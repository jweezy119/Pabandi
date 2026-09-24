export declare const paypalService: {
    /**
     * Create a PayPal Order (Checkout Session equivalent) and return the approval URL.
     * @param amount        Amount as a decimal string e.g. "9.99"
     * @param currency      ISO 4217 e.g. "USD"
     * @param reservationId Used as a custom reference
     * @param returnUrl     Where PayPal redirects on success
     * @param cancelUrl     Where PayPal redirects on cancel
     */
    createCheckoutUrl(amount: number, currency: string, reservationId: string, returnUrl?: string, cancelUrl?: string): Promise<string>;
    /**
     * Capture a PayPal order after the customer approves it.
     * Call this from your PayPal return URL handler.
     */
    captureOrder(orderId: string): Promise<boolean>;
    /**
     * Issue a full refund on a captured PayPal order.
     * @param captureId  The capture ID from the completed order
     * @param amountCents Amount to refund in cents (omit for full refund)
     */
    refundDeposit(captureId: string, amountCents?: number): Promise<boolean>;
    /**
     * Verify a PayPal IPN / Webhook event.
     * PayPal uses a verification call-back — check transmission-id header.
     */
    verifyWebhook(headers: Record<string, string>, rawBody: string, webhookId: string): Promise<boolean>;
};
//# sourceMappingURL=paypal.service.d.ts.map