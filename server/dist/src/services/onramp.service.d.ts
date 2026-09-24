export type OnrampProvider = 'MOONPAY' | 'TRANSAK' | 'STRIPE_CRYPTO' | 'CASHAPP';
export type OnrampQuote = {
    provider: OnrampProvider;
    fiatAmount: number;
    fiatCurrency: string;
    cryptoAmount: number;
    cryptoCurrency: string;
    fee: number;
    rate: number;
    estimatedMinutes: number;
};
export type OnrampSession = {
    id: string;
    provider: OnrampProvider;
    url: string;
    status: string;
    fiatAmount: number;
    fiatCurrency: string;
    cryptoAmount: number;
    cryptoCurrency: string;
    expiresAt: string;
};
export declare const onrampService: {
    /**
     * Get quotes from all configured on-ramp providers.
     */
    getQuotes({ fiatAmount, fiatCurrency, cryptoCurrency, }: {
        fiatAmount: number;
        fiatCurrency?: string;
        cryptoCurrency?: string;
    }): Promise<OnrampQuote[]>;
    /**
     * Create an on-ramp session for a specific provider.
     */
    createSession({ provider, fiatAmount, fiatCurrency, cryptoCurrency, walletAddress, reference, }: {
        provider: OnrampProvider;
        fiatAmount: number;
        fiatCurrency?: string;
        cryptoCurrency?: string;
        walletAddress: string;
        reference: string;
    }): Promise<OnrampSession>;
};
//# sourceMappingURL=onramp.service.d.ts.map