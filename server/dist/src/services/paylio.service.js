"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paylioService = void 0;
const logger_1 = require("../utils/logger");
const PAYLIO_API_BASE = 'https://paylio.org/api/v1';
exports.paylioService = {
    /**
     * Create a PayLio hosted checkout for card-funded USDC settlement.
     * Docs: POST /api/v1/wallet
     */
    async createCheckout({ address, amount, currency = 'USD', callback, passFeeToCustomer = true, email, note, }) {
        const apiKey = process.env.PAYLIO_API_KEY;
        if (!apiKey) {
            throw new Error('Missing PAYLIO_API_KEY');
        }
        const body = {
            address,
            amount: String(amount),
            currency,
            callback,
            passFeeToCustomer,
        };
        if (email)
            body.email = email;
        if (note)
            body.note = note;
        const res = await fetch(`${PAYLIO_API_BASE}/wallet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text();
            logger_1.logger.error('[PayLio] createCheckout failed: %s %s', res.status, text);
            throw new Error(`PayLio checkout failed: ${res.status}`);
        }
        const data = (await res.json());
        return {
            id: String(data.id || data.payment_id || ''),
            url: String(data.checkout_url || data.url || ''),
            status: String(data.status || 'unpaid'),
            amount: String(data.amount || amount),
            currency: String(data.currency || currency),
            ipnToken: String(data.ipn_token || data.id || ''),
        };
    },
    /**
     * Check payment status by ipn_token returned from createCheckout.
     * Docs: GET /api/v1/payment-status
     */
    async getPaymentStatus(ipnToken) {
        const apiKey = process.env.PAYLIO_API_KEY;
        if (!apiKey) {
            throw new Error('Missing PAYLIO_API_KEY');
        }
        const res = await fetch(`${PAYLIO_API_BASE}/payment-status?ipn_token=${encodeURIComponent(ipnToken)}`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });
        if (!res.ok) {
            const text = await res.text();
            logger_1.logger.error('[PayLio] getPaymentStatus failed: %s %s', res.status, text);
            throw new Error(`PayLio status check failed: ${res.status}`);
        }
        const data = (await res.json());
        const normalizedStatus = ['paid', 'canceled', 'unpaid'].includes(String(data.status || '').toLowerCase())
            ? String(data.status).toLowerCase()
            : 'unpaid';
        return {
            id: String(data.id || ipnToken),
            status: normalizedStatus,
            forwardStatus: data.forward_status ? String(data.forward_status) : undefined,
            forwardedAmount: data.forwarded_amount ? String(data.forwarded_amount) : undefined,
            paidAt: data.paid_at ? String(data.paid_at) : undefined,
            coin: data.coin ? String(data.coin) : undefined,
        };
    },
};
//# sourceMappingURL=paylio.service.js.map