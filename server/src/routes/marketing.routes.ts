import { Router, Request, Response, NextFunction } from 'express';
import { marketingAgent } from '../services/marketingAgent.service';
import { socialExec } from '../services/socialExec.service';

const router = Router();

/**
 * GET /api/v1/marketing/status
 * Shows whether the agent is in DRY_RUN or LIVE, and how to flip it.
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      mode: socialExec.isDryRun() ? 'DRY_RUN' : 'LIVE',
      note: socialExec.isDryRun()
        ? 'No posts go live. Set SOCIAL_LIVE=true + install/authenticate `xurl` (xurl auth oauth2) to go live. Commands are logged, not executed.'
        : 'Live mode active — xurl is posting/engaging on your behalf.',
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

export default router;
