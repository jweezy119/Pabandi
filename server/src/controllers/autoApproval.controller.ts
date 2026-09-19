import { Request, Response, NextFunction } from 'express';
import { autoApproval } from '../services/autoApproval.service';
import { prisma } from '../utils/database';

export const getAutoApprovalStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const enabled = autoApproval.isEnabled();
    const address = autoApproval.getPlatformAddress();
    res.json({ success: true, enabled, platformWallet: address });
  } catch (err) { next(err); }
};

export const getPlatformBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await autoApproval.getFullBalance();
    res.json({ success: true, balance });
  } catch (err) { next(err); }
};

export const autoTransfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { toWallet, amountUsdc, referenceId } = req.body;
    const result = await autoApproval.autoTransfer({ toWallet, amountUsdc, referenceId });
    if (result.success && result.txHash) {
      // Record in treasury
      await prisma.usdcTransfer.create({
        data: {
          fromWallet: autoApproval.getPlatformAddress(),
          toWallet,
          amountUsdc,
          txHash: result.txHash,
          type: 'AGENT_PAYMENT',
          referenceId,
          status: 'CONFIRMED',
          blockTime: new Date(),
        },
      });
    }
    res.json(result);
  } catch (err) { next(err); }
};

export const generateNewWallet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wallet = (autoApproval.constructor as any).generateWallet();
    res.json({
      success: true,
      message: 'NEW PLATFORM WALLET GENERATED — SAVE THE PRIVATE KEY SECRETLY',
      publicKey: wallet.publicKey,
      privateKeyBase64: wallet.privateKeyBase64,
      instructions: [
        '1. Copy the private key to your password manager',
        '2. Set PLATFORM_PRIVATE_KEY in Render dashboard',
        '3. Send USDC on Solana to the public address',
        '4. Delete this response — the key is now in your env vars',
      ],
    });
  } catch (err) { next(err); }
};

export const getTransferHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const history = await prisma.usdcTransfer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, history });
  } catch (err) { next(err); }
};
