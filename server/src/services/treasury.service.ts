import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export type TreasuryBucket = 'OPERATING' | 'TREASURY' | 'LP_PROVISION' | 'YIELD_REINVEST' | 'EMERGENCY';

export const TREASURY_BUCKETS: readonly TreasuryBucket[] = [
  'OPERATING',
  'TREASURY',
  'LP_PROVISION',
  'YIELD_REINVEST',
  'EMERGENCY',
] as const;

export const recordTribute = async (params: {
  amount: number;
  bucket: TreasuryBucket;
  txHash?: string;
  meta?: Record<string, any>;
}): Promise<{ id: string }> => {
  const { amount, bucket, txHash, meta } = params;

  if (!TREASURY_BUCKETS.includes(bucket)) {
    throw new Error(`Invalid treasury bucket: ${bucket}`);
  }

  const result = await prisma.treasuryPosition.create({
    data: {
      bucket,
      amount,
      txHash: txHash || null,
      status: 'PENDING',
      meta: meta || undefined,
    },
    select: {
      id: true,
    },
  });

  logger.info?.(`[Treasury] tribute recorded`, { bucket, amount, txHash });
  return result;
};

export const getTreasurySummary = async (): Promise<{
  total: number;
  byBucket: Record<string, number>;
}> => {
  const positions = await prisma.treasuryPosition.findMany({
    select: {
      bucket: true,
      amount: true,
    },
  });

  const byBucket: Record<string, number> = {};
  let total = 0;

  for (const position of positions) {
    const amount = Number(position.amount || 0);
    byBucket[position.bucket] = (byBucket[position.bucket] || 0) + amount;
    total += amount;
  }

  return { total, byBucket };
};
