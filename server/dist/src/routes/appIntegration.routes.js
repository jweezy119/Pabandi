"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * appIntegration.routes.ts — third-party app + agent integration HTTP surface.
 *
 *   POST /api/v1/apps/connect       — register an app, get a PTP-backed bearer token
 *   GET  /api/v1/apps/:id/config    — get embeddable widget config (public, scoped)
 *   POST /api/v1/agents/invoke      — invoke a Pabandi agent/tool from another app
 *                                      (pay-per-use via PAB/SOL fee deduction)
 */
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const appIntegration_service_1 = require("../services/appIntegration.service");
const router = (0, express_1.Router)();
// ── POST /api/v1/apps/connect ────────────────────────────────────────────────
router.post('/connect', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { appName, scopes, webhookUrl, redirectUrl } = req.body;
        if (!appName || !scopes || !Array.isArray(scopes)) {
            return res.status(400).json({ success: false, error: 'appName and scopes[] required' });
        }
        const result = await appIntegration_service_1.appIntegrationService.connectApp({
            appName,
            ownerUserId: req.user.id,
            scopes,
            webhookUrl,
            redirectUrl,
        });
        return res.status(201).json({ success: true, data: result });
    }
    catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});
// ── GET /api/v1/apps/:id/config ──────────────────────────────────────────────
router.get('/:id/config', async (req, res) => {
    try {
        const config = await appIntegration_service_1.appIntegrationService.getAppConfig(req.params.id);
        // Mask bearer token in config responses
        return res.json({ success: true, data: config });
    }
    catch (e) {
        const code = e.message === 'app not found' ? 404 : 500;
        return res.status(code).json({ success: false, error: e.message });
    }
});
// ── POST /api/v1/agents/invoke ───────────────────────────────────────────────
router.post('/invoke', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { toolName, args = {}, maxFeePab, maxFeeSol } = req.body;
        if (!toolName)
            return res.status(400).json({ success: false, error: 'toolName required' });
        const result = await appIntegration_service_1.appIntegrationService.invokeAgent({
            appId: req.user.id,
            toolName,
            args,
            maxFeePab,
            maxFeeSol,
        });
        return res.json({ success: true, data: result });
    }
    catch (e) {
        const code = e.message === 'unknown tool' ? 404 : 500;
        return res.status(code).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=appIntegration.routes.js.map