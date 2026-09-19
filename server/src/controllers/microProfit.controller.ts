import { Request, Response, NextFunction } from 'express';
import { microProfitEngine } from '../services/microProfitEngine.service';

export const simulateDeployment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startingUsd = parseFloat(req.query.usd as string) || 25;
    const solBalance = parseFloat(req.query.sol as string) || 0.50;
    const simulation = (microProfitEngine.constructor as any).simulateDeployment(startingUsd, solBalance);
    res.json({ success: true, simulation });
  } catch (err) { next(err); }
};

export const getOptimalConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const capital = parseFloat(req.query.capital as string) || 25;
    const batchSize = microProfitEngine.getOptimalBatchSize(capital);
    const taskValue = microProfitEngine.getOptimalTaskValue(capital);
    const usdPerCycle = batchSize * taskValue;
    const cyclesPerDay = Math.max(1, Math.floor(25 / (capital / 25)));
    res.json({
      success: true,
      config: {
        capital,
        batchSize,
        taskValue,
        usdPerCycle,
        cyclesPerDay,
        estimatedDailyRevenue: (usdPerCycle * 0.02 - 0.00025) * cyclesPerDay,
      },
    });
  } catch (err) { next(err); }
};
