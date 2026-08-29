"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPaymentWebhook = exports.createSubscriptionCheckout = exports.getPayment = exports.createPayment = void 0;
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const client_1 = require("@prisma/client");
const safepay_service_1 = require("../services/safepay.service");
const createPayment = async (req, res, next) => {
    try {
        const { reservationId, amount, paymentMethod } = req.body;
        if (reservationId) {
            const reservation = await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
            });
            if (!reservation) {
                throw new errorHandler_1.CustomError('Reservation not found', 404);
            }
            if (reservation.customerId !== req.user.id) {
                throw new errorHandler_1.CustomError('Unauthorized', 403);
            }
        }
        // Create payment record
        const payment = await database_1.prisma.payment.create({
            data: {
                reservationId,
                userId: req.user.id,
                amount,
                paymentMethod: paymentMethod || 'credit_card',
                status: 'PENDING',
            },
        });
        // Integrate with Safepay
        let paymentUrl = `/payment/process/${payment.id}`;
        if (paymentMethod === 'safepay') {
            try {
                const checkoutReference = `pay_${payment.id}`;
                paymentUrl = await safepay_service_1.safepayService.createCheckoutUrl(amount, checkoutReference);
                await database_1.prisma.payment.update({
                    where: { id: payment.id },
                    data: { gatewayResponse: { ...(payment.gatewayResponse || {}), safepayReference: checkoutReference } },
                });
            }
            catch (err) {
                logger_1.logger.error(`Safepay initialization failed: ${err}`);
            }
        }
        logger_1.logger.info(`Payment created: ${payment.id} via ${paymentMethod}`);
        res.status(201).json({
            success: true,
            message: 'Payment initiated',
            data: {
                payment: {
                    ...payment,
                    paymentUrl,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createPayment = createPayment;
const getPayment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payment = await database_1.prisma.payment.findUnique({
            where: { id },
            include: {
                reservation: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
        if (!payment) {
            throw new errorHandler_1.CustomError('Payment not found', 404);
        }
        // Check authorization
        if (req.user.role !== client_1.UserRole.ADMIN &&
            payment.userId !== req.user.id) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        res.json({
            success: true,
            data: { payment },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPayment = getPayment;
const createSubscriptionCheckout = async (req, res, next) => {
    try {
        const { planId, amount, planName } = req.body;
        if (!amount || amount <= 0) {
            throw new errorHandler_1.CustomError('A valid subscription amount is required', 400);
        }
        const reference = `sub_${planId || 'custom'}_${Date.now()}`;
        const checkoutUrl = await safepay_service_1.safepayService.createApiSubscriptionCheckoutUrl(amount, reference);
        const payment = await database_1.prisma.payment.create({
            data: {
                userId: req.user.id,
                amount,
                paymentMethod: 'safepay',
                status: 'PENDING',
                gatewayResponse: { planId, planName, reference },
            },
        });
        res.status(201).json({
            success: true,
            data: { checkoutUrl, payment },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createSubscriptionCheckout = createSubscriptionCheckout;
const processPaymentWebhook = async (req, res, next) => {
    try {
        const signature = req.headers['x-sfpy-signature'];
        const rawBody = req.rawBody || JSON.stringify(req.body || {});
        const isValid = safepay_service_1.safepayService.verifyWebhook(signature, rawBody);
        if (!isValid) {
            logger_1.logger.error('Invalid Safepay webhook signature');
            return res.status(401).json({ success: false, message: 'Invalid signature' });
        }
        const payload = req.body || {};
        const { tracker, reference, state } = payload;
        const mappedStatus = mapSafePayState(state);
        if (!reference) {
            return res.status(400).json({ success: false, message: 'Missing reference' });
        }
        const payment = await database_1.prisma.payment.findUnique({
            where: { id: String(reference) },
        });
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }
        const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED'];
        const isTerminal = terminalStatuses.includes(payment.status);
        const updates = {
            gatewayResponse: {
                ...(payment.gatewayResponse || {}),
                safepay: payload,
            },
        };
        if (!isTerminal) {
            updates.status = mappedStatus;
            if (tracker)
                updates.transactionId = String(tracker);
        }
        const updated = await database_1.prisma.payment.update({
            where: { id: payment.id },
            data: updates,
        });
        if (mappedStatus === 'COMPLETED' && payment.status !== 'COMPLETED') {
            const fee = +(updated.amount * 0.03).toFixed(2);
            await database_1.prisma.payment.update({
                where: { id: updated.id },
                data: { platformFeeAmount: fee, platformFeeStatus: 'CAPTURED' },
            });
            if (updated.reservationId) {
                await database_1.prisma.reservation.update({
                    where: { id: updated.reservationId },
                    data: { depositPaid: true },
                });
            }
        }
        logger_1.logger.info(`Payment webhook processed: ${updated.id} - ${updated.status}`);
        res.json({ success: true, status: updated.status });
    }
    catch (error) {
        next(error);
    }
};
exports.processPaymentWebhook = processPaymentWebhook;
function mapSafePayState(state) {
    const normalized = String(state || '').toLowerCase();
    if (normalized === 'completed')
        return 'COMPLETED';
    if (normalized === 'cancelled' || normalized === 'canceled')
        return 'CANCELLED';
    return 'FAILED';
}
//# sourceMappingURL=payment.controller.js.map