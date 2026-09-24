export type PaylioCheckout = {
    id: string;
    url: string;
    status: string;
    amount: string;
    currency: string;
    ipnToken: string;
};
export type PaylioPaymentStatus = {
    id: string;
    status: 'unpaid' | 'paid' | 'canceled';
    forwardStatus?: string;
    forwardedAmount?: string;
    paidAt?: string;
    coin?: string;
};
export declare const paylioService: {
    /**
     * Create a PayLio hosted checkout for card-funded USDC settlement.
     * Docs: POST /api/v1/wallet
     */
    createCheckout({ address, amount, currency, callback, passFeeToCustomer, email, note, }: {
        address: string;
        amount: number;
        currency?: string;
        callback: string;
        passFeeToCustomer?: boolean;
        email?: string;
        note?: string;
    }): Promise<PaylioCheckout>;
    /**
     * Check payment status by ipn_token returned from createCheckout.
     * Docs: GET /api/v1/payment-status
     */
    getPaymentStatus(ipnToken: string): Promise<PaylioPaymentStatus>;
};
//# sourceMappingURL=paylio.service.d.ts.map