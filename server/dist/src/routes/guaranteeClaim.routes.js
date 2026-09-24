"use strict";
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
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const guaranteeClaim_service_1 = require("../services/guaranteeClaim.service");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const claimSchema = zod_1.z.object({
    bondId: zod_1.z.string().min(1),
    claimAmountUSD: zod_1.z.number().positive().max(1000000),
    claimType: zod_1.z.enum(['FRAUD', 'NO_SHOW', 'NON_DELIVERY', 'DEFECT']),
    evidence: zod_1.z.string().min(1).max(2000),
    reason: zod_1.z.string().max(500).optional(),
});
// ── POST /api/v1/guarantee/claim ───────────────────────────────────────────────
router.post('/claim', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const parsed = claimSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                error: 'invalid claim input',
                details: parsed.error.flatten().fieldErrors,
            });
        }
        const input = {
            bondId: parsed.data.bondId,
            claimAmountUSD: parsed.data.claimAmountUSD,
            claimType: parsed.data.claimType,
            evidence: parsed.data.evidence,
            reason: parsed.data.reason,
            claimerId: req.user.id,
        };
        const result = await guaranteeClaim_service_1.guaranteeClaimService.recordClaim(input);
        return res.status(201).json({ success: true, data: result });
    }
    catch (e) {
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
router.get('/status/:bondId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const bond = await (await Promise.resolve().then(() => __importStar(require('../utils/database')))).prisma.performanceBond.findUnique({
            where: { id: req.params.bondId },
            select: { id: true, status: true, coverageUSD: true, claimedAt: true, expiresAt: true },
        });
        if (!bond)
            return res.status(404).json({ success: false, error: 'BOND_NOT_FOUND' });
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
    }
    catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=guaranteeClaim.routes.js.map