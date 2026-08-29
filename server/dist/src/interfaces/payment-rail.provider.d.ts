export interface VerificationPayload {
    intentId: string;
    expectedAmountPkr: number;
    expectedDestination: string;
    screenshotBase64?: string;
    webhookData?: any;
}
export interface VerificationResult {
    isValid: boolean;
    confidence: number;
    providerTxnRef?: string;
    fields?: {
        transferAmount: number | null;
        recipientAccount: string | null;
        bankName: string | null;
        currency: string | null;
        transactionDate: string | null;
    };
    rawJson?: any;
}
export interface PaymentRailProvider {
    name: string;
    verifyPayment(payload: VerificationPayload): Promise<VerificationResult>;
}
//# sourceMappingURL=payment-rail.provider.d.ts.map