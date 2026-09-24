import { PTPAttestation } from '../protocol/ptp.spec';
export interface VerificationResult {
    verified: boolean;
    entityId: string;
    entityType: 'CUSTOMER' | 'BUSINESS';
    attestation: PTPAttestation;
    timestamp: number;
}
export declare class TrustApiAsService {
    /**
     * Verify an entity's trust status via the B2B API.
     * Checks subscription quota via BillingService, computes TrustFlux,
     * returns a real-time PTP verification verdict.
     */
    verifyEntity(apiKey: string, entityId: string, entityType: 'CUSTOMER' | 'BUSINESS'): Promise<VerificationResult | {
        error: string;
    }>;
}
export declare const trustApiAsService: TrustApiAsService;
//# sourceMappingURL=trustApiAsService.service.d.ts.map