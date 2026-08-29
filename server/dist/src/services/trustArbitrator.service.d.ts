export type DisputeStatus = 'OPEN' | 'RESOLVED_AUTOMATED' | 'ESCALATED_HUMAN' | 'RESOLVED_HUMAN';
export type Ruling = 'BUYER_WINS' | 'SELLER_WINS' | 'REFUND_HALF' | 'NEEDS_MORE_INFO';
export type ArbitratorRole = 'customer' | 'business';
export interface DisputeEvidence {
    disputeId: string;
    claimAmount: number;
    currency: string;
    customerId?: string;
    businessId?: string;
    customerName?: string;
    businessName?: string;
    customerTrustScore?: number;
    businessTrustScore?: number;
    customerStakedPab?: number;
    businessStakedPab?: number;
    messages: {
        role: ArbitratorRole;
        text: string;
        timestamp: string;
    }[];
    evidenceImages: string[];
    bookingDetails: {
        reservationId: string;
        reservationDate: string;
        amount: number;
        status: string;
        paymentMethod: string;
    };
    initialClaim: string;
}
export interface ArbitrationResult {
    ruling: Ruling;
    confidence: number;
    reasoning: string;
    factors: Record<string, number>;
    pabReward?: {
        recipient: string;
        amount: number;
    };
    pabSlash?: {
        target: string;
        amount: number;
        reason: string;
    };
    needsHumanReview: boolean;
    estimatedResolutionTime: string;
}
export declare class TrustArbitratorService {
    /**
     * Arbitrate a dispute using AI (Qwen) + contextual rules
     */
    arbitrate(evidence: DisputeEvidence): Promise<ArbitrationResult>;
    /**
     * Fast-path rule overrides (no AI needed)
     */
    private applyRuleOverrides;
    private finalizeRuleBased;
    /**
     * Use Qwen (DashScope) to analyze dispute evidence
     */
    private analyzeWithQwen;
    /**
     * Heuristic analysis fallback when AI is not available
     */
    private heuristicAnalysis;
    /**
     * Compute $PAB rewards for correct arbitration (incentivize good behavior)
     */
    private computePabIncentives;
    /**
     * Compute $PAB slashing for the losing party
     */
    private computePabSlashing;
}
export declare const trustArbitratorService: TrustArbitratorService;
//# sourceMappingURL=trustArbitrator.service.d.ts.map