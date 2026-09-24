"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiveStripeWebhook = void 0;
const stripe_service_1 = require("../services/stripe.service");
const database_1 = require("../utils/database");
const receiveStripeWebhook = async (req, res, next) => {
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
                // Sitara deposit flow: close the payment + mark the deposit paid so
                // check-in, review, stars, and rewards unlock.
                try {
                    const pending = await database_1.prisma.payment.findFirst({
                        where: { reservationId: String(reservationId), status: 'PENDING' },
                        orderBy: { createdAt: 'desc' },
                    });
                    if (pending) {
                        await database_1.prisma.payment.update({
                            where: { id: pending.id },
                            data: {
                                status: 'COMPLETED',
                                gatewayResponse: {
                                    ...(pending.gatewayResponse || {}),
                                    stripeSessionId: session.id,
                                    paidAt: new Date().toISOString(),
                                },
                            },
                        });
                    }
                    await database_1.prisma.reservation.updateMany({
                        where: { id: String(reservationId) },
                        data: { depositPaid: true },
                    });
                }
                catch (e) {
                    console.error('Stripe deposit completion failed:', e.message);
                }
            }
        }
        return res.status(200).json({ received: true });
    }
    catch (error) {
        next(error);
    }
};
exports.receiveStripeWebhook = receiveStripeWebhook;
//# sourceMappingURL=webhook.stripe.controller.js.map