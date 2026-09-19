import { Request, Response, NextFunction } from 'express';
import { settlementService } from '../services/settlement.service';

export const runSettlement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await settlementService.runSettlement();
    res.json({ success: true, result });
  } catch (err) { next(err); }
};

export const getSettlementStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, settlement: { intervalMs: 60 * 60 * 1000 } });
  } catch (err) { next(err); }
};
