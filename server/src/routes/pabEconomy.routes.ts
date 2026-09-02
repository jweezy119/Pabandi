import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { initializePabEconomy, getWallet, earnPab, spendPab, stakePab, unstakePab, getTreasury, getPabStats, recordPlatformFee } from '../services/pabEconomy.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ── GET /api/v1/pab/stats ───────────────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getPabStats();
    res.json({ success: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/pab/wallet ──────────────────────────────────────────────────
router.get('/wallet', authenticate, async (req: any, res: Response) => {
  try {
    const wallet = await getWallet(req.user.id);
    res.json({ success: true, data: wallet });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/pab/earn ───────────────────────────────────────────────────
router.post('/earn', authenticate, async (req: any, res: Response) => {
  try {
    const { action, refType, refId } = req.body;
    const tx = await earnPab(req.user.id, action, refType, refId);
    if (!tx) return res.status(400).json({ success: false, error: 'No earn rule for this action' });
    res.status(201).json({ success: true, data: tx });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/pab/spend ──────────────────────────────────────────────────
router.post('/spend', authenticate, async (req: any, res: Response) => {
  try {
    const { action, refType, refId } = req.body;
    const tx = await spendPab(req.user.id, action, refType, refId);
    if (!tx) return res.status(400).json({ success: false, error: 'No spend rule for this action' });
    res.status(201).json({ success: true, data: tx });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/pab/stake ──────────────────────────────────────────────────
router.post('/stake', authenticate, async (req: any, res: Response) => {
  try {
    const { tier } = req.body;
    const wallet = await stakePab(req.user.id, tier);
    res.json({ success: true, data: wallet });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/pab/unstake ────────────────────────────────────────────────
router.post('/unstake', authenticate, async (req: any, res: Response) => {
  try {
    const wallet = await unstakePab(req.user.id);
    res.json({ success: true, data: wallet });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/pab/treasury ────────────────────────────────────────────────
router.get('/treasury', async (_req: Request, res: Response) => {
  try {
    const treasury = await getTreasury();
    res.json({ success: true, data: treasury });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/pab/record-fee ─────────────────────────────────────────────
router.post('/record-fee', authenticate, async (req: any, res: Response) => {
  try {
    const { solAmount } = req.body;
    await recordPlatformFee(solAmount);
    res.json({ success: true, message: 'Fee recorded' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/pab/initialize ─────────────────────────────────────────────
router.post('/initialize', async (_req: Request, res: Response) => {
  try {
    await initializePabEconomy();
    res.json({ success: true, message: 'PAB economy initialized' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
