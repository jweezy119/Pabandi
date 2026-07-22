import { Response } from 'express';
import { recordTribute, getTreasurySummary } from '../services/treasury.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export const createTribute = async (req: any, res: Response) => {
  try {
    const { amount, bucket, txHash, meta } = req.body;
    const result = await recordTribute({ amount, bucket, txHash, meta });
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error creating treasury tribute:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to create treasury tribute' });
  }
};

export const getSummary = async (req: any, res: Response) => {
  try {
    const summary = await getTreasurySummary();
    const recentPositions = await prisma.treasuryPosition.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, bucket: true, amount: true, status: true, createdAt: true },
    });
    res.json({ success: true, data: { ...summary, recentPositions } });
  } catch (error: any) {
    logger.error('Error fetching treasury summary:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch treasury summary' });
  }
};
