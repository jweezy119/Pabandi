export declare const stripeService: {
    /**
     * Create a Stripe Checkout Session and return its URL.
     * @param amountCents Amount in the smallest currency unit (cents for USD)
     * @param currency ISO 4217 currency code, e.g. "usd"
     * @param reservationId Used as metadata reference
     * @param successUrl Redirect URL after successful payment
     * @param cancelUrl  Redirect URL if user cancels
     * @param destinationAccountId Optional Stripe Connect account ID to route funds to
     */
    createCheckoutUrl(amountCents: number, currency: string, reservationId: string, successUrl?: string, cancelUrl?: string, destinationAccountId?: string): Promise<string>;
    /**
     * Refund a Stripe PaymentIntent.
     */
    refundDeposit(paymentIntentId: string, amountCents?: number): Promise<boolean>;
    /**
     * Verify a Stripe webhook signature.
     */
    verifyWebhook(signature: string, rawBody: Buffer | string): boolean;
    /**
     * Stripe Connect: Create an Express connected account.
     */
    createConnectAccount(businessId: string): Promise<string>;
    /**
     * Stripe Connect: Create an account link for onboarding.
     */
    createAccountLink(accountId: string): Promise<string>;
    /**
     * REAL off-ramp: push settled USDC to a Stripe Connect account as a transfer.
     * This is the actual payout rail (vs the simulated fallback). Requires
     * STRIPE_SECRET_KEY + a connected account id.
     */
    payoutToConnect(amountUsdc: number, connectAccountId: string): Promise<{
        id: string;
        status: string;
    }>;
};
//# sourceMappingURL=stripe.service.d.ts.map