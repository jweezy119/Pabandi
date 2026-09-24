"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSquareRefund = exports.handleSquareWebhook = exports.getSquarePayment = exports.createSquareCheckout = void 0;
const squareCheckout_service_1 = require("../services/squareCheckout.service");
const database_1 = require("../utils/database");
const createSquareCheckout = async (req, res, next) => {
    try {
        const { referenceId, amount, currency, redirectUrl, cancelUrl, note, customerEmail } = req.body;
        const checkout = await squareCheckout_service_1.squareService.createCheckout({
            referenceId,
            amount: Math.round(amount * 100), // convert dollars to cents
            currency: currency || 'USD',
            redirectUrl,
            cancelUrl,
            note,
            customerEmail,
        });
        res.json({ success: true, checkout });
    }
    catch (err) {
        next(err);
    }
};
exports.createSquareCheckout = createSquareCheckout;
const getSquarePayment = async (req, res, next) => {
    try {
        const { paymentId } = req.params;
        const payment = await squareCheckout_service_1.squareService.getPayment(paymentId);
        res.json({ success: true, payment });
    }
    catch (err) {
        next(err);
    }
};
exports.getSquarePayment = getSquarePayment;
const handleSquareWebhook = async (req, res, next) => {
    try {
        const body = JSON.stringify(req.body);
        const signature = req.headers['x-square-signature'];
        const webhookUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const isValid = await squareCheckout_service_1.squareService.verifyWebhook(body, signature, webhookUrl);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }
        const result = await squareCheckout_service_1.squareService.processWebhook(req.body);
        // Update payment status in DB based on webhook
        if (result.type === 'PAYMENT_UPDATED' && result.status === 'COMPLETED') {
            // Find payment by Square payment ID and update status
            const payment = await database_1.prisma.payment.findUnique({
                where: { transactionId: result.paymentId },
            });
            if (payment) {
                await database_1.prisma.payment.update({
                    where: { id: payment.id },
                    data: { status: 'COMPLETED' },
                });
                // Also mark reservation deposit as paid
                if (payment.reservationId) {
                    await database_1.prisma.reservation.update({
                        where: { id: payment.reservationId },
                        data: { depositPaid: true },
                    });
                }
            }
        }
        res.json({ received: true, result });
    }
    catch (err) {
        next(err);
    }
};
exports.handleSquareWebhook = handleSquareWebhook;
const createSquareRefund = async (req, res, next) => {
    try {
        const { paymentId, amount, reason } = req.body;
        const refund = await squareCheckout_service_1.squareService.createRefund(paymentId, Math.round(amount * 100), reason);
        res.json({ success: true, refund });
    }
    catch (err) {
        next(err);
    }
};
exports.createSquareRefund = createSquareRefund;
//# sourceMappingURL=squareCheckout.controller.js.map