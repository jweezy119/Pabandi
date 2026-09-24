export type EscrowCheckoutEnvironment = 'sandbox' | 'production';
export declare const ESCROW_API_BASE: string;
export declare const ESCROW_ENV: EscrowCheckoutEnvironment;
export type EscrowCreateTransactionResponse = {
    id?: number | string;
    url?: string;
    status?: string;
};
export declare const escrowService: {
    createTransaction({ amount, currency, buyerEmail, sellerEmail, description, itemTitle, reference, }: {
        amount: number;
        currency: string;
        buyerEmail: string;
        sellerEmail: string;
        description: string;
        itemTitle: string;
        reference: string;
    }): Promise<EscrowCreateTransactionResponse>;
};
//# sourceMappingURL=escrow.service.d.ts.map