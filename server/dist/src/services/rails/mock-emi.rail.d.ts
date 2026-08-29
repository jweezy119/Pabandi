import { PaymentRailProvider, VerificationPayload, VerificationResult } from '../../interfaces/payment-rail.provider';
export declare class MockEmiRail implements PaymentRailProvider {
    name: string;
    verifyPayment(payload: VerificationPayload): Promise<VerificationResult>;
}
export declare const mockEmiRail: MockEmiRail;
//# sourceMappingURL=mock-emi.rail.d.ts.map