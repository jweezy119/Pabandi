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
 * monetization.routes.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Revenue API routes for the three monetization layers:
 *   - /trust-brokerage/*     — Trust Data Bundles (data product sales)
 *   - /trust-api/*          — API-as-a-Service (recurring subscriptions)
 *   - /insurance/*          — Reputation Insurance (premium revenue)
 */
const express_1 = require("express");
const router = (0, express_1.Router)();
// ── Trust Brokerage API ──────────────────────────────────────────────────────
/**
 * POST /api/v1/monetization/trust-brokerage/bundle
 * Generate a Trust Data Bundle for resale.
 * Body: { entityId, entityType, buyerId }
 */
router.post('/trust-brokerage/bundle', async (req, res) => {
    const { entityId, entityType, buyerId } = req.body;
    if (!entityId || !entityType) {
        return res.status(400).json({ success: false, error: 'entityId and entityType required' });
    }
    try {
        const { trustBrokerageService } = await Promise.resolve().then(() => __importStar(require('../services/trustBrokerage.service')));
        const bundle = await trustBrokerageService.createBundle(entityId, entityType, buyerId);
        if (!bundle) {
            return res.status(404).json({ success: false, error: 'Insufficient confidence to generate bundle' });
        }
        res.json({ success: true, data: bundle });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/monetization/trust-brokerage/revenue
 * Get daily revenue from trust data sales.
 */
router.get('/trust-brokerage/revenue', async (_req, res) => {
    try {
        const { trustBrokerageService } = await Promise.resolve().then(() => __importStar(require('../services/trustBrokerage.service')));
        res.json({ success: true, data: { dailyRevenue: trustBrokerageService.getDailyRevenue() } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── Trust API-as-a-Service ────────────────────────────────────────────────────
// Route removed, handled by billing.routes.ts (/api/v1/billing/subscribe)
/**
 * POST /api/v1/monetization/trust-api/verify
 * Verify an entity via API.
 * Body: { apiKey, entityId, entityType }
 */
router.post('/trust-api/verify', async (req, res) => {
    const { apiKey, entityId, entityType } = req.body;
    if (!apiKey || !entityId || !entityType) {
        return res.status(400).json({ success: false, error: 'apiKey, entityId, entityType required' });
    }
    try {
        const { trustApiAsService } = await Promise.resolve().then(() => __importStar(require('../services/trustApiAsService.service')));
        const result = await trustApiAsService.verifyEntity(apiKey, entityId, entityType);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Stats and pricing handled by billing.routes.ts
// ── Reputation Insurance API ──────────────────────────────────────────────────
/**
 * POST /api/v1/monetization/insurance/underwrite
 * Underwrite a new insurance policy for a booking.
 * Body: { providerId, customerId, reservationId, coverageAmount, coverageType }
 */
router.post('/insurance/underwrite', async (req, res) => {
    const { providerId, customerId, reservationId, coverageAmount, coverageType } = req.body;
    if (!providerId || !reservationId || !coverageAmount) {
        return res.status(400).json({ success: false, error: 'providerId, reservationId, coverageAmount required' });
    }
    try {
        const { reputationInsuranceService } = await Promise.resolve().then(() => __importStar(require('../services/reputationInsurance.service')));
        const result = await reputationInsuranceService.underwrite(providerId, customerId, reservationId, coverageAmount, coverageType || 'NO_SHOW');
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/v1/monetization/insurance/claim
 * Process an insurance claim.
 * Body: { policyId, evidence, reason }
 */
router.post('/insurance/claim', async (req, res) => {
    const { policyId, evidence, reason } = req.body;
    if (!policyId) {
        return res.status(400).json({ success: false, error: 'policyId required' });
    }
    try {
        const { reputationInsuranceService } = await Promise.resolve().then(() => __importStar(require('../services/reputationInsurance.service')));
        const result = await reputationInsuranceService.processClaim(policyId, evidence, reason);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/monetization/insurance/stats
 * Get actuarial stats for insurance underwriting.
 */
router.get('/insurance/stats', async (_req, res) => {
    try {
        const { reputationInsuranceService } = await Promise.resolve().then(() => __importStar(require('../services/reputationInsurance.service')));
        const stats = reputationInsuranceService.getStats();
        res.json({ success: true, data: stats });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=monetization.routes.js.map