"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const ai_payment_verifier_service_1 = require("../services/ai.payment.verifier.service");
const booking_service_1 = require("../services/booking.service");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
/**
 * POST /api/v1/payments/raast/verify
 * Upload a Raast payment screenshot for AI verification.
 * Body: multipart/form-data with 'screenshot' file, 'reference', 'amount'
 */
router.post('/verify', auth_middleware_1.authenticate, upload.single('screenshot'), async (req, res, next) => {
    try {
        const { reference, amount } = req.body;
        if (!reference || !amount) {
            return res.status(400).json({ success: false, error: 'reference and amount required' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'screenshot file required' });
        }
        // Find the booking's crypto payment
        const payment = await database_1.prisma.cryptoPayment.findFirst({
            where: { reference, type: 'manual', payerId: req.user.id },
        });
        if (!payment) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }
        // Get the business's Raast ID from metadata
        const meta = payment.metadata;
        const business = await database_1.prisma.business.findUnique({ where: { id: meta?.businessId } });
        const expectedRaastId = business?.raastId || '';
        const expectedAmount = Number(amount);
        // Run AI verification
        const imageBase64 = req.file.buffer.toString('base64');
        const verification = await ai_payment_verifier_service_1.aiPaymentVerifierService.verify(imageBase64, expectedAmount, expectedRaastId);
        // Store screenshot URL in metadata
        const screenshotUrl = `data:${req.file.mimetype};base64,${imageBase64}`;
        await database_1.prisma.cryptoPayment.update({
            where: { id: payment.id },
            data: {
                metadata: {
                    ...meta,
                    screenshotUrl,
                    verificationResult: verification,
                    verifiedAt: new Date().toISOString(),
                },
            },
        });
        logger_1.logger.info(`[RaastVerify] ${reference}: valid=${verification.isValid}, confidence=${verification.confidence}`);
        res.json({
            success: true,
            data: {
                isValid: verification.isValid,
                confidence: verification.confidence,
                fields: verification.fields,
                message: verification.isValid
                    ? 'Screenshot verified. Awaiting venue confirmation.'
                    : 'Could not auto-verify. Venue will review manually.',
            },
        });
    }
    catch (error) {
        logger_1.logger.error(`[RaastVerify] error: ${error.message}`);
        next(error);
    }
});
/**
 * GET /api/v1/payments/raast/pending
 * List pending Raast payments for a business (venue dashboard).
 */
router.get('/pending', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        // Find business owned by this user
        const business = await database_1.prisma.business.findFirst({ where: { ownerId: req.user.id } });
        if (!business) {
            return res.status(404).json({ success: false, error: 'No business found' });
        }
        // Find pending manual payments for this business
        const payments = await database_1.prisma.cryptoPayment.findMany({
            where: {
                type: 'manual',
                status: 'PENDING',
                metadata: { path: ['businessId'], equals: business.id },
            },
            orderBy: { createdAt: 'desc' },
        });
        // Enrich with reservation + customer details
        const enriched = await Promise.all(payments.map(async (p) => {
            const meta = p.metadata;
            const reservation = meta?.reservationId
                ? await database_1.prisma.reservation.findUnique({ where: { id: meta.reservationId } })
                : null;
            const customer = p.payerId
                ? await database_1.prisma.user.findUnique({ where: { id: p.payerId }, select: { firstName: true, lastName: true, email: true, phone: true } })
                : null;
            return {
                id: p.id,
                reference: p.reference,
                amount: p.amount,
                status: p.status,
                createdAt: p.createdAt,
                screenshotUrl: meta?.screenshotUrl || null,
                verificationResult: meta?.verificationResult || null,
                reservation: reservation
                    ? { date: reservation.reservationDate, time: reservation.reservationTime, guests: reservation.numberOfGuests, name: reservation.customerName }
                    : null,
                customer: customer ? { name: `${customer.firstName} ${customer.lastName}`, email: customer.email, phone: customer.phone } : null,
            };
        }));
        res.json({ success: true, data: enriched });
    }
    catch (error) {
        logger_1.logger.error(`[RaastPending] error: ${error.message}`);
        next(error);
    }
});
/**
 * POST /api/v1/payments/raast/:reference/confirm
 * Venue confirms receipt of Raast payment → releases escrow.
 */
router.post('/:reference/confirm', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { reference } = req.params;
        // Find the payment
        const payment = await database_1.prisma.cryptoPayment.findFirst({
            where: { reference, type: 'manual', status: 'PENDING' },
        });
        if (!payment) {
            return res.status(404).json({ success: false, error: 'Payment not found or already processed' });
        }
        const meta = payment.metadata;
        // Verify the business owner is confirming
        const business = await database_1.prisma.business.findUnique({ where: { id: meta?.businessId } });
        if (!business || business.ownerId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        // Update payment status
        await database_1.prisma.cryptoPayment.update({
            where: { id: payment.id },
            data: { status: 'COMPLETED' },
        });
        // Update reservation
        if (meta?.reservationId) {
            await database_1.prisma.reservation.update({
                where: { id: meta.reservationId },
                data: { depositStatus: 'PAID', status: 'CONFIRMED', depositPaid: true },
            });
        }
        // Create escrow
        const creationFee = (payment.amount * 100) / 10000; // 1%
        const heldAmount = payment.amount - creationFee;
        const escrow = await database_1.prisma.escrow.create({
            data: {
                paymentId: payment.id,
                amount: heldAmount,
                status: 'HELD',
                payerId: payment.payerId,
                payeeId: payment.payeeId,
            },
        });
        // Auto-release escrow immediately (since venue confirmed)
        const releaseResult = await (0, booking_service_1.releaseEscrowToBusiness)(escrow.id, req.user.id);
        logger_1.logger.info(`[RaastConfirm] ${reference}: confirmed by ${req.user.id}, escrow released`);
        res.json({
            success: true,
            message: 'Payment confirmed and escrow released',
            data: {
                escrowId: escrow.id,
                releasedAmount: releaseResult.releasedAmount,
                netToBusiness: releaseResult.netToBusiness,
            },
        });
    }
    catch (error) {
        logger_1.logger.error(`[RaastConfirm] error: ${error.message}`);
        next(error);
    }
});
/**
 * POST /api/v1/payments/raast/:reference/reject
 * Venue rejects a Raast payment.
 */
router.post('/:reference/reject', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { reference } = req.params;
        const { reason } = req.body;
        const payment = await database_1.prisma.cryptoPayment.findFirst({
            where: { reference, type: 'manual', status: 'PENDING' },
        });
        if (!payment) {
            return res.status(404).json({ success: false, error: 'Payment not found or already processed' });
        }
        const meta = payment.metadata;
        const business = await database_1.prisma.business.findUnique({ where: { id: meta?.businessId } });
        if (!business || business.ownerId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        // Update payment status
        await database_1.prisma.cryptoPayment.update({
            where: { id: payment.id },
            data: {
                status: 'FAILED',
                metadata: { ...meta, rejectedAt: new Date().toISOString(), rejectedBy: req.user.id, rejectReason: reason },
            },
        });
        // Update reservation
        if (meta?.reservationId) {
            await database_1.prisma.reservation.update({
                where: { id: meta.reservationId },
                data: { depositStatus: 'NOT_REQUIRED', status: 'CANCELLED' },
            });
        }
        logger_1.logger.info(`[RaastReject] ${reference}: rejected by ${req.user.id}, reason: ${reason || 'none'}`);
        res.json({ success: true, message: 'Payment rejected' });
    }
    catch (error) {
        logger_1.logger.error(`[RaastReject] error: ${error.message}`);
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=raastPayment.routes.js.map