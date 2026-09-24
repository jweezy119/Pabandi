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
const router = (0, express_1.Router)();
// ── POST /api/v1/promoters/register (auth required) ───────────────────────
router.post('/register', async (req, res, next) => {
    try {
        const { authenticate } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { promoterService } = await Promise.resolve().then(() => __importStar(require('../services/promoter.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const userId = req.user?.id;
        const promoter = await promoterService.registerPromoter(userId, req.body);
        res.status(201).json({ success: true, data: promoter });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('token')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(400).json({ success: false, error: err.message || 'Failed to register promoter' });
    }
});
// ── GET /api/v1/promoters/me (auth required) ──────────────────────────────
router.get('/me', async (req, res, next) => {
    try {
        const { authenticate } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { promoterService } = await Promise.resolve().then(() => __importStar(require('../services/promoter.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const userId = req.user?.id;
        const promoter = await promoterService.getPromoterByUserId(userId);
        if (!promoter) {
            return res.status(404).json({ success: false, error: 'Promoter profile not found' });
        }
        res.json({ success: true, data: promoter });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('token')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: err.message || 'Failed to load promoter profile' });
    }
});
// ── GET /api/v1/promoters/stats (auth required) ───────────────────────────
router.get('/stats', async (req, res, next) => {
    try {
        const { authenticate } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { promoterService } = await Promise.resolve().then(() => __importStar(require('../services/promoter.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const userId = req.user?.id;
        const promoter = await promoterService.getPromoterByUserId(userId);
        if (!promoter) {
            return res.status(404).json({ success: false, error: 'Promoter profile not found' });
        }
        const stats = await promoterService.getPromoterStats(promoter.id);
        res.json({ success: true, data: stats });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('token')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: err.message || 'Failed to load stats' });
    }
});
// ── GET /api/v1/promoters/bookings (auth required) ────────────────────────
router.get('/bookings', async (req, res, next) => {
    try {
        const { authenticate } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { promoterService } = await Promise.resolve().then(() => __importStar(require('../services/promoter.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const userId = req.user?.id;
        const promoter = await promoterService.getPromoterByUserId(userId);
        if (!promoter) {
            return res.status(404).json({ success: false, error: 'Promoter profile not found' });
        }
        const bookings = await promoterService.getPromoterBookings(promoter.id);
        res.json({ success: true, data: bookings });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('token')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: err.message || 'Failed to load bookings' });
    }
});
// ── GET /api/v1/promoters/wallet (auth required) ──────────────────────────
router.get('/wallet', async (req, res, next) => {
    try {
        const { authenticate } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { promoterService } = await Promise.resolve().then(() => __importStar(require('../services/promoter.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const userId = req.user?.id;
        const promoter = await promoterService.getPromoterByUserId(userId);
        if (!promoter) {
            return res.status(404).json({ success: false, error: 'Promoter profile not found' });
        }
        const wallet = await promoterService.getPromoterWallet(promoter.id);
        res.json({ success: true, data: wallet });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('token')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: err.message || 'Failed to load wallet' });
    }
});
// ── GET /api/v1/promoters/leaderboard ─────────────────────────────────────
router.get('/leaderboard', async (req, res, next) => {
    try {
        const { promoterService } = await Promise.resolve().then(() => __importStar(require('../services/promoter.service')));
        const { limit } = req.query;
        const leaderboard = await promoterService.getPromoterLeaderboard(limit ? Number(limit) : 10);
        res.json({ success: true, data: leaderboard });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to load leaderboard' });
    }
});
// ── GET /api/v1/promoters/ref-link (auth required) ────────────────────────
router.get('/ref-link', async (req, res, next) => {
    try {
        const { authenticate } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { promoterService } = await Promise.resolve().then(() => __importStar(require('../services/promoter.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const userId = req.user?.id;
        const promoter = await promoterService.getPromoterByUserId(userId);
        if (!promoter) {
            return res.status(404).json({ success: false, error: 'Promoter profile not found' });
        }
        const promoCode = await promoterService.generateReferralCode(promoter.id);
        res.json({ success: true, data: promoCode });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('token')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: err.message || 'Failed to generate referral link' });
    }
});
exports.default = router;
//# sourceMappingURL=promoter.routes.js.map