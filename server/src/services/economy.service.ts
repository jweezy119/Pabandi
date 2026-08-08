import { prisma } from '../utils/database';
import { getTreasurySummary } from './treasury.service';
import { logger } from '../utils/logger';

/**
 * Aggregates real on-chain + simulated $PAB circulation from persisted
 * AgentTransaction rows + treasury accrual positions.
 * This is the single source of truth for the public Economy dashboard.
 */
export const getEconomyStats = async (): Promise<{
  bookings: number;
  feesCollected: number;
  burned: number;
  rewardsPaid: number;
  poolFees: number;
  walletsFunded: number;
  accrual: { total: number; byBucket: Record<string, number> };
  lastRunAt: string | null;
}> => {
  try {
    const [txAgg, poolAgg, wallets, lastBurn] = await Promise.all([
      prisma.agentTransaction.groupBy({
        by: ['type'],
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.agentTransaction.aggregate({
        where: { type: 'POOL_FEE' },
        _sum: { amount: true },
      }),
      prisma.web3Agent.count({ where: { isActive: true } }),
      prisma.agentTransaction.findFirst({
        where: { type: 'BURN' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const byType: Record<string, { sum: number; count: number }> = {};
    for (const row of txAgg) {
      byType[row.type] = { sum: Number(row._sum.amount || 0), count: row._count.id };
    }

    const bookings = byType['BOOKING_PAYMENT']?.count ?? 0;
    const feesCollected = byType['FEE_COLLECTION']?.sum ?? 0;
    const burned = byType['BURN']?.sum ?? 0;
    const rewardsPaid = byType['BOOKING_PAYMENT']?.sum ?? 0;
    const poolFees = Number(poolAgg._sum.amount || 0);

    const accrual = await getTreasurySummary();

    return {
      bookings,
      feesCollected,
      burned,
      rewardsPaid,
      poolFees,
      walletsFunded: wallets,
      accrual: { total: accrual.total, byBucket: accrual.byBucket },
      lastRunAt: lastBurn?.createdAt?.toISOString() ?? null,
    };
  } catch (err: any) {
    logger.error('[Economy] stats aggregation failed:', err.message);
    return {
      bookings: 0, feesCollected: 0, burned: 0, rewardsPaid: 0,
      poolFees: 0, walletsFunded: 0,
      accrual: { total: 0, byBucket: {} }, lastRunAt: null,
    };
  }
};
