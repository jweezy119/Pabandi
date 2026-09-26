"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_controller_1 = require("../controllers/whatsapp.controller");
const router = (0, express_1.Router)();
// Meta Webhook Verification
router.get('/webhook', whatsapp_controller_1.verifyWebhook);
// Incoming WhatsApp messages
router.post('/webhook', whatsapp_controller_1.handleIncomingWhatsApp);
exports.default = router;
//# sourceMappingURL=whatsapp.routes.js.map