import { PTPAttestation, PTPVerificationResult } from '../protocol/ptp.spec';
export declare class TrustAttestationService {
    /**
     * Issue a signed cryptographic attestation for a user using the PTP protocol.
     */
    issue(userId: string): Promise<PTPAttestation>;
    /**
     * Verify an attestation from a 3rd party.
     * Defers to PTP Engine.
     */
    verify(attestation: PTPAttestation): PTPVerificationResult;
}
export declare const trustAttestationService: TrustAttestationService;
//# sourceMappingURL=trustAttestation.service.d.ts.map