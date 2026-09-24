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
const partnerRewards_service_1 = require("../services/partnerRewards.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ── Public: List active offers ────────────────────────────────────────────
router.get('/offers', async (req, res) => {
    try {
        const { category, businessId } = req.query;
        const offers = await partnerRewards_service_1.partnerRewardsService.listOffers({
            category: category,
            businessId: businessId,
            active: true,
        });
        res.json({ success: true, data: offers });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load offers' });
    }
});
// ── Public: Get offer details ─────────────────────────────────────────────
router.get('/offers/:id', async (req, res) => {
    try {
        const offer = await partnerRewards_service_1.partnerRewardsService.getOffer(req.params.id);
        if (!offer)
            return res.status(404).json({ error: 'Offer not found' });
        res.json({ success: true, data: offer });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load offer' });
    }
});
// ── Authenticated: Redeem offer ───────────────────────────────────────────
router.post('/offers/:id/redeem', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const reward = await partnerRewards_service_1.partnerRewardsService.redeemOffer(userId, req.params.id);
        res.status(201).json({ success: true, data: reward });
    }
    catch (e) {
        res.status(400).json({ error: e.message || 'Failed to redeem' });
    }
});
// ── Authenticated: Confirm redemption (after purchase) ────────────────────
router.post('/rewards/:code/confirm', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { purchaseAmount } = req.body;
        const reward = await partnerRewards_service_1.partnerRewardsService.confirmRedemption(userId, req.params.code, purchaseAmount);
        res.json({ success: true, data: reward });
    }
    catch (e) {
        res.status(400).json({ error: e.message || 'Failed to confirm' });
    }
});
// ── Authenticated: Get my rewards ─────────────────────────────────────────
router.get('/rewards', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const rewards = await partnerRewards_service_1.partnerRewardsService.getUserRewards(userId);
        res.json({ success: true, data: rewards });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load rewards' });
    }
});
// ── Public: Verify redemption code ────────────────────────────────────────
router.get('/rewards/verify/:code', async (req, res) => {
    try {
        const reward = await partnerRewards_service_1.partnerRewardsService.getRewardByCode(req.params.code);
        if (!reward)
            return res.status(404).json({ error: 'Code not found' });
        res.json({ success: true, data: reward });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to verify' });
    }
});
// ── Partner: Create offer ─────────────────────────────────────────────────
router.post('/partner/offers', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { businessId, title, description, category, rewardType, rewardValue, maxRewardAmount, minPurchase, maxRedemptions, perUserLimit, startsAt, endsAt } = req.body;
        // Verify user owns this business
        const { PrismaClient } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
        const prisma = new PrismaClient();
        const business = await prisma.business.findFirst({
            where: { id: businessId, ownerId: userId },
        });
        if (!business)
            return res.status(403).json({ error: 'Not your business' });
        const offer = await partnerRewards_service_1.partnerRewardsService.createOffer({
            businessId,
            title,
            description,
            category,
            rewardType,
            rewardValue,
            maxRewardAmount,
            minPurchase,
            maxRedemptions,
            perUserLimit,
            startsAt: new Date(startsAt),
            endsAt: new Date(endsAt),
        });
        res.status(201).json({ success: true, data: offer });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create offer' });
    }
});
// ── Partner: List my offers ───────────────────────────────────────────────
router.get('/partner/offers', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { PrismaClient } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
        const prisma = new PrismaClient();
        const businesses = await prisma.business.findMany({
            where: { ownerId: userId },
            select: { id: true },
        });
        const businessIds = businesses.map(b => b.id);
        const offers = await prisma.partnerOffer.findMany({
            where: { businessId: { in: businessIds } },
            include: { business: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: offers });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load offers' });
    }
});
// ── Partner: Get analytics ────────────────────────────────────────────────
router.get('/partner/analytics', auth_middleware_1.authenticate, async (req, res) => {
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
        const analytics = await partnerRewards_service_1.partnerRewardsService.getPartnerAnalytics(businessId);
        res.json({ success: true, data: analytics });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load analytics' });
    }
});
// ── Public: Get stats ─────────────────────────────────────────────────────
router.get('/stats', async (_req, res) => {
    try {
        const stats = await partnerRewards_service_1.partnerRewardsService.getStats();
        res.json({ success: true, data: stats });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load stats' });
    }
});
exports.default = router;
//# sourceMappingURL=partnerRewards.routes.js.map