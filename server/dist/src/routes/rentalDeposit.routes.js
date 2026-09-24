"use strict";
/**
 * Pabandi Yield Deposit (PYD) API — non-custodial rental security deposits.
 *
 * Pabandi is infrastructure only: records the trust-based deposit reduction,
 * facilitates the tenant+landlord yield-pool agreement, and orchestrates
 * non-custodial escrow settlement. Pabandi never holds principal.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const pyd_service_1 = require("../services/pyd.service");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Admin guard for internal/campaign operations (env-gated; no real admin login needed).
function requireAdminKey(req, res, next) {
    const key = process.env.ADMIN_API_KEY;
    if (!key)
        return res.status(403).json({ success: false, message: 'Admin operations disabled (ADMIN_API_KEY unset).' });
    const provided = req.headers['x-admin-key'] || req.query.adminKey;
    if (provided !== key)
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
    next();
}
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
/**
 * POST /api/v1/pyd/rent-stream
 * Create a tokenized rent stream (rent held in yield rail for float window).
 */
router.post('/rent-stream', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const tenantId = req.user?.id;
        const { landlordId, rentAmountUSD, propertyId, pool, expectedApy, holdingDays } = req.body ?? {};
        if (!landlordId || !rentAmountUSD) {
            return res.status(400).json({ success: false, error: 'landlordId, rentAmountUSD required' });
        }
        const { renterEquityService } = await Promise.resolve().then(() => __importStar(require('../services/renterEquity.service')));
        const stream = await renterEquityService.createRentStream({
            tenantId,
            landlordId,
            rentAmountUSD: Number(rentAmountUSD),
            propertyId,
            pool,
            expectedApy: expectedApy ? Number(expectedApy) : undefined,
            holdingDays: holdingDays ? Number(holdingDays) : undefined,
        });
        res.json({ success: true, data: stream });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/pyd/renter-equity/:userId
 * View a user's renter equity wallet (yield accrued, no principal).
 */
router.get('/renter-equity/:userId', async (req, res) => {
    try {
        const { renterEquityService } = await Promise.resolve().then(() => __importStar(require('../services/renterEquity.service')));
        const equity = await renterEquityService.getEquity(req.params.userId);
        res.json({ success: true, data: equity });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/pyd/usdy/config
 * Public view of the Ondo USDY rail status (mint, live flag, APY) — no secrets.
 */
router.get('/usdy/config', async (_req, res) => {
    try {
        const { ondoUsdyService } = await Promise.resolve().then(() => __importStar(require('../services/ondoUsdy.service')));
        res.json({
            success: true,
            data: {
                live: process.env.ONDO_RWA_LIVE === 'true',
                usdyMint: process.env.ONDO_USDY_MINT || null,
                settlementWalletConfigured: !!process.env.ONDO_SETTLEMENT_KEY,
                apy: Number(process.env.ONDO_APY || 4.5),
                note: process.env.ONDO_RWA_LIVE === 'true'
                    ? 'Real on-chain USDY holding + yield distribution active (settlement wallet).'
                    : 'SIMULATED: set ONDO_RWA_LIVE=true + ONDO_USDY_MINT + ONDO_SETTLEMENT_KEY to go live.',
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/v1/pyd/usdy/hold
 * Hold a rent payment in USDY for the float window (real SPL transfer when live).
 */
router.post('/usdy/hold', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const tenantId = req.user?.id;
        const { streamId, tenantWallet, amountUsd } = req.body ?? {};
        if (!streamId || !tenantWallet || !amountUsd) {
            return res.status(400).json({ success: false, error: 'streamId, tenantWallet, amountUsd required' });
        }
        const { ondoUsdyService } = await Promise.resolve().then(() => __importStar(require('../services/ondoUsdy.service')));
        const result = await ondoUsdyService.holdInUsdy(streamId, tenantWallet, Number(amountUsd));
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/v1/pyd/usdy/lead
 * Pre-registration capture for the Ondo USDY rent-yield rail. Public.
 * Builds a verifiable list of landlord/property interest to show Ondo.
 */
router.post('/usdy/lead', async (req, res) => {
    try {
        const { email, name, propertyType, portfolioSize, country, message } = req.body || {};
        if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Valid email required to pre-register.' });
        }
        const lead = await database_1.prisma.usdyLead.upsert({
            where: { email },
            create: {
                email,
                name: name || null,
                propertyType: propertyType || null,
                portfolioSize: typeof portfolioSize === 'number' ? portfolioSize : null,
                country: country || null,
                message: message || null,
                source: 'usdy_landing',
            },
            update: {
                name: name || undefined,
                propertyType: propertyType || undefined,
                portfolioSize: typeof portfolioSize === 'number' ? portfolioSize : undefined,
                country: country || undefined,
                message: message || undefined,
            },
        });
        const total = await database_1.prisma.usdyLead.count();
        return res.json({
            success: true,
            data: { registered: true, leadId: lead.id, totalPreRegistered: total },
            message: 'You are pre-registered for USDY rent yield on Pabandi. We will reach out when the rail goes live.',
        });
    }
    catch (err) {
        logger_1.logger.error(`[rentalDeposit] USDY lead capture failed: ${err.message}`);
        return res.status(500).json({ success: false, message: 'Could not save pre-registration. Try again.' });
    }
});
/**
 * GET /api/v1/pyd/usdy/leads/count  (public, lightweight)
 * Social proof for the campaign: how many properties are pre-registered for the USDY rail.
 */
router.get('/usdy/leads/count', async (_req, res) => {
    try {
        const total = await database_1.prisma.usdyLead.count();
        const byCountry = await database_1.prisma.usdyLead.groupBy({ by: ['country'], _count: { _all: true } });
        return res.json({
            success: true,
            data: {
                totalPreRegistered: total,
                countries: byCountry.filter((c) => c.country).map((c) => ({ country: c.country, count: c._count._all })),
            },
        });
    }
    catch (err) {
        return res.json({ success: true, data: { totalPreRegistered: 0, countries: [] }, simulated: true });
    }
});
/**
 * DELETE /api/v1/pyd/usdy/lead
 * Admin-only purge of pre-registration leads (e.g. remove test rows before showing the counter).
 * Guarded by ADMIN_API_KEY (header x-admin-key or ?adminKey=).
 */
router.delete('/usdy/lead', requireAdminKey, async (req, res) => {
    try {
        const { email, all } = req.query;
        let deleted = 0;
        if (all === 'true') {
            const r = await database_1.prisma.usdyLead.deleteMany({});
            deleted = r.count;
        }
        else if (email) {
            const r = await database_1.prisma.usdyLead.deleteMany({ where: { email: String(email) } });
            deleted = r.count;
        }
        else {
            return res.status(400).json({ success: false, message: 'Provide ?email= or ?all=true' });
        }
        logger_1.logger.info(`[rentalDeposit] USDY leads purged by admin: ${deleted}`);
        return res.json({ success: true, data: { deleted } });
    }
    catch (err) {
        logger_1.logger.error(`[rentalDeposit] USDY lead purge failed: ${err.message}`);
        return res.status(500).json({ success: false, message: 'Purge failed.' });
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