/**
 * guaranteeClaim.routes.ts — P0: the real guarantee/claim rail HTTP endpoint.
 *
 *   POST /api/v1/guarantee/claim   — file a guarantee claim against a
 *                                     PerformanceBond (fail-closed, simulated
 *                                     when no live SOL key).
 *
 * The claim is a first-class, auditable event: EscrowEvent(kind=CLAIM) +
 * TreasuryPosition mint + PTP attestation + signed TrustAuditTrail.
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { guaranteeClaimService, ClaimInput } from '../services/guaranteeClaim.service';
import { z } from 'zod';

const router = Router();

const claimSchema = z.object({
  bondId: z.string().min(1),
  claimAmountUSD: z.number().positive().max(1_000_000),
  claimType: z.enum(['FRAUD', 'NO_SHOW', 'NON_DELIVERY', 'DEFECT']),
  evidence: z.string().min(1).max(2000),
  reason: z.string().max(500).optional(),
});

// ── POST /api/v1/guarantee/claim ───────────────────────────────────────────────
router.post('/claim', authenticate, async (req: Request, res: Response) => {
  try {
    const parsed = claimSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid claim input',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const input: ClaimInput = {
      bondId: parsed.data.bondId,
      claimAmountUSD: parsed.data.claimAmountUSD,
      claimType: parsed.data.claimType,
      evidence: parsed.data.evidence,
      reason: parsed.data.reason,
      claimerId: (req as any).user.id,
    };
    const result = await guaranteeClaimService.recordClaim(input);
    return res.status(201).json({ success: true, data: result });
  } catch (e: any) {
    const code = e.message === 'BOND_NOT_FOUND' ? 404
      : e.message === 'BOND_NOT_ACTIVE' || e.message === 'BOND_ALREADY_CLAIMED' || e.message === 'BOND_EXPIRED'
        ? 422
      : e.message === 'CLAIMERS_DONT_MATCH_BOND' || e.message === 'CLAIM_EXCEEDS_COVERAGE'
        ? 403
      : 500;
    return res.status(code).json({
      success: false,
      error: e.message,
      claimable: false,
    });
  }
});

// ── GET /api/v1/guarantee/status/:bondId ────────────────────────────────────────
router.get('/status/:bondId', authenticate, async (req: Request, res: Response) => {
  try {
    const bond = await (await import('../utils/database')).prisma.performanceBond.findUnique({
      where: { id: req.params.bondId },
      select: { id: true, status: true, coverageUSD: true, claimedAt: true, expiresAt: true },
    });
    if (!bond) return res.status(404).json({ success: false, error: 'BOND_NOT_FOUND' });
    return res.json({
      success: true,
      data: {
        bondId: bond.id,
        status: bond.status,
        coverageUSD: bond.coverageUSD,
        claimedAt: bond.claimedAt?.toISOString() || null,
        expiresAt: bond.expiresAt?.toISOString() || null,
        claimable: bond.status === 'ACTIVE' && !bond.claimedAt && (!bond.expiresAt || new Date(bond.expiresAt) > new Date()),
      },
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
