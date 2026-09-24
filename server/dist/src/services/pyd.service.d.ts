/**
 * Pabandi Yield Deposit (PYD) — non-custodial rental security deposit infrastructure.
 *
 * Design principle: Pabandi NEVER holds tenant funds. The Solana escrow contract
 * (see solana_escrow.service.ts) holds the deposit USDC. Pabandi is only:
 *   1. The TRUST layer  (PTP risk band → deposit reduction)
 *   2. The AGREEMENT layer (tenant + landlord sign a yield-pool opt-in)
 *   3. The SETTLEMENT orchestrator (tells the contract when to release)
 *
 * Liability posture: ZERO. Pabandi takes protocol fees at settlement, not by
 * custoding principal. The yield spread is taken from YIELD, never principal.
 */
import { PTPRiskBand } from '../protocol/ptp.spec';
import { RiskBand } from './geoRiskOracle.service';
export declare const YIELD_POOLS: {
    readonly JITO_STSOL: {
        readonly label: "Jito SOL (liquid staking)";
        readonly expectedApy: 7;
        readonly tenantApy: 5.5;
        readonly spreadPct: 1.5;
    };
    readonly ONDO_USDC: {
        readonly label: "Ondo USDC Money Market";
        readonly expectedApy: 4.5;
        readonly tenantApy: 3.5;
        readonly spreadPct: 1;
    };
    readonly MAPLE: {
        readonly label: "Maple Institutional USDC";
        readonly expectedApy: 6;
        readonly tenantApy: 4.5;
        readonly spreadPct: 1.5;
    };
};
export type YieldPoolKey = keyof typeof YIELD_POOLS;
export interface CreateDepositInput {
    tenantId: string;
    landlordId: string;
    depositContext?: 'PROPERTY' | 'CAR' | 'BUILDER' | 'FLEET' | 'HOA';
    assetDescription: string;
    requiredAmountUSD: number;
    yieldOptIn?: boolean;
    communityPoolOptIn?: boolean;
    pool?: YieldPoolKey;
    beneficiaryBackgroundCheckId?: string;
    /** Optional intrinsic property risk (from GeoRiskOracle). Riskier asset trims the tenant discount. */
    geoRiskBand?: RiskBand;
    /** Optional pre-supplied tenant trust score (skips the DB user lookup — used by sims/tests). */
    tenantTrustScore?: number;
}
/**
 * PURE deposit-pricing math (no DB, no side effects).
 * Applies the tenant's PTP risk-band reduction + optional background-check reduction,
 * then the dual-risk property-trim, and returns the final deposit terms.
 * Reused by createDeposit AND by the Hyper-Pilot simulation (which can't afford 2500 DB writes).
 */
export declare function computeDepositTerms(input: {
    requiredAmountUSD: number;
    tenantTrustScore: number;
    geoRiskBand?: RiskBand;
    beneficiaryBackgroundCheckPass?: boolean;
}): {
    riskBand: PTPRiskBand;
    depositReductionPct: number;
    bcReductionPct: number;
    propertyRiskTrim: number;
    finalReduction: number;
    actualDepositUSD: number;
};
export declare class PydService {
    /**
     * Create a security deposit. Applies the tenant's PTP risk-band deposit reduction.
     * Does NOT move money — just records the non-custodial agreement.
     */
    createDeposit(input: CreateDepositInput): Promise<any>;
    /**
     * Propose a yield-pool agreement. Tenant + landlord must BOTH sign before it's ACTIVE.
     * Pabandi never touches principal — spread is taken from yield only.
     */
    proposeYieldAgreement(depositId: string, tenantId: string, landlordId: string, pool?: YieldPoolKey): Promise<any>;
    /** Tenant signs the yield agreement. */
    signAsTenant(agreementId: string, tenantId: string): Promise<any>;
    /** Landlord signs the yield agreement. */
    signAsLandlord(agreementId: string, landlordId: string): Promise<any>;
    /**
     * Fund the deposit into the non-custodial Solana escrow contract.
     * In production this calls solana_escrow.service to initialize the PDA.
     * Simulated here (no treasury SOL required) — sets the PDA + tx hash.
     */
    fundEscrow(depositId: string, tenantWallet: string): Promise<any>;
    /** Projected yield for a deposit (used by the dashboard). */
    projectYield(depositId: string, months: number): Promise<any>;
    /** Get a deposit with its yield agreement. */
    getDeposit(depositId: string): Promise<any>;
    /**
     * DUAL-RISK RENT PRICING (Geospatial Risk Oracle)
     * Given a base rent, a property's intrinsic risk band, and the tenant's PTP trust band,
     * compute the dynamically adjusted monthly rent. Property risk adds a premium; tenant
     * trust gives a discount. Pure function over geoRiskOracle — no side effects.
     */
    priceRent(baseRentUSD: number, geoRiskBand: RiskBand, tenantTrustBand: RiskBand): import("./geoRiskOracle.service").DualRiskPricingResult;
    /**
     * Process a tokenized rent payment.
     * Instead of a sunk cost, rent is held in a yield-bearing RWA (e.g., Ondo USDY)
     * for a short duration (e.g., paid on the 1st, settles on the 5th).
     * The generated yield is split 50/50 using O(1) distribution logic.
     */
    processTokenizedRent(tenantId: string, landlordId: string, rentAmountUSD: number, holdingDays: number): Promise<any>;
}
export declare const pydService: PydService;
//# sourceMappingURL=pyd.service.d.ts.map