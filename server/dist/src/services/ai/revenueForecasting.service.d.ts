export interface RevenueFeatures {
    businessId: string;
    category: string;
    location?: {
        latitude: number;
        longitude: number;
    };
    historicalRevenue?: number[];
    historicalOrders?: number[];
    seasonalityFactors?: Record<string, number>;
    marketingSpend?: number[];
    competitorActivity?: number;
    economicIndicators?: {
        inflationRate?: number;
        unemploymentRate?: number;
        consumerConfidence?: number;
    };
}
export interface ForecastResult {
    businessId: string;
    period: string;
    predictedRevenue: number;
    confidenceInterval: {
        lower: number;
        upper: number;
    };
    growthRate: number;
    seasonalityAdjustment: number;
    trend: 'GROWING' | 'STABLE' | 'DECLINING';
    keyDrivers: string[];
    recommendations: string[];
    confidence: number;
}
export interface RevenueTrend {
    month: string;
    actualRevenue: number;
    predictedRevenue: number;
    confidence: number;
}
export declare class RevenueForecastingService {
    /**
     * Generate revenue forecast for the next 12 months
     */
    forecast(features: RevenueFeatures): Promise<ForecastResult>;
    /**
     * Get monthly revenue predictions for visualization
     */
    getMonthlyPredictions(businessId: string, months?: number): Promise<RevenueTrend[]>;
    /**
     * Get historical revenue data
     */
    private getHistoricalRevenue;
    /**
     * Calculate trend direction and strength
     */
    private calculateTrend;
    /**
     * Calculate seasonality patterns
     */
    private calculateSeasonality;
    /**
     * Generate future predictions
     */
    private generatePredictions;
    /**
     * Calculate confidence intervals
     */
    private calculateConfidenceIntervals;
    /**
     * Identify key revenue drivers
     */
    private identifyKeyDrivers;
    /**
     * Generate actionable recommendations
     */
    private generateRecommendations;
    /**
     * Calculate overall confidence
     */
    private calculateConfidence;
    private coefficientOfVariation;
    private calculateGrowthRate;
    private getMonthName;
    private fallbackPrediction;
}
export declare const revenueForecastingService: RevenueForecastingService;
//# sourceMappingURL=revenueForecasting.service.d.ts.map