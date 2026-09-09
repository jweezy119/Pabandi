import { Response, NextFunction, Request } from 'express';
import { prisma } from '../utils/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';
import { cryptoService } from '../services/cryptoService';
import { logger } from '../utils/logger';

// Sitara OS: Star Power tier thresholds
export const STAR_TIER_POINTS = {
  'tara': { min: 0, name: 'Tara', nameUrdu: 'تارا', color: 'from-slate-400 to-slate-500' },
  'sitara-e-noor': { min: 100, name: 'Sitara-e-Noor', nameUrdu: 'ستارہ نور', color: 'from-blue-400 to-blue-500' },
  'sitara-e-roshan': { min: 500, name: 'Sitara-e-Roshan', nameUrdu: 'ستارہ روشن', color: 'from-amber-400 to-yellow-500' },
  'sitara-e-darakshan': { min: 2000, name: 'Sitara-e-Darakshan', nameUrdu: 'ستارہ درخشاں', color: 'from-purple-400 via-pink-500 to-rose-500' },
  'sitara-e-izzat': { min: 10000, name: 'Sitara-e-Izzat', nameUrdu: 'ستارہ عزت', color: 'from-yellow-300 via-orange-400 to-red-500' },
} as const;

export const STAR_TIER_ORDER = ['tara', 'sitara-e-noor', 'sitara-e-roshan', 'sitara-e-darakshan', 'sitara-e-izzat'] as const;

export function calculateStarTier(points: number): keyof typeof STAR_TIER_POINTS {
  for (let i = STAR_TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = STAR_TIER_ORDER[i];
    if (points >= STAR_TIER_POINTS[tier].min) {
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
export const createReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { businessId, reservationId, rating, text } = req.body;
    const customerId = req.user!.id;

    if (!businessId || !reservationId || !rating) {
      throw new CustomError('Missing required fields', 400);
    }

    if (rating < 1 || rating > 5) {
      throw new CustomError('Rating must be 1-5', 400);
    }

    // 1. Verify reservation belongs to user and is COMPLETED (checked in + checked out)
    const reservation = await prisma.reservation.findUnique({
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
      throw new CustomError('Reservation not found', 404);
    }

    if (reservation.customerId !== customerId) {
      throw new CustomError('This reservation does not belong to you', 403);
    }

    if (reservation.businessId !== businessId) {
      throw new CustomError('Reservation does not match business', 400);
    }

    // Must have checked in (check-in verification required for review eligibility)
    if (!reservation.checkInDate || reservation.status !== 'COMPLETED') {
      throw new CustomError('Reservation must be completed to leave a review', 400);
    }

    // Check for duplicate review
    const existing = await prisma.pabandiReview.findUnique({
      where: { reservationId },
    });

    if (existing) {
      throw new CustomError('Review already exists for this reservation', 409);
    }

    // 2. Calculate star points
    // Base: rating * 10, verified check-in bonus: +10
    const starPoints = rating * 10 + 10;

    // 3. Create the review with star points
    const review = await prisma.pabandiReview.create({
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
      await cryptoService.rewardGoogleReview(customerId, businessId, reservationId);
    } catch (e: any) {
      logger.warn(`PAB reward failed for review ${review.id}: ${e.message}`);
    }

    res.status(201).json({
      success: true,
      data: { review, starPoints },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/reviews/:id/upvote
 * Upvote a review. Only users with a verified check-in at the same business can upvote.
 * Each upvote = 5 star power points to the reviewer.
 */
export const upvoteReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: reviewId } = req.params;
    const voterId = req.user!.id;

    // Find the review
    const review = await prisma.pabandiReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        businessId: true,
        customerId: true,
        upvoteCount: true,
      },
    });

    if (!review) {
      throw new CustomError('Review not found', 404);
    }

    // You can't upvote your own review
    if (review.customerId === voterId) {
      throw new CustomError('Cannot upvote your own review', 400);
    }

    // Verify the voter has a verified check-in at this business
    const voterReservation = await prisma.reservation.findFirst({
      where: {
        customerId: voterId,
        businessId: review.businessId,
        status: 'COMPLETED',
        checkInDate: { not: null },
      },
    });

    if (!voterReservation) {
      throw new CustomError('Only verified customers who checked in at this business can upvote', 403);
    }

    // Create the upvote (transaction handles dedup via @@unique)
    await prisma.pabandiReviewUpvote.create({
      data: {
        reviewId: review.id,
        voterId,
      },
    });

    // Increment upvote count on the review
    const updatedReview = await prisma.pabandiReview.update({
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
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new CustomError('You have already upvoted this review', 409);
    }
    next(error);
  }
};

/**
 * GET /api/v1/reviews/:id/upvotes
 * Get upvotes on a review
 */
export const getReviewUpvotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const upvotes = await prisma.pabandiReviewUpvote.findMany({
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
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/star-power/:userId
 * Get a user's Star Power profile
 */
export const getStarPower = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const starPower = await prisma.starPower.findUnique({
      where: { userId },
    });

    if (!starPower) {
      throw new CustomError('Star Power not found for user', 404);
    }

    const tier = calculateStarTier(starPower.totalPoints);
    const tierInfo = STAR_TIER_POINTS[tier];

    // Get recent reviews for verification
    const recentReviews = await prisma.pabandiReview.findMany({
      where: { customerId: userId },
      include: {
        business: { select: { name: true, rating: true, reviewCount: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get upvote count (reviews the user wrote + upvotes received)
    const upvotesReceived = await prisma.pabandiReviewUpvote.count({
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
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/star-power/business/:businessId
 * Get Star Power leaderboard for a business's reviewers
 */
export const getBusinessStarLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const { limit = '20', tier } = req.query;

    // Aggregate per-customer from their reviews at this business,
    // joining each customer's StarPower + cached tier.
    const reviews = await prisma.pabandiReview.findMany({
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

    const byCustomer = new Map<string, { user: any; totalPoints: number; reviews: { rating: number }[] }>();
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
      const userTier = (entry.user.starPowerTier || calculateStarTier(entry.totalPoints)) as keyof typeof STAR_TIER_POINTS;
      const tierInfo = STAR_TIER_POINTS[userTier];
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
  } catch (error) {
    next(error);
  }
};

// ── Helper: Update Star Power for a user
async function updateStarPower(userId: string, points: number, reason: string): Promise<void> {
  const updated = await prisma.starPower.upsert({
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
  await prisma.user.update({
    where: { id: userId },
    data: {
      starPowerTier: newTier,
      starPowerPoints: updated.totalPoints,
    },
  });

  logger.info(`[StarPower] User ${userId} ${reason}: +${points} pts (total: ${updated.totalPoints}, tier: ${newTier})`);
}
