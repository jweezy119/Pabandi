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
const promotions_service_1 = require("../services/promotions.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ── Public: List promotions ───────────────────────────────────────────────
router.get('/promotions', async (req, res) => {
    try {
        const { businessId, active, segment } = req.query;
        const promotions = await promotions_service_1.promotionsService.listPromotions({
            businessId: businessId,
            active: active === 'true',
            segment: segment,
        });
        res.json({ success: true, data: promotions });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load promotions' });
    }
});
// ── Public: Get available promotions for user ─────────────────────────────
router.get('/promotions/available', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const promotions = await promotions_service_1.promotionsService.getAvailableForUser(userId);
        res.json({ success: true, data: promotions });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load available promotions' });
    }
});
// ── Authenticated: Redeem promotion ───────────────────────────────────────
router.post('/promotions/:id/redeem', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const redemption = await promotions_service_1.promotionsService.redeemPromotion(userId, req.params.id);
        res.status(201).json({ success: true, data: redemption });
    }
    catch (e) {
        res.status(400).json({ error: e.message || 'Failed to redeem' });
    }
});
// ── Authenticated: Use promotion ──────────────────────────────────────────
router.post('/promotions/use/:code', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { purchaseAmount } = req.body;
        const result = await promotions_service_1.promotionsService.usePromotion(userId, req.params.code, purchaseAmount);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(400).json({ error: e.message || 'Failed to use promotion' });
    }
});
// ── Authenticated: Get my redemptions ─────────────────────────────────────
router.get('/promotions/my', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const redemptions = await promotions_service_1.promotionsService.getUserRedemptions(userId);
        res.json({ success: true, data: redemptions });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load redemptions' });
    }
});
// ── Vendor: Create promotion ──────────────────────────────────────────────
router.post('/vendor/promotions', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { businessId } = req.body;
        // Verify ownership
        const { PrismaClient } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
        const prisma = new PrismaClient();
        const business = await prisma.business.findFirst({
            where: { id: businessId, ownerId: userId },
        });
        if (!business)
            return res.status(403).json({ error: 'Not your business' });
        const promotion = await promotions_service_1.promotionsService.createPromotion({
            businessId,
            ...req.body,
            startsAt: new Date(req.body.startsAt),
            endsAt: new Date(req.body.endsAt),
        });
        res.status(201).json({ success: true, data: promotion });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create promotion' });
    }
});
// ── Vendor: Get my promotions ─────────────────────────────────────────────
router.get('/vendor/promotions', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { PrismaClient } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
        const prisma = new PrismaClient();
        const businesses = await prisma.business.findMany({
            where: { ownerId: userId },
            select: { id: true },
        });
        const businessIds = businesses.map(b => b.id);
        const promotions = await prisma.vendorPromotion.findMany({
            where: { businessId: { in: businessIds } },
            include: { business: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: promotions });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load promotions' });
    }
});
// ── Vendor: Get analytics ─────────────────────────────────────────────────
router.get('/vendor/analytics', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { businessId } = req.query;
        // Verify ownership
        const { PrismaClient } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
        const prisma = new PrismaClient();
        const business = await prisma.business.findFirst({
            where: { id: businessId, ownerId: userId },
        });
        if (!business)
            return res.status(403).json({ error: 'Not your business' });
        const analytics = await promotions_service_1.promotionsService.getVendorAnalytics(businessId);
        res.json({ success: true, data: analytics });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load analytics' });
    }
});
// ── Public: Get loyalty membership ────────────────────────────────────────
router.get('/loyalty/:businessId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const membership = await promotions_service_1.promotionsService.getMembership(userId, req.params.businessId);
        res.json({ success: true, data: membership });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load membership' });
    }
});
// ── Authenticated: Redeem loyalty points ──────────────────────────────────
router.post('/loyalty/:businessId/redeem', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { points } = req.body;
        const result = await promotions_service_1.promotionsService.redeemPoints(userId, req.params.businessId, points);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(400).json({ error: e.message || 'Failed to redeem points' });
    }
});
exports.default = router;
//# sourceMappingURL=promotions.routes.js.map