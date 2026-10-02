/**
 * Pabandi Autonomous Treasury API
 * ---------------------------------
 * Exposes the orchestrator to the frontend + external webhooks.
 * Runs in SIMULATOR mode by default — full flow works with zero banking partner.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
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
  // This was completely unauthenticated: anyone who knew a virtualAccountId
  // could post an arbitrary amount and mint a PENDING_SWEEP treasury position
  // for it. handleIncomingWire does not check the caller against the account, so
  // the position could be created against any user's account and then swept.
  //
  // A banking partner would sign this. Until one is wired, the only source of
  // truth available is the caller naming the amount out of band, so this is
  // admin-only rather than merely authenticated — an ordinary user must not be
  // able to declare money into the treasury.
  const configured = (process.env.TREASURY_FIAT_WEBHOOK_SECRET || '').trim();
  if (!configured) {
    logger.error(
      '[Treasury] Rejected fiat-deposit: TREASURY_FIAT_WEBHOOK_SECRET is not configured. Until a banking partner is wired this endpoint credits money and cannot be called.',
    );
    return res.status(503).json({ success: false, error: 'Fiat deposit webhook is not configured' });
  }

  // Sign the exact bytes received. index.ts captures them on the json verify
  // hook; re-serialising req.body would produce different whitespace and never
  // match.
  const rawBody =
    typeof (req as Request & { rawBody?: string }).rawBody === 'string'
      ? ((req as Request & { rawBody?: string }).rawBody as string)
      : JSON.stringify(req.body ?? {});

  const presented = String(req.headers['x-treasury-signature'] ?? '');
  const expected = crypto.createHmac('sha256', configured).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    logger.warn('[Treasury] Rejected fiat-deposit: signature mismatch');
    return res.status(401).json({ success: false, error: 'Invalid signature' });
  }

  try {
    const { virtualAccountId, amountUsd } = req.body ?? {};
    if (!virtualAccountId || !amountUsd) {
      return res.status(400).json({ success: false, error: 'virtualAccountId and amountUsd required' });
    }
    const amount = Number(amountUsd);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amountUsd must be a positive number' });
    }
    const pos = await treasuryOrchestrator.handleIncomingWire(virtualAccountId, amount);
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
// Money leaves the treasury here, to a caller-supplied wallet. Any
// authenticated user could name any position and their own address, so this is
// admin-only: it is a treasury withdrawal, not a user action.
router.post('/sweep', authenticate, authorize('ADMIN'), async (req: Request, res: Response): Promise<any> => {
  try {
    const { treasuryPositionId, destinationWallet } = req.body ?? {};
    if (!treasuryPositionId || !destinationWallet) {
      return res.status(400).json({ success: false, error: 'treasuryPositionId and destinationWallet required' });
    }
    // A sweep destination is a blockchain address, so a typo is unrecoverable.
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(destinationWallet)) {
      return res.status(400).json({ success: false, error: 'destinationWallet is not a valid Solana address' });
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
router.post('/demo-flow', authenticate, authorize('ADMIN'), async (req: Request, res: Response): Promise<any> => {
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

/**
 * Combined profitability summary across ALL revenue sources.
 * GET /api/v1/treasury/autonomous-summary
 * (authenticated users — aggregate read-only reporting)
 */
router.get('/autonomous-summary', authenticate, async (_req: Request, res: Response): Promise<any> => {
  try {
    const ledger = await treasuryOrchestrator.getLedger(1000);
    const summary: Record<string, { count: number; pab: number; usdc: number }> = {};
    for (const row of ledger) {
      const b = row.bucket;
      const asset = (row.meta as any)?.asset ?? 'USD';
      summary[b] = summary[b] ?? { count: 0, pab: 0, usdc: 0 };
      summary[b].count++;
      if (asset === 'PAB') summary[b].pab += row.amount;
      else summary[b].usdc += row.amount;
    }

    const totalPabRevenue = (summary['AGENT_REVENUE']?.pab ?? 0) + (summary['SWEEP_OUT']?.usdc ?? 0);
    const totalUsdcRevenue = (summary['AGENT_REVENUE']?.usdc ?? 0) + (summary['SWEEP_OUT']?.usdc ?? 0);
    const totalBurnedPab = summary['BURN']?.pab ?? 0;
    const totalFiatSwept = summary['SWEEP_OUT']?.usdc ?? 0;

    res.json({
      success: true,
      data: {
        buckets: summary,
        totals: {
          pabRevenue: +totalPabRevenue.toFixed(4),
          usdcRevenue: +totalUsdcRevenue.toFixed(2),
          burnedPab: +totalBurnedPab.toFixed(4),
          fiatSweptUsd: +totalFiatSwept.toFixed(2),
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
