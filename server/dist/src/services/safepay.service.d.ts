export declare const safepayService: {
    /**
     * Initialize a new Safepay Checkout Session
     * @param amount Deposit amount in PKR
     * @param reservationId The underlying reservation ID to track
     */
    createCheckoutUrl(amount: number, reservationId: string): Promise<string>;
    /**
     * Initialize a new Safepay Checkout Session for API Subscriptions
     * @param amount Amount in PKR
     * @param referenceId Reference ID (e.g. api_sub_...)
     */
    createApiSubscriptionCheckoutUrl(amount: number, referenceId: string): Promise<string>;
    /**
     * Refund a previously captured deposit via Safepay
     */
    refundDeposit(reservationId: string, amount: number): Promise<boolean>;
    /**
     * Verify Webhook Signature to safely update Reservation Status
     */
    verifyWebhook(signature: string, rawBody: Buffer | string): boolean;
    getOrderStatus(reference: string): Promise<{
        found: boolean;
        remoteStatus?: string;
        transactionId?: string;
    }>;
};
//# sourceMappingURL=safepay.service.d.ts.map