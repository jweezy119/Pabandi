/**
 * PPD (Pabandi Protected Deposit) deepened rail:
 *   A) Milestone draws (construction/fleet phased release)
 *   B) Performance bonds (Pabond-underwritten)
 *   C) Community pools (HOA yield → community)
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ppdService } from '../services/ppd.service';
import { prisma } from '../utils/database';

const router = Router();

// ── A. Milestone project ──────────────────────────────────────────────────
router.post('/milestone-project', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const body = req.body ?? {};
    const { landlordId, depositContext, assetDescription, requiredAmountUSD, yieldOptIn, communityPoolOptIn, pool, beneficiaryBackgroundCheckId, milestones, retentionPct } = body;
    if (!landlordId || !assetDescription || !requiredAmountUSD || !Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({ success: false, error: 'landlordId, assetDescription, requiredAmountUSD, milestones[] required' });
    }
    const result = await ppdService.createMilestoneProject({
      tenantId: userId,
      landlordId,
      depositContext,
      assetDescription,
      requiredAmountUSD: Number(requiredAmountUSD),
      yieldOptIn,
      communityPoolOptIn,
      pool,
      beneficiaryBackgroundCheckId,
      milestones,
      retentionPct: retentionPct ? Number(retentionPct) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/milestone/:id/release', authenticate, async (req: Request, res: Response) => {
  try {
    const { lienWaiverUrl, signedBy, bcCheckId } = req.body ?? {};
    const result = await ppdService.releaseMilestone(req.params.id, { lienWaiverUrl, signedBy, bcCheckId });
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── B. Performance bond ────────────────────────────────────────────────────
router.post('/bond', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { depositId, beneficiaryId, depositContext, coverageUSD } = req.body ?? {};
    if (!depositId || !beneficiaryId || !coverageUSD) {
      return res.status(400).json({ success: false, error: 'depositId, beneficiaryId, coverageUSD required' });
    }
    const bond = await ppdService.underwriteBond({
      depositId,
      beneficiaryId,
      payerId: userId,
      depositContext,
      coverageUSD: Number(coverageUSD),
    });
    res.json({ success: true, data: bond });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/bond/:id/claim', authenticate, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body ?? {};
    const bond = await ppdService.claimBond(req.params.id, reason || 'default');
    res.json({ success: true, data: bond });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── C. Community pool (HOA) ─────────────────────────────────────────────────
router.post('/community-pool', authenticate, async (req: Request, res: Response) => {
  try {
    const { communityName, treasuryWallet } = req.body ?? {};
    if (!communityName) return res.status(400).json({ success: false, error: 'communityName required' });
    const pool = await ppdService.createCommunityPool(communityName, treasuryWallet);
    res.json({ success: true, data: pool });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/community-pool/:id/route-deposit', authenticate, async (req: Request, res: Response) => {
  try {
    const { depositId } = req.body ?? {};
    if (!depositId) return res.status(400).json({ success: false, error: 'depositId required' });
    const pool = await ppdService.routeDepositToPool(req.params.id, depositId);
    res.json({ success: true, data: pool });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/community-pool/:id/grant', authenticate, async (req: Request, res: Response) => {
  try {
    const { title, amountUSD, description } = req.body ?? {};
    if (!title || !amountUSD) return res.status(400).json({ success: false, error: 'title, amountUSD required' });
    const grant = await ppdService.proposeCommunityGrant(req.params.id, title, Number(amountUSD), description);
    res.json({ success: true, data: grant });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/community-grant/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const { approvedBy } = req.body ?? {};
    const grant = await ppdService.approveCommunityGrant(req.params.id, approvedBy || (req as any).user?.id);
    res.json({ success: true, data: grant });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Public HOA transparency dashboard
router.get('/community-pool/:id/dashboard', async (req: Request, res: Response) => {
  try {
    const dash = await ppdService.getCommunityDashboard(req.params.id);
    res.json({ success: true, data: dash });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Migrate new tables (Cloud Run FS read-only) ─────────────────────────────
router.post('/migrate', async (req: Request, res: Response) => {
  try {
    const stmts = [
      `CREATE TABLE IF NOT EXISTS "ProjectMilestone" ("id" TEXT NOT NULL PRIMARY KEY, "depositId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "sequence" INTEGER NOT NULL DEFAULT 0, "amountUSD" DOUBLE PRECISION NOT NULL, "requiresLienWaiver" BOOLEAN NOT NULL DEFAULT false, "requiresBcRefresh" BOOLEAN NOT NULL DEFAULT false, "requiresSignoff" BOOLEAN NOT NULL DEFAULT true, "status" TEXT NOT NULL DEFAULT 'PENDING', "releasedAt" TIMESTAMP(3), "releasedTxHash" TEXT, "lienWaiverUrl" TEXT, "bcCheckId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS "PerformanceBond" ("id" TEXT NOT NULL PRIMARY KEY, "depositId" TEXT NOT NULL, "beneficiaryId" TEXT NOT NULL, "payerId" TEXT NOT NULL, "depositContext" TEXT NOT NULL DEFAULT 'BUILDER', "coverageUSD" DOUBLE PRECISION NOT NULL, "premiumUSD" DOUBLE PRECISION NOT NULL, "velocityMult" DOUBLE PRECISION NOT NULL DEFAULT 1.0, "status" TEXT NOT NULL DEFAULT 'PROPOSED', "claimedAt" TIMESTAMP(3), "claimReason" TEXT, "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS "CommunityPool" ("id" TEXT NOT NULL PRIMARY KEY, "communityName" TEXT NOT NULL, "treasuryWallet" TEXT, "totalDepositsUSD" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalYieldUSD" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalDistributedUSD" DOUBLE PRECISION NOT NULL DEFAULT 0, "memberCount" INTEGER NOT NULL DEFAULT 0, "publicDashboard" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS "CommunityGrant" ("id" TEXT NOT NULL PRIMARY KEY, "poolId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "amountUSD" DOUBLE PRECISION NOT NULL, "status" TEXT NOT NULL DEFAULT 'PROPOSED', "approvedBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE INDEX IF NOT EXISTS "ProjectMilestone_depositId_idx" ON "ProjectMilestone"("depositId")`,
      `CREATE INDEX IF NOT EXISTS "ProjectMilestone_status_idx" ON "ProjectMilestone"("status")`,
      `CREATE INDEX IF NOT EXISTS "PerformanceBond_depositId_idx" ON "PerformanceBond"("depositId")`,
      `CREATE INDEX IF NOT EXISTS "PerformanceBond_beneficiaryId_idx" ON "PerformanceBond"("beneficiaryId")`,
      `CREATE INDEX IF NOT EXISTS "PerformanceBond_payerId_idx" ON "PerformanceBond"("payerId")`,
      `CREATE INDEX IF NOT EXISTS "CommunityGrant_poolId_idx" ON "CommunityGrant"("poolId")`,
      `CREATE INDEX IF NOT EXISTS "CommunityGrant_status_idx" ON "CommunityGrant"("status")`,
    ];
    for (const s of stmts) await prisma.$executeRawUnsafe(s);
    res.json({ success: true, message: 'PPD tables migrated' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
