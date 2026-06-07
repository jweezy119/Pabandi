import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { cryptoService } from '../services/cryptoService';
import { CustomError } from '../middleware/errorHandler';
import { prisma } from '../utils/database';

export const getMyWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await cryptoService.getWalletData(req.user!.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getBusinessRewards = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'BUSINESS_OWNER' && req.user!.role !== 'ADMIN') {
      throw new CustomError('Business account required', 403);
    }
    const data = await cryptoService.getBusinessRewardsSummary(req.user!.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getRewardRules = async (_req: Request, res: Response) => {
  res.json({ success: true, data: cryptoService.getPublicRewardRules() });
};

export const connectSolanaWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { address } = req.body;
    if (!address || typeof address !== 'string' || address.length < 32) {
      throw new CustomError('Valid Solana wallet address is required', 400);
    }
    const wallet = await cryptoService.connectSolanaWallet(req.user!.id, address.trim());
    res.json({
      success: true,
      message: 'Solana wallet connected for $PAB payouts',
      data: { address: wallet.address, chain: 'solana' },
    });
  } catch (error) {
    next(error);
  }
};

export const requestSolanaTransfer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
    if (!wallet?.address || wallet.currency !== 'SOL') {
      throw new CustomError('Connect a Phantom (Solana) wallet first', 400);
    }
    const transferAmount = Number(amount) || wallet.balance;
    if (transferAmount <= 0 || transferAmount > wallet.balance) {
      throw new CustomError('Invalid transfer amount', 400);
    }

    // On-chain SPL transfer requires treasury + mint; queue for processing.
    await prisma.cryptoReward.create({
      data: {
        userId: req.user!.id,
        amount: -transferAmount,
        type: 'SOLANA_TRANSFER_REQUEST',
        status: 'PENDING',
        txHash: null,
      },
    });

    res.json({
      success: true,
      message: 'Transfer queued. $PAB will be sent to your Solana wallet shortly.',
      data: {
        to: wallet.address,
        amount: transferAmount,
        chain: 'solana',
        status: 'pending',
      },
    });
  } catch (error) {
    next(error);
  }
};
