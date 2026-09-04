import { Router, Request, Response } from 'express';
import { promoService } from '../services/promo.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ── Public: Stats ─────────────────────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await promoService.getStats();
    res.json({ success: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not load stats' });
  }
});

// ── Public: List ambassadors ───────────────────────────────────────────────
router.get('/ambassadors', async (req: Request, res: Response) => {
  try {
    const { workType, minReputation, active } = req.query;
    const list = await promoService.listAmbassadors({
      workType: workType as string,
      minReputation: minReputation ? Number(minReputation) : undefined,
      active: active !== undefined ? active === 'true' : undefined,
    });
    res.json({ success: true, data: list });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not list ambassadors' });
  }
});

// ── Public: Single ambassador ──────────────────────────────────────────────
router.get('/ambassadors/:id', async (req: Request, res: Response) => {
  try {
    const ambassador = await promoService.getAmbassador(req.params.id);
    if (!ambassador) return res.status(404).json({ error: 'Ambassador not found' });
    res.json({ success: true, data: ambassador });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not load ambassador' });
  }
});

// ── Authenticated: Create ambassador ───────────────────────────────────────
router.post('/ambassadors', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { handle, workType, bio, portfolioUrl, zkPublicKey } = req.body || {};
    if (!handle || !workType) return res.status(400).json({ error: 'handle and workType required' });
    const ambassador = await promoService.createAmbassador({ userId, handle, workType, bio, portfolioUrl, zkPublicKey });
    res.status(201).json({ success: true, data: ambassador });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not create ambassador' });
  }
});

// ── Public: List jobs ──────────────────────────────────────────────────────
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const { workType, status, brandId } = req.query;
    const list = await promoService.listJobs({
      workType: workType as string,
      status: status as string,
      brandId: brandId as string,
    });
    res.json({ success: true, data: list });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not list jobs' });
  }
});

// ── Public: Single job ─────────────────────────────────────────────────────
router.get('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const job = await promoService.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ success: true, data: job });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not load job' });
  }
});

// ── Authenticated: Create job ──────────────────────────────────────────────
router.post('/jobs', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { brandName, title, description, workType, budgetUsd, deadline, requirements, maxAmbassadors, zkRequired } = req.body || {};
    if (!title || !description || !workType || !budgetUsd) {
      return res.status(400).json({ error: 'title, description, workType, budgetUsd required' });
    }
    const job = await promoService.createJob({
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
  } catch (e: any) {
    res.status(500).json({ error: 'Could not create job' });
  }
});

// ── Authenticated: Update job status ───────────────────────────────────────
router.patch('/jobs/:id/status', authenticate, async (req: any, res: Response) => {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status required' });
    const job = await promoService.updateJobStatus(req.params.id, status);
    res.json({ success: true, data: job });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update job' });
  }
});

// ── Authenticated: Create submission ───────────────────────────────────────
router.post('/submissions', authenticate, async (req: any, res: Response) => {
  try {
    const { jobId, ambassadorId, contentUrl, description, zkProofId } = req.body || {};
    if (!jobId || !ambassadorId) return res.status(400).json({ error: 'jobId and ambassadorId required' });
    const submission = await promoService.createSubmission({ jobId, ambassadorId, contentUrl, description, zkProofId });
    res.status(201).json({ success: true, data: submission });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not create submission' });
  }
});

// ── Public: List submissions ───────────────────────────────────────────────
router.get('/submissions', async (req: Request, res: Response) => {
  try {
    const { jobId, ambassadorId, status } = req.query;
    const list = await promoService.listSubmissions({
      jobId: jobId as string,
      ambassadorId: ambassadorId as string,
      status: status as string,
    });
    res.json({ success: true, data: list });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not list submissions' });
  }
});

// ── Authenticated: Update submission status ────────────────────────────────
router.patch('/submissions/:id/status', authenticate, async (req: any, res: Response) => {
  try {
    const { status, reviewNotes } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status required' });
    const submission = await promoService.updateSubmissionStatus(req.params.id, status, reviewNotes);
    res.json({ success: true, data: submission });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update submission' });
  }
});

// ── Authenticated: Create review ───────────────────────────────────────────
router.post('/reviews', authenticate, async (req: any, res: Response) => {
  try {
    const { submissionId, ambassadorId, rating, text, zkProofId, zkCommitment, workType, verified } = req.body || {};
    if (!submissionId || !ambassadorId || !rating || !workType) {
      return res.status(400).json({ error: 'submissionId, ambassadorId, rating, workType required' });
    }
    const review = await promoService.createReview({
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
  } catch (e: any) {
    res.status(500).json({ error: 'Could not create review' });
  }
});

// ── Public: List reviews ───────────────────────────────────────────────────
router.get('/reviews', async (req: Request, res: Response) => {
  try {
    const { workType, verified, minRating } = req.query;
    const list = await promoService.listReviews({
      workType: workType as string,
      verified: verified !== undefined ? verified === 'true' : undefined,
      minRating: minRating ? Number(minRating) : undefined,
    });
    res.json({ success: true, data: list });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not list reviews' });
  }
});

// ── ZK: Generate commitment ────────────────────────────────────────────────
router.post('/zk/commitment', authenticate, async (req: any, res: Response) => {
  try {
    const { ambassadorId, secret } = req.body || {};
    if (!ambassadorId || !secret) return res.status(400).json({ error: 'ambassadorId and secret required' });
    const commitment = promoService.generateZKCommitment(ambassadorId, secret);
    res.json({ success: true, data: { commitment } });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not generate commitment' });
  }
});

// ── ZK: Verify commitment ──────────────────────────────────────────────────
router.post('/zk/verify', async (req: Request, res: Response) => {
  try {
    const { ambassadorId, secret, commitment } = req.body || {};
    if (!ambassadorId || !secret || !commitment) return res.status(400).json({ error: 'ambassadorId, secret, commitment required' });
    const valid = promoService.verifyZKCommitment(ambassadorId, secret, commitment);
    res.json({ success: true, data: { valid } });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not verify' });
  }
});

// ── ZK: Generate work proof ────────────────────────────────────────────────
router.post('/zk/work-proof', authenticate, async (req: any, res: Response) => {
  try {
    const { ambassadorId, jobId, workHash } = req.body || {};
    if (!ambassadorId || !jobId || !workHash) return res.status(400).json({ error: 'ambassadorId, jobId, workHash required' });
    const result = promoService.generateWorkProof(ambassadorId, jobId, workHash);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not generate work proof' });
  }
});

export default router;
