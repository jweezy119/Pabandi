export interface USDCResult {
    type: 'solana';
    mint: string;
    amount: number;
    reference: string;
    qrData: string;
    deepLink: string;
}
export interface BTCPayResult {
    type: 'btcpay';
    id: string;
    url: string;
    qrData: string;
}
export interface ManualResult {
    type: 'manual';
    reference: string;
    instructions: string;
}
export declare function createUSDCpayment({ amount, reference, memo }: {
    amount: number;
    reference: string;
    memo?: string;
}): Promise<USDCResult>;
export declare function verifyUSDCpayment({ reference, txSig }: {
    reference: string;
    txSig: string;
}): Promise<{
    verified: boolean;
    amount?: number;
    destination?: string;
    error?: string;
}>;
export declare function releaseUSDCtoBusiness({ businessWallet, amount, reference }: {
    businessWallet: string;
    amount: number;
    reference: string;
}): Promise<{
    success: boolean;
    txSig?: string;
    fee?: number;
    net?: number;
    error?: string;
}>;
export declare function createPayLioPayment({ amount, reference, customerEmail, }: {
    amount: number;
    reference: string;
    customerEmail?: string;
}): Promise<{
    type: 'paylio';
    id?: string;
    url?: string;
    error?: string;
}>;
export declare function verifyPayLioPayment(paymentId: string): Promise<{
    status: string;
    confirmed: boolean;
    amount?: number;
    paid_at?: string;
}>;
export declare function createBTCPayInvoice({ amount, currency, reference }: {
    amount: number;
    currency: string;
    reference: string;
}): Promise<BTCPayResult | {
    type: 'btcpay';
    error: string;
}>;
export declare function verifyBTCPayPayment(invoiceId: string): Promise<{
    status: string;
    confirmed: boolean;
}>;
export declare function createManualPayment({ amount, reference, method }: {
    amount: number;
    reference: string;
    method?: string;
}): ManualResult;
export declare function holdInEscrow({ paymentId, payerId, payeeId, amount, reference }: {
    paymentId: string;
    payerId: string;
    payeeId: string;
    amount: number;
    reference: string;
}): Promise<{
    escrowId: string;
    status: string;
}>;
export declare function releaseEscrow({ escrowId, releasedBy }: {
    escrowId: string;
    releasedBy: string;
}): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function refundEscrow({ escrowId, reason }: {
    escrowId: string;
    reason?: string;
}): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function getEscrowDetails(escrowId: string): Promise<({
    payer: {
        email: string;
        id: string;
        firstName: string;
        lastName: string;
    };
    payee: {
        email: string;
        id: string;
        firstName: string;
        lastName: string;
    };
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: string;
    amount: number;
    releasedAt: Date | null;
    paymentId: string | null;
    releasedBy: string | null;
    refundReason: string | null;
    payerId: string;
    payeeId: string;
}) | null>;
//# sourceMappingURL=payment.service.d.ts.map