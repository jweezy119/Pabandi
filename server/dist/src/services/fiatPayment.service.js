"use strict";
// ── Fiat Payment Service ─────────────────────────────────────────────────────
// Honest fiat bridge: records intent, generates payment instructions,
// and routes confirmation through the same escrow system.
// No money transmitter license needed — we never touch fiat directly.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fiatPaymentService = exports.FIAT_METHODS = void 0;
exports.calculateCreationFee = calculateCreationFee;
exports.calculateReleaseFee = calculateReleaseFee;
exports.generatePaymentQR = generatePaymentQR;
exports.createFiatPayment = createFiatPayment;
exports.getFiatPaymentStatus = getFiatPaymentStatus;
exports.confirmFiatPayment = confirmFiatPayment;
exports.rejectFiatPayment = rejectFiatPayment;
exports.cancelFiatPayment = cancelFiatPayment;
exports.markFiatPaymentSent = markFiatPaymentSent;
exports.listPendingFiatPayments = listPendingFiatPayments;
exports.listUserFiatPayments = listUserFiatPayments;
exports.getAvailableFiatMethods = getAvailableFiatMethods;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
// ── Fee Model (matches crypto: 1% creation / 1% release) ─────────────────────
const CREATION_FEE_BPS = 100; // 1%
const RELEASE_FEE_BPS = 100; // 1%
// ── Available Methods Metadata ───────────────────────────────────────────────
exports.FIAT_METHODS = [
    {
        id: 'PAYPAL',
        label: 'PayPal',
        icon: '🅿️',
        description: 'Pay via PayPal — send to the business PayPal email.',
        hasQR: true,
        requiresBusinessConfirmation: true,
    },
    {
        id: 'VENMO',
        label: 'Venmo',
        icon: '💙',
        description: 'Pay via Venmo — send to the business Venmo handle.',
        hasQR: true,
        requiresBusinessConfirmation: true,
    },
    {
        id: 'CASH_APP',
        label: 'Cash App',
        icon: '💚',
        description: 'Pay via Cash App — send to the business $tag.',
        hasQR: true,
        requiresBusinessConfirmation: true,
    },
    {
        id: 'ZELLE',
        label: 'Zelle',
        icon: '⚡',
        description: 'Pay via Zelle — send from your bank app.',
        hasQR: false,
        requiresBusinessConfirmation: true,
    },
    {
        id: 'ACH',
        label: 'ACH Bank Transfer',
        icon: '🏦',
        description: 'Direct bank transfer with account & routing numbers.',
        hasQR: false,
        requiresBusinessConfirmation: true,
    },
    {
        id: 'CARD',
        label: 'Credit/Debit Card (Manual)',
        icon: '💳',
        description: 'Pay at the business using their card terminal.',
        hasQR: false,
        requiresBusinessConfirmation: true,
    },
    {
        id: 'CASH',
        label: 'Cash',
        icon: '💵',
        description: 'Pay in person with cash.',
        hasQR: false,
        requiresBusinessConfirmation: true,
    },
    {
        id: 'CHECK',
        label: 'Check',
        icon: '📝',
        description: 'Pay by check — hand to the business.',
        hasQR: false,
        requiresBusinessConfirmation: true,
    },
];
// ── Helper: Generate unique reference ────────────────────────────────────────
function generateReference(method) {
    const prefix = `FIAT-${method.slice(0, 3)}`;
    const timestamp = Date.now().toString(36);
    const rand = crypto_1.default.randomBytes(4).toString('hex');
    return `${prefix}-${timestamp}-${rand}`.toUpperCase();
}
// ── Helper: Calculate fee ────────────────────────────────────────────────────
function calculateCreationFee(amount) {
    return (amount * CREATION_FEE_BPS) / 10000;
}
function calculateReleaseFee(amount) {
    return (amount * RELEASE_FEE_BPS) / 10000;
}
// ── QR Code Data Generator ───────────────────────────────────────────────────
function generatePaymentQR(method, identifier, amount, reference) {
    switch (method) {
        case 'PAYPAL':
            // PayPal.me link format
            return `https://www.paypal.com/paypalme/${identifier}/${amount}`;
        case 'VENMO':
            // Venmo deep link
            return `venmo://paypay?txn=pay&recipients=${identifier}&amount=${amount}&note=${reference}`;
        case 'CASH_APP':
            // Cash App payment link
            return `https://cash.app/$${identifier}/${amount}`;
        case 'ZELLE':
            // Zelle doesn't support QR for payments directly, but banks use this format
            return `zelle://transfer?to=${identifier}&amount=${amount}&memo=${reference}`;
        case 'ACH':
            return `ach://transfer?account=${identifier}&amount=${amount}&ref=${reference}`;
        default:
            return `pabandi://fiat/${method.toLowerCase()}?ref=${reference}&amount=${amount}`;
    }
}
// ── Payment Instructions Builder ─────────────────────────────────────────────
function buildInstructions(method, config, amount, reference) {
    const amountFormatted = `$${amount.toFixed(2)}`;
    const warningLine = '⚠️ This payment requires manual confirmation by the business. Funds are held in escrow until confirmed.';
    switch (method) {
        case 'PAYPAL': {
            const email = config.paypalEmail || 'business@example.com';
            const paymentUrl = `https://www.paypal.com/paypalme/${email.replace('@', '')}/${amount}`;
            const instructions = [
                `Pay via PayPal`,
                ``,
                `Amount: ${amountFormatted}`,
                `PayPal Email: ${email}`,
                `Reference: ${reference}`,
                ``,
                `Steps:`,
                `1. Open PayPal and send ${amountFormatted} to ${email}`,
                `2. Enter "${reference}" as the note/memo`,
                `3. The business will confirm receipt manually`,
                ``,
                warningLine,
            ].join('\n');
            const qrData = generatePaymentQR('PAYPAL', email.replace('@', ''), amount, reference);
            return { instructions, paymentUrl, qrData };
        }
        case 'VENMO': {
            const handle = config.venmoHandle || '@business';
            const paymentUrl = `venmo://paypay?txn=pay&recipients=${handle}&amount=${amount}&note=${reference}`;
            const instructions = [
                `Pay via Venmo`,
                ``,
                `Amount: ${amountFormatted}`,
                `Venmo Handle: ${handle}`,
                `Reference: ${reference}`,
                ``,
                `Steps:`,
                `1. Open Venmo and send ${amountFormatted} to ${handle}`,
                `2. Enter "${reference}" in the note`,
                `3. The business will confirm receipt manually`,
                ``,
                warningLine,
            ].join('\n');
            const qrData = generatePaymentQR('VENMO', handle, amount, reference);
            return { instructions, paymentUrl, qrData };
        }
        case 'CASH_APP': {
            const tag = config.cashAppTag || '$business';
            const paymentUrl = `https://cash.app/$${tag.replace('$', '')}/${amount}`;
            const instructions = [
                `Pay via Cash App`,
                ``,
                `Amount: ${amountFormatted}`,
                `Cash App Tag: ${tag}`,
                `Reference: ${reference}`,
                ``,
                `Steps:`,
                `1. Open Cash App and send ${amountFormatted} to ${tag}`,
                `2. Enter "${reference}" in the For field`,
                `3. The business will confirm receipt manually`,
                ``,
                warningLine,
            ].join('\n');
            const qrData = generatePaymentQR('CASH_APP', tag.replace('$', ''), amount, reference);
            return { instructions, paymentUrl, qrData };
        }
        case 'ZELLE': {
            const email = config.zelleEmail || config.zellePhone || '';
            const instructions = [
                `Pay via Zelle`,
                ``,
                `Amount: ${amountFormatted}`,
                config.zelleEmail ? `Zelle Email: ${config.zelleEmail}` : '',
                config.zellePhone ? `Zelle Phone: ${config.zellePhone}` : '',
                `Reference: ${reference}`,
                ``,
                `Steps:`,
                `1. Open your bank app (Zelle is built in)`,
                `2. Send ${amountFormatted} to the Zelle email/phone above`,
                `3. Include "${reference}" as memo/note if possible`,
                `4. The business will confirm receipt manually`,
                ``,
                warningLine,
            ]
                .filter(Boolean)
                .join('\n');
            return { instructions };
        }
        case 'ACH': {
            const instructions = [
                `ACH Bank Transfer`,
                ``,
                `Amount: ${amountFormatted}`,
                config.bankName ? `Bank: ${config.bankName}` : '',
                config.bankRouting ? `Routing Number: ${config.bankRouting}` : '',
                config.bankAccount ? `Account Number: ${config.bankAccount}` : '',
                `Reference: ${reference}`,
                ``,
                `Steps:`,
                `1. Log in to your online banking`,
                `2. Set up an ACH transfer using the details above`,
                `3. Enter "${reference}" as the transfer memo`,
                `4. The business will confirm receipt (1-3 business days)`,
                ``,
                warningLine,
            ]
                .filter(Boolean)
                .join('\n');
            return { instructions };
        }
        case 'CARD': {
            const instructions = [
                `Credit/Debit Card (Manual Processing)`,
                ``,
                `Amount: ${amountFormatted}`,
                `Reference: ${reference}`,
                ``,
                `Steps:`,
                `1. Tell the business you're paying via card`,
                `2. They will process the payment through their terminal`,
                `3. Reference: ${reference}`,
                `4. The business will confirm once processed`,
                ``,
                warningLine,
            ].join('\n');
            return { instructions };
        }
        case 'CASH': {
            const instructions = [
                `Pay in Person with Cash`,
                ``,
                `Amount: ${amountFormatted}`,
                `Reference: ${reference}`,
                ``,
                `Steps:`,
                `1. Bring ${amountFormatted} cash to the business`,
                `2. Show reference: ${reference}`,
                `3. Business will confirm receipt and mark paid`,
                ``,
                warningLine,
            ].join('\n');
            return { instructions };
        }
        case 'CHECK': {
            const instructions = [
                `Pay by Check`,
                ``,
                `Amount: ${amountFormatted}`,
                `Reference: ${reference}`,
                ``,
                `Steps:`,
                `1. Write check for ${amountFormatted}`,
                `2. Memo: ${reference}`,
                `3. Hand to the business`,
                `4. Business will confirm when check clears`,
                ``,
                warningLine,
            ].join('\n');
            return { instructions };
        }
        default:
            return {
                instructions: `Fiat payment of ${amountFormatted}. Reference: ${reference}. Business will confirm manually.`,
            };
    }
}
// ── Main: Create Fiat Payment ────────────────────────────────────────────────
async function createFiatPayment(input) {
    const { method, amount, reference, payerId, payeeId, businessId, payeeConfig, currency = 'USD', } = input;
    // Validate method
    if (!exports.FIAT_METHODS.find((m) => m.id === method)) {
        throw new Error(`Unsupported fiat payment method: ${method}`);
    }
    if (!amount || amount <= 0) {
        throw new Error('Amount must be greater than 0');
    }
    const ref = reference || generateReference(method);
    const creationFee = calculateCreationFee(amount);
    const netAmount = amount - creationFee;
    // Build payment instructions
    const { instructions, paymentUrl, qrData } = buildInstructions(method, payeeConfig, amount, ref);
    // Create fiat payment record + escrow atomically
    const fiatPayment = await database_1.prisma.$transaction(async (tx) => {
        // Create the fiat payment record
        const fp = await tx.fiatPayment.create({
            data: {
                method,
                amount,
                currency,
                status: 'PENDING',
                reference: ref,
                payerId,
                payeeId,
                businessId,
                paymentUrl,
                instructions,
                escrowId: undefined, // will be set after escrow creation
            },
        });
        // Create escrow record (honest — holds the "intent" amount)
        const escrow = await tx.escrow.create({
            data: {
                amount: netAmount,
                status: 'PENDING',
                payerId: payerId || '',
                payeeId,
            },
        });
        // Link escrow to fiat payment
        await tx.fiatPayment.update({
            where: { id: fp.id },
            data: { escrowId: escrow.id },
        });
        return { ...fp, escrowId: escrow.id };
    });
    logger_1.logger.info(`[FiatPaymentService] Created ${method} payment: ${ref} ($${amount} ${currency}, fee: $${creationFee.toFixed(2)})`);
    return {
        type: 'fiat',
        method,
        reference: ref,
        paymentUrl,
        instructions,
        qrData,
        amount,
        currency,
        status: fiatPayment.status,
        escrowId: fiatPayment.escrowId || undefined,
    };
}
// ── Get Fiat Payment Status ──────────────────────────────────────────────────
async function getFiatPaymentStatus(reference) {
    const payment = await database_1.prisma.fiatPayment.findUnique({
        where: { reference },
        include: {
            payer: { select: { id: true, email: true, firstName: true, lastName: true } },
            payee: { select: { id: true, email: true, firstName: true, lastName: true } },
            business: { select: { id: true, name: true } },
            escrow: true,
        },
    });
    if (!payment) {
        throw new Error('Fiat payment not found');
    }
    return payment;
}
// ── Confirm Fiat Payment (Business Confirms Receipt) ─────────────────────────
async function confirmFiatPayment(reference, confirmedBy) {
    const payment = await database_1.prisma.fiatPayment.findUnique({
        where: { reference },
    });
    if (!payment) {
        throw new Error('Fiat payment not found');
    }
    if (payment.status === 'CONFIRMED') {
        return { success: false, error: 'Payment already confirmed' };
    }
    if (payment.status === 'CANCELLED' || payment.status === 'REJECTED') {
        return { success: false, error: `Cannot confirm ${payment.status.toLowerCase()} payment` };
    }
    // Update payment status + release escrow
    const releaseFee = calculateReleaseFee(payment.amount);
    const netRelease = payment.amount - releaseFee;
    await database_1.prisma.$transaction(async (tx) => {
        // Mark payment as confirmed
        await tx.fiatPayment.update({
            where: { id: payment.id },
            data: {
                status: 'CONFIRMED',
                confirmedAt: new Date(),
                confirmedBy,
            },
        });
        // Release escrow (net of release fee)
        if (payment.escrowId) {
            await tx.escrow.update({
                where: { id: payment.escrowId },
                data: {
                    status: 'RELEASED',
                    releasedAt: new Date(),
                    releasedBy: confirmedBy,
                },
            });
        }
    });
    logger_1.logger.info(`[FiatPaymentService] Confirmed ${reference} by ${confirmedBy} (net release: $${netRelease.toFixed(2)})`);
    return { success: true, escrowId: payment.escrowId || undefined };
}
// ── Reject Fiat Payment (Business Rejects — Refund to Escrow) ────────────────
async function rejectFiatPayment(reference, rejectedBy, reason) {
    const payment = await database_1.prisma.fiatPayment.findUnique({
        where: { reference },
    });
    if (!payment) {
        throw new Error('Fiat payment not found');
    }
    if (payment.status === 'CONFIRMED') {
        return { success: false, error: 'Cannot reject an already confirmed payment' };
    }
    if (payment.status === 'CANCELLED' || payment.status === 'REJECTED') {
        return { success: false, error: `Payment already ${payment.status.toLowerCase()}` };
    }
    await database_1.prisma.$transaction(async (tx) => {
        await tx.fiatPayment.update({
            where: { id: payment.id },
            data: {
                status: 'REJECTED',
                confirmedAt: new Date(),
                confirmedBy: rejectedBy,
                rejectionReason: reason,
            },
        });
        // Refund escrow back to payer
        if (payment.escrowId) {
            await tx.escrow.update({
                where: { id: payment.escrowId },
                data: {
                    status: 'REFUNDED',
                    refundReason: reason || 'Business rejected payment',
                    releasedAt: new Date(),
                    releasedBy: rejectedBy,
                },
            });
        }
    });
    logger_1.logger.info(`[FiatPaymentService] Rejected ${reference} by ${rejectedBy} (reason: ${reason})`);
    return { success: true };
}
// ── Cancel Fiat Payment ──────────────────────────────────────────────────────
async function cancelFiatPayment(reference, cancelledBy) {
    const payment = await database_1.prisma.fiatPayment.findUnique({
        where: { reference },
    });
    if (!payment) {
        throw new Error('Fiat payment not found');
    }
    if (payment.status === 'CONFIRMED') {
        return { success: false, error: 'Cannot cancel an already confirmed payment' };
    }
    if (payment.status === 'CANCELLED') {
        return { success: false, error: 'Payment already cancelled' };
    }
    await database_1.prisma.$transaction(async (tx) => {
        await tx.fiatPayment.update({
            where: { id: payment.id },
            data: {
                status: 'CANCELLED',
                confirmedAt: new Date(),
                confirmedBy: cancelledBy,
            },
        });
        if (payment.escrowId) {
            await tx.escrow.update({
                where: { id: payment.escrowId },
                data: {
                    status: 'REFUNDED',
                    refundReason: 'Cancelled by payer',
                    releasedAt: new Date(),
                    releasedBy: cancelledBy,
                },
            });
        }
    });
    return { success: true };
}
// ── Mark as Sent (Payer indicates they sent the money) ──────────────────────
async function markFiatPaymentSent(reference, userId) {
    const payment = await database_1.prisma.fiatPayment.findUnique({
        where: { reference },
    });
    if (!payment) {
        throw new Error('Fiat payment not found');
    }
    if (payment.status !== 'PENDING') {
        return { success: false, error: `Cannot mark as sent from status ${payment.status}` };
    }
    await database_1.prisma.fiatPayment.update({
        where: { id: payment.id },
        data: { status: 'SENT' },
    });
    return { success: true };
}
// ── List pending fiat payments for a business ────────────────────────────────
async function listPendingFiatPayments(businessId) {
    return database_1.prisma.fiatPayment.findMany({
        where: {
            businessId,
            status: { in: ['PENDING', 'SENT'] },
        },
        include: {
            payer: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
}
// ── List fiat payments for a user ────────────────────────────────────────────
async function listUserFiatPayments(userId) {
    return database_1.prisma.fiatPayment.findMany({
        where: {
            OR: [{ payerId: userId }, { payeeId: userId }],
        },
        include: {
            payer: { select: { id: true, email: true, firstName: true, lastName: true } },
            payee: { select: { id: true, email: true, firstName: true, lastName: true } },
            business: { select: { id: true, name: true } },
            escrow: true,
        },
        orderBy: { createdAt: 'desc' },
    });
}
// ── Get available fiat methods ───────────────────────────────────────────────
function getAvailableFiatMethods() {
    return exports.FIAT_METHODS;
}
exports.fiatPaymentService = {
    createFiatPayment,
    getFiatPaymentStatus,
    confirmFiatPayment,
    rejectFiatPayment,
    cancelFiatPayment,
    markFiatPaymentSent,
    listPendingFiatPayments,
    listUserFiatPayments,
    getAvailableFiatMethods,
    generatePaymentQR,
    calculateCreationFee,
    calculateReleaseFee,
};
//# sourceMappingURL=fiatPayment.service.js.map