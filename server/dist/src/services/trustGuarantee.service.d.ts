import { PTPRiskBand } from '../protocol/ptp.spec';
/**
 * TrustGuaranteeService — Financial Guarantees Backed by Trust Scores
 * ────────────────────────────────────────────────────────────────────────────
 * The highest-revenue-ceiling product in PTP.
 *
 * When a merchant uses PTP to verify a buyer, and the buyer has Band A/B trust,
 * Pabandi offers a FINANCIAL GUARANTEE — if the buyer commits fraud or no-shows,
 * Pabandi covers the merchant's loss up to the guaranteed amount.
 *
 * Why this works:
 *   - Band A has <0.5% fraud probability → expected loss on $500 guarantee = $2.50
 *   - We charge 0.5% fee → $2.50 per guarantee
 *   - Net expected profit per guarantee = ~$0 at Band A (break-even = trust)
 *   - But at scale with blended Band A/B: expected profit margin is ~40-60%
 *   - This is literally how insurance works, but backed by real intelligence
 *
 * Revenue example:
 *   10,000 guaranteed transactions/month × $50 avg × 1% avg fee = $5,000/month
 *   Expected payout: ~$250-500/month (Band A/B fraud rate)
 *   Net margin: ~$4,500/month
 *
 * This makes PTP economically rational for merchants — they save more on fraud
 * losses than they pay for PTP guarantees.
 */
export interface GuaranteePolicy {
    id: string;
    merchantId: string;
    buyerId: string;
    buyerRiskBand: PTPRiskBand;
    transactionAmountUSD: number;
    guaranteedAmountUSD: number;
    feeUSD: number;
    feePercent: number;
    status: 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'PAID_OUT' | 'DENIED';
    coverageType: 'FRAUD' | 'NO_SHOW' | 'BOTH';
    createdAt: number;
    expiresAt: number;
    transactionId?: string;
    claimId?: string;
}
export interface GuaranteeClaim {
    id: string;
    policyId: string;
    merchantId: string;
    claimType: 'FRAUD' | 'NO_SHOW';
    claimAmountUSD: number;
    evidence: string;
    status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED' | 'PAID_OUT';
    submittedAt: number;
    resolvedAt?: number;
    payoutAmountUSD?: number;
    denialReason?: string;
}
export declare class TrustGuaranteeService {
    /**
     * Purchase a transaction guarantee.
     * Only available for Band A and Band B buyers.
     */
    purchaseGuarantee(merchantId: string, buyerId: string, transactionAmountUSD: number, buyerTrustScore: number): Promise<GuaranteePolicy | {
        error: string;
    }>;
    /**
     * File a guarantee claim when a guaranteed transaction goes wrong.
     */
    fileClaim(policyId: string, merchantId: string, claimType: 'FRAUD' | 'NO_SHOW', claimAmountUSD: number, evidence: string): Promise<GuaranteeClaim | {
        error: string;
    }>;
    /**
     * Adjudicate a claim (admin action).
     */
    adjudicateClaim(claimId: string, decision: 'APPROVE' | 'DENY', payoutAmount?: number, denialReason?: string): Promise<GuaranteeClaim | {
        error: string;
    }>;
    /**
     * Get platform-wide guarantee risk pool stats.
     */
    getRiskPoolStats(): {
        totalGuaranteedUSD: number;
        totalFeesCollectedUSD: number;
        totalPayoutsUSD: number;
        netRevenueUSD: number;
        lossRatio: number;
        activePolicies: number;
        pendingClaims: number;
    };
    /**
     * Get guarantee eligibility and pricing for a specific buyer.
     */
    getEligibility(buyerTrustScore: number, transactionAmountUSD: number): {
        eligible: boolean;
        riskBand: PTPRiskBand;
        guaranteedAmountUSD: number;
        feeUSD: number;
        feePercent: number;
        coverageDescription: string;
    };
}
export declare const trustGuaranteeService: TrustGuaranteeService;
//# sourceMappingURL=trustGuarantee.service.d.ts.map