import { Router, Request, Response, NextFunction } from 'express';
import { loopService } from '../services/loop.service';
import { prisma } from '../utils/database';

const router = Router();

/** GET /api/v1/loops/selfcheck — proves the live Prisma client can write+read GigEvent (cache-bust verification). */
router.get('/selfcheck', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const before = await prisma.gigEvent.count();
    const row = await prisma.gigEvent.create({ data: { kind: 'SELFCHECK', role: 'system', gigId: 'selfcheck', source: 'ai-loop' } });
    const after = await prisma.gigEvent.count();
    await prisma.gigEvent.delete({ where: { id: row.id } });
    res.json({ success: true, data: { clientLive: true, before, after, wrote: after === before + 1 } });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message, clientLive: false }); }
});

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

/** GET /api/v1/loops/agent — the autonomous freelancer agent's live PAB trust state. */
router.get('/agent', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = await (await import('../utils/database')).prisma.web3Agent.findFirst({ where: { isActive: true }, orderBy: { balancePab: 'desc' } });
    if (!agent) return res.json({ success: true, data: null });
    res.json({ success: true, data: { agentId: agent.id, category: agent.category, balancePab: agent.balancePab, walletAddress: agent.walletAddress } });
  } catch (e: any) { next(e); }
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

/** POST /api/v1/loops/wake — fire the autonomous heartbeat once (catch-up). Called by the board/launch
 *  page on load so the open board is never empty when a human visits, even on Render Free (sleeps when idle).
 *  Phases: owner posts gigs (up to pipeline target) → agents BID (gigs stay OPEN with competing bids → visible board).
 *  Delivery is deliberately NOT in wake — it runs on a slower cadence via the 24/7 pinger, so the board
 *  shows a living pipeline of open, competing gigs rather than emptying instantly. */
router.post('/wake', async (_req: Request, res: Response) => {
  res.json({ success: true, data: { triggered: true, note: 'autonomous heartbeat running' } });
  loopService.runProjectOwnerLoop(3, 'PABANDI', 6).catch(() => {});
  setTimeout(() => loopService.runFreelancerLoop(10).catch(() => {}), 1200); // bid phase: gigs stay OPEN w/ competing bids
});

/** POST /api/v1/loops/heartbeat — full cycle including delivery. Used by the 24/7 external pinger (slow cadence). */
router.post('/heartbeat', async (_req: Request, res: Response) => {
  res.json({ success: true, data: { triggered: true, note: 'full cycle incl. delivery' } });
  loopService.runProjectOwnerLoop(2, 'PABANDI', 6).catch(() => {});
  setTimeout(() => loopService.runFreelancerLoop(10).catch(() => {}), 1200);
  setTimeout(() => loopService.runFreelancerDeliver(2).catch(() => {}), 5000); // deliver a few → feed shows delivery
});

/** POST /api/v1/loops/freelancers/deliver — accept best bid + deliver a limited number of open gigs. */
router.post('/freelancers/deliver', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = await loopService.runFreelancerDeliver((req.body || {}).limit || 2);
    res.json({ success: true, data: { delivered: out.length, results: out } });
  } catch (e: any) { next(e); }
});

export default router;
