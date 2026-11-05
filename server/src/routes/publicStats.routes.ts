import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

interface CachedStats {
  data: {
    businesses: number;
    escrowedUsd: number;
    bookingsProtected: number;
    updatedAt: string;
  };
  cachedAt: number;
}

let statsCache: CachedStats | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * GET /api/v1/public/stats
 * Real aggregated platform stats, cached for 10 minutes to avoid DB load.
 * Unauthenticated and safe for landing page metrics.
 */
router.get('/', async (_req: Request, res: Response) => {
  const now = Date.now();
  if (statsCache && now - statsCache.cachedAt < CACHE_TTL_MS) {
    return res.json({ success: true, data: statsCache.data, cached: true });
  }

  try {
    const [businessesCount, universalEscrowAggregate, solanaEscrowAggregate, bookingsCount] =
      await Promise.all([
        prisma.business.count().catch(() => 0),
        prisma.universalEscrow
          .aggregate({
            _sum: { amount: true },
            where: { status: { in: ['funded', 'in_progress', 'conditions_met', 'released'] } },
          })
          .catch(() => ({ _sum: { amount: 0 } })),
        prisma.solanaEscrow
          .aggregate({
            _sum: { amount: true },
            where: { status: { in: ['FUNDED', 'RELEASED', 'COMPLETED'] } },
          })
          .catch(() => ({ _sum: { amount: 0 } })),
        prisma.booking
          .count({
            where: { depositStatus: { in: ['funded', 'refunded', 'forfeited'] } },
          })
          .catch(() => 0),
      ]);

    const totalEscrowUsd =
      Math.round(
        ((universalEscrowAggregate._sum.amount || 0) + (solanaEscrowAggregate._sum.amount || 0)) *
          100,
      ) / 100;

    const data = {
      businesses: businessesCount,
      escrowedUsd: totalEscrowUsd,
      bookingsProtected: bookingsCount,
      updatedAt: new Date().toISOString(),
    };

    statsCache = {
      data,
      cachedAt: now,
    };

    return res.json({ success: true, data, cached: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[PublicStats] Failed to compute stats:', message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve stats' });
  }
});

export default router;
