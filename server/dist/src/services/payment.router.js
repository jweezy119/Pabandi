"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRouter = void 0;
const safepay_service_1 = require("./safepay.service");
const paypal_service_1 = require("./paypal.service");
const logger_1 = require("../utils/logger");
/**
 * Dual-market Payment Router
 *
 * Routes payment to the correct gateway based on the business currency:
 *   PKR → Safepay  (Local market)
 *   USD / other → PayPal  (USA / global market)
 *
 * This keeps both markets live simultaneously with zero code changes
 * in the reservation controller — just call paymentRouter.createCheckoutUrl().
 */
exports.paymentRouter = {
    /**
     * Create a checkout URL routed to the right gateway.
     * @param amount       Deposit amount in the business's native currency units
     * @param currency     Business currency code e.g. "PKR" or "USD"
     * @param reservationId  Reservation ID for tracking
     */
    async createCheckoutUrl(amount, currency, reservationId) {
        const curr = currency.toUpperCase();
        if (curr === 'PKR') {
            // Local market → Safepay (amount is already in PKR)
            logger_1.logger.info(`[PaymentRouter] Routing PKR ${amount} → Safepay (Local)`);
            const url = await safepay_service_1.safepayService.createCheckoutUrl(amount, reservationId);
            return { url, gateway: 'safepay' };
        }
        else {
            // USA / Global market → PayPal (convert amount to cents for consistency)
            // Amounts stored in DB are in major units (e.g. 10.00 USD), convert to cents
            const amountCents = Math.round(amount * 100);
            logger_1.logger.info(`[PaymentRouter] Routing ${curr} ${amount} → PayPal (USA/Global)`);
            const url = await paypal_service_1.paypalService.createCheckoutUrl(amountCents, curr, reservationId);
            return { url, gateway: 'paypal' };
        }
    },
    /**
     * Issue a refund through the correct gateway.
     * @param currency       Business currency (determines which gateway)
     * @param gatewayRef     Safepay: reservationId | PayPal: captureId
     * @param amount         Amount to refund in major currency units
     */
    async refundDeposit(currency, gatewayRef, amount) {
        const curr = currency.toUpperCase();
        if (curr === 'PKR') {
            return safepay_service_1.safepayService.refundDeposit(gatewayRef, amount);
        }
        else {
            const amountCents = Math.round(amount * 100);
            return paypal_service_1.paypalService.refundDeposit(gatewayRef, amountCents);
        }
    },
    /**
     * Returns which gateway handles a given currency.
     */
    gatewayFor(currency) {
        return currency.toUpperCase() === 'PKR' ? 'safepay' : 'paypal';
    },
};
//# sourceMappingURL=payment.router.js.map