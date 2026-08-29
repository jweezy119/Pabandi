interface ReservationFeatures {
    customerHistory?: {
        totalReservations: number;
        noShowCount: number;
        cancellationCount: number;
        lastReservationDate?: Date;
        averageNoShowRate?: number;
    };
    timeFactors?: {
        dayOfWeek: number;
        hour: number;
        isWeekend: boolean;
        isHoliday: boolean;
    };
    bookingFactors?: {
        advanceBookingDays: number;
        isSameDay: boolean;
        groupSize: number;
        hasSpecialRequests: boolean;
    };
    businessFactors?: {
        averageNoShowRate: number;
        businessRating?: number;
        requiresDeposit: boolean;
        businessCategory?: string;
    };
    /** Salon / Spa specific */
    serviceFactors?: {
        serviceType?: string;
        serviceDurationMinutes?: number;
        estimatedValueUSD?: number;
    };
    /** Event / VIP specific */
    eventFactors?: {
        eventCapacity?: number;
        isVIP?: boolean;
        ticketPriceUSD?: number;
    };
}
export interface PredictionResult {
    probability: number;
    riskScore: number;
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    factors: Record<string, number>;
    depositRecommendation: {
        required: boolean;
        amountUSD: number;
        strategy: 'FLAT' | 'PERCENTAGE' | 'AI_DYNAMIC';
        reason: string;
        /** Deposit is applied toward the total purchase */
        creditedTowardPurchase: true;
    };
    overbookingAdvice?: {
        predictedNoShowPercent: number;
        safeOverbookMargin: number;
        recommendedCapacity: number;
    };
}
export declare class NoShowPredictor {
    private model;
    private isModelLoaded;
    /**
     * Predict no-show probability for a reservation
     */
    predict(features: ReservationFeatures): Promise<PredictionResult>;
    /**
     * Rule-based prediction with industry-specific modifiers
     */
    private ruleBasedPrediction;
    /**
     * Industry-specific risk adjustments
     */
    private industrySpecificPrediction;
    /**
     * Calculate dynamic deposit based on risk, industry, and service value.
     * All deposits are credited toward the total purchase.
     */
    private calculateDynamicDeposit;
    /**
     * Overbooking advice for event venues
     */
    private calculateOverbookingAdvice;
    /**
     * Map score to risk level
     */
    private getRiskLevel;
    /**
     * Normalize features for ML model input
     */
    private normalizeFeatures;
    /**
     * Extract factor contributions for explanation
     */
    private extractFactors;
    /**
     * Load ML model (placeholder for actual model loading)
     */
    loadModel(): Promise<void>;
    /**
     * Get customer reservation history for prediction
     */
    getCustomerHistory(customerId: string, businessId?: string): Promise<{
        totalReservations: number;
        noShowCount: number;
        cancellationCount: number;
        lastReservationDate?: Date;
        averageNoShowRate: number;
    }>;
    /**
     * Get business average no-show rate
     */
    getBusinessNoShowRate(businessId: string): Promise<number>;
    /**
     * Get aggregated no-show analytics by day of week for a business
     */
    getNoShowByDayOfWeek(businessId: string): Promise<{
        day: number;
        total: number;
        noShows: number;
        rate: number;
    }[]>;
    /**
     * Get no-show analytics by hour of day for heatmap
     */
    getNoShowByHour(businessId: string): Promise<{
        hour: number;
        total: number;
        noShows: number;
        rate: number;
    }[]>;
}
export declare const noShowPredictor: NoShowPredictor;
export {};
//# sourceMappingURL=noShowPredictor.d.ts.map