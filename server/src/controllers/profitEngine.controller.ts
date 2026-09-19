import { Request, Response, NextFunction } from 'express';
import { profitEngine } from '../services/profitEngine.service';

export const getProfitReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = profitEngine.getReport();
    res.json({ success: true, report });
  } catch (err) { next(err); }
};

export const runManualCycle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await profitEngine.runCycle();
    res.json({ success: true, result });
  } catch (err) { next(err); }
};

export const getArbitrageStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const arb = await profitEngine.checkArbitrageOpportunity();
    res.json({ success: true, arbitrage: arb });
  } catch (err) { next(err); }
};

export const getSettlementSpeed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const speed = profitEngine.getSettlementSpeed();
    res.json({ success: true, settlement: speed });
  } catch (err) { next(err); }
};

export const getLearningLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      learning: {
        feeRate: (profitEngine as any).feeRate,
        avgCycleTime: (profitEngine as any).getAvgCycleTime ? (profitEngine as any).getAvgCycleTime() : 0,
        cycleCount: (profitEngine as any).cycleCount,
        adjustments: (profitEngine as any).cycleTimes?.length || 0,
      },
    });
  } catch (err) { next(err); }
};
