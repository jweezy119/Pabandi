"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPendingFiatPaymentsController = exports.getFiatMethods = exports.markFiatPaymentSentController = exports.cancelFiatPaymentController = exports.rejectFiatPaymentController = exports.confirmFiatPaymentController = exports.getFiatPaymentStatusController = exports.createFiatPaymentRequest = void 0;
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const client_1 = require("@prisma/client");
const fiatPayment_service_1 = require("../services/fiatPayment.service");
// Create a new fiat payment request
const createFiatPaymentRequest = async (req, res, next) => {
    try {
        const { method, amount, payerEmail, payeeId, businessId, payeeConfig, currency = 'USD', } = req.body;
        if (!method || !amount || !payeeId || !payeeConfig) {
            throw new errorHandler_1.CustomError('method, amount, payeeId, and payeeConfig are required', 400);
        }
        // Validate method
        const validMethods = ['PAYPAL', 'VENMO', 'CASH_APP', 'ZELLE', 'ACH', 'CARD', 'CASH', 'CHECK'];
        if (!validMethods.includes(method)) {
            throw new errorHandler_1.CustomError(`Invalid method. Must be one of: ${validMethods.join(', ')}`, 400);
        }
        if (typeof amount !== 'number' || amount <= 0) {
            throw new errorHandler_1.CustomError('Amount must be a positive number', 400);
        }
        const creationFee = (0, fiatPayment_service_1.calculateCreationFee)(amount);
        const result = await (0, fiatPayment_service_1.createFiatPayment)({
            method: method,
            amount,
            payerId: req.user?.id,
            payerEmail,
            payeeId,
            businessId,
            payeeConfig,
            currency,
        });
        logger_1.logger.info(`[FiatPayment] Created ${method} payment: ${result.reference} for user ${req.user?.id || 'anonymous'}`);
        res.status(201).json({
            success: true,
            message: 'Fiat payment request created',
            data: {
                ...result,
                creationFee,
                netAmount: amount - creationFee,
                warning: 'This payment method requires manual confirmation by the business.',
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createFiatPaymentRequest = createFiatPaymentRequest;
// Get fiat payment status
const getFiatPaymentStatusController = async (req, res, next) => {
    try {
        const { reference } = req.params;
        const payment = await (0, fiatPayment_service_1.getFiatPaymentStatus)(reference);
        res.json({
            success: true,
            data: payment,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getFiatPaymentStatusController = getFiatPaymentStatusController;
// Business confirms fiat payment receipt
const confirmFiatPaymentController = async (req, res, next) => {
    try {
        const { reference } = req.params;
        const userId = req.user.id;
        // Verify user is the payee or admin
        const payment = await database_1.prisma.fiatPayment.findUnique({
            where: { reference },
        });
        if (!payment) {
            throw new errorHandler_1.CustomError('Fiat payment not found', 404);
        }
        if (payment.payeeId !== userId && req.user.role !== client_1.UserRole.ADMIN) {
            throw new errorHandler_1.CustomError('Only the receiving business can confirm payment', 403);
        }
        const result = await (0, fiatPayment_service_1.confirmFiatPayment)(reference, userId);
        if (!result.success) {
            throw new errorHandler_1.CustomError(result.error || 'Failed to confirm payment', 400);
        }
        res.json({
            success: true,
            message: 'Payment confirmed and escrow released',
            data: {
                reference,
                status: 'CONFIRMED',
                escrowId: result.escrowId,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.confirmFiatPaymentController = confirmFiatPaymentController;
// Business rejects fiat payment
const rejectFiatPaymentController = async (req, res, next) => {
    try {
        const { reference } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;
        const payment = await database_1.prisma.fiatPayment.findUnique({
            where: { reference },
        });
        if (!payment) {
            throw new errorHandler_1.CustomError('Fiat payment not found', 404);
        }
        if (payment.payeeId !== userId && req.user.role !== client_1.UserRole.ADMIN) {
            throw new errorHandler_1.CustomError('Only the receiving business can reject payment', 403);
        }
        const result = await (0, fiatPayment_service_1.rejectFiatPayment)(reference, userId, reason);
        if (!result.success) {
            throw new errorHandler_1.CustomError(result.error || 'Failed to reject payment', 400);
        }
        res.json({
            success: true,
            message: 'Payment rejected and escrow refunded',
            data: {
                reference,
                status: 'REJECTED',
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.rejectFiatPaymentController = rejectFiatPaymentController;
// Cancel fiat payment
const cancelFiatPaymentController = async (req, res, next) => {
    try {
        const { reference } = req.params;
        const userId = req.user.id;
        const payment = await database_1.prisma.fiatPayment.findUnique({
            where: { reference },
        });
        if (!payment) {
            throw new errorHandler_1.CustomError('Fiat payment not found', 404);
        }
        if (payment.payerId !== userId && req.user.role !== client_1.UserRole.ADMIN) {
            throw new errorHandler_1.CustomError('Only the payer can cancel', 403);
        }
        const result = await (0, fiatPayment_service_1.cancelFiatPayment)(reference, userId);
        if (!result.success) {
            throw new errorHandler_1.CustomError(result.error || 'Failed to cancel payment', 400);
        }
        res.json({
            success: true,
            message: 'Payment cancelled and escrow refunded',
            data: {
                reference,
                status: 'CANCELLED',
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.cancelFiatPaymentController = cancelFiatPaymentController;
// Payer marks payment as sent
const markFiatPaymentSentController = async (req, res, next) => {
    try {
        const { reference } = req.params;
        const userId = req.user.id;
        const payment = await database_1.prisma.fiatPayment.findUnique({
            where: { reference },
        });
        if (!payment) {
            throw new errorHandler_1.CustomError('Fiat payment not found', 404);
        }
        if (payment.payerId !== userId) {
            throw new errorHandler_1.CustomError('Only the payer can mark as sent', 403);
        }
        const result = await (0, fiatPayment_service_1.markFiatPaymentSent)(reference, userId);
        if (!result.success) {
            throw new errorHandler_1.CustomError(result.error || 'Failed to mark as sent', 400);
        }
        res.json({
            success: true,
            message: 'Payment marked as sent. Awaiting business confirmation.',
            data: {
                reference,
                status: 'SENT',
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.markFiatPaymentSentController = markFiatPaymentSentController;
// Get available fiat payment methods
const getFiatMethods = async (_req, res, next) => {
    try {
        const methods = (0, fiatPayment_service_1.getAvailableFiatMethods)();
        res.json({
            success: true,
            data: methods,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getFiatMethods = getFiatMethods;
// List pending payments for a business
const listPendingFiatPaymentsController = async (req, res, next) => {
    try {
        const { businessId } = req.query;
        const userId = req.user.id;
        // Verify ownership
        if (businessId) {
            const business = await database_1.prisma.business.findUnique({
                where: { id: businessId },
            });
            if (!business || business.ownerId !== userId) {
                if (req.user.role !== client_1.UserRole.ADMIN) {
                    throw new errorHandler_1.CustomError('Unauthorized', 403);
                }
            }
        }
        const targetBusinessId = businessId || null;
        if (!targetBusinessId) {
            // Return all user's payments
            const payments = await (0, fiatPayment_service_1.listUserFiatPayments)(userId);
            return res.json({
                success: true,
                data: payments,
            });
        }
        const payments = await (0, fiatPayment_service_1.listPendingFiatPayments)(targetBusinessId);
        res.json({
            success: true,
            data: payments,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.listPendingFiatPaymentsController = listPendingFiatPaymentsController;
//# sourceMappingURL=fiatPayment.controller.js.map