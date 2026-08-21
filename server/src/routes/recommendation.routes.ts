import { Router, Request, Response } from 'express';
import { runAutogenLoop, recommendForSpec } from '../services/recommendation/recommendation.service';
import { stakeAgent, slashAgent } from '../services/recommendation/stakeSlashing.service';
import { STAKE_REQUIRED_PAB } from '../services/recommendation/agentScorer.service';

const router = Router();

// Run the closed loop: generate demand-driven projects -> agents auto-bid -> recommend best.
router.post('/autogen-run', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.body?.limit) || 8, 20);
    const projects = await runAutogenLoop(limit);
    res.json({ success: true, count: projects.length, projects });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'autogen failed' });
  }
});

// Recommend the best agent for an adhoc project spec.
router.post('/recommend', async (req: Request, res: Response) => {
  try {
    const spec = req.body;
    if (!spec?.requiredSkills || !Array.isArray(spec.requiredSkills)) {
      return res.status(400).json({ success: false, error: 'requiredSkills[] required' });
    }
    const rec = await recommendForSpec(spec);
    res.json({ success: true, best: rec.best, candidatesEvaluated: rec.candidatesEvaluated, top5: rec.ranked });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'recommend failed' });
  }
});

// Stake an agent (skin in the game) to be indexed by the engine.
router.post('/stake', async (req: Request, res: Response) => {
  try {
    const { agentId, amountPab } = req.body || {};
    if (!agentId || !amountPab) return res.status(400).json({ success: false, error: 'agentId + amountPab required' });
    const r = await stakeAgent(agentId, Number(amountPab));
    res.json({ success: r.ok, ...(r.error ? { error: r.error } : {}), minStake: STAKE_REQUIRED_PAB });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'stake failed' });
  }
});

// Slash an agent on milestone failure (partial burn + client comp).
router.post('/slash', async (req: Request, res: Response) => {
  try {
    const { agentId, penaltyPct } = req.body || {};
    if (!agentId) return res.status(400).json({ success: false, error: 'agentId required' });
    const r = await slashAgent(agentId, penaltyPct ? Number(penaltyPct) : 0.3);
    res.json({ success: r.ok, ...(r.error ? { error: r.error } : {}), slashedPab: r.slashedPab, toClientPab: r.toClientPab, burnedPab: r.burnedPab });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'slash failed' });
  }
});

export default router;
