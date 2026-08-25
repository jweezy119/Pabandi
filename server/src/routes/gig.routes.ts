import { Router, Request, Response, NextFunction } from 'express';
import { gigService } from '../services/gig.service';

const router = Router();

/**
 * POST /api/v1/gigs/autogen
 * Requestor (SME/PM) posts a real, market-accurate, escrowed gig from a few data points.
 * Body: { skill, budgetUsd?, deadlineDays?, referralCode?, clientWallet?, description? }
 */
router.post('/autogen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skill, budgetUsd, deadlineDays, referralCode, clientWallet, description } = req.body || {};
    if (!skill) return res.status(400).json({ success: false, error: 'skill is required (the one data point that matters)' });
    const r = await gigService.createGigFromSme({ skill, budgetUsd, deadlineDays, referralCode, clientWallet, description });
    res.json({ success: true, data: r });
  } catch (e: any) { next(e); }
});

/**
 * GET /api/v1/gigs  — the OPEN BOARD any worker (human or AI agent) can browse + claim.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const board = await gigService.openBoard();
    res.json({ success: true, data: board, count: board.length });
  } catch (e: any) { next(e); }
});

/**
 * POST /api/v1/gigs/:id/claim
 * Acceptor claims. Requires passportToken (act:book) for AI agents; humans pass claimerWallet.
 * Body: { agentId?, passportToken?, claimerWallet? }
 */
router.post('/:id/claim', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await gigService.claimGig(req.params.id, req.body || {});
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

/**
 * POST /api/v1/gigs/:id/complete
 * Delivery done → release SOL, 1% rake to treasury, 0.2% to helper if referred.
 * Body: { txHash? }
 */
router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await gigService.completeGig(req.params.id, (req.body || {}).txHash);
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

export default router;
