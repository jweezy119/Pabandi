export interface PricingFeatures {
    businessId: string;
    category: string;
    serviceId?: string;
    currentPrice: number;
    cost: number;
    historicalDemand: number[];
    historicalPrices: number[];
    competitorPrices?: number[];
    seasonalityFactors?: Record<string, number>;
    customerSegments?: Array<{
        segment: string;
        priceSensitivity: number;
        size: number;
    }>;
    costStructure?: {
        fixedCosts: number;
        variableCostPerUnit: number;
    };
    inventoryConstraints?: {
        maxCapacity: number;
        currentInventory: number;
        leadTimeDays: number;
    };
    businessGoals?: {
        maximizeRevenue?: boolean;
        maximizeProfit?: boolean;
        maximizeMarketShare?: boolean;
        minMargin?: number;
    };
}
export interface PricingRecommendation {
    businessId: string;
    serviceId?: string;
    currentPrice: number;
    recommendedPrice: number;
    priceChange: number;
    priceChangePercent: number;
    expectedRevenueChange: number;
    expectedProfitChange: number;
    expectedVolumeChange: number;
    elasticity: number;
    confidence: number;
    reasoning: string[];
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
    implementationStrategy: 'IMMEDIATE' | 'GRADUAL' | 'TEST_THEN_SCALE';
    testPeriodDays?: number;
    competitorAnalysis?: {
        priceVsCompetitors: number;
        position: 'PREMIUM' | 'COMPETITIVE' | 'BUDGET';
    };
    sensitivityAnalysis: {
        pricePoints: Array<{
            price: number;
            expectedVolume: number;
            expectedRevenue: number;
            expectedProfit: number;
        }>;
    };
}
export declare class PricingOptimizationService {
    /**
     * Generate optimal pricing recommendation
     */
    optimizePrice(features: PricingFeatures): Promise<PricingRecommendation>;
    /**
     * Get price elasticity of demand from historical data
     */
    private calculateElasticity;
    /**
     * Estimate demand curve: Q = a * P^b (constant elasticity model)
     */
    private estimateDemandCurve;
    /**
     * Calculate optimal price based on business objectives
     */
    private calculateOptimalPrice;
    /**
     * Generate sensitivity analysis
     */
    private generateSensitivityAnalysis;
    /**
     * Analyze competitor positioning
     */
    private analyzeCompetitors;
    /**
     * Assess risk of price change
     */
    private assessRisk;
    /**
     * Determine implementation strategy
     */
    private determineImplementationStrategy;
    /**
     * Generate reasoning for recommendation
     */
    private generateReasoning;
    private calculateConfidence;
    private getSeasonalMultiplier;
    private predictDemandAtPrice;
    private findPriceForDemand;
    private fallbackRecommendation;
}
export declare const pricingOptimizationService: PricingOptimizationService;
//# sourceMappingURL=pricingOptimization.service.d.ts.map