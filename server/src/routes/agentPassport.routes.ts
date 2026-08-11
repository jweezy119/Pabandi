/**
 * Agent Capability Passport (ACP) routes — the AI-agent trust standard.
 *
 *   POST /api/v1/agent-passport/issue   -> issue a signed passport for an agent (auth)
 *   GET  /api/v1/agent-passport/verify  -> public, no-auth one-call verification
 *   GET  /.well-known/ptp.json          -> discovery doc (public key + endpoints)
 *
 * The issued attestation is self-verifying (offline via Pabandi's public key),
 * so any website or agent framework can check an agent's permission to act
 * WITHOUT calling Pabandi — that portability is what makes it a standard.
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ptpEngine } from '../protocol/ptp.spec';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// Issue an Agent Capability Passport for the authenticated user's agent.
router.post('/issue', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'unauthenticated' });
    const { agentId, capabilities } = req.body ?? {};
    if (!agentId || !Array.isArray(capabilities) || capabilities.length === 0) {
      return res.status(400).json({ success: false, error: 'agentId + non-empty capabilities[] required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true } });
    const score = user?.trustScore || 70;

    let velocity: { direction: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE'; momentum: number; confidence: number } = {
      direction: 'STEADY', momentum: 0, confidence: 0.5,
    };
    try {
      const { trustFluxService } = await import('../services/trustFlux.service');
      const flux = await trustFluxService.computeTrustFlux(userId);
      velocity = { direction: flux.trend, momentum: Math.abs(flux.velocity), confidence: flux.confidence };
    } catch { /* default velocity */ }

    const att = ptpEngine.issueAgentPassport({ agentId, ownerUserId: userId, capabilities, trustScore: score, velocity });
    res.json({ success: true, data: att });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Public, no-auth verification — the "standard" one-call check any site/agent uses.
// `token` is a base64-encoded PTPAgentAttestation; `need` optionally requires a capability.
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    const need = req.query.need as string | undefined;
    if (!token) return res.status(400).json({ success: false, error: 'token (base64 attestation) required' });
    let att: any;
    try {
      att = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    } catch {
      return res.status(400).json({ success: false, error: 'token is not valid base64 JSON' });
    }
    const result = ptpEngine.verifyAgentPassport(att, need);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: 'invalid token: ' + e.message });
  }
});

// Discovery document so external agents can find the verify endpoint + public key.
router.get('/.well-known/ptp.json', async (req: Request, res: Response) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json(ptpEngine.getDiscoveryDocument(base));
});

export default router;
