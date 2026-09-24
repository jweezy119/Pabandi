"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const evolution_service_1 = require("../services/evolution.service");
const router = (0, express_1.Router)();
// ── EVOLUTION API ────────────────────────────────────
// Create new WhatsApp instance
router.post('/instance/create', async (req, res) => {
    try {
        const { instanceName } = req.body;
        const result = await evolution_service_1.evolutionAPI.createInstance(instanceName || `pabandi-${Date.now()}`);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Get QR code for instance
router.get('/instance/:instanceName/qrcode', async (req, res) => {
    try {
        const result = await evolution_service_1.evolutionAPI.getQRCode(req.params.instanceName);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Get instance connection state
router.get('/instance/:instanceName/state', async (req, res) => {
    try {
        const result = await evolution_service_1.evolutionAPI.getInstanceState(req.params.instanceName);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// List all instances
router.get('/instances', async (req, res) => {
    try {
        const result = await evolution_service_1.evolutionAPI.listInstances();
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Logout/delete instance
router.delete('/instance/:instanceName', async (req, res) => {
    try {
        const result = await evolution_service_1.evolutionAPI.logoutInstance(req.params.instanceName);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Send text message
router.post('/send/:instanceName', async (req, res) => {
    try {
        const { to, message } = req.body;
        const result = await evolution_service_1.evolutionAPI.sendTextMessage(req.params.instanceName, to, message);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── WEBHOOK (called by Evolution API) ─────────────────
router.post('/webhook/:instanceName', async (req, res) => {
    try {
        await evolution_service_1.evolutionAPI.handleWebhook(req.params.instanceName, req.body);
        res.json({ success: true });
    }
    catch (err) {
        console.error('[Evolution Webhook] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=evolution.routes.js.map