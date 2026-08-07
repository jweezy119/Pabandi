/**
 * Pabandi Autonomous Treasury API
 * ---------------------------------
 * Exposes the orchestrator to the frontend + external webhooks.
 * Runs in SIMULATOR mode by default — full flow works with zero banking partner.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { treasuryOrchestrator } from '../services/treasury/orchestrator.service';

const router = Router();

/**
 * Create a virtual bank account for the authenticated user.
 * POST /api/v1/treasury/virtual-account
 */
router.post('/virtual-account', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });
    const va = await treasuryOrchestrator.issueVirtualAccount(userId);
    res.json({ success: true, data: va });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get the authenticated user's virtual account deposit instructions.
 * GET /api/v1/treasury/virtual-account
 */
router.get('/virtual-account', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });
    const va = await treasuryOrchestrator.issueVirtualAccount(userId); // idempotent
    res.json({ success: true, data: va });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Webhook: simulate / receive an incoming fiat wire to a virtual account.
 * POST /api/v1/treasury/webhooks/fiat-deposit
 * body: { virtualAccountId, amountUsd }
 */
router.post('/webhooks/fiat-deposit', async (req: Request, res: Response): Promise<any> => {
  try {
    const { virtualAccountId, amountUsd } = req.body ?? {};
    if (!virtualAccountId || !amountUsd) {
      return res.status(400).json({ success: false, error: 'virtualAccountId and amountUsd required' });
    }
    const pos = await treasuryOrchestrator.handleIncomingWire(virtualAccountId, Number(amountUsd));
    res.json({ success: true, data: pos });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Sweep a pending fiat position into on-chain stablecoin.
 * POST /api/v1/treasury/sweep
 * body: { treasuryPositionId, destinationWallet }
 */
router.post('/sweep', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { treasuryPositionId, destinationWallet } = req.body ?? {};
    if (!treasuryPositionId || !destinationWallet) {
      return res.status(400).json({ success: false, error: 'treasuryPositionId and destinationWallet required' });
    }
    const result = await treasuryOrchestrator.sweepToWeb3(treasuryPositionId, destinationWallet);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Run the full demo flow (issue account → wire → sweep) for the profitability report.
 * POST /api/v1/treasury/demo-flow
 * body: { amountUsd, destinationWallet }
 */
router.post('/demo-flow', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const { amountUsd, destinationWallet } = req.body ?? {};
    if (!amountUsd || !destinationWallet) {
      return res.status(400).json({ success: false, error: 'amountUsd and destinationWallet required' });
    }
    const result = await treasuryOrchestrator.runDemoFlow(userId, Number(amountUsd), destinationWallet);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Ledger view for the profitability report.
 * GET /api/v1/treasury/ledger
 */
router.get('/ledger', authenticate, async (_req: Request, res: Response): Promise<any> => {
  try {
    const ledger = await treasuryOrchestrator.getLedger(50);
    res.json({ success: true, data: ledger });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
