/**
 * agentLoop.routes.ts — Control + observe the AI-agent booking loop.
 *
 *  POST /prepare-live   Pre-create all agent PAB ATAs + fund each agent with SOL for tx
 *                       fees (one-time, ~0.13 SOL for 65 agents). Makes a small SOL
 *                       balance (e.g. 0.6) viable for LIVE on-chain bookings.
 *  POST /run-once       Run one booking cycle now (respects LIVE_BOOKINGS env).
 *  GET  /state          Current loop state (running, live, totals).
 *  GET  /sol-buffer     Funded-wallet SOL balance + how many agents hold SOL.
 */
import { Router, Request, Response } from 'express';
import { runAgentLoopCycle, prepareLiveRails, getAgentLoopState, startAgentLoop, stopAgentLoop } from '../services/agentLoop.service';
import { web3AgentService } from '../services/web3Agent.service';
import { prisma } from '../utils/database';

const router = Router();

router.post('/prepare-live', async (req: Request, res: Response): Promise<any> => {
  const { solBudget, perAgentSol } = req.body || {};
  try {
    const r = await prepareLiveRails({ solBudget: solBudget ? Number(solBudget) : undefined, perAgentSol: perAgentSol ? Number(perAgentSol) : undefined });
    if (r.error) return res.status(400).json({ success: false, error: r.error });
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/run-once', async (_req: Request, res: Response): Promise<any> => {
  try {
    const r = await runAgentLoopCycle();
    res.json({ success: true, data: r });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/state', (_req: Request, res: Response): any => {
  res.json({ success: true, data: getAgentLoopState() });
});

router.get('/bookings', async (_req: Request, res: Response): Promise<any> => {
  try {
    const rows = await prisma.agentBooking.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ success: true, data: rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/sol-buffer', async (_req: Request, res: Response): Promise<any> => {
  try { res.json({ success: true, data: await web3AgentService.liveSolBuffer() }); }
  catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/start', (_req: Request, res: Response): any => { startAgentLoop(); res.json({ success: true, data: getAgentLoopState() }); });
router.post('/stop', (_req: Request, res: Response): any => { stopAgentLoop(); res.json({ success: true, data: getAgentLoopState() }); });

export default router;
