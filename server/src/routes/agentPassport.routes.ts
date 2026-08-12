/**
 * Agent Capability Passport (ACP) routes — the AI-agent trust standard.
 *
 *   POST /api/v1/agent-passport/issue   -> issue a signed passport (auth + metered)
 *   GET  /api/v1/agent-passport/verify  -> public, no-auth one-call verification
 *   GET  /api/v1/agent-passport/ledger/:key -> public audit of a charge
 *   GET  /.well-known/ptp.json          -> discovery doc (public key + endpoints)
 *
 * Economic loop (fault-tolerant + foolproof):
 *   - capabilities are validated against the owner's risk band (no privilege escalation)
 *   - each issue is idempotently charged (retry-safe, never double-billed)
 *   - daily per-owner issue cap prevents abuse
 *   - FAIL-CLOSED: if the ledger can't record the charge, no passport is issued
 *   - verifiers never pay, so verify() stays offline and always works
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ptpEngine } from '../protocol/ptp.spec';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { passportEconomy, validateCapabilities, PTPRiskBand } from '../services/passportEconomy.service';
import { PAB_FEE_PER_PASSPORT } from '../config/tokenomics';

const router = Router();

// Issue an Agent Capability Passport for the authenticated user's agent.
router.post('/issue', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'unauthenticated' });
    const { agentId, capabilities, idempotencyKey } = req.body ?? {};
    if (!agentId || !Array.isArray(capabilities) || capabilities.length === 0) {
      return res.status(400).json({ success: false, error: 'agentId + non-empty capabilities[] required' });
    }

    // Derive the owner's trust band (foolproof ceiling source of truth).
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true } });
    const score = user?.trustScore || 70;
    const band = ptpEngine.scoreToRiskBand(score) as PTPRiskBand;

    // FENCE: reject any capability not allowed / exceeding the band ceiling.
    const capCheck = validateCapabilities(band, capabilities);
    if (!capCheck.ok) {
      return res.status(403).json({ success: false, error: `capability rejected: ${capCheck.reason}` });
    }

    // ECONOMIC LOOP (fail-closed + idempotent). Throws if ledger can't record.
    let charge;
    try {
      charge = await passportEconomy.chargeIssue({ ownerUserId: userId, agentId, riskBand: band, capabilities, idempotencyKey });
    } catch (e: any) {
      return res.status(402).json({ success: false, error: `issuance not recorded (not charged): ${e.message}` });
    }

    let velocity: { direction: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE'; momentum: number; confidence: number } = {
      direction: 'STEADY', momentum: 0, confidence: 0.5,
    };
    try {
      const { trustFluxService } = await import('../services/trustFlux.service');
      const flux = await trustFluxService.computeTrustFlux(userId);
      velocity = { direction: flux.trend, momentum: Math.abs(flux.velocity), confidence: flux.confidence };
    } catch { /* default velocity */ }

    const att = ptpEngine.issueAgentPassport({ agentId, ownerUserId: userId, capabilities, trustScore: score, velocity });
    res.json({
      success: true,
      data: att,
      economics: {
        feePab: charge.feePab,
        alreadyCharged: charge.alreadyCharged,
        idempotencyKey: charge.idempotencyKey,
        riskBand: band,
        ledgerId: charge.record?.id,
      },
    });
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

// Public audit of a charge (idempotency key -> record). Anyone can verify billing.
router.get('/ledger/:idempotencyKey', async (req: Request, res: Response) => {
  try {
    const rec = await passportEconomy.lookup(req.params.idempotencyKey);
    if (!rec) return res.status(404).json({ success: false, error: 'no such issuance' });
    res.json({
      success: true,
      data: {
        idempotencyKey: rec.idempotencyKey,
        ownerUserId: rec.ownerUserId,
        agentId: rec.agentId,
        riskBand: rec.riskBand,
        feePab: rec.feePab,
        capabilities: rec.capabilities,
        chargedAt: rec.chargedAt,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Discovery document so external agents can find the verify endpoint + public key.
router.get('/.well-known/ptp.json', async (req: Request, res: Response) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json(ptpEngine.getDiscoveryDocument(base));
});

export default router;
