import { Request, Response } from 'express';
import { reliabilityService } from '../services/reliability.service';
import { logger } from '../utils/logger';

export const getGuidelines = async (req: Request, res: Response) => {
  try {
    const guidelines = {
      description: "Pabandi uses the Global Trust Protocol, an industry-agnostic Elo-based scoring algorithm.",
      baseSwing: 25,
      scoreRange: "0-100",
      contextWeights: {
        "Casual/Standard": 1.0,
        "Premium Event": 1.2,
        "High-Stakes (Medical/B2B)": 2.0
      },
      outcomes: {
        "Completed": "Expected (+)",
        "Late Cancel": "Penalized (-), but better than ghosting",
        "No Show": "Severely Penalized (--)"
      },
      philosophy: "Trust is earned. High scores are hard to maintain, but low scores can be quickly redeemed by demonstrating consistent reliability."
    };

    res.json({
      success: true,
      data: guidelines
    });

  } catch (error) {
    logger.error('Error fetching reliability guidelines:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch guidelines' });
  }
};

export const getHistory = async (req: Request, res: Response) => {
  try {
    // For now, we return a mocked receipt since we don't persist them in the DB yet
    // In production, we would query a 'ScoreReceipt' table by req.user.userId
    const mockReceipt = {
      id: "receipt_1234",
      date: new Date().toISOString(),
      previousScore: 85,
      newScore: 86.5,
      totalChange: 1.5,
      reasoning: "Attendance expected due to Elite status. Included +0 streak bonus."
    };

    res.json({
      success: true,
      data: [mockReceipt]
    });

  } catch (error) {
    logger.error('Error fetching reliability history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
};
