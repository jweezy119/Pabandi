export interface DemandFeatures {
    businessId: string;
    category: string;
    serviceId?: string;
    historicalDemand: number[];
    historicalDates: Date[];
    seasonalityFactors?: Record<string, number>;
    events?: Array<{
        date: Date;
        impact: number;
        type: 'HOLIDAY' | 'EVENT' | 'PROMOTION' | 'WEATHER';
    }>;
    weatherData?: Array<{
        date: Date;
        temperature: number;
        precipitation: number;
        condition: string;
    }>;
    promotionSchedule?: Array<{
        startDate: Date;
        endDate: Date;
        discountPercent: number;
        channel: string;
    }>;
    externalFactors?: {
        economicIndicator?: number;
        competitorActivity?: number;
        localEvents?: number;
    };
}
export interface DemandForecast {
    businessId: string;
    serviceId?: string;
    period: string;
    predictions: Array<{
        date: string;
        predictedDemand: number;
        confidenceInterval: {
            lower: number;
            upper: number;
        };
        dayOfWeek: number;
        isHoliday: boolean;
        factors: Record<string, number>;
    }>;
    totalPredictedDemand: number;
    peakDays: Array<{
        date: string;
        predictedDemand: number;
    }>;
    lowDays: Array<{
        date: string;
        predictedDemand: number;
    }>;
    seasonalityPattern: Record<string, number>;
    recommendations: string[];
    confidence: number;
}
export interface CapacityPlanning {
    businessId: string;
    recommendedCapacity: number;
    currentCapacity: number;
    utilizationRate: number;
    peakUtilization: number;
    recommendedStaffing: Array<{
        date: string;
        recommendedStaff: number;
        peakHours: number[];
    }>;
    costSavings: number;
    overCapacityDays: number;
    underCapacityDays: number;
}
export declare class DemandForecastingService {
    /**
     * Generate demand forecast
     */
    forecast(features: DemandFeatures): Promise<DemandForecast>;
    /**
     * Get capacity planning recommendations
     */
    getCapacityPlanning(businessId: string, days?: number): Promise<CapacityPlanning>;
    private prepareTimeSeries;
    private decomposeTimeSeries;
    private generatePredictions;
    private identifyPeakLowDays;
    private extractSeasonalityPattern;
    private generateRecommendations;
    private calculateConfidence;
    private calculateVolatility;
    private fallbackForecast;
    private getBusinessCapacity;
    private generateStaffingSchedule;
    private calculateCostSavings;
    private calculateStaffingRecommendations;
}
export declare const demandForecastingService: DemandForecastingService;
//# sourceMappingURL=demandForecasting.service.d.ts.map