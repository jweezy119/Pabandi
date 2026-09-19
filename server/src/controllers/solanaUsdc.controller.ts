import { Request, Response, NextFunction } from 'express';
import { solanaUsdc } from '../services/solanaUsdc.service';
import { prisma } from '../utils/database';

export const getPlatformBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await solanaUsdc.getPlatformBalance();
    res.json({ success: true, balance, platformWallet: solanaUsdc.getPlatformWallet() });
  } catch (err) { next(err); }
};

export const buildTransfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromWallet, toWallet, amountUsdc } = req.body;
    const tx = await solanaUsdc.buildTransferTransaction({ fromWallet, toWallet, amountUsdc });
    res.json({ success: true, ...tx });
  } catch (err) { next(err); }
};

export const recordTransfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await solanaUsdc.recordTransfer(req.body);
    res.json({ success: true, record });
  } catch (err) { next(err); }
};

export const createAgentWallet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    const result = await solanaUsdc.createAgentWallet(agentId);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

export const getAgentBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    const wallet = await prisma.agentWallet.findUnique({ where: { agentId } });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    const balance = await solanaUsdc.getUsdcBalance(wallet.publicKey);
    res.json({ success: true, balance, publicKey: wallet.publicKey });
  } catch (err) { next(err); }
};

export const getTransfers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transfers = await prisma.usdcTransfer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, transfers });
  } catch (err) { next(err); }
};

export const getAgentWallets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wallets = await prisma.agentWallet.findMany({
      include: { agent: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, wallets });
  } catch (err) { next(err); }
};
