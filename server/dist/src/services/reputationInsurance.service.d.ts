export interface InsurancePolicy {
    policyId: string;
    providerId: string;
    customerId: string;
    reservationId: string;
    coverageAmount: number;
    premiumUSD: number;
    premiumPAB?: number;
    riskMultiplier: number;
    coverageType: 'NO_SHOW' | 'CANCELLATION' | 'SERVICE_FAILURE';
    expiresAt: number;
    isActive: boolean;
    payoutTxHash?: string;
}
export interface UnderwritingResult {
    approved: boolean;
    premiumUSD: number;
    premiumPAB: number;
    riskMultiplier: number;
    riskBand: 'SAFE' | 'MODERATE' | 'RISKY';
    reason: string;
    coverageAmount: number;
}
export declare class ReputationInsuranceService {
    private activePolicies;
    private totalPremiums;
    private totalPayouts;
    private totalClaims;
    /**
     * Underwrite a new insurance policy for a booking.
     * Uses TrustFlux to assess the provider's risk profile.
     */
    underwrite(providerId: string, customerId: string, reservationId: string, coverageAmount: number, coverageType: 'NO_SHOW' | 'CANCELLATION' | 'SERVICE_FAILURE'): Promise<UnderwritingResult>;
    /**
     * Process a claim when a no-show or service failure occurs.
     * Verifies the claim against TrustFlux prediction and payouts if valid.
     */
    processClaim(policyId: string, evidence: string, reason: string): Promise<{
        approved: boolean;
        payoutAmount?: number;
        message: string;
    }>;
    /** Get actuarial stats */
    getStats(): {
        totalPremiums: number;
        totalPayouts: number;
        totalClaims: number;
        lossRatio: number;
        profitMargin: number;
        activePolicies: number;
    };
}
export declare const reputationInsuranceService: ReputationInsuranceService;
//# sourceMappingURL=reputationInsurance.service.d.ts.map