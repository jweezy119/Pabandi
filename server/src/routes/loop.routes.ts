import { Router, Request, Response, NextFunction } from 'express';
import { loopService } from '../services/loop.service';

const router = Router();

/** GET /api/v1/loops — segment state (the "db folder" view: owners vs freelancers). */
router.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, data: loopService.state() });
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

/** GET /api/v1/loops/activity — live feed of recent post/claim/complete events. */
router.get('/activity', (_req: Request, res: Response) => {
  res.json({ success: true, data: loopService.recentActivity(20) });
});

export default router;
