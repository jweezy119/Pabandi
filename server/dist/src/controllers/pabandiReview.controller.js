"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replyToReview = exports.getBusinessStarLeaderboard = exports.getStarPower = exports.getReviewUpvotes = exports.upvoteReview = exports.createReview = exports.STAR_TIER_ORDER = exports.STAR_TIER_POINTS = void 0;
exports.calculateStarTier = calculateStarTier;
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const cryptoService_1 = require("../services/cryptoService");
const logger_1 = require("../utils/logger");
// Sitara OS: Star Power tier thresholds
exports.STAR_TIER_POINTS = {
    'tara': { min: 0, name: 'Tara', nameUrdu: 'تارا', color: 'from-slate-400 to-slate-500' },
    'sitara-e-noor': { min: 100, name: 'Sitara-e-Noor', nameUrdu: 'ستارہ نور', color: 'from-blue-400 to-blue-500' },
    'sitara-e-roshan': { min: 500, name: 'Sitara-e-Roshan', nameUrdu: 'ستارہ روشن', color: 'from-amber-400 to-yellow-500' },
    'sitara-e-darakshan': { min: 2000, name: 'Sitara-e-Darakshan', nameUrdu: 'ستارہ درخشاں', color: 'from-purple-400 via-pink-500 to-rose-500' },
    'sitara-e-izzat': { min: 10000, name: 'Sitara-e-Izzat', nameUrdu: 'ستارہ عزت', color: 'from-yellow-300 via-orange-400 to-red-500' },
};
exports.STAR_TIER_ORDER = ['tara', 'sitara-e-noor', 'sitara-e-roshan', 'sitara-e-darakshan', 'sitara-e-izzat'];
function calculateStarTier(points) {
    for (let i = exports.STAR_TIER_ORDER.length - 1; i >= 0; i--) {
        const tier = exports.STAR_TIER_ORDER[i];
        if (points >= exports.STAR_TIER_POINTS[tier].min) {
            return tier;
        }
    }
    return 'tara';
}
/**
 * POST /api/v1/reviews
 * Create a verified review after check-in.
 * Awards star points: rating * 10 + 10 bonus for verified check-in.
 * Also credits $PAB: 200 per review (matches existing cryptoService rules).
 */
const createReview = async (req, res, next) => {
    try {
        const { businessId, reservationId, rating, text } = req.body;
        const customerId = req.user.id;
        if (!businessId || !reservationId || !rating) {
            throw new errorHandler_1.CustomError('Missing required fields', 400);
        }
        if (rating < 1 || rating > 5) {
            throw new errorHandler_1.CustomError('Rating must be 1-5', 400);
        }
        // 1. Verify reservation belongs to user and is COMPLETED (checked in + checked out)
        const reservation = await database_1.prisma.reservation.findUnique({
            where: { id: reservationId },
            select: {
                customerId: true,
                businessId: true,
                status: true,
                checkInDate: true,
                checkOutDate: true,
            },
        });
        if (!reservation) {
            throw new errorHandler_1.CustomError('Reservation not found', 404);
        }
        if (reservation.customerId !== customerId) {
            throw new errorHandler_1.CustomError('This reservation does not belong to you', 403);
        }
        if (reservation.businessId !== businessId) {
            throw new errorHandler_1.CustomError('Reservation does not match business', 400);
        }
        // Must have checked in (check-in verification required for review eligibility)
        if (!reservation.checkInDate || reservation.status !== 'COMPLETED') {
            throw new errorHandler_1.CustomError('Reservation must be completed to leave a review', 400);
        }
        // Check for duplicate review
        const existing = await database_1.prisma.pabandiReview.findUnique({
            where: { reservationId },
        });
        if (existing) {
            throw new errorHandler_1.CustomError('Review already exists for this reservation', 409);
        }
        // 2. Calculate star points
        // Base: rating * 10, verified check-in bonus: +10
        const starPoints = rating * 10 + 10;
        // 3. Create the review with star points
        const review = await database_1.prisma.pabandiReview.create({
            data: {
                businessId,
                customerId,
                reservationId,
                rating,
                text,
                starPoints,
            },
        });
        // 4. Update user's Star Power
        await updateStarPower(customerId, starPoints, 'review_created');
        // 5. Credit $PAB rewards (200 per verified review per existing rules)
        try {
            await cryptoService_1.cryptoService.rewardGoogleReview(customerId, businessId, reservationId);
        }
        catch (e) {
            logger_1.logger.warn(`PAB reward failed for review ${review.id}: ${e.message}`);
        }
        // 6. The business EARNS this star: recompute verified rating + trust.
        // Sitara stars come only from verified visits — never from anonymous ratings.
        try {
            const agg = await database_1.prisma.pabandiReview.aggregate({
                where: { businessId },
                _avg: { rating: true },
                _count: { rating: true },
            });
            const verifiedAvg = agg._avg.rating ?? rating;
            const verifiedCount = agg._count.rating ?? 1;
            const trustDelta = rating >= 5 ? 1 : rating === 4 ? 0.5 : rating === 3 ? 0.1 : rating === 2 ? -0.5 : -1;
            const biz = await database_1.prisma.business.findUnique({
                where: { id: businessId },
                select: { trustScore: true },
            });
            const trustScore = Math.min(99, Math.max(5, (biz?.trustScore ?? 50) + trustDelta));
            await database_1.prisma.business.update({
                where: { id: businessId },
                data: { rating: verifiedAvg, reviewCount: verifiedCount, trustScore },
            });
            logger_1.logger.info(`[stars] Business ${businessId} earned ★${rating} (avg ${verifiedAvg.toFixed(2)} over ${verifiedCount}, trust ${trustScore.toFixed(1)})`);
        }
        catch (e) {
            logger_1.logger.warn(`Business star update failed for review ${review.id}: ${e.message}`);
        }
        res.status(201).json({
            success: true,
            data: { review, starPoints },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createReview = createReview;
/**
 * POST /api/v1/reviews/:id/upvote
 * Upvote a review. Only users with a verified check-in at the same business can upvote.
 * Each upvote = 5 star power points to the reviewer.
 */
const upvoteReview = async (req, res, next) => {
    try {
        const { id: reviewId } = req.params;
        const voterId = req.user.id;
        // Find the review
        const review = await database_1.prisma.pabandiReview.findUnique({
            where: { id: reviewId },
            select: {
                id: true,
                businessId: true,
                customerId: true,
                upvoteCount: true,
            },
        });
        if (!review) {
            throw new errorHandler_1.CustomError('Review not found', 404);
        }
        // You can't upvote your own review
        if (review.customerId === voterId) {
            throw new errorHandler_1.CustomError('Cannot upvote your own review', 400);
        }
        // Verify the voter has a verified check-in at this business
        const voterReservation = await database_1.prisma.reservation.findFirst({
            where: {
                customerId: voterId,
                businessId: review.businessId,
                status: 'COMPLETED',
                checkInDate: { not: null },
            },
        });
        if (!voterReservation) {
            throw new errorHandler_1.CustomError('Only verified customers who checked in at this business can upvote', 403);
        }
        // Create the upvote (transaction handles dedup via @@unique)
        await database_1.prisma.pabandiReviewUpvote.create({
            data: {
                reviewId: review.id,
                voterId,
            },
        });
        // Increment upvote count on the review
        const updatedReview = await database_1.prisma.pabandiReview.update({
            where: { id: review.id },
            data: { upvoteCount: { increment: 1 } },
        });
        // Award 5 star power points to the reviewer for each upvote
        await updateStarPower(review.customerId, 5, 'upvote_received');
        // Award 2 star power points to the voter for participating
        await updateStarPower(voterId, 2, 'upvote_given');
        res.json({
            success: true,
            data: updatedReview,
        });
    }
    catch (error) {
        if (error.code === 'P2002') {
            throw new errorHandler_1.CustomError('You have already upvoted this review', 409);
        }
        next(error);
    }
};
exports.upvoteReview = upvoteReview;
/**
 * GET /api/v1/reviews/:id/upvotes
 * Get upvotes on a review
 */
const getReviewUpvotes = async (req, res, next) => {
    try {
        const upvotes = await database_1.prisma.pabandiReviewUpvote.findMany({
            where: { reviewId: req.params.id },
            select: {
                id: true,
                voterId: true,
                createdAt: true,
                voter: { select: { firstName: true, lastName: true, profilePictureUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: upvotes });
    }
    catch (error) {
        next(error);
    }
};
exports.getReviewUpvotes = getReviewUpvotes;
/**
 * GET /api/v1/star-power/:userId
 * Get a user's Star Power profile
 */
const getStarPower = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const starPower = await database_1.prisma.starPower.findUnique({
            where: { userId },
        });
        if (!starPower) {
            throw new errorHandler_1.CustomError('Star Power not found for user', 404);
        }
        const tier = calculateStarTier(starPower.totalPoints);
        const tierInfo = exports.STAR_TIER_POINTS[tier];
        // Get recent reviews for verification
        const recentReviews = await database_1.prisma.pabandiReview.findMany({
            where: { customerId: userId },
            include: {
                business: { select: { name: true, rating: true, reviewCount: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        // Get upvote count (reviews the user wrote + upvotes received)
        const upvotesReceived = await database_1.prisma.pabandiReviewUpvote.count({
            where: { review: { customerId: userId } },
        });
        res.json({
            success: true,
            data: {
                ...starPower,
                tier,
                tierName: tierInfo.name,
                tierNameUrdu: tierInfo.nameUrdu,
                tierColor: tierInfo.color,
                reviews: recentReviews,
                upvotesReceived,
                // For the Star Card UI
                starCard: {
                    totalPoints: starPower.totalPoints,
                    currentTier: tier,
                    tierName: tierInfo.name,
                    verifiedCheckIns: recentReviews.length,
                    upvotesReceived,
                    reliabilityScore: 0, // will come from user profile
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getStarPower = getStarPower;
/**
 * GET /api/v1/star-power/business/:businessId
 * Get Star Power leaderboard for a business's reviewers
 */
const getBusinessStarLeaderboard = async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const { limit = '20', tier } = req.query;
        // Aggregate per-customer from their reviews at this business,
        // joining each customer's StarPower + cached tier.
        const reviews = await database_1.prisma.pabandiReview.findMany({
            where: { businessId: String(businessId) },
            include: {
                customer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        profilePictureUrl: true,
                        starPowerTier: true,
                        starPowerPoints: true,
                        starPower: { select: { totalPoints: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });
        const byCustomer = new Map();
        for (const r of reviews) {
            const entry = byCustomer.get(r.customerId) ?? {
                user: r.customer,
                totalPoints: r.customer.starPower?.totalPoints ?? r.customer.starPowerPoints ?? 0,
                reviews: [],
            };
            entry.reviews.push({ rating: r.rating });
            byCustomer.set(r.customerId, entry);
        }
        let leaderboard = [...byCustomer.values()].map(entry => {
            const userTier = (entry.user.starPowerTier || calculateStarTier(entry.totalPoints));
            const tierInfo = exports.STAR_TIER_POINTS[userTier];
            return {
                userId: entry.user.id,
                user: entry.user,
                totalPoints: entry.totalPoints,
                tier: userTier,
                tierName: tierInfo.name,
                tierNameUrdu: tierInfo.nameUrdu,
                tierColor: tierInfo.color,
                reviewCount: entry.reviews.length,
                avgRating: entry.reviews.length > 0
                    ? entry.reviews.reduce((sum, r) => sum + r.rating, 0) / entry.reviews.length
                    : 0,
            };
        });
        // Filter by tier if provided (Prisma can't filter by computed tier)
        if (tier && tier !== 'all') {
            leaderboard = leaderboard.filter(e => e.tier === tier);
        }
        leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
        const limited = leaderboard.slice(0, Number(limit));
        res.json({ success: true, data: limited });
    }
    catch (error) {
        next(error);
    }
};
exports.getBusinessStarLeaderboard = getBusinessStarLeaderboard;
// ── Helper: Update Star Power for a user
async function updateStarPower(userId, points, reason) {
    const updated = await database_1.prisma.starPower.upsert({
        where: { userId },
        update: {
            totalPoints: { increment: points },
            lastUpdated: new Date(),
        },
        create: {
            userId,
            totalPoints: points,
        },
    });
    // Also update cached fields on User for fast lookups
    const newTier = calculateStarTier(updated.totalPoints);
    await database_1.prisma.user.update({
        where: { id: userId },
        data: {
            starPowerTier: newTier,
            starPowerPoints: updated.totalPoints,
        },
    });
    logger_1.logger.info(`[StarPower] User ${userId} ${reason}: +${points} pts (total: ${updated.totalPoints}, tier: ${newTier})`);
}
/**
 * POST /api/v1/reviews/:id/reply
 * Business owner responds publicly to a verified review (Yelp-style).
 * Only the owning business may reply, once or updated.
 */
const replyToReview = async (req, res, next) => {
    try {
        const { id: reviewId } = req.params;
        const { text } = req.body || {};
        if (!text || !String(text).trim()) {
            throw new errorHandler_1.CustomError('Reply text is required', 400);
        }
        if (String(text).length > 1000) {
            throw new errorHandler_1.CustomError('Reply must be under 1000 characters', 400);
        }
        const review = await database_1.prisma.pabandiReview.findUnique({
            where: { id: reviewId },
            select: { id: true, businessId: true },
        });
        if (!review) {
            throw new errorHandler_1.CustomError('Review not found', 404);
        }
        const owned = await database_1.prisma.business.findFirst({
            where: { id: review.businessId, ownerId: req.user.id },
            select: { id: true },
        });
        if (!owned) {
            throw new errorHandler_1.CustomError('Only the business owner can reply', 403);
        }
        const updated = await database_1.prisma.pabandiReview.update({
            where: { id: reviewId },
            data: { ownerReply: String(text).trim(), ownerRepliedAt: new Date() },
        });
        res.json({ success: true, data: { id: updated.id, ownerReply: updated.ownerReply, ownerRepliedAt: updated.ownerRepliedAt } });
    }
    catch (error) {
        next(error);
    }
};
exports.replyToReview = replyToReview;
//# sourceMappingURL=pabandiReview.controller.js.map