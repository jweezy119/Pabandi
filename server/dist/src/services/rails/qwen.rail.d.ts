import { PaymentRailProvider, VerificationPayload, VerificationResult } from '../../interfaces/payment-rail.provider';
export declare class QwenScreenshotRail implements PaymentRailProvider {
    name: string;
    verifyPayment(payload: VerificationPayload): Promise<VerificationResult>;
}
export declare const qwenScreenshotRail: QwenScreenshotRail;
//# sourceMappingURL=qwen.rail.d.ts.map