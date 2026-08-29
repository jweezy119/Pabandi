"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escrowService = exports.ESCROW_ENV = exports.ESCROW_API_BASE = void 0;
const logger_1 = require("../utils/logger");
exports.ESCROW_API_BASE = process.env.ESCROW_API_BASE || 'https://api.escrow.com';
exports.ESCROW_ENV = process.env.NODE_ENV === 'production'
    ? 'production'
    : 'sandbox';
const ESCROW_API_EMAIL = process.env.ESCROW_API_EMAIL || '';
const ESCROW_API_KEY = process.env.ESCROW_API_KEY || '';
exports.escrowService = {
    async createTransaction({ amount, currency, buyerEmail, sellerEmail, description, itemTitle, reference, }) {
        if (!ESCROW_API_EMAIL || !ESCROW_API_KEY) {
            return { status: 'disabled' };
        }
        try {
            const baseUrl = `${exports.ESCROW_API_BASE}/2017-09-01/transaction${exports.ESCROW_ENV === 'sandbox' ? '-sandbox' : ''}`;
            const payload = {
                parties: [
                    { role: 'buyer', customer: buyerEmail },
                    { role: 'seller', customer: sellerEmail },
                ],
                currency,
                description,
                items: [
                    {
                        title: itemTitle,
                        description,
                        type: 'general_merchandise',
                        quantity: 1,
                        schedule: [
                            {
                                amount,
                                payer_customer: buyerEmail,
                                beneficiary_customer: sellerEmail,
                            },
                        ],
                    },
                ],
                metadata: {
                    pabandiReference: reference,
                },
            };
            logger_1.logger.info('[Escrow] Creating transaction reference=%s amount=%s', reference, amount);
            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = (await response.json());
            const id = Number(data?.id) || data?.id;
            const url = data?.url || `${exports.ESCROW_API_BASE}/transaction/${id}`;
            return {
                id,
                url,
                status: response.ok ? 'awaiting_payment' : 'error',
            };
        }
        catch (error) {
            logger_1.logger.error('[Escrow] createTransaction failed: %s', error?.message || error);
            return { status: 'error' };
        }
    },
};
//# sourceMappingURL=escrow.service.js.map