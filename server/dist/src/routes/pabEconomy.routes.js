"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pabEconomy_service_1 = require("../services/pabEconomy.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ── GET /api/v1/pab/stats ───────────────────────────────────────────────────
router.get('/stats', async (_req, res) => {
    try {
        const stats = await (0, pabEconomy_service_1.getPabStats)();
        res.json({ success: true, data: stats });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── GET /api/v1/pab/wallet ──────────────────────────────────────────────────
router.get('/wallet', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const wallet = await (0, pabEconomy_service_1.getWallet)(req.user.id);
        res.json({ success: true, data: wallet });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── POST /api/v1/pab/earn ───────────────────────────────────────────────────
router.post('/earn', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { action, refType, refId } = req.body;
        const tx = await (0, pabEconomy_service_1.earnPab)(req.user.id, action, refType, refId);
        if (!tx)
            return res.status(400).json({ success: false, error: 'No earn rule for this action' });
        res.status(201).json({ success: true, data: tx });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── POST /api/v1/pab/spend ──────────────────────────────────────────────────
router.post('/spend', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { action, refType, refId } = req.body;
        const tx = await (0, pabEconomy_service_1.spendPab)(req.user.id, action, refType, refId);
        if (!tx)
            return res.status(400).json({ success: false, error: 'No spend rule for this action' });
        res.status(201).json({ success: true, data: tx });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
// ── POST /api/v1/pab/stake ──────────────────────────────────────────────────
router.post('/stake', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { tier } = req.body;
        const wallet = await (0, pabEconomy_service_1.stakePab)(req.user.id, tier);
        res.json({ success: true, data: wallet });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
// ── POST /api/v1/pab/unstake ────────────────────────────────────────────────
router.post('/unstake', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const wallet = await (0, pabEconomy_service_1.unstakePab)(req.user.id);
        res.json({ success: true, data: wallet });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
// ── GET /api/v1/pab/treasury ────────────────────────────────────────────────
router.get('/treasury', async (_req, res) => {
    try {
        const treasury = await (0, pabEconomy_service_1.getTreasury)();
        res.json({ success: true, data: treasury });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── POST /api/v1/pab/record-fee ─────────────────────────────────────────────
router.post('/record-fee', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { solAmount } = req.body;
        await (0, pabEconomy_service_1.recordPlatformFee)(solAmount);
        res.json({ success: true, message: 'Fee recorded' });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── POST /api/v1/pab/initialize ─────────────────────────────────────────────
router.post('/initialize', async (_req, res) => {
    try {
        await (0, pabEconomy_service_1.initializePabEconomy)();
        res.json({ success: true, message: 'PAB economy initialized' });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=pabEconomy.routes.js.map