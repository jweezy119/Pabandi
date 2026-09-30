"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_service_1 = require("../services/settings.service");
const apiKey_middleware_1 = require("../middleware/apiKey.middleware");
const router = (0, express_1.Router)();
/**
 * Webhook management. Every route is API-key authenticated — previously these
 * were unauthenticated and accepted a caller-supplied businessId, which let
 * anyone read or delete another tenant's delivery configuration.
 *
 * Scope rule: when the key belongs to a business, its own businessId always
 * wins and a body-supplied id is rejected. Agent keys (businessId = null) must
 * pass their own businessId explicitly.
 */
function resolveBusinessId(req) {
    const keyBusinessId = req.apiClient?.businessId ?? null;
    const bodyBusinessId = typeof req.body?.businessId === 'string' && req.body.businessId.length > 0
        ? req.body.businessId
        : undefined;
    const queryBusinessId = typeof req.query?.businessId === 'string' && req.query.businessId.length > 0
        ? req.query.businessId
        : undefined;
    if (keyBusinessId) {
        if ((bodyBusinessId || queryBusinessId) && bodyBusinessId !== keyBusinessId && queryBusinessId !== keyBusinessId) {
            return { error: 'API key is not permitted to manage webhooks for another businessId' };
        }
        return { businessId: keyBusinessId };
    }
    const requested = bodyBusinessId || queryBusinessId;
    if (!requested) {
        return { error: 'businessId is required for agent API keys' };
    }
    return { businessId: requested };
}
router.get('/', apiKey_middleware_1.apiKeyAuth, async (req, res) => {
    try {
        const { businessId, error } = resolveBusinessId(req);
        if (error)
            return res.status(400).json({ error });
        const data = await settings_service_1.SettingsService.getWebhooks(businessId);
        res.json({ success: true, data });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/', apiKey_middleware_1.apiKeyAuth, async (req, res) => {
    try {
        const { businessId, error } = resolveBusinessId(req);
        if (error)
            return res.status(400).json({ error });
        if (!req.body?.url && !req.body?.targetUrl) {
            return res.status(400).json({
                error: 'url is required',
                example: { businessId: '...', url: 'https://your-agent.com/webhook', events: ['booking.created'] },
            });
        }
        // Map the agent-facing shape (url/events) onto the stored columns. Previously
        // these were passed through raw, so every agent webhook was created with an
        // undefined targetUrl and silently never delivered.
        const data = await settings_service_1.SettingsService.createWebhook(businessId, {
            targetUrl: req.body.url ?? req.body.targetUrl,
            subscribedEvents: req.body.events ?? req.body.subscribedEvents ?? [],
        });
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.delete('/:id', apiKey_middleware_1.apiKeyAuth, async (req, res) => {
    try {
        if (req.apiClient?.businessId) {
            const rows = await settings_service_1.SettingsService.getWebhooks(req.apiClient.businessId);
            if (!rows.some((w) => w?.id === req.params.id)) {
                return res.status(404).json({ error: 'Webhook not found for this business' });
            }
        }
        const data = await settings_service_1.SettingsService.deleteWebhook(req.params.id);
        res.json({ success: true, data });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map