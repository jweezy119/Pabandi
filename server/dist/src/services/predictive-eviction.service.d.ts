export declare class PredictiveEvictionService {
    /**
     * Evaluates a tenant's eviction risk probability and updates their profile.
     * Uses a mocked ML ensemble representing XGBoost + Temporal GNN models
     * trained on CourtListener data and OSINT indicators.
     */
    evaluateTenantRisk(tenantId: string): Promise<{
        tenantId: string;
        riskScore: number;
        evictionProbability: number;
        recommendation: string;
    }>;
}
export declare const predictiveEvictionService: PredictiveEvictionService;
//# sourceMappingURL=predictive-eviction.service.d.ts.map