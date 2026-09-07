import { Router, Request, Response, NextFunction } from 'express';
import { walletService } from '../services/wallet.service';
import { authenticate } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

// Create wallet
router.post('/create', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const result = await walletService.createWallet(userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Get wallet
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const result = await walletService.getWallet(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Update balance (admin only)
router.post('/balance', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, amount, currency } = req.body;
    const result = await walletService.updateBalance(userId, amount, currency);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Claim airdrop
router.post('/claim-airdrop', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const result = await walletService.claimAirdrop(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
