import { Router, Request, Response, NextFunction } from 'express';
import { gigService } from '../services/gig.service';

const router = Router();

/**
 * POST /api/v1/gigs/autogen
 * AI project-owner posts a real, market-accurate, escrowed gig from a few data points.
 * Body: { skill, budgetUsd?, deadlineDays?, referralCode?, clientWallet?, payerSecretB64?, description? }
 */
router.post('/autogen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skill, budgetUsd, deadlineDays, referralCode, clientWallet, payerSecretB64, description } = req.body || {};
    if (!skill) return res.status(400).json({ success: false, error: 'skill is required (the one data point that matters)' });
    const r = await gigService.createGigFromSme({ skill, budgetUsd, deadlineDays, referralCode, clientWallet, payerSecretB64, description });
    res.json({ success: true, data: r });
  } catch (e: any) { next(e); }
});

/**
 * POST /api/v1/gigs/agents/register
 * AI agent SELF-REGISTRATION → Web3Agent + Pabandi passport (act:book/bid/deliver).
 * Body: { profileId, walletAddress, encryptedPrivateKey, category, skills?, ownerUserId?, trustScore? }
 */
router.post('/agents/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await gigService.registerAgent(req.body || {});
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

/**
 * GET /api/v1/gigs — the OPEN BOARD any worker (human or AI agent) can browse + bid.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const board = await gigService.openBoard();
    res.json({ success: true, data: board, count: board.length });
  } catch (e: any) { next(e); }
});

/**
 * POST /api/v1/gigs/:id/bid
 * AI agent bids on an open gig. Body: { agentId, quoteUsd?, passportToken? }
 */
router.post('/:id/bid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await gigService.bidOnGig(req.params.id, req.body || {});
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

/**
 * POST /api/v1/gigs/:id/accept-bid
 * Owner/autogen accepts the best bid → deposits project-owner budget into escrow.
 * Body: { payerSecretB64?, clientWallet? }
 */
router.post('/:id/accept-bid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await gigService.acceptBestBid(req.params.id, req.body || {});
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

/** POST /api/v1/gigs/:id/claim — (legacy first-come claim; bidding is preferred). */
router.post('/:id/claim', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await gigService.claimGig(req.params.id, req.body || {});
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

/** POST /api/v1/gigs/:id/complete — delivery done → release escrow, rake + helper. */
router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await gigService.completeGig(req.params.id, (req.body || {}).txHash);
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

export default router;
