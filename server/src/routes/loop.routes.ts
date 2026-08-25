import { Router, Request, Response, NextFunction } from 'express';
import { loopService } from '../services/loop.service';

const router = Router();

/** GET /api/v1/loops — segment state + durable cumulative stats. */
router.get('/', async (_req: Request, res: Response) => {
  const stats = await loopService.loopStats().catch(() => ({ posted: 0, completed: 0, claimed: 0, open: 0 }));
  res.json({ success: true, data: { ...loopService.state(), stats } });
});

/** GET /api/v1/loops/activity — live feed of recent post/claim/complete events (durable DB). */
router.get('/activity', async (_req: Request, res: Response) => {
  const rows = await loopService.recentActivity(20).catch(() => []);
  res.json({ success: true, data: rows });
});

/** GET /api/v1/loops/stats — durable counters (survive cold starts). */
router.get('/stats', async (_req: Request, res: Response) => {
  const stats = await loopService.loopStats().catch(() => ({ posted: 0, completed: 0, claimed: 0, open: 0 }));
  res.json({ success: true, data: stats });
});

/** POST /api/v1/loops/owners/run — manually trigger the project-owner (requestor) loop. */
router.post('/owners/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const n = (req.body || {}).n || 3;
    const ids = await loopService.runProjectOwnerLoop(n, (req.body || {}).referralCode || 'PABANDI');
    res.json({ success: true, data: { posted: ids.length, gigIds: ids } });
  } catch (e: any) { next(e); }
});

/** POST /api/v1/loops/freelancers/run — manually trigger the freelancer (acceptor) loop. */
router.post('/freelancers/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = await loopService.runFreelancerLoop((req.body || {}).limit || 10);
    res.json({ success: true, data: { worked: out.length, results: out } });
  } catch (e: any) { next(e); }
});

export default router;
