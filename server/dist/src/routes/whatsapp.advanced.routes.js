"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_smart_service_1 = require("../services/whatsapp.smart.service");
const router = (0, express_1.Router)();
// Adapter: WhatsApp advanced capabilities
router.get('/capabilities', (_req, res) => {
    res.json({ success: true, capabilities: whatsapp_smart_service_1.whatsAppSmartService.capabilities() });
});
// Adapter: execute a smart WhatsApp action from external systems/CRM
router.post('/smart-action', async (req, res, next) => {
    try {
        const { intent, customerPhone, businessPhone, message } = req.body || {};
        if (!intent) {
            return res.status(400).json({ success: false, error: 'intent is required' });
        }
        const reply = await whatsapp_smart_service_1.whatsAppSmartService.runSmartAction(intent, {
            customerPhone,
            businessPhone,
            message,
        });
        res.json({ success: true, data: reply });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=whatsapp.advanced.routes.js.map