"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const promo_service_1 = require("../services/promo.service");
const promo_payout_service_1 = require("../services/promo.payout.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
// ── Public: Stats ─────────────────────────────────────────────────────────
router.get('/stats', async (_req, res) => {
    try {
        const stats = await promo_service_1.promoService.getStats();
        res.json({ success: true, data: stats });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not load stats' });
    }
});
// ── Public: List ambassadors ───────────────────────────────────────────────
router.get('/ambassadors', async (req, res) => {
    try {
        const { workType, minReputation, active } = req.query;
        const list = await promo_service_1.promoService.listAmbassadors({
            workType: workType,
            minReputation: minReputation ? Number(minReputation) : undefined,
            active: active !== undefined ? active === 'true' : undefined,
        });
        res.json({ success: true, data: list });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not list ambassadors' });
    }
});
// ── Public: Single ambassador ──────────────────────────────────────────────
router.get('/ambassadors/:id', async (req, res) => {
    try {
        const ambassador = await promo_service_1.promoService.getAmbassador(req.params.id);
        if (!ambassador)
            return res.status(404).json({ error: 'Ambassador not found' });
        res.json({ success: true, data: ambassador });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not load ambassador' });
    }
});
// ── Authenticated: Create ambassador ───────────────────────────────────────
router.post('/ambassadors', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { handle, workType, bio, portfolioUrl, zkPublicKey } = req.body || {};
        if (!handle || !workType)
            return res.status(400).json({ error: 'handle and workType required' });
        const ambassador = await promo_service_1.promoService.createAmbassador({ userId, handle, workType, bio, portfolioUrl, zkPublicKey });
        res.status(201).json({ success: true, data: ambassador });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not create ambassador' });
    }
});
// ── Public: List jobs ──────────────────────────────────────────────────────
router.get('/jobs', async (req, res) => {
    try {
        const { workType, status, brandId } = req.query;
        const list = await promo_service_1.promoService.listJobs({
            workType: workType,
            status: status,
            brandId: brandId,
        });
        res.json({ success: true, data: list });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not list jobs' });
    }
});
// ── Public: Single job ─────────────────────────────────────────────────────
router.get('/jobs/:id', async (req, res) => {
    try {
        const job = await promo_service_1.promoService.getJob(req.params.id);
        if (!job)
            return res.status(404).json({ error: 'Job not found' });
        res.json({ success: true, data: job });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not load job' });
    }
});
// ── Authenticated: Create job ──────────────────────────────────────────────
router.post('/jobs', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { brandName, title, description, workType, budgetUsd, deadline, requirements, maxAmbassadors, zkRequired } = req.body || {};
        if (!title || !description || !workType || !budgetUsd) {
            return res.status(400).json({ error: 'title, description, workType, budgetUsd required' });
        }
        const job = await promo_service_1.promoService.createJob({
            brandId: userId,
            brandName: brandName || null,
            title,
            description,
            workType,
            budgetUsd: Number(budgetUsd),
            deadline: deadline ? new Date(deadline) : undefined,
            requirements: requirements || [],
            maxAmbassadors: maxAmbassadors || 1,
            zkRequired,
        });
        res.status(201).json({ success: true, data: job });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not create job' });
    }
});
// ── Authenticated: Update job status ───────────────────────────────────────
router.patch('/jobs/:id/status', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { status } = req.body || {};
        if (!status)
            return res.status(400).json({ error: 'status required' });
        const job = await promo_service_1.promoService.updateJobStatus(req.params.id, status);
        res.json({ success: true, data: job });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not update job' });
    }
});
// ── Authenticated: Create submission ───────────────────────────────────────
router.post('/submissions', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { jobId, ambassadorId, contentUrl, description, zkProofId } = req.body || {};
        if (!jobId || !ambassadorId)
            return res.status(400).json({ error: 'jobId and ambassadorId required' });
        const submission = await promo_service_1.promoService.createSubmission({ jobId, ambassadorId, contentUrl, description, zkProofId });
        res.status(201).json({ success: true, data: submission });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not create submission' });
    }
});
// ── Public: List submissions ───────────────────────────────────────────────
router.get('/submissions', async (req, res) => {
    try {
        const { jobId, ambassadorId, status } = req.query;
        const list = await promo_service_1.promoService.listSubmissions({
            jobId: jobId,
            ambassadorId: ambassadorId,
            status: status,
        });
        res.json({ success: true, data: list });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not list submissions' });
    }
});
// ── Authenticated: Update submission status ────────────────────────────────
router.patch('/submissions/:id/status', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { status, reviewNotes } = req.body || {};
        if (!status)
            return res.status(400).json({ error: 'status required' });
        const submission = await promo_service_1.promoService.updateSubmissionStatus(req.params.id, status, reviewNotes);
        res.json({ success: true, data: submission });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not update submission' });
    }
});
// ── Authenticated: Create review ───────────────────────────────────────────
router.post('/reviews', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { submissionId, ambassadorId, rating, text, zkProofId, zkCommitment, workType, verified } = req.body || {};
        if (!submissionId || !ambassadorId || !rating || !workType) {
            return res.status(400).json({ error: 'submissionId, ambassadorId, rating, workType required' });
        }
        const review = await promo_service_1.promoService.createReview({
            submissionId,
            ambassadorId,
            rating: Number(rating),
            text,
            zkProofId,
            zkCommitment,
            workType,
            verified,
        });
        res.status(201).json({ success: true, data: review });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not create review' });
    }
});
// ── Public: List reviews ───────────────────────────────────────────────────
router.get('/reviews', async (req, res) => {
    try {
        const { workType, verified, minRating } = req.query;
        const list = await promo_service_1.promoService.listReviews({
            workType: workType,
            verified: verified !== undefined ? verified === 'true' : undefined,
            minRating: minRating ? Number(minRating) : undefined,
        });
        res.json({ success: true, data: list });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not list reviews' });
    }
});
// ── ZK: Generate commitment ────────────────────────────────────────────────
router.post('/zk/commitment', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { ambassadorId, secret } = req.body || {};
        if (!ambassadorId || !secret)
            return res.status(400).json({ error: 'ambassadorId and secret required' });
        const commitment = promo_service_1.promoService.generateZKCommitment(ambassadorId, secret);
        res.json({ success: true, data: { commitment } });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not generate commitment' });
    }
});
// ── ZK: Verify commitment ──────────────────────────────────────────────────
router.post('/zk/verify', async (req, res) => {
    try {
        const { ambassadorId, secret, commitment } = req.body || {};
        if (!ambassadorId || !secret || !commitment)
            return res.status(400).json({ error: 'ambassadorId, secret, commitment required' });
        const valid = promo_service_1.promoService.verifyZKCommitment(ambassadorId, secret, commitment);
        res.json({ success: true, data: { valid } });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not verify' });
    }
});
// ── ZK: Generate work proof ────────────────────────────────────────────────
router.post('/zk/work-proof', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { ambassadorId, jobId, workHash } = req.body || {};
        if (!ambassadorId || !jobId || !workHash)
            return res.status(400).json({ error: 'ambassadorId, jobId, workHash required' });
        const result = promo_service_1.promoService.generateWorkProof(ambassadorId, jobId, workHash);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not generate work proof' });
    }
});
exports.default = router;
// ── Payout & Earning ──────────────────────────────────────────────────────
router.post('/payout/submit-work', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { jobId, ambassadorId, contentUrl, description, workHash } = req.body || {};
        if (!jobId || !ambassadorId || !workHash)
            return res.status(400).json({ error: 'jobId, ambassadorId, workHash required' });
        const result = await promo_payout_service_1.promoPayoutService.submitWork({ jobId, ambassadorId, contentUrl, description, workHash });
        res.status(201).json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Could not submit work' });
    }
});
router.post('/payout/accept-and-pay', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { submissionId } = req.body || {};
        const userId = req.user?.id;
        if (!submissionId)
            return res.status(400).json({ error: 'submissionId required' });
        const result = await promo_payout_service_1.promoPayoutService.acceptAndPay(submissionId, userId);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Could not accept and pay' });
    }
});
router.post('/payout/review', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { submissionId, ambassadorId, rating, text, workType, zkSecret } = req.body || {};
        if (!submissionId || !ambassadorId || !rating || !workType || !zkSecret) {
            return res.status(400).json({ error: 'submissionId, ambassadorId, rating, workType, zkSecret required' });
        }
        const result = await promo_payout_service_1.promoPayoutService.submitReview({ submissionId, ambassadorId, rating, text, workType, zkSecret });
        res.status(201).json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Could not submit review' });
    }
});
router.post('/payout/verify-commitment', async (req, res) => {
    try {
        const { ambassadorId, secret, commitment } = req.body || {};
        if (!ambassadorId || !secret || !commitment)
            return res.status(400).json({ error: 'ambassadorId, secret, commitment required' });
        const valid = promo_payout_service_1.promoPayoutService.verifyCommitment(ambassadorId, secret, commitment);
        res.json({ success: true, data: { valid } });
    }
    catch (e) {
        res.status(500).json({ error: 'Could not verify' });
    }
});
router.get('/payout/earnings/:ambassadorId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const earnings = await promo_payout_service_1.promoPayoutService.getEarnings(req.params.ambassadorId);
        res.json({ success: true, data: earnings });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Could not load earnings' });
    }
});
router.post('/payout/fund-job', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { jobId } = req.body || {};
        const userId = req.user?.id;
        if (!jobId)
            return res.status(400).json({ error: 'jobId required' });
        const result = await promo_payout_service_1.promoPayoutService.fundJob(jobId, userId);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Could not fund job' });
    }
});
// ── Ambassador wallet connection ───────────────────────────────────────────
router.post('/ambassadors/:id/connect-wallet', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { walletAddress } = req.body || {};
        if (!walletAddress)
            return res.status(400).json({ error: 'walletAddress required' });
        const ambassador = await promo_service_1.promoService.updateAmbassador(req.params.id, { zkPublicKey: walletAddress });
        res.json({ success: true, data: ambassador });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Could not connect wallet' });
    }
});
// ── On-chain $PAB mint status ─────────────────────────────────────────────
router.get('/payout/mint-status/:ambassadorId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const ambassador = await prisma.promoAmbassador.findUnique({ where: { id: req.params.ambassadorId } });
        if (!ambassador)
            return res.status(404).json({ error: 'Ambassador not found' });
        const wallet = await prisma.wallet.findUnique({ where: { userId: ambassador.userId } });
        res.json({ success: true, data: { wallet: wallet?.address || null, currency: wallet?.currency || null } });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Could not get mint status' });
    }
});
//# sourceMappingURL=promo.routes.js.map