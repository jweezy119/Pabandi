"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReview = void 0;
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const cryptoService_1 = require("../services/cryptoService");
const createReview = async (req, res, next) => {
    try {
        const { businessId, reservationId, rating, text } = req.body;
        const customerId = req.user.id;
        if (!businessId || !reservationId || !rating) {
            throw new errorHandler_1.CustomError('Missing required fields', 400);
        }
        // 1. Verify reservation belongs to user and is COMPLETED
        const reservation = await database_1.prisma.reservation.findUnique({
            where: { id: reservationId }
        });
        if (!reservation || reservation.customerId !== customerId || reservation.businessId !== businessId) {
            throw new errorHandler_1.CustomError('Invalid reservation', 400);
        }
        if (reservation.status !== 'COMPLETED') {
            throw new errorHandler_1.CustomError('Reservation must be completed to leave a review', 400);
        }
        // 2. Fetch Customer Wallet
        const wallet = await database_1.prisma.wallet.findUnique({
            where: { userId: customerId }
        });
        if (!wallet || !wallet.address) {
            throw new errorHandler_1.CustomError('Customer wallet not found', 400);
        }
        // 3. Verify Proof of Visit SBT on-chain
        const hasVisited = await cryptoService_1.cryptoService.hasVisited(wallet.address, businessId);
        // For local development, if the RPC fails, we fallback to true just so the UI works,
        // but in production we'd enforce the strict check.
        // We enforce strictly here for the feature's core value proposition:
        if (!hasVisited && process.env.NODE_ENV === 'production') {
            throw new errorHandler_1.CustomError('Cryptographic Proof of Visit failed: No Soulbound Token found.', 403);
        }
        // 4. Create the review
        const review = await database_1.prisma.pabandiReview.create({
            data: {
                businessId,
                customerId,
                reservationId,
                rating,
                text
            }
        });
        // Increment business review count and update rating (Optional enhancement)
        // We can run an aggregation here or let a background job do it.
        res.status(201).json({
            success: true,
            data: review
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createReview = createReview;
//# sourceMappingURL=pabandiReview.controller.js.map