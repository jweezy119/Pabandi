export interface PaymentProofFields {
    amount?: number;
    recipient?: string;
    bank?: string;
    currency?: string;
    date?: string;
}
export interface PaymentVerificationResult {
    isValid: boolean;
    confidence: number;
    fields: PaymentProofFields;
    raw?: string;
}
export declare class AiPaymentVerifierService {
    verify(imageBase64: string, expectedAmountPkr: number, expectedDestination: string): Promise<PaymentVerificationResult>;
    private evaluate;
    private localFallback;
}
export declare const aiPaymentVerifierService: AiPaymentVerifierService;
//# sourceMappingURL=ai.payment.verifier.service.d.ts.map