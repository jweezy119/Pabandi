export type CashAppPaymentLink = {
    id: string;
    url: string;
    status: string;
    amount: number;
    currency: string;
};
export type CashAppOnrampQuote = {
    amount: number;
    currency: string;
    fee: number;
    total: number;
    cryptoAmount: number;
    cryptoCurrency: string;
    rate: number;
};
export type CashAppOfframpQuote = {
    cryptoAmount: number;
    cryptoCurrency: string;
    fiatAmount: number;
    fiatCurrency: string;
    fee: number;
    netAmount: number;
    rate: number;
};
export declare const cashAppService: {
    /**
     * Create a Cash App payment link for a checkout session.
     * Returns a deep link or hosted URL that redirects to Cash App.
     */
    createPaymentLink({ amount, currency, reference, note, }: {
        amount: number;
        currency?: string;
        reference: string;
        note?: string;
    }): Promise<CashAppPaymentLink>;
    /**
     * Get a Cash App on-ramp quote: fiat → USDC.
     * In production this would call a real on-ramp provider (MoonPay/Transak/Stripe Crypto).
     * Here we return a deterministic quote so the UI can show estimated crypto received.
     */
    getOnrampQuote({ fiatAmount, fiatCurrency, cryptoCurrency, }: {
        fiatAmount: number;
        fiatCurrency?: string;
        cryptoCurrency?: string;
    }): Promise<CashAppOnrampQuote>;
    /**
     * Get a Cash App off-ramp quote: USDC → fiat.
     */
    getOfframpQuote({ cryptoAmount, cryptoCurrency, fiatCurrency, }: {
        cryptoAmount: number;
        cryptoCurrency?: string;
        fiatCurrency?: string;
    }): Promise<CashAppOfframpQuote>;
    /**
     * Verify a Cash App payment webhook signature.
     */
    verifyWebhook(payload: string, signature: string): boolean;
};
//# sourceMappingURL=cashapp.service.d.ts.map