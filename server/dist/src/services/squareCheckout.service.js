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
Object.defineProperty(exports, "__esModule", { value: true });
exports.squareService = exports.SquareService = void 0;
const square_1 = require("square");
const accessToken = process.env.SQUARE_ACCESS_TOKEN || '';
const squareClient = new square_1.SquareClient({
    token: accessToken,
    environment: square_1.SquareEnvironment.Production,
});
const SQUARE_BASE = 'https://connect.squareup.com';
const SQUARE_VERSION = '2026-09-16';
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID || '';
function authHeaders() {
    return {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Square-Version': SQUARE_VERSION,
    };
}
class SquareService {
    /**
     * Create a Square Checkout (hosted payment page)
     * Customer is redirected to Square's hosted page
     */
    async createCheckout(params) {
        const cents = Math.round(params.amount);
        if (!Number.isFinite(cents) || cents <= 0)
            throw new Error('Invalid amount');
        let locationId = SQUARE_LOCATION_ID;
        if (!locationId) {
            const loc = await this.getDefaultLocation();
            if (!loc)
                throw new Error('No Square location found. Set SQUARE_LOCATION_ID.');
            locationId = loc;
        }
        const resp = await fetch(SQUARE_BASE + '/v2/online-checkout/payment-links', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                idempotency_key: params.referenceId,
                order: {
                    location_id: locationId,
                    line_items: [
                        {
                            name: 'Pabandi Booking #' + params.referenceId.slice(-8),
                            quantity: '1',
                            base_price_money: { amount: cents, currency: params.currency },
                        },
                    ],
                    metadata: { pabandiRef: params.referenceId },
                },
                checkout_options: {
                    redirect_url: params.redirectUrl,
                    ask_for_shipping_address: false,
                },
                pre_populated_data: params.customerEmail
                    ? { buyer_email: params.customerEmail }
                    : undefined,
                payment_note: params.note || 'Pabandi booking deposit',
            }),
        });
        const data = await resp.json();
        if (!resp.ok || !data?.payment_link?.url) {
            throw new Error(data?.errors?.[0]?.detail || 'Square checkout creation failed');
        }
        return {
            id: data.payment_link.id,
            url: data.payment_link.url,
            orderId: data.payment_link.order_id,
            referenceId: params.referenceId,
        };
    }
    async getDefaultLocation() {
        try {
            const resp = await fetch(SQUARE_BASE + '/v2/locations', {
                headers: authHeaders(),
            });
            const data = await resp.json();
            if (!resp.ok || !data?.locations?.length)
                return null;
            const active = data.locations.find((l) => l.status === 'ACTIVE');
            return (active || data.locations[0])?.id || null;
        }
        catch {
            return null;
        }
    }
    /**
     * Get payment details from Square
     */
    async getPayment(paymentId) {
        const response = await squareClient.payments.get({ paymentId });
        if (response.payment) {
            return response.payment;
        }
        throw new Error('Payment not found');
    }
    /**
     * Verify a Square webhook signature
     */
    async verifyWebhook(body, signature, url) {
        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
        const webhookSecret = process.env.SQUARE_WEBHOOK_SECRET || '';
        if (!webhookSecret)
            return true;
        const expected = crypto
            .createHmac('sha256', webhookSecret)
            .update(url + body)
            .digest('base64');
        return expected === signature;
    }
    /**
     * Process Square webhook event
     */
    async processWebhook(event) {
        const eventType = event.type;
        const data = event.data?.object;
        switch (eventType) {
            case 'payment.completed':
            case 'payment.updated':
                return {
                    type: 'PAYMENT_UPDATED',
                    paymentId: data?.payment?.id,
                    status: data?.payment?.status,
                };
            case 'refund.created':
                return {
                    type: 'REFUND_CREATED',
                    paymentId: data?.refund?.paymentId,
                    amount: data?.refund?.amountMoney,
                };
            default:
                return { type: 'UNKNOWN', eventType };
        }
    }
    /**
     * Create a refund for a payment
     */
    async createRefund(paymentId, amountCents, reason) {
        const response = await squareClient.refunds.refundPayment({
            idempotencyKey: 'refund-' + paymentId + '-' + Date.now(),
            paymentId,
            amountMoney: {
                amount: BigInt(amountCents),
                currency: 'USD',
            },
            reason,
        });
        return response.refund;
    }
}
exports.SquareService = SquareService;
exports.squareService = new SquareService();
//# sourceMappingURL=squareCheckout.service.js.map