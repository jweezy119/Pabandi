/**
 * ppd.service.ts — Pabandi Protected Deposit (deepened rail)
 *
 * Builds on PydService (trust-band deposit + yield) and adds:
 *   A) MilestoneDraw — phased, conditional release for construction/fleet
 *      (draws gated by lien waivers, BC refresh, payer sign-off; 10% retention)
 *   B) PerformanceBond — Pabond-underwritten bond that replaces/backs a deposit,
 *      priced from the beneficiary's TrustFlux velocity (lower premium = rising trust)
 *   C) CommunityPool — HOA yield redirected to community amenities/reserves,
 *      with transparent grants governed by the community
 *
 * Liability posture unchanged: Pabandi never holds principal. Bonds are
 * underwritten from the Pabond reserve + protocol fees; spread taken from yield.
 */
export interface MilestoneInput {
    name: string;
    description?: string;
    sequence?: number;
    amountUSD: number;
    requiresLienWaiver?: boolean;
    requiresBcRefresh?: boolean;
    requiresSignoff?: boolean;
}
export interface CreateMilestoneProjectInput {
    tenantId: string;
    landlordId: string;
    depositContext: 'BUILDER' | 'FLEET' | 'HOA';
    assetDescription: string;
    requiredAmountUSD: number;
    yieldOptIn?: boolean;
    communityPoolOptIn?: boolean;
    pool?: 'JITO_STSOL' | 'ONDO_USDC' | 'MAPLE';
    beneficiaryBackgroundCheckId?: string;
    milestones: MilestoneInput[];
    retentionPct?: number;
}
export declare class PpdService {
    /**
     * Create a milestone-gated project escrow.
     * Splits requiredAmountUSD across milestones + a retention draw.
     */
    createMilestoneProject(input: CreateMilestoneProjectInput): Promise<any>;
    /**
     * Release a milestone. Gates on lien waiver / BC refresh / sign-off.
     * Simulated escrow release (swap to solana_escrow in prod).
     */
    releaseMilestone(milestoneId: string, opts?: {
        lienWaiverUrl?: string;
        signedBy?: string;
        bcCheckId?: string;
    }): Promise<any>;
    /**
     * Underwrite a performance bond for a builder/fleet/HOA vendor.
     * Premium priced from Pabond TrustFlux velocity: rising trust → cheaper bond.
     * This lets the vendor avoid tying up deposit capital entirely.
     */
    underwriteBond(input: {
        depositId: string;
        beneficiaryId: string;
        payerId: string;
        depositContext: 'BUILDER' | 'FLEET' | 'HOA';
        coverageUSD: number;
    }): Promise<any>;
    claimBond(bondId: string, reason: string): Promise<any>;
    createCommunityPool(communityName: string, treasuryWallet?: string): Promise<any>;
    /**
     * Route a deposit's yield to a community pool. Called when an HOA deposit
     * opts into communityPoolOptIn. Tracks cumulative deposits.
     */
    routeDepositToPool(poolId: string, depositId: string): Promise<any>;
    proposeCommunityGrant(poolId: string, title: string, amountUSD: number, description?: string): Promise<any>;
    approveCommunityGrant(grantId: string, approvedBy: string): Promise<any>;
    /** Public transparency payload for an HOA dashboard. */
    getCommunityDashboard(poolId: string): Promise<any>;
    /**
     * Generates a Zero-Knowledge Proof (simulated) of on-time rent payment.
     * Proves "Tenant has X consecutive on-time payments" without revealing rent amount,
     * landlord identity, or property address.
     */
    generateProofOfRent(tenantId: string, depositId: string, consecutiveMonths: number): Promise<any>;
}
export declare const ppdService: PpdService;
//# sourceMappingURL=ppd.service.d.ts.map