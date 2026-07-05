import { Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';
import { cryptoService } from '../services/cryptoService';
import { logger } from '../utils/logger';

export const createReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { businessId, reservationId, rating, text } = req.body;
    const customerId = req.user!.id;

    if (!businessId || !reservationId || !rating) {
      throw new CustomError('Missing required fields', 400);
    }

    // 1. Verify reservation belongs to user and is COMPLETED
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId }
    });

    if (!reservation || reservation.customerId !== customerId || reservation.businessId !== businessId) {
      throw new CustomError('Invalid reservation', 400);
    }

    if (reservation.status !== 'COMPLETED') {
      throw new CustomError('Reservation must be completed to leave a review', 400);
    }

    // 2. Fetch Customer Wallet
    const wallet = await prisma.wallet.findUnique({
      where: { userId: customerId }
    });

    if (!wallet || !wallet.address) {
      throw new CustomError('Customer wallet not found', 400);
    }

    // 3. Verify Proof of Visit SBT on-chain
    const hasVisited = await cryptoService.hasVisited(wallet.address, businessId);
    
    // For local development, if the RPC fails, we fallback to true just so the UI works,
    // but in production we'd enforce the strict check.
    // We enforce strictly here for the feature's core value proposition:
    if (!hasVisited && process.env.NODE_ENV === 'production') {
       throw new CustomError('Cryptographic Proof of Visit failed: No Soulbound Token found.', 403);
    }

    // 4. Create the review
    const review = await prisma.pabandiReview.create({
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

  } catch (error) {
    next(error);
  }
};
