import { Request, Response, NextFunction } from 'express';
import { singleWalletTreasury } from '../services/singleWalletTreasury.service';

export const fundWallet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amountUsd, txHash, note } = req.body;
    const result = await singleWalletTreasury.fundWallet({ amountUsd, txHash, note });
    res.json(result);
  } catch (err) { next(err); }
};

export const getBreakdown = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const breakdown = await singleWalletTreasury.getFullBreakdown();
    res.json({ success: true, breakdown });
  } catch (err) { next(err); }
};

export const recycleProfits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amountUsd, txHash } = req.body;
    const result = await singleWalletTreasury.recycleProfitsToOperating({ amountUsd, txHash });
    res.json(result);
  } catch (err) { next(err); }
};

export const getWalletAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = singleWalletTreasury.getPlatformWalletAddress();
    res.json({ success: true, platformWallet: address });
  } catch (err) { next(err); }
};

export const allocateToReserve = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amountUsd, txHash } = req.body;
    const result = await singleWalletTreasury.allocateToReserve({ amountUsd, txHash });
    res.json(result);
  } catch (err) { next(err); }
};
