"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gig_service_1 = require("../services/gig.service");
const web3_js_1 = require("@solana/web3.js");
const router = (0, express_1.Router)();
/**
 * GET /api/v1/gigs/wallet
 * Exposes the AI business(owner) wallet address + live SOL balance. Fund this address with SOL
 * to switch the autonomous escrow from simulated → REAL on-chain (freelancer receives actual SOL).
 * Treasury is never at risk — it only custodies the deposited escrow.
 */
router.get('/wallet', async (_req, res, next) => {
    try {
        const bus = gig_service_1.gigService.ensureBusinessWallet();
        let balance = 0;
        try {
            const c = new web3_js_1.Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
            balance = (await c.getBalance(new web3_js_1.PublicKey(bus.pubkey))) / web3_js_1.LAMPORTS_PER_SOL;
        }
        catch { }
        res.json({ success: true, data: { businessWallet: bus.pubkey, solBalance: +balance.toFixed(6), funded: balance > 0.0005, note: 'Send SOL here to enable LIVE on-chain escrow (treasury risk = 0)' } });
    }
    catch (e) {
        next(e);
    }
});
/**
 * POST /api/v1/gigs/autogen
 * AI project-owner posts a real, market-accurate, escrowed gig from a few data points.
 * Body: { skill, budgetUsd?, deadlineDays?, referralCode?, clientWallet?, payerSecretB64?, description? }
 */
router.post('/autogen', async (req, res, next) => {
    try {
        const { skill, budgetUsd, deadlineDays, referralCode, clientWallet, payerSecretB64, description } = req.body || {};
        if (!skill)
            return res.status(400).json({ success: false, error: 'skill is required (the one data point that matters)' });
        const r = await gig_service_1.gigService.createGigFromSme({ skill, budgetUsd, deadlineDays, referralCode, clientWallet, payerSecretB64, description });
        res.json({ success: true, data: r });
    }
    catch (e) {
        next(e);
    }
});
/**
 * POST /api/v1/gigs/agents/register
 * AI agent SELF-REGISTRATION → Web3Agent + Pabandi passport (act:book/bid/deliver).
 * Body: { profileId, walletAddress, encryptedPrivateKey, category, skills?, ownerUserId?, trustScore? }
 */
router.post('/agents/register', async (req, res, next) => {
    try {
        const r = await gig_service_1.gigService.registerAgent(req.body || {});
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
/**
 * GET /api/v1/gigs/agents/:id/balance — live PAB trust-stake balance.
 */
router.get('/agents/:id/balance', async (req, res, next) => {
    try {
        const r = await gig_service_1.gigService.agentBalance(req.params.id);
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(404).json({ success: false, error: e.message });
    }
});
/**
 * POST /api/v1/gigs/agents/:id/faucet — controlled PAB top-up (treasury reserve).
 * Body: { amountPab }
 */
router.post('/agents/:id/faucet', async (req, res, next) => {
    try {
        const r = await gig_service_1.gigService.agentFaucet(req.params.id, Number((req.body || {}).amountPab) || 0);
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
/** GET /api/v1/gigs/pab-stats — $PAB tokenomic dashboard (supply, distributed, staked, referral). */
router.get('/pab-stats', async (_req, res, next) => {
    try {
        const r = await gig_service_1.gigService.pabStats();
        res.json({ success: true, data: r });
    }
    catch (e) {
        next(e);
    }
});
router.get('/', async (_req, res, next) => {
    try {
        const board = await gig_service_1.gigService.openBoard();
        res.json({ success: true, data: board, count: board.length });
    }
    catch (e) {
        next(e);
    }
});
/**
 * POST /api/v1/gigs/:id/bid
 * AI agent bids on an open gig. Body: { agentId, quoteUsd?, passportToken? }
 */
router.post('/:id/bid', async (req, res, next) => {
    try {
        const r = await gig_service_1.gigService.bidOnGig(req.params.id, req.body || {});
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
/**
 * POST /api/v1/gigs/:id/accept-bid
 * Owner/autogen accepts the best bid → deposits project-owner budget into escrow.
 * Body: { payerSecretB64?, clientWallet? }
 */
router.post('/:id/accept-bid', async (req, res, next) => {
    try {
        const r = await gig_service_1.gigService.acceptBestBid(req.params.id, req.body || {});
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
/** GET /api/v1/gigs/:id/bid-ranking — transparent "why this agent won" breakdown (trust/skill/value per bidder). */
router.get('/:id/bid-ranking', async (req, res, next) => {
    try {
        const r = await gig_service_1.gigService.bidRanking(req.params.id);
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
/** POST /api/v1/gigs/:id/claim — (legacy first-come claim; bidding is preferred). */
router.post('/:id/claim', async (req, res, next) => {
    try {
        const r = await gig_service_1.gigService.claimGig(req.params.id, req.body || {});
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
/** POST /api/v1/gigs/:id/complete — delivery done → release escrow, rake + helper. */
router.post('/:id/complete', async (req, res, next) => {
    try {
        const r = await gig_service_1.gigService.completeGig(req.params.id, (req.body || {}).txHash);
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=gig.routes.js.map