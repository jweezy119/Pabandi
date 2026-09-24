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
export declare const paymentRouter: {
    /**
     * Create a checkout URL routed to the right gateway.
     * @param amount       Deposit amount in the business's native currency units
     * @param currency     Business currency code e.g. "PKR" or "USD"
     * @param reservationId  Reservation ID for tracking
     */
    createCheckoutUrl(amount: number, currency: string, reservationId: string): Promise<{
        url: string;
        gateway: "safepay" | "paypal";
    }>;
    /**
     * Issue a refund through the correct gateway.
     * @param currency       Business currency (determines which gateway)
     * @param gatewayRef     Safepay: reservationId | PayPal: captureId
     * @param amount         Amount to refund in major currency units
     */
    refundDeposit(currency: string, gatewayRef: string, amount: number): Promise<boolean>;
    /**
     * Returns which gateway handles a given currency.
     */
    gatewayFor(currency: string): "safepay" | "paypal";
};
//# sourceMappingURL=payment.router.d.ts.map