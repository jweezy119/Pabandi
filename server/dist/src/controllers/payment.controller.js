"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPayLioWebhook = exports.getPayLioPaymentStatus = exports.createPayLio = exports.getPaymentStatus = exports.getEscrowById = exports.refundEscrow = exports.releaseEscrow = exports.createEscrow = exports.processBTCPayWebhook = exports.verifyPayment = exports.getPaymentById = exports.createPaymentRequest = void 0;
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const client_1 = require("@prisma/client");
const payment_service_1 = require("../services/payment.service");
const crypto_1 = __importDefault(require("crypto"));
// Create a new crypto payment request
const createPaymentRequest = async (req, res, next) => {
    try {
        const { amount, currency = 'USDC', type = 'usdc', memo, reference, businessId, payeeId } = req.body;
        if (!amount || amount <= 0) {
            throw new errorHandler_1.CustomError('Amount must be greater than 0', 400);
        }
        const paymentRef = reference || `pab_${crypto_1.default.randomBytes(8).toString('hex')}`;
        let paymentRequest;
        switch (type) {
            case 'usdc':
            case 'solana': {
                paymentRequest = await (0, payment_service_1.createUSDCpayment)({
                    amount: parseFloat(amount),
                    reference: paymentRef,
                    memo
                });
                break;
            }
            case 'btcpay':
            case 'bitcoin': {
                paymentRequest = await (0, payment_service_1.createBTCPayInvoice)({
                    amount: parseFloat(amount),
                    currency: currency || 'USD',
                    reference: paymentRef
                });
                break;
            }
            case 'manual': {
                paymentRequest = (0, payment_service_1.createManualPayment)({
                    amount: parseFloat(amount),
                    reference: paymentRef,
                    method: req.body.method
                });
                break;
            }
            default:
                throw new errorHandler_1.CustomError(`Unsupported payment type: ${type}`, 400);
        }
        // Create crypto payment record in database
        const payment = await database_1.prisma.cryptoPayment.create({
            data: {
                type: paymentRequest.type,
                amount: parseFloat(amount),
                currency,
                status: 'PENDING',
                reference: paymentRef,
                payerId: req.user?.id || null,
                payeeId: payeeId || null,
                metadata: {
                    ...paymentRequest,
                    ...(memo ? { memo } : {}),
                },
            },
        });
        logger_1.logger.info(`Crypto payment created: ${payment.id} via ${type}`);
        res.status(201).json({
            success: true,
            message: 'Payment request created',
            data: {
                payment,
                request: paymentRequest,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createPaymentRequest = createPaymentRequest;
// Get crypto payment by ID
const getPaymentById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payment = await database_1.prisma.cryptoPayment.findUnique({
            where: { id },
            include: {
                payer: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                payee: {
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
            payment.payerId !== req.user?.id &&
            payment.payeeId !== req.user?.id) {
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
exports.getPaymentById = getPaymentById;
// Verify a crypto payment
const verifyPayment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { txSig, invoiceId } = req.body;
        const payment = await database_1.prisma.cryptoPayment.findUnique({
            where: { id },
        });
        if (!payment) {
            throw new errorHandler_1.CustomError('Payment not found', 404);
        }
        let verificationResult = { verified: false };
        if (payment.type === 'solana' && txSig) {
            verificationResult = await (0, payment_service_1.verifyUSDCpayment)({
                reference: payment.reference,
                txSig
            });
        }
        else if (payment.type === 'btcpay' && invoiceId) {
            const btcpayResult = await (0, payment_service_1.verifyBTCPayPayment)(invoiceId);
            verificationResult = {
                verified: btcpayResult.confirmed,
                status: btcpayResult.status
            };
        }
        else {
            throw new errorHandler_1.CustomError('Verification requires txSig for USDC or invoiceId for BTCPay', 400);
        }
        if (verificationResult.verified) {
            await database_1.prisma.cryptoPayment.update({
                where: { id: payment.id },
                data: {
                    status: 'COMPLETED',
                    txSignature: txSig || invoiceId || null,
                },
            });
        }
        res.json({
            success: true,
            data: {
                verified: verificationResult.verified,
                status: verificationResult.verified ? 'COMPLETED' : payment.status,
                details: verificationResult,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyPayment = verifyPayment;
// Process BTCPay webhook
const processBTCPayWebhook = async (req, res, next) => {
    try {
        const { invoiceId, status, metadata } = req.body;
        logger_1.logger.info(`[BTCPay Webhook] Invoice ${invoiceId} status: ${status}`);
        if (!invoiceId) {
            return res.status(400).json({ success: false, error: 'Missing invoiceId' });
        }
        // Find payment by reference
        const payment = await database_1.prisma.cryptoPayment.findFirst({
            where: {
                reference: metadata?.reference || invoiceId,
            },
        });
        if (!payment) {
            logger_1.logger.warn(`[BTCPay Webhook] No payment found for invoice ${invoiceId}`);
            return res.status(404).json({ success: false, error: 'Payment not found' });
        }
        const newStatus = status === 'Settled' || status === 'Complete' ? 'COMPLETED' :
            status === 'Expired' ? 'FAILED' : payment.status;
        await database_1.prisma.cryptoPayment.update({
            where: { id: payment.id },
            data: {
                status: newStatus,
                txSignature: invoiceId,
                metadata: {
                    ...(payment.metadata || {}),
                    btcpayWebhook: req.body,
                },
            },
        });
        res.json({ success: true, status: newStatus });
    }
    catch (error) {
        logger_1.logger.error(`[BTCPay Webhook] Error: ${error.message}`);
        next(error);
    }
};
exports.processBTCPayWebhook = processBTCPayWebhook;
// Create escrow for a crypto payment
const createEscrow = async (req, res, next) => {
    try {
        const { paymentId, payerId, payeeId, amount } = req.body;
        if (!paymentId || !payerId || !payeeId || !amount) {
            throw new errorHandler_1.CustomError('paymentId, payerId, payeeId, and amount are required', 400);
        }
        const payment = await database_1.prisma.cryptoPayment.findUnique({ where: { id: paymentId } });
        if (!payment) {
            throw new errorHandler_1.CustomError('Payment not found', 404);
        }
        // Only payer or admin can create escrow
        if (payerId !== req.user.id && req.user.role !== client_1.UserRole.ADMIN) {
            throw new errorHandler_1.CustomError('Only payer can create escrow', 403);
        }
        const escrow = await database_1.prisma.escrow.create({
            data: {
                paymentId,
                amount: parseFloat(amount),
                status: 'PENDING',
                payerId,
                payeeId,
            },
        });
        logger_1.logger.info(`Escrow created: ${escrow.id} for payment ${paymentId}`);
        res.status(201).json({
            success: true,
            data: escrow,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createEscrow = createEscrow;
// Release escrow
const releaseEscrow = async (req, res, next) => {
    try {
        const { id } = req.params;
        const escrow = await database_1.prisma.escrow.findUnique({ where: { id } });
        if (!escrow) {
            throw new errorHandler_1.CustomError('Escrow not found', 404);
        }
        // Only payee can release (or admin)
        if (escrow.payeeId !== req.user.id && req.user.role !== client_1.UserRole.ADMIN) {
            throw new errorHandler_1.CustomError('Only payee can release escrow', 403);
        }
        if (escrow.status !== 'PENDING' && escrow.status !== 'HELD') {
            throw new errorHandler_1.CustomError(`Cannot release from status ${escrow.status}`, 400);
        }
        await database_1.prisma.escrow.update({
            where: { id },
            data: {
                status: 'RELEASED',
                releasedAt: new Date(),
                releasedBy: req.user.id,
            },
        });
        // Update associated crypto payment status
        if (escrow.paymentId) {
            await database_1.prisma.cryptoPayment.update({
                where: { id: escrow.paymentId },
                data: { status: 'COMPLETED' },
            });
        }
        logger_1.logger.info(`Escrow released: ${id} by ${req.user.id}`);
        res.json({ success: true, data: { status: 'RELEASED' } });
    }
    catch (error) {
        next(error);
    }
};
exports.releaseEscrow = releaseEscrow;
// Refund escrow
const refundEscrow = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const escrow = await database_1.prisma.escrow.findUnique({ where: { id } });
        if (!escrow) {
            throw new errorHandler_1.CustomError('Escrow not found', 404);
        }
        // Only payer can request refund (or admin)
        if (escrow.payerId !== req.user.id && req.user.role !== client_1.UserRole.ADMIN) {
            throw new errorHandler_1.CustomError('Only payer can request refund', 403);
        }
        if (escrow.status === 'RELEASED') {
            throw new errorHandler_1.CustomError('Cannot refund an already released escrow', 400);
        }
        await database_1.prisma.escrow.update({
            where: { id },
            data: {
                status: 'REFUNDED',
                refundReason: reason,
                releasedAt: new Date(),
            },
        });
        // Update associated crypto payment status
        if (escrow.paymentId) {
            await database_1.prisma.cryptoPayment.update({
                where: { id: escrow.paymentId },
                data: { status: 'REFUNDED' },
            });
        }
        logger_1.logger.info(`Escrow refunded: ${id} (reason: ${reason})`);
        res.json({ success: true, data: { status: 'REFUNDED' } });
    }
    catch (error) {
        next(error);
    }
};
exports.refundEscrow = refundEscrow;
// Get escrow details
const getEscrowById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const escrow = await database_1.prisma.escrow.findUnique({
            where: { id },
            include: {
                payer: { select: { id: true, email: true, firstName: true, lastName: true } },
                payee: { select: { id: true, email: true, firstName: true, lastName: true } },
            },
        });
        if (!escrow) {
            throw new errorHandler_1.CustomError('Escrow not found', 404);
        }
        // Only involved parties or admin can view
        if (escrow.payerId !== req.user.id &&
            escrow.payeeId !== req.user.id &&
            req.user.role !== client_1.UserRole.ADMIN) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        res.json({ success: true, data: escrow });
    }
    catch (error) {
        next(error);
    }
};
exports.getEscrowById = getEscrowById;
// Get crypto payment status
const getPaymentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payment = await database_1.prisma.cryptoPayment.findUnique({
            where: { id },
        });
        if (!payment) {
            throw new errorHandler_1.CustomError('Payment not found', 404);
        }
        res.json({
            success: true,
            data: {
                id: payment.id,
                status: payment.status,
                type: payment.type,
                amount: payment.amount,
                currency: payment.currency,
                reference: payment.reference,
                txSignature: payment.txSignature,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPaymentStatus = getPaymentStatus;
// ── PayLio Controllers ──────────────────────────────────────────────────────
const createPayLio = async (req, res, next) => {
    try {
        const { amount, reference, customerEmail } = req.body;
        if (!amount || !reference) {
            return res.status(400).json({ success: false, error: 'amount and reference are required' });
        }
        const result = await (0, payment_service_1.createPayLioPayment)({
            amount: parseFloat(amount),
            reference,
            customerEmail,
        });
        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }
        res.json({
            success: true,
            data: { id: result.id, url: result.url, type: 'paylio' },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createPayLio = createPayLio;
const getPayLioPaymentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const status = await (0, payment_service_1.verifyPayLioPayment)(id);
        res.json({ success: true, data: status });
    }
    catch (error) {
        next(error);
    }
};
exports.getPayLioPaymentStatus = getPayLioPaymentStatus;
const processPayLioWebhook = async (req, res, next) => {
    try {
        // ── Signature verification ─────────────────────────────────────────────
        const PAYLIO_WEBHOOK_SECRET = process.env.PAYLIO_WEBHOOK_SECRET;
        if (PAYLIO_WEBHOOK_SECRET) {
            const signature = String(req.headers['x-paylio-signature'] || req.headers['x-webhook-signature'] || '');
            if (!signature) {
                logger_1.logger.warn('[PayLio Webhook] Missing signature header');
                return res.status(401).json({ success: false, error: 'Missing signature' });
            }
            const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
            const rawBody = JSON.stringify(req.body);
            const expected = crypto.createHmac('sha256', PAYLIO_WEBHOOK_SECRET).update(rawBody).digest('hex');
            if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
                logger_1.logger.warn('[PayLio Webhook] Invalid signature');
                return res.status(401).json({ success: false, error: 'Invalid signature' });
            }
        }
        const { event, data } = req.body;
        logger_1.logger.info(`[PayLio Webhook] Event: ${event}`, data);
        if (event === 'payment.completed' || event === 'payment.success') {
            const reference = data?.reference || data?.payment_id || data?.id;
            const paylioId = data?.id || data?.payment_id;
            logger_1.logger.info(`[PayLio] Payment completed: reference=${reference}, id=${paylioId}`);
            if (reference) {
                try {
                    const { confirmPaymentAndCreateEscrow } = await Promise.resolve().then(() => __importStar(require('../services/booking.service')));
                    const result = await confirmPaymentAndCreateEscrow(reference);
                    if (result.success) {
                        logger_1.logger.info(`[PayLio] Escrow created for ${reference}: ${result.escrowId}`);
                    }
                    else {
                        logger_1.logger.warn(`[PayLio] Escrow creation failed for ${reference}: ${result.message}`);
                    }
                }
                catch (escrowErr) {
                    logger_1.logger.error(`[PayLio] Error creating escrow for ${reference}: ${escrowErr.message}`);
                }
            }
        }
        res.json({ received: true });
    }
    catch (error) {
        next(error);
    }
};
exports.processPayLioWebhook = processPayLioWebhook;
//# sourceMappingURL=payment.controller.js.map