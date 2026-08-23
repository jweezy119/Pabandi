import { Router, Request, Response, NextFunction } from 'express';
import { marketingAgent } from '../services/marketingAgent.service';
import { socialExec } from '../services/socialExec.service';
import { farcasterExec } from '../services/farcasterExec.service';

const router = Router();

/**
 * GET /api/v1/marketing/status
 * Shows whether the agent is in DRY_RUN or LIVE for X + Farcaster, and how to flip.
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      x: socialExec.isDryRun() ? 'DRY_RUN' : 'LIVE',
      farcaster: farcasterExec.isDryRun() ? 'DRY_RUN' : 'LIVE',
      note: 'DRY_RUN logs the exact command, executes nothing, costs $0. To go live: X needs xurl auth + SOCIAL_LIVE=true; Farcaster needs an authorized signer + FARCASTER_LIVE=true. Enable MARKETING_AUTONOMOUS=true to schedule.',
    },
  });
});

/**
 * GET /api/v1/marketing/draft
 * Compose a post using live stats but DO NOT post (safe preview, always free).
 */
router.get('/draft', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const text = await marketingAgent.composePost();
    res.json({ success: true, data: { text, mode: socialExec.isDryRun() ? 'DRY_RUN' : 'LIVE' } });
  } catch (e) { next(e); }
});

/**
 * POST /api/v1/marketing/post-now
 * Generate + post a marketing update. In DRY_RUN it logs the exact command.
 */
router.post('/post-now', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await marketingAgent.generateAndPost();
    res.json({ success: true, data: { text: post.text, dryRun: post.dryRun } });
  } catch (e) { next(e); }
});

/**
 * POST /api/v1/marketing/engage
 * Run an autonomous engagement sweep (search + decide reposts/replies).
 */
router.post('/engage', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await marketingAgent.runEngagementSweep();
    res.json({ success: true, data: { dryRun: r.dryRun, decisions: r.decisions } });
  } catch (e) { next(e); }
});

/**
 * POST /api/v1/marketing/farcaster/post-now
 * Generate + post a marketing update to Farcaster. DRY_RUN logs the exact command.
 */
router.post('/farcaster/post-now', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await marketingAgent.generateAndPostFarcaster();
    res.json({ success: true, data: { text: post.text, dryRun: post.dryRun } });
  } catch (e) { next(e); }
});

/**
 * POST /api/v1/marketing/farcaster/engage
 * Run an autonomous Farcaster engagement sweep.
 */
router.post('/farcaster/engage', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await marketingAgent.runFarcasterSweep();
    res.json({ success: true, data: { dryRun: r.dryRun, decisions: r.decisions } });
  } catch (e) { next(e); }
});

/**
 * POST /api/v1/marketing/demo
 * Run the full pipeline locally (compose + engage) against a mock feed and write a
 * visible transcript. Proof-before-you-pay: same logic as live, zero cost, no creds.
 */
router.post('/demo', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await marketingAgent.runDemo();
    res.json({ success: true, data: { transcript: r.transcript, log: process.env.MARKETING_DEMO_LOG || '.marketing-demo/log.jsonl' } });
  } catch (e) { next(e); }
});

export default router;
