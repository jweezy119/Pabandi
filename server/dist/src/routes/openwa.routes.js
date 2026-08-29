"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_service_1 = require("../services/whatsapp.service");
const openwa_admin_service_1 = require("../services/openwa_admin.service");
const openwa_plugins_service_1 = require("../services/openwa.plugins.service");
const router = (0, express_1.Router)();
// GET /api/v1/openwa/sessions - list active OpenWA sessions
router.get('/sessions', async (_req, res, next) => {
    try {
        const sessions = await whatsapp_service_1.openwaService.listSessions();
        res.json({ success: true, data: sessions });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/openwa/plugins - list OpenWA plugins
router.get('/plugins', (_req, res, next) => {
    try {
        const plugins = (0, openwa_admin_service_1.listAdminPlugins)();
        res.json({ success: true, data: plugins });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/openwa/plugins/available - List all available plugins from the catalog
router.get('/plugins/available', (_req, res, next) => {
    try {
        const catalog = (0, openwa_plugins_service_1.getPluginCatalog)();
        res.json({ success: true, data: catalog.plugins });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/openwa/plugins/:id - get single plugin
router.get('/plugins/:id', (req, res, next) => {
    try {
        const plugin = (0, openwa_admin_service_1.getAdminPlugin)(req.params.id);
        if (!plugin) {
            res.status(404).json({ success: false, error: 'Plugin not found' });
            return;
        }
        res.json({ success: true, data: plugin });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/v1/openwa/plugins/:id - update plugin config/enabled
router.patch('/plugins/:id', (req, res, next) => {
    try {
        const updated = (0, openwa_admin_service_1.updateAdminPlugin)(req.params.id, req.body);
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/openwa/plugins/:id/activate - Activate/Deactivate a plugin for the business
router.post('/plugins/:id/activate', (req, res, next) => {
    try {
        const { active } = req.body;
        // In a real app, this would persist the plugin preference per-business to the DB.
        // For now, update the admin plugin list in memory.
        const updated = (0, openwa_admin_service_1.updateAdminPlugin)(req.params.id, { enabled: active });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/openwa/health - Get connection health of OpenWA
router.get('/health', async (_req, res, next) => {
    try {
        const health = await whatsapp_service_1.openwaService.healthCheck();
        res.json({ success: true, data: health });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/openwa/stats - Get message delivery stats
router.get('/stats', async (_req, res, next) => {
    try {
        const sessions = await whatsapp_service_1.openwaService.listSessions();
        res.json({
            success: true,
            data: {
                activeSessions: sessions.filter(s => s.status === 'connected' || s.connected).length,
                totalSessions: sessions.length,
                messageDeliveryRate: 0.98,
                uptime: '99.9%',
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/openwa/send-text - send a text message via OpenWA
router.post('/send-text', async (req, res, next) => {
    try {
        const { to, message, sessionId, pluginContext } = req.body;
        if (!to || !message) {
            res.status(400).json({ success: false, error: 'to and message are required' });
            return;
        }
        const result = await whatsapp_service_1.openwaService.sendText(to, message, { sessionId, pluginContext });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=openwa.routes.js.map