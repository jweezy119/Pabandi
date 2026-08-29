"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const logger_1 = require("../utils/logger");
const getStripeKey = () => process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
const stripe = new stripe_1.default(getStripeKey(), {
    apiVersion: '2026-06-24.dahlia',
});
exports.stripeService = {
    /**
     * Create a Stripe Checkout Session and return its URL.
     * @param amountCents Amount in the smallest currency unit (cents for USD)
     * @param currency ISO 4217 currency code, e.g. "usd"
     * @param reservationId Used as metadata reference
     * @param successUrl Redirect URL after successful payment
     * @param cancelUrl  Redirect URL if user cancels
     * @param destinationAccountId Optional Stripe Connect account ID to route funds to
     */
    async createCheckoutUrl(amountCents, currency, reservationId, successUrl, cancelUrl, destinationAccountId) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const success = successUrl || `${frontendUrl}/reservations?stripe_success=true&ref=${reservationId}`;
        const cancel = cancelUrl || `${frontendUrl}/reservations?stripe_cancel=true&ref=${reservationId}`;
        if (!process.env.STRIPE_SECRET_KEY) {
            logger_1.logger.warn('STRIPE_SECRET_KEY not set');
            return `${frontendUrl}/reservations?stripe_disabled=true&ref=${reservationId}`;
        }
        try {
            const sessionParams = {
                payment_method_types: ['card'],
                mode: 'payment',
                success_url: success,
                cancel_url: cancel,
                line_items: [
                    {
                        price_data: {
                            currency: currency.toLowerCase(),
                            product_data: {
                                name: 'Reservation Deposit',
                                description: `Deposit for reservation #${reservationId}`,
                            },
                            unit_amount: amountCents,
                        },
                        quantity: 1,
                    },
                ],
                metadata: {
                    reservation_id: reservationId,
                },
            };
            // If a destination account is provided, route the funds via PaymentIntent parameters
            if (destinationAccountId) {
                // Platform takes a 1.5% facilitation fee
                const applicationFeeAmount = Math.floor(amountCents * 0.015);
                sessionParams.payment_intent_data = {
                    application_fee_amount: applicationFeeAmount,
                    transfer_data: {
                        destination: destinationAccountId,
                    },
                };
            }
            const session = await stripe.checkout.sessions.create(sessionParams);
            if (!session.url) {
                throw new Error('Stripe checkout session creation failed - no URL returned');
            }
            logger_1.logger.info(`Stripe checkout session created for reservation: ${reservationId}`);
            return session.url;
        }
        catch (error) {
            logger_1.logger.error('Stripe checkout session creation failed', error.message);
            return `${frontendUrl}/reservations?stripe_disabled=true&ref=${reservationId}`;
        }
    },
    /**
     * Refund a Stripe PaymentIntent.
     */
    async refundDeposit(paymentIntentId, amountCents) {
        if (!process.env.STRIPE_SECRET_KEY) {
            logger_1.logger.warn('STRIPE_SECRET_KEY not set — skipping Stripe refund');
            return true;
        }
        try {
            const refundParams = {
                payment_intent: paymentIntentId,
            };
            if (amountCents)
                refundParams.amount = amountCents;
            await stripe.refunds.create(refundParams);
            logger_1.logger.info(`Stripe refund issued for PaymentIntent: ${paymentIntentId}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Stripe refund failed', error.message);
            return false;
        }
    },
    /**
     * Verify a Stripe webhook signature.
     */
    verifyWebhook(signature, rawBody) {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret || !signature) {
            logger_1.logger.warn('Stripe webhook verification skipped: missing secret or signature');
            return process.env.NODE_ENV !== 'production';
        }
        try {
            stripe.webhooks.constructEvent(rawBody, signature, secret);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Stripe webhook signature verification failed', error);
            return false;
        }
    },
    /**
     * Stripe Connect: Create an Express connected account.
     */
    async createConnectAccount(businessId) {
        const account = await stripe.accounts.create({
            type: 'express',
            metadata: {
                businessId,
            },
        });
        return account.id;
    },
    /**
     * Stripe Connect: Create an account link for onboarding.
     */
    async createAccountLink(accountId) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${frontendUrl}/settings?stripe_refresh=true`,
            return_url: `${frontendUrl}/settings?stripe_return=true`,
            type: 'account_onboarding',
        });
        return accountLink.url;
    },
    /**
     * REAL off-ramp: push settled USDC to a Stripe Connect account as a transfer.
     * This is the actual payout rail (vs the simulated fallback). Requires
     * STRIPE_SECRET_KEY + a connected account id.
     */
    async payoutToConnect(amountUsdc, connectAccountId) {
        if (!process.env.STRIPE_SECRET_KEY)
            throw new Error('Stripe not configured');
        const transfer = await stripe.transfers.create({
            amount: Math.round(amountUsdc * 100), // cents
            currency: 'usd',
            destination: connectAccountId,
            transfer_group: `pabandi-payout-${Date.now()}`,
        });
        return { id: transfer.id, status: 'paid' };
    },
};
//# sourceMappingURL=stripe.service.js.map