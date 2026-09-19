import { Request, Response, NextFunction } from 'express';
import { compoundingService } from '../services/compounding.service';

export const getCompoundReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = compoundingService.getReport();
    res.json({ success: true, report });
  } catch (err) { next(err); }
};

export const addCapital = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;
    compoundingService.addCapital(amount);
    res.json({ success: true, newReserve: compoundingService.getCurrentSettings().reserve });
  } catch (err) { next(err); }
};

export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = compoundingService.getCurrentSettings();
    res.json({ success: true, settings });
  } catch (err) { next(err); }
};
