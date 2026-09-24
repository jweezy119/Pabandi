"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_2 = require("express");
const stripe_service_1 = require("../services/stripe.service");
const database_1 = require("../utils/database");
const router = (0, express_2.Router)();
router.post('/', express_1.default.raw({ type: 'application/json', verify: (req, _res, buf) => { req.rawBody = buf; } }), async (req, res, next) => {
    try {
        const signature = req.header('stripe-signature') || '';
        const rawBody = req.rawBody || Buffer.from('');
        const ok = stripe_service_1.stripeService.verifyWebhook(signature, rawBody);
        if (!ok) {
            return res.status(401).json({ success: false, error: 'Invalid webhook' });
        }
        const event = req.body || {};
        if (event?.type === 'checkout.session.completed') {
            const session = event?.data?.object || {};
            const reservationId = session?.metadata?.reservation_id || session?.client_reference_id;
            if (reservationId) {
                await database_1.prisma.checkoutSession.updateMany({
                    where: { id: reservationId },
                    data: { status: 'PAID', metadata: { ...(session.metadata || {}), stripeSessionId: session.id } },
                });
            }
        }
        return res.status(200).json({ received: true });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=webhook.stripe.routes.js.map