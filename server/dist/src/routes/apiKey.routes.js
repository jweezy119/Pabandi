"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_service_1 = require("../services/settings.service");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const businessId = String(req.query.businessId);
        const data = await settings_service_1.SettingsService.getApiKeys(businessId);
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const businessId = String(req.body.businessId);
        const data = await settings_service_1.SettingsService.createApiKey(businessId, req.body.data);
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const data = await settings_service_1.SettingsService.revokeApiKey(req.params.id);
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=apiKey.routes.js.map