export interface TrustInputs {
    reliability: {
        completed: number;
        noShows: number;
        cancellations: number;
    };
    osint: {
        breachCount: number;
        domainAgeDays: number;
        voipLikelihood: number;
    };
    social: {
        witnessCount: number;
        vouchScore: number;
    };
    behavior: {
        avgResponseMinutes: number;
        prepayCompliance: number;
    };
    verticals?: {
        commerce: {
            completed: number;
            noShows: number;
        };
        hospitality: {
            completed: number;
            noShows: number;
        };
        freelance: {
            completed: number;
            noShows: number;
        };
        appointment: {
            completed: number;
            noShows: number;
        };
    };
}
export declare class TrustScoreService {
    /**
     * Adaptive Bayesian-inspired scoring logic.
     * Gets smarter and shifts weights based on the density of positive/negative outcomes.
     */
    calculateCompositeScore(inputs: TrustInputs): {
        score: number;
        weights: any;
        verticalScores?: any;
    };
    /**
     * Computes the "Trust Velocity" over the last 30 days.
     */
    computeVelocity(userId: string): Promise<{
        slope30d: number;
        streak: number;
        label: string;
    }>;
    /**
     * Process a new event, recalculate score, and write to audit trail.
     */
    processEvent(userId: string, event: {
        component: string;
        reason: string;
        severity: 'positive' | 'neutral' | 'negative';
        osintData?: any;
    }): Promise<void>;
    /**
     * Calculates a risk premium multiplier for third-party insurance integrations (e.g., Nexus Mutual).
     *
     * @param trustScore The AI-calculated trust score (0-100)
     * @returns A risk multiplier (e.g., 0.5x for ultra-safe, 3.0x for high risk)
     */
    calculateInsurancePremium(trustScore: number): number;
}
export declare const trustScoreService: TrustScoreService;
//# sourceMappingURL=trustScore.service.d.ts.map