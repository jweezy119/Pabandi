import { Router, Request, Response, NextFunction } from 'express';
import { gigService } from '../services/gig.service';
import { PublicKey, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { ledgerService } from '../services/payment-orchestration/ledger.service';
import { paymentOrchestrator } from '../services/payment-orchestration/orchestrator.service';
import { telegramNotificationService } from '../services/telegram-notification.service';
import { payoutVerificationService } from '../services/payout-verification.service';
import {
  validate, createGigSchema, autogenGigSchema, agentRegisterSchema,
  bidSchema, claimSchema, completeGigSchema, faucetSchema, acceptBidSchema,
} from '../validation/gig';
import {
  moneyRateLimiter, faucetRateLimiter, agentRegisterRateLimiter,
} from '../middleware/rateLimiter';

const router = Router();

/**
 * Defensive belt-and-braces against RAW SOLANA SECRET KEYS arriving over HTTP.
 *
 * `payerSecretB64` is only ever legitimate inside the server's own autonomous
 * loop (scripts run locally, keys stay in env/encrypted files). Any HTTP body
 * that carries one is a leaky client — we log-and-drop it BEFORE it reaches the
 * wallet layer. (The zod schemas also reject it; this middleware is the second
 * line and runs even where zod wraps a different shape.)
 */
function stripClientSecretKeys(req: Request, _res: Response, next: NextFunction) {
  const body = req.body as Record<string, unknown> | undefined;
  if (body && 'payerSecretB64' in body && body.payerSecretB64) {
    logger.warn(`[security] client sent payerSecretB64 over HTTP — stripped (path=${req.originalUrl})`);
    delete body.payerSecretB64;
  }
  next();
}
router.use(stripClientSecretKeys);

/**
 * GET /api/v1/gigs/wallet
 * Exposes the AI business(owner) wallet address + live SOL balance. Fund this address with SOL
 * to switch the autonomous escrow from simulated → REAL on-chain (freelancer receives actual SOL).
 * Treasury is never at risk — it only custodies the deposited escrow.
 */
router.get('/wallet', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const bus: any = (gigService as any).ensureBusinessWallet();
    let balance = 0;
    try { const c = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed'); balance = (await c.getBalance(new PublicKey(bus.pubkey))) / LAMPORTS_PER_SOL; } catch {}
    res.json({ success: true, data: { businessWallet: bus.pubkey, solBalance: +balance.toFixed(6), funded: balance > 0.0005, note: 'Send SOL here to enable LIVE on-chain escrow (treasury risk = 0)' } });
  } catch (e: any) { next(e); }
});

/**
 * POST /api/v1/gigs/autogen
 * AI project-owner posts a real, market-accurate, escrowed gig from a few data points.
 * Auth + rate limited: this creates escrow-bearing ledger state.
 * Body: { skill, budgetUsd?, deadlineDays?, referralCode?, clientWallet?, description? }
 */
router.post('/autogen', authenticate, moneyRateLimiter, validate(autogenGigSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skill, budgetUsd, deadlineDays, referralCode, clientWallet, description } = req.body || {};
    if (!skill) return res.status(400).json({ success: false, error: 'skill is required (the one data point that matters)' });
    const r = await gigService.createGigFromSme({ skill, budgetUsd, deadlineDays, referralCode, clientWallet, description });
    res.json({ success: true, data: r });
  } catch (e: any) { next(e); }
});

/**
 * POST /api/v1/gigs/agents/register
 * AI agent SELF-REGISTRATION → Web3Agent + Pabandi passport (act:book/bid/deliver).
 * Body: { profileId, walletAddress, encryptedPrivateKey, category, skills?, ownerUserId?, trustScore? }
 */
router.post('/agents/register', agentRegisterRateLimiter, validate(agentRegisterSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await gigService.registerAgent(req.body || {});
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

/**
 * GET /api/v1/gigs/agents/:id/balance — live PAB trust-stake balance.
 */
router.get('/agents/:id/balance', async (req: Request, res: Response, next: NextFunction) => {
  try { const r = await gigService.agentBalance(req.params.id); res.json({ success: true, data: r }); }
  catch (e: any) { res.status(404).json({ success: false, error: e.message }); }
});

/**
 * POST /api/v1/gigs/agents/:id/faucet — controlled PAB top-up (treasury reserve).
 * Auth + hard rate limit: this MINTS trust currency, unauthenticated minting is
 * free inflation of the PAB money supply.
 * Body: { amountPab } (1..1000)
 */
router.post('/agents/:id/faucet', authenticate, faucetRateLimiter, validate(faucetSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { const r = await gigService.agentFaucet(req.params.id, Number((req.body || {}).amountPab) || 0); res.json({ success: true, data: r }); }
  catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

/** GET /api/v1/gigs/pab-stats — $PAB tokenomic dashboard (supply, distributed, staked, referral). */
router.get('/pab-stats', async (_req: Request, res: Response, next: NextFunction) => {
  try { const r = await gigService.pabStats(); res.json({ success: true, data: r }); }
  catch (e: any) { next(e); }
});
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const board = await gigService.openBoard();
    res.json({ success: true, data: board, count: board.length });
  } catch (e: any) { next(e); }
});

/**
 * POST /api/v1/gigs/ — Create a new gig (project).
 * Body: { title, description, category, requiredSkills, budgetUsd, estimatedHours?, demandGrowthPct? }
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, category, requiredSkills, budgetUsd, estimatedHours, demandGrowthPct } = req.body || {};

    if (!title || !description || !category || budgetUsd == null) {
      return res.status(400).json({ success: false, error: 'title, description, category, and budgetUsd are required' });
    }

    const gig = await prisma.project.create({
      data: {
        title,
        description,
        category,
        requiredSkills: requiredSkills || [],
        budgetUsd: Number(budgetUsd),
        estimatedHours: estimatedHours ? Number(estimatedHours) : 0,
        demandGrowthPct: demandGrowthPct ? Number(demandGrowthPct) : 0,
        status: 'OPEN',
        createdBy: req.user?.id,
      },
    });

    // Real-time Push Alert: Broadcast new gig opportunity to Telegram agents/builders
    telegramNotificationService.notifyNewGig({
      gigId: gig.id,
      title: gig.title,
      description: gig.description,
      category: gig.category,
      requiredSkills: (gig.requiredSkills as string[]) || [],
      budgetUsd: gig.budgetUsd,
    }).catch(err => logger.warn('[TelegramPush] Failed to broadcast new gig:', err));

    res.status(201).json({ success: true, data: { gigId: gig.id, ...gig } });
  } catch (e: any) { next(e); }
});

/**
 * POST /api/v1/gigs/:id/accept/:bidId — Accept a specific bid on a gig.
 * Only the gig poster may accept.
 */
router.post('/:id/accept/:bidId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: gigId, bidId } = req.params;

    const gig = await prisma.project.findUnique({ where: { id: gigId } });
    if (!gig) return res.status(404).json({ success: false, error: 'Gig not found' });
    if (gig.status !== 'OPEN') return res.status(400).json({ success: false, error: 'Gig is not open' });
    if (gig.createdBy !== req.user?.id) return res.status(403).json({ success: false, error: 'Only the gig poster may accept bids' });

    const bid = await prisma.projectBid.findUnique({ where: { id: bidId } });
    if (!bid) return res.status(404).json({ success: false, error: 'Bid not found' });
    if (bid.projectId !== gigId) return res.status(400).json({ success: false, error: 'Bid does not belong to this gig' });
    if (bid.status !== 'PENDING') return res.status(400).json({ success: false, error: 'Bid is not pending' });

    // Compliance gate: contractor must have a verified Wallet / Bank ESFCA payout route
    const payoutBlock = await payoutVerificationService.checkContractor(bid.agentId);
    if (payoutBlock) {
      return res.status(403).json({ ...payoutBlock, error: 'This contractor has not verified a payout method yet.' });
    }

    // Reject all other pending bids
    await prisma.projectBid.updateMany({
      where: { projectId: gigId, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });

    // Accept this bid
    await prisma.projectBid.update({
      where: { id: bidId },
      data: { status: 'ACCEPTED' },
    });

    // Mark gig as in progress
    await prisma.project.update({
      where: { id: gigId },
      data: { status: 'IN_PROGRESS', bestAgentId: bid.agentId, bestConfidence: bid.confidencePct },
    });

    // Real-time Push Alert: Notify accepted bidder
    telegramNotificationService.notifyBidAccepted({
      gigId,
      gigTitle: gig.title,
      agentId: bid.agentId,
      quoteUsd: bid.quoteUsd,
      clientId: req.user?.id,
    }).catch(err => logger.warn('[TelegramPush] Failed to notify accepted bidder:', err));

    res.json({ success: true, data: { gigId, acceptedBidId: bidId, agentId: bid.agentId, quoteUsd: bid.quoteUsd } });
  } catch (e: any) { next(e); }
});

/**
 * POST /api/v1/gigs/:id/fund-escrow
 * Locks funds in universal escrow across Solana USDC, SBP Raast, Card, or JazzCash.
 * Writes double-entry balanced journal entries in the ledger and updates gig status.
 */
router.post('/:id/fund-escrow', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: gigId } = req.params;
    const { rail = 'solana', amountUsd, txHash, paymentId, currency = 'USD' } = req.body;

    const gig = await prisma.project.findUnique({ where: { id: gigId } });
    if (!gig) return res.status(404).json({ success: false, error: 'Gig not found' });

    const finalAmount = Number(amountUsd) || gig.budgetUsd;
    const pId = paymentId || `pay_escrow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Double-entry ledger recording
    const journal = ledgerService.recordEscrowFunding({
      paymentId: pId,
      reference: `gig_${gigId}`,
      rail,
      amount: finalAmount,
      currency,
      fee: finalAmount * 0.02, // 2% Wakala facilitation fee
      payerId: req.user?.id || 'client',
      payeeId: gig.bestAgentId || 'assigned_contractor',
      gigId,
    });

    // Update gig status & locked vault
    const updated = await prisma.project.update({
      where: { id: gigId },
      data: {
        status: 'IN_PROGRESS',
        vaultUsdc: finalAmount,
      },
    });

    // Real-time Push Alert: Notify contractor/agent that escrow is funded
    telegramNotificationService.notifyEscrowFunded({
      gigId,
      gigTitle: gig.title,
      amountUsd: finalAmount,
      rail,
      payerId: req.user?.id,
      payeeId: gig.bestAgentId || undefined,
      txHash: txHash || null,
    }).catch(err => logger.warn('[TelegramPush] Failed to notify funded escrow:', err));

    res.json({
      success: true,
      data: {
        gigId,
        status: updated.status,
        escrow: {
          funded: true,
          rail,
          amountUsd: finalAmount,
          txHash: txHash || null,
          ledgerTxId: journal.id,
          trustBonus: journal.trustScoreImpact.payerScoreDelta,
        },
      },
    });
  } catch (e: any) { next(e); }
});

/**
 * POST /api/v1/gigs/:id/release-escrow
 * Creator verifies delivery and releases the escrow to the contractor/agent.
 * Journals payout settlement and boosts contractor Trust Score by +25 points.
 */
router.post('/:id/release-escrow', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: gigId } = req.params;
    const gig = await prisma.project.findUnique({ where: { id: gigId } });
    if (!gig) return res.status(404).json({ success: false, error: 'Gig not found' });
    if (gig.createdBy && gig.createdBy !== req.user?.id) {
      return res.status(403).json({ success: false, error: 'Only the gig poster may release escrow' });
    }

    const payeeId = gig.bestAgentId || 'payee_contractor';
    const journal = ledgerService.recordEscrowRelease({
      reference: `gig_${gigId}`,
      rail: 'solana',
      amount: gig.vaultUsdc || gig.budgetUsd,
      currency: 'USD',
      payeeId,
      gigId,
    });

    const updated = await prisma.project.update({
      where: { id: gigId },
      data: { status: 'DELIVERED' },
    });

    // Real-time Push Alert: Notify contractor that escrow is released
    telegramNotificationService.notifyEscrowReleased({
      gigId,
      gigTitle: gig.title,
      amountUsd: gig.vaultUsdc || gig.budgetUsd,
      payeeId: gig.bestAgentId || undefined,
      payeeTrustScoreDelta: journal.trustScoreImpact.payeeScoreDelta,
    }).catch(err => logger.warn('[TelegramPush] Failed to notify released escrow:', err));

    res.json({
      success: true,
      data: {
        gigId,
        status: updated.status,
        released: true,
        ledgerTxId: journal.id,
        payeeTrustScoreDelta: journal.trustScoreImpact.payeeScoreDelta,
      },
    });
  } catch (e: any) { next(e); }
});

/**
 * POST /api/v1/gigs/:id/bid
 * AI agent bids on an open gig. Body: { agentId, quoteUsd?, passportToken? }
 * Zod-validated + money-limited: bids debit real PAB stakes.
 */
router.post('/:id/bid', moneyRateLimiter, validate(bidSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payoutBlock = await payoutVerificationService.checkContractor(req.body?.agentId);
    if (payoutBlock) return res.status(403).json(payoutBlock);
    const r = await gigService.bidOnGig(req.params.id, req.body || {});
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

/**
 * POST /api/v1/gigs/:id/accept-bid
 * Owner/autogen accepts the best bid → deposits project-owner budget into escrow.
 * AUTH required (this moves real SOL into escrow) and client secret keys are never
 * accepted — deposits come from the server-held business wallet only.
 * Body: { clientWallet? }
 */
router.post('/:id/accept-bid', authenticate, moneyRateLimiter, validate(acceptBidSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await gigService.acceptBestBid(req.params.id, req.body || {});
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

/** GET /api/v1/gigs/:id/bid-ranking — transparent "why this agent won" breakdown (trust/skill/value per bidder). */
router.get('/:id/bid-ranking', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await gigService.bidRanking(req.params.id);
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

/**
 * POST /api/v1/gigs/:id/claim — (legacy first-come claim; bidding is preferred).
 * Zod-validated + money-limited (assigns an agent and flips the gig's ledger state).
 */
router.post('/:id/claim', moneyRateLimiter, validate(claimSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payoutBlock = await payoutVerificationService.checkContractor(req.body?.agentId);
    if (payoutBlock) return res.status(403).json(payoutBlock);
    const r = await gigService.claimGig(req.params.id, req.body || {});
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

/**
 * POST /api/v1/gigs/:id/complete — delivery done → release escrow, rake + helper.
 * AUTH required. This is the single most dangerous endpoint in the file: it
 * releases SOL from the treasury to the freelancer wallet and writes ledger
 * rows. Unauthenticated completion = free money.
 */
router.post('/:id/complete', authenticate, moneyRateLimiter, validate(completeGigSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await gigService.completeGig(req.params.id, (req.body || {}).txHash);
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

export default router;
