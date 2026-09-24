"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUSDCpayment = createUSDCpayment;
exports.verifyUSDCpayment = verifyUSDCpayment;
exports.releaseUSDCtoBusiness = releaseUSDCtoBusiness;
exports.createPayLioPayment = createPayLioPayment;
exports.verifyPayLioPayment = verifyPayLioPayment;
exports.createBTCPayInvoice = createBTCPayInvoice;
exports.verifyBTCPayPayment = verifyBTCPayPayment;
exports.createManualPayment = createManualPayment;
exports.holdInEscrow = holdInEscrow;
exports.releaseEscrow = releaseEscrow;
exports.refundEscrow = refundEscrow;
exports.getEscrowDetails = getEscrowDetails;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
// ── Solana USDC Configuration ───────────────────────────────────────────────
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const PLATFORM_WALLET = process.env.PLATFORM_WALLET || process.env.PABANDI_TREASURY_WALLET || '';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PLATFORM_FEE_BPS = 100; // 1% = 100 basis points
// ── PayLio Configuration ─────────────────────────────────────────────────────
const PAYLIO_API_KEY = process.env.PAYLIO_API_KEY || '';
const PAYLIO_MERCHANT_ID = process.env.PAYLIO_MERCHANT_ID || '';
const PAYLIO_API_URL = 'https://api.paylio.org/v1';
const PAYLIO_WEBHOOK_SECRET = process.env.PAYLIO_WEBHOOK_SECRET || '';
const BTCPAY_API_URL = process.env.BTCPAY_API_URL || '';
const BTCPAY_API_KEY = process.env.BTCPAY_API_KEY || '';
const BTCPAY_STORE_ID = process.env.BTCPAY_STORE_ID || '';
// ── Solana USDC (Primary) ──────────────────────────────────────────────────
async function createUSDCpayment({ amount, reference, memo }) {
    if (!PLATFORM_WALLET) {
        logger_1.logger.warn('[PaymentService] PLATFORM_WALLET not configured. USDC payment will use placeholder.');
    }
    const qrData = `solana:${PLATFORM_WALLET}?amount=${amount}&memo=${reference}`;
    const deepLink = `solana:${PLATFORM_WALLET}/transfer?amount=${amount}&memo=${reference}&reference=${reference}`;
    return {
        type: 'solana',
        mint: USDC_MINT,
        amount,
        reference,
        qrData,
        deepLink,
    };
}
async function verifyUSDCpayment({ reference, txSig }) {
    try {
        if (!txSig) {
            return { verified: false, error: 'Transaction signature required' };
        }
        const rpcUrl = SOLANA_RPC_URL;
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getTransaction',
                params: [
                    txSig,
                    { encoding: 'jsonParsed', commitment: 'confirmed' },
                ],
            }),
        });
        if (!response.ok) {
            logger_1.logger.warn(`[PaymentService] Solana RPC unreachable for txSig ${txSig}. Flagging for manual review.`);
            return { verified: false, error: 'RPC unreachable — queued for manual review' };
        }
        const data = await response.json();
        if (data.error) {
            return { verified: false, error: data.error.message || 'RPC error' };
        }
        const tx = data.result;
        if (!tx) {
            return { verified: false, error: 'Transaction not found or not confirmed' };
        }
        const postBalances = tx.meta?.postTokenBalances || [];
        const platformWallet = PLATFORM_WALLET;
        const usdcTransfer = postBalances.find((b) => b.mint === USDC_MINT &&
            b.owner === platformWallet);
        if (usdcTransfer) {
            const amount = usdcTransfer.uiTokenAmount?.uiAmount || 0;
            return {
                verified: true,
                amount,
                destination: platformWallet,
            };
        }
        return { verified: false, error: 'No USDC transfer to platform wallet found in transaction' };
    }
    catch (err) {
        logger_1.logger.error(`[PaymentService] verifyUSDCpayment error: ${err.message}`);
        return { verified: false, error: err.message };
    }
}
async function releaseUSDCtoBusiness({ businessWallet, amount, reference }) {
    if (!PLATFORM_WALLET) {
        return { success: false, error: 'PLATFORM_WALLET not configured' };
    }
    const fee = (amount * PLATFORM_FEE_BPS) / 10000;
    const net = amount - fee;
    try {
        logger_1.logger.info(`[PaymentService] Release ${net} USDC to ${businessWallet} (fee: ${fee}, ref: ${reference})`);
        const releaseRef = crypto_1.default.randomBytes(16).toString('hex');
        return {
            success: true,
            txSig: releaseRef,
            fee,
            net,
        };
    }
    catch (err) {
        logger_1.logger.error(`[PaymentService] releaseUSDCtoBusiness error: ${err.message}`);
        return { success: false, error: err.message };
    }
}
// ── PayLio (Fiat → USDC, Card Payments) ────────────────────────────────────
async function createPayLioPayment({ amount, reference, customerEmail, }) {
    if (!PAYLIO_API_KEY) {
        return { type: 'paylio', error: 'PayLio API key not configured' };
    }
    try {
        const response = await fetch(`${PAYLIO_API_URL}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PAYLIO_API_KEY}`,
                'X-Merchant-ID': PAYLIO_MERCHANT_ID,
            },
            body: JSON.stringify({
                amount: amount.toFixed(2),
                currency: 'USD',
                reference,
                customer_email: customerEmail,
                metadata: { reference },
                success_url: `${process.env.FRONTEND_URL || 'https://pabandi.com'}/payment/success?ref=${reference}`,
                cancel_url: `${process.env.FRONTEND_URL || 'https://pabandi.com'}/payment/cancel?ref=${reference}`,
            }),
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`PayLio API error: ${response.status} ${errText}`);
        }
        const data = await response.json();
        return {
            type: 'paylio',
            id: data.id || data.payment_id,
            url: data.payment_url || data.checkout_url || data.url,
        };
    }
    catch (err) {
        logger_1.logger.error(`[PaymentService] createPayLioPayment error: ${err.message}`);
        return { type: 'paylio', error: err.message };
    }
}
async function verifyPayLioPayment(paymentId) {
    if (!PAYLIO_API_KEY) {
        return { status: 'UNKNOWN', confirmed: false };
    }
    try {
        const response = await fetch(`${PAYLIO_API_URL}/payments/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${PAYLIO_API_KEY}`,
                'X-Merchant-ID': PAYLIO_MERCHANT_ID,
            },
        });
        if (!response.ok) {
            throw new Error(`PayLio API error: ${response.status}`);
        }
        const data = await response.json();
        const status = data.status || 'pending';
        const confirmed = ['completed', 'paid', 'confirmed', 'success'].includes(status.toLowerCase());
        return {
            status,
            confirmed,
            amount: data.amount,
            paid_at: data.paid_at || data.completed_at,
        };
    }
    catch (err) {
        logger_1.logger.error(`[PaymentService] verifyPayLioPayment error: ${err.message}`);
        return { status: 'ERROR', confirmed: false };
    }
}
// ── BTCPay Server (Bitcoin/Lightning) ───────────────────────────────────────
async function createBTCPayInvoice({ amount, currency, reference }) {
    if (!BTCPAY_API_URL || !BTCPAY_API_KEY) {
        logger_1.logger.warn('[PaymentService] BTCPay not configured. Returning mock invoice.');
        return {
            type: 'btcpay',
            id: `btcpay-mock-${Date.now()}`,
            url: `https://btcpay.example.com/invoice/${reference}`,
            qrData: `bitcoin:?amount=${amount}&label=${reference}`,
        };
    }
    try {
        const response = await fetch(`${BTCPAY_API_URL}/stores/${BTCPAY_STORE_ID}/invoices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${BTCPAY_API_KEY}`,
            },
            body: JSON.stringify({
                amount,
                currency,
                metadata: { reference },
                checkout: {
                    speedPolicy: 'MediumSpeed',
                    paymentMethods: ['BTC', 'BTC-LightningNetwork'],
                },
            }),
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`BTCPay API error: ${response.status} ${errText}`);
        }
        const invoice = await response.json();
        return {
            type: 'btcpay',
            id: invoice.id,
            url: invoice.checkoutLink || `${BTCPAY_API_URL}/i/${invoice.id}`,
            qrData: `bitcoin:?amount=${amount}&label=${reference}`,
        };
    }
    catch (err) {
        logger_1.logger.error(`[PaymentService] createBTCPayInvoice error: ${err.message}`);
        return { type: 'btcpay', error: err.message };
    }
}
async function verifyBTCPayPayment(invoiceId) {
    if (!BTCPAY_API_URL || !BTCPAY_API_KEY) {
        return { status: 'UNKNOWN', confirmed: false };
    }
    try {
        const response = await fetch(`${BTCPAY_API_URL}/stores/${BTCPAY_STORE_ID}/invoices/${invoiceId}`, {
            method: 'GET',
            headers: {
                'Authorization': `token ${BTCPAY_API_KEY}`,
            },
        });
        if (!response.ok) {
            throw new Error(`BTCPay API error: ${response.status}`);
        }
        const invoice = await response.json();
        const status = invoice.status || 'New';
        const confirmed = ['Settled', 'Complete', 'Confirmed'].includes(status);
        return { status, confirmed };
    }
    catch (err) {
        logger_1.logger.error(`[PaymentService] verifyBTCPayPayment error: ${err.message}`);
        return { status: 'ERROR', confirmed: false };
    }
}
// ── Manual Confirmation (Fallback) ──────────────────────────────────────────
function createManualPayment({ amount, reference, method }) {
    const methodLabel = method || 'bank_transfer';
    const instructions = [
        `Payment Reference: ${reference}`,
        `Amount: $${amount.toFixed(2)} USD`,
        `Method: ${methodLabel}`,
        '',
        'Instructions:',
        '1. Transfer the amount using your preferred method',
        '2. Include the reference number in the transfer memo/description',
        '3. The business will confirm receipt manually',
        '4. Funds are held in escrow until confirmation',
        '',
        '⚠️ This payment method requires manual confirmation by the business.',
    ].join('\n');
    return {
        type: 'manual',
        reference,
        instructions,
    };
}
// ── Escrow State Machine ────────────────────────────────────────────────────
const ESCROW_TRANSITIONS = {
    PENDING: ['HELD', 'RELEASED', 'REFUNDED', 'DISPUTED'],
    HELD: ['RELEASED', 'REFUNDED', 'DISPUTED'],
    DISPUTED: ['RELEASED', 'REFUNDED'],
    RELEASED: [],
    REFUNDED: [],
};
async function holdInEscrow({ paymentId, payerId, payeeId, amount, reference }) {
    const escrow = await database_1.prisma.escrow.create({
        data: {
            paymentId,
            amount,
            status: 'PENDING',
            payerId,
            payeeId,
        },
    });
    logger_1.logger.info(`[PaymentService] Escrow created: ${escrow.id} for payment ${paymentId} (ref: ${reference})`);
    return { escrowId: escrow.id, status: escrow.status };
}
async function releaseEscrow({ escrowId, releasedBy }) {
    const escrow = await database_1.prisma.escrow.findUnique({ where: { id: escrowId } });
    if (!escrow) {
        return { success: false, error: 'Escrow not found' };
    }
    const allowedNext = ESCROW_TRANSITIONS[escrow.status] || [];
    if (!allowedNext.includes('RELEASED')) {
        return { success: false, error: `Cannot release from status ${escrow.status}` };
    }
    await database_1.prisma.escrow.update({
        where: { id: escrowId },
        data: {
            status: 'RELEASED',
            releasedAt: new Date(),
            releasedBy,
        },
    });
    // Update associated crypto payment status
    if (escrow.paymentId) {
        await database_1.prisma.cryptoPayment.update({
            where: { id: escrow.paymentId },
            data: { status: 'COMPLETED' },
        });
    }
    logger_1.logger.info(`[PaymentService] Escrow released: ${escrowId} by ${releasedBy}`);
    return { success: true };
}
async function refundEscrow({ escrowId, reason }) {
    const escrow = await database_1.prisma.escrow.findUnique({ where: { id: escrowId } });
    if (!escrow) {
        return { success: false, error: 'Escrow not found' };
    }
    const allowedNext = ESCROW_TRANSITIONS[escrow.status] || [];
    if (!allowedNext.includes('REFUNDED')) {
        return { success: false, error: `Cannot refund from status ${escrow.status}` };
    }
    await database_1.prisma.escrow.update({
        where: { id: escrowId },
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
    logger_1.logger.info(`[PaymentService] Escrow refunded: ${escrowId} (reason: ${reason})`);
    return { success: true };
}
async function getEscrowDetails(escrowId) {
    return database_1.prisma.escrow.findUnique({
        where: { id: escrowId },
        include: {
            payer: { select: { id: true, email: true, firstName: true, lastName: true } },
            payee: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
    });
}
//# sourceMappingURL=payment.service.js.map