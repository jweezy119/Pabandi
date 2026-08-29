export interface ClaimInput {
    bondId: string;
    claimerId: string;
    claimAmountUSD: number;
    claimType: 'FRAUD' | 'NO_SHOW' | 'NON_DELIVERY' | 'DEFECT';
    evidence: string;
    reason?: string;
}
export interface ClaimResult {
    claimId: string;
    bondId: string;
    claimerId: string;
    claimAmountUSD: number;
    claimType: string;
    coverageUSD: number;
    status: 'RECORDED' | 'SIMULATED';
    simulated: boolean;
    attestation: any;
    escrowedAt: string;
    escrowTxHash: string;
    auditTrailId: string;
    coverageRemainingUSD: number;
}
export declare const guaranteeClaimService: {
    recordClaim(input: ClaimInput): Promise<ClaimResult>;
};
//# sourceMappingURL=guaranteeClaim.service.d.ts.map