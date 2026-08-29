"use strict";
/**
 * Pabandi Yield Deposit (PYD) API — non-custodial rental security deposits.
 *
 * Pabandi is infrastructure only: records the trust-based deposit reduction,
 * facilitates the tenant+landlord yield-pool agreement, and orchestrates
 * non-custodial escrow settlement. Pabandi never holds principal.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const pyd_service_1 = require("../services/pyd.service");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
/**
 * Create a security deposit (applies tenant's PTP band deposit reduction).
 * POST /api/v1/pyd/deposit
 */
router.post('/deposit', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const body = req.body ?? {};
        const { landlordId, depositContext, assetDescription, requiredAmountUSD, yieldOptIn, communityPoolOptIn, pool, beneficiaryBackgroundCheckId } = body;
        if (!landlordId || !assetDescription || !requiredAmountUSD) {
            return res.status(400).json({ success: false, error: 'landlordId, assetDescription, requiredAmountUSD required' });
        }
        const result = await pyd_service_1.pydService.createDeposit({
            tenantId: userId,
            landlordId,
            depositContext,
            assetDescription,
            requiredAmountUSD: Number(requiredAmountUSD),
            yieldOptIn,
            communityPoolOptIn,
            pool: pool,
            beneficiaryBackgroundCheckId,
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * Propose / view a yield agreement for a deposit.
 * POST /api/v1/pyd/deposit/:id/yield-agreement
 */
router.post('/deposit/:id/yield-agreement', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { pool } = req.body ?? {};
        const agreement = await pyd_service_1.pydService.proposeYieldAgreement(req.params.id, userId, req.body.landlordId, pool ?? 'JITO_STSOL');
        res.json({ success: true, data: agreement });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * Tenant signs the yield agreement.
 * POST /api/v1/pyd/yield-agreement/:id/sign-tenant
 */
router.post('/yield-agreement/:id/sign-tenant', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const ag = await pyd_service_1.pydService.signAsTenant(req.params.id, userId);
        res.json({ success: true, data: ag });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * Landlord signs the yield agreement.
 * POST /api/v1/pyd/yield-agreement/:id/sign-landlord
 */
router.post('/yield-agreement/:id/sign-landlord', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const ag = await pyd_service_1.pydService.signAsLandlord(req.params.id, userId);
        res.json({ success: true, data: ag });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * Fund the deposit into the non-custodial Solana escrow contract.
 * POST /api/v1/pyd/deposit/:id/fund
 */
router.post('/deposit/:id/fund', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { tenantWallet } = req.body ?? {};
        if (!tenantWallet)
            return res.status(400).json({ success: false, error: 'tenantWallet required' });
        const deposit = await pyd_service_1.pydService.fundEscrow(req.params.id, tenantWallet);
        res.json({ success: true, data: deposit });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * Projected yield for a deposit (dashboard).
 * GET /api/v1/pyd/deposit/:id/project-yield?months=12
 */
router.get('/deposit/:id/project-yield', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const months = Number(req.query.months) || 12;
        const projection = await pyd_service_1.pydService.projectYield(req.params.id, months);
        res.json({ success: true, data: projection });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * Get a deposit with its yield agreement.
 * GET /api/v1/pyd/deposit/:id
 */
router.get('/deposit/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const deposit = await pyd_service_1.pydService.getDeposit(req.params.id);
        res.json({ success: true, data: deposit });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
/**
 * POST /api/v1/pyd/migrate
 * Add new SecurityDeposit columns for generalized PPD rail (Cloud Run FS read-only → raw SQL).
 */
router.post('/migrate', async (req, res) => {
    try {
        const cols = [
            `ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "depositContext" TEXT NOT NULL DEFAULT 'PROPERTY'`,
            `ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "bcReductionPct" DOUBLE PRECISION NOT NULL DEFAULT 0`,
            `ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "bcCheckId" TEXT`,
            `ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "communityPoolOptIn" BOOLEAN NOT NULL DEFAULT false`,
        ];
        for (const c of cols)
            await database_1.prisma.$executeRawUnsafe(c);
        res.json({ success: true, message: 'SecurityDeposit columns migrated' });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
//# sourceMappingURL=rentalDeposit.routes.js.map