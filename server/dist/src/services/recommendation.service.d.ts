/**
 * Pabandi Recommendation Engine
 * ==============================
 *
 * Uses Jev to power all site recommendations.
 * Jev is 400x cheaper than LLMs for decision-making.
 *
 * Recommendation types:
 * - Property recommendations (which property to show)
 * - Trust tier recommendation (which tier to target)
 * - Payment method recommendation (USDC vs PAB)
 * - Staking amount recommendation (how much to stake)
 * - Feature recommendations (what to show next)
 */
export declare class RecommendationService {
    private apiKey;
    private baseUrl;
    private model;
    constructor();
    private callJev;
    recommendProperties(userId: string, availableProperties: any[]): Promise<{
        recommended: any[];
        reasoning: string;
        confidence: number;
    }>;
    recommendTrustTier(userId: string): Promise<{
        currentTier: string;
        recommendedTier: string;
        pabNeeded: number;
        apy: number;
        benefits: string[];
        confidence: number;
    }>;
    recommendPaymentMethod(userId: string, amountUsd: number): Promise<{
        method: 'usdc' | 'pab' | 'split';
        pabPercent: number;
        savings: number;
        reasoning: string;
        confidence: number;
    }>;
    recommendNextFeature(userId: string): Promise<{
        feature: string;
        reason: string;
        priority: 'high' | 'medium' | 'low';
        confidence: number;
    }>;
}
export declare const recommendationEngine: RecommendationService;
//# sourceMappingURL=recommendation.service.d.ts.map