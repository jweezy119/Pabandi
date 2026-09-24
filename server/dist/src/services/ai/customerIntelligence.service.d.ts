export interface CustomerFeatures {
    customerId: string;
    businessId: string;
    firstOrderDate: Date;
    lastOrderDate: Date;
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    orderFrequency: number;
    daysSinceLastOrder: number;
    favoriteCategory?: string;
    preferredTimeSlot?: string;
    avgGroupSize?: number;
    cancellationRate: number;
    noShowRate: number;
    reviewScore?: number;
    referralCount?: number;
    loyaltyTier?: string;
    engagementScore?: number;
}
export interface CLVPrediction {
    customerId: string;
    predictedCLV: number;
    confidence: number;
    predictedMonthsActive: number;
    expectedFutureOrders: number;
    expectedFutureRevenue: number;
    riskOfChurn: number;
    segment: 'CHAMPION' | 'LOYAL' | 'POTENTIAL' | 'AT_RISK' | 'LOST';
    recommendedActions: string[];
    optimalDiscount?: number;
    nextBestAction: string;
}
export interface ChurnPrediction {
    customerId: string;
    churnProbability: number;
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    timeToChurn: number;
    keyRiskFactors: string[];
    retentionActions: string[];
    optimalIntervention: string;
    estimatedValueAtRisk: number;
}
export declare class CustomerIntelligenceService {
    /**
     * Predict Customer Lifetime Value
     */
    predictCLV(features: CustomerFeatures): Promise<CLVPrediction>;
    /**
     * Predict churn probability
     */
    predictChurn(features: CustomerFeatures): Promise<ChurnPrediction>;
    /**
     * Get comprehensive customer intelligence
     */
    getCustomerIntelligence(customerId: string, businessId: string): Promise<{
        clv: CLVPrediction;
        churn: ChurnPrediction;
        segment: string;
        nextActions: string[];
        valueTier: string;
    }>;
    private monthsSinceFirstOrder;
    private calculateSurvivalProbability;
    private estimateMaxLifespan;
    private calculateChurnRisk;
    private getChurnRiskLevel;
    private estimateTimeToChurn;
    private identifyRiskFactors;
    private generateRetentionActions;
    private determineOptimalIntervention;
    private segmentCustomer;
    private determineValueTier;
    private determineSegment;
    private generateCLVRecommendations;
    private calculateOptimalDiscount;
    private determineNextBestAction;
    private calculateConfidence;
    private fallbackCLV;
    private fetchCustomerFeatures;
}
export declare const customerIntelligenceService: CustomerIntelligenceService;
//# sourceMappingURL=customerIntelligence.service.d.ts.map