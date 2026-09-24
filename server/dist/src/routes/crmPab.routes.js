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
const express_1 = require("express");
const crmPab_service_1 = require("../services/crmPab.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// ── PAB Dashboard Metrics ─────────────────────────────────────────────────────
// GET /api/v1/crm/pab/balance
router.get('/balance', async (req, res) => {
    try {
        const profile = await (await Promise.resolve().then(() => __importStar(require('../utils/database')))).prisma.propertyManagerProperty.findUnique({
            where: { userId: req.user.id },
        });
        if (!profile)
            return res.status(404).json({ error: 'Not enrolled' });
        const result = await crmPab_service_1.crmPabService.getManagerPabBalance(profile.id);
        res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('[CrmPabRoutes] balance failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/crm/pab/staking-overview
router.get('/staking-overview', async (req, res) => {
    try {
        const profile = await (await Promise.resolve().then(() => __importStar(require('../utils/database')))).prisma.propertyManagerProperty.findUnique({
            where: { userId: req.user.id },
        });
        if (!profile)
            return res.status(404).json({ error: 'Not enrolled' });
        const result = await crmPab_service_1.crmPabService.getStakingOverview(profile.id);
        res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('[CrmPabRoutes] staking-overview failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/crm/pab/revenue-analytics
router.get('/revenue-analytics', async (req, res) => {
    try {
        const profile = await (await Promise.resolve().then(() => __importStar(require('../utils/database')))).prisma.propertyManagerProperty.findUnique({
            where: { userId: req.user.id },
        });
        if (!profile)
            return res.status(404).json({ error: 'Not enrolled' });
        const result = await crmPab_service_1.crmPabService.getRevenueAnalytics(profile.id);
        res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('[CrmPabRoutes] revenue-analytics failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/crm/pab/tenant-risk/:tenantId
router.get('/tenant-risk/:tenantId', async (req, res) => {
    try {
        const result = await crmPab_service_1.crmPabService.getTenantRiskWithPabScoring(req.params.tenantId);
        if (!result)
            return res.status(404).json({ error: 'Tenant not found' });
        res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('[CrmPabRoutes] tenant-risk failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/crm/pab/bulk-rewards
router.post('/bulk-rewards', async (req, res) => {
    try {
        const profile = await (await Promise.resolve().then(() => __importStar(require('../utils/database')))).prisma.propertyManagerProperty.findUnique({
            where: { userId: req.user.id },
        });
        if (!profile)
            return res.status(404).json({ error: 'Not enrolled' });
        const { name, description, recipients } = req.body;
        if (!name || !recipients || !Array.isArray(recipients)) {
            return res.status(400).json({ error: 'name and recipients array required' });
        }
        const result = await crmPab_service_1.crmPabService.createBulkPabReward({
            managerId: profile.id,
            name,
            description,
            recipients,
        });
        res.status(201).json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('[CrmPabRoutes] bulk-rewards failed:', e.message);
        res.status(500).json({ error: 'Could not create bulk reward' });
    }
});
// POST /api/v1/crm/pab/bulk-rewards/:id/distribute
router.post('/bulk-rewards/:id/distribute', async (req, res) => {
    try {
        const result = await crmPab_service_1.crmPabService.distributeBulkPabReward(req.params.id);
        res.json(result);
    }
    catch (e) {
        logger_1.logger.error('[CrmPabRoutes] distribute failed:', e.message);
        res.status(500).json({ error: 'Could not distribute rewards' });
    }
});
exports.default = router;
//# sourceMappingURL=crmPab.routes.js.map