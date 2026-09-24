"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * PPD (Pabandi Protected Deposit) deepened rail:
 *   A) Milestone draws (construction/fleet phased release)
 *   B) Performance bonds (Pabond-underwritten)
 *   C) Community pools (HOA yield → community)
 */
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const ppd_service_1 = require("../services/ppd.service");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
// ── A. Milestone project ──────────────────────────────────────────────────
router.post('/milestone-project', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const body = req.body ?? {};
        const { landlordId, depositContext, assetDescription, requiredAmountUSD, yieldOptIn, communityPoolOptIn, pool, beneficiaryBackgroundCheckId, milestones, retentionPct } = body;
        if (!landlordId || !assetDescription || !requiredAmountUSD || !Array.isArray(milestones) || milestones.length === 0) {
            return res.status(400).json({ success: false, error: 'landlordId, assetDescription, requiredAmountUSD, milestones[] required' });
        }
        const result = await ppd_service_1.ppdService.createMilestoneProject({
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
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/milestone/:id/release', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { lienWaiverUrl, signedBy, bcCheckId } = req.body ?? {};
        const result = await ppd_service_1.ppdService.releaseMilestone(req.params.id, { lienWaiverUrl, signedBy, bcCheckId });
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Worker instant-pay ledger (pay-on-verified-work)
router.get('/worker-payouts', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const rows = await database_1.prisma.workerPayout.findMany({
            where: { userId: req.user?.id },
            orderBy: { createdAt: 'desc' },
        });
        const total = rows.reduce((s, r) => s + (r.netUsdc || 0), 0);
        const fees = rows.reduce((s, r) => s + (r.feeUsdc || 0), 0);
        res.json({ success: true, data: { payouts: rows, totalNetUsdc: +total.toFixed(2), totalFeesUsdc: +fees.toFixed(2), count: rows.length } });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── B. Performance bond ────────────────────────────────────────────────────
router.post('/bond', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { depositId, beneficiaryId, depositContext, coverageUSD } = req.body ?? {};
        if (!depositId || !beneficiaryId || !coverageUSD) {
            return res.status(400).json({ success: false, error: 'depositId, beneficiaryId, coverageUSD required' });
        }
        const bond = await ppd_service_1.ppdService.underwriteBond({
            depositId,
            beneficiaryId,
            payerId: userId,
            depositContext,
            coverageUSD: Number(coverageUSD),
        });
        res.json({ success: true, data: bond });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/bond/:id/claim', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { reason } = req.body ?? {};
        const bond = await ppd_service_1.ppdService.claimBond(req.params.id, reason || 'default');
        res.json({ success: true, data: bond });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── C. Community pool (HOA) ─────────────────────────────────────────────────
router.post('/community-pool', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { communityName, treasuryWallet } = req.body ?? {};
        if (!communityName)
            return res.status(400).json({ success: false, error: 'communityName required' });
        const pool = await ppd_service_1.ppdService.createCommunityPool(communityName, treasuryWallet);
        res.json({ success: true, data: pool });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/community-pool/:id/route-deposit', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { depositId } = req.body ?? {};
        if (!depositId)
            return res.status(400).json({ success: false, error: 'depositId required' });
        const pool = await ppd_service_1.ppdService.routeDepositToPool(req.params.id, depositId);
        res.json({ success: true, data: pool });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/community-pool/:id/grant', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { title, amountUSD, description } = req.body ?? {};
        if (!title || !amountUSD)
            return res.status(400).json({ success: false, error: 'title, amountUSD required' });
        const grant = await ppd_service_1.ppdService.proposeCommunityGrant(req.params.id, title, Number(amountUSD), description);
        res.json({ success: true, data: grant });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/community-grant/:id/approve', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { approvedBy } = req.body ?? {};
        const grant = await ppd_service_1.ppdService.approveCommunityGrant(req.params.id, approvedBy || req.user?.id);
        res.json({ success: true, data: grant });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Public HOA transparency dashboard
router.get('/community-pool/:id/dashboard', async (req, res) => {
    try {
        const dash = await ppd_service_1.ppdService.getCommunityDashboard(req.params.id);
        res.json({ success: true, data: dash });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── Migrate new tables (Cloud Run FS read-only) ─────────────────────────────
router.post('/migrate', async (req, res) => {
    try {
        const stmts = [
            `CREATE TABLE IF NOT EXISTS "ProjectMilestone" ("id" TEXT NOT NULL PRIMARY KEY, "depositId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "sequence" INTEGER NOT NULL DEFAULT 0, "amountUSD" DOUBLE PRECISION NOT NULL, "requiresLienWaiver" BOOLEAN NOT NULL DEFAULT false, "requiresBcRefresh" BOOLEAN NOT NULL DEFAULT false, "requiresSignoff" BOOLEAN NOT NULL DEFAULT true, "status" TEXT NOT NULL DEFAULT 'PENDING', "releasedAt" TIMESTAMP(3), "releasedTxHash" TEXT, "lienWaiverUrl" TEXT, "bcCheckId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS "PerformanceBond" ("id" TEXT NOT NULL PRIMARY KEY, "depositId" TEXT NOT NULL, "beneficiaryId" TEXT NOT NULL, "payerId" TEXT NOT NULL, "depositContext" TEXT NOT NULL DEFAULT 'BUILDER', "coverageUSD" DOUBLE PRECISION NOT NULL, "premiumUSD" DOUBLE PRECISION NOT NULL, "velocityMult" DOUBLE PRECISION NOT NULL DEFAULT 1.0, "status" TEXT NOT NULL DEFAULT 'PROPOSED', "claimedAt" TIMESTAMP(3), "claimReason" TEXT, "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS "CommunityPool" ("id" TEXT NOT NULL PRIMARY KEY, "communityName" TEXT NOT NULL, "treasuryWallet" TEXT, "totalDepositsUSD" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalYieldUSD" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalDistributedUSD" DOUBLE PRECISION NOT NULL DEFAULT 0, "memberCount" INTEGER NOT NULL DEFAULT 0, "publicDashboard" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS "CommunityGrant" ("id" TEXT NOT NULL PRIMARY KEY, "poolId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "amountUSD" DOUBLE PRECISION NOT NULL, "status" TEXT NOT NULL DEFAULT 'PROPOSED', "approvedBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS "WorkerPayout" ("id" TEXT NOT NULL PRIMARY KEY, "milestoneId" TEXT NOT NULL, "depositId" TEXT NOT NULL, "userId" TEXT NOT NULL, "grossUsdc" DOUBLE PRECISION NOT NULL, "settlementBps" DOUBLE PRECISION NOT NULL, "feeUsdc" DOUBLE PRECISION NOT NULL, "netUsdc" DOUBLE PRECISION NOT NULL, "status" TEXT NOT NULL DEFAULT 'PAID', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
            `ALTER TABLE "ProjectMilestone" ADD COLUMN IF NOT EXISTS "creditedUserId" TEXT`,
            `ALTER TABLE "ProjectMilestone" ADD COLUMN IF NOT EXISTS "creditedUsdc" DOUBLE PRECISION`,
            `ALTER TABLE "ProjectMilestone" ADD COLUMN IF NOT EXISTS "settlementBps" DOUBLE PRECISION`,
            `CREATE INDEX IF NOT EXISTS "ProjectMilestone_depositId_idx" ON "ProjectMilestone"("depositId")`,
            `CREATE INDEX IF NOT EXISTS "ProjectMilestone_status_idx" ON "ProjectMilestone"("status")`,
            `CREATE INDEX IF NOT EXISTS "PerformanceBond_depositId_idx" ON "PerformanceBond"("depositId")`,
            `CREATE INDEX IF NOT EXISTS "PerformanceBond_beneficiaryId_idx" ON "PerformanceBond"("beneficiaryId")`,
            `CREATE INDEX IF NOT EXISTS "PerformanceBond_payerId_idx" ON "PerformanceBond"("payerId")`,
            `CREATE INDEX IF NOT EXISTS "CommunityGrant_poolId_idx" ON "CommunityGrant"("poolId")`,
            `CREATE INDEX IF NOT EXISTS "CommunityGrant_status_idx" ON "CommunityGrant"("status")`,
        ];
        for (const s of stmts)
            await database_1.prisma.$executeRawUnsafe(s);
        res.json({ success: true, message: 'PPD tables migrated' });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=ppd.routes.js.map