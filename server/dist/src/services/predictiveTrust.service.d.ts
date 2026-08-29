export interface RiskProfile {
    entityId: string;
    sampleSize: number;
    completed: number;
    noShow: number;
    cancelled: number;
    noShowRate: number;
    completionRate: number;
    confidence: number;
}
export declare const predictiveTrustService: {
    /** Per-customer no-show / completion risk from history. */
    customerRisk(customerId: string): Promise<RiskProfile>;
    /** Per-business reliability from history. */
    businessRisk(businessId: string): Promise<RiskProfile>;
    /**
     * Forward prediction for a PROSPECTIVE booking (call BEFORE create).
     * Blends customer + business risk, then applies lead-time & day-of-week
     * modifiers. Returns the probability the booking completes (no no-show).
     */
    predictBooking(input: {
        customerId?: string;
        businessId?: string;
        reservationTime?: string | Date;
    }): Promise<{
        predictedNoShow: number;
        predictedCompletion: number;
        confidence: number;
        factors: {
            label: string;
            contribution: number;
        }[];
    }>;
    /**
     * Demand forecast per hour-of-day for a business (from COMPLETED history).
     * Returns 24 buckets; higher count = busier hour.
     */
    demandForecast(businessId: string): Promise<{
        hour: number;
        count: number;
    }[]>;
    /**
     * Recommend the best upcoming slots for a customer at a business.
     * Scores each candidate by predictedCompletion (higher better) with a small
     * penalty for peak-demand hours (spread load), returns top 3.
     */
    recommendSlots(input: {
        customerId?: string;
        businessId: string;
        daysAhead?: number;
    }): Promise<{
        slot: string;
        predictedCompletion: number;
        demand: number;
    }[]>;
    /**
     * Persist a prediction onto a reservation (called at create time) so the
     * trust rail + guarantees can use it. Writes noShowProbability + aiFactors.
     */
    attachPredictionToReservation(reservationId: string, input: {
        customerId?: string;
        businessId?: string;
        reservationTime?: string | Date;
    }): Promise<{
        predictedNoShow: number;
        predictedCompletion: number;
        confidence: number;
        factors: {
            label: string;
            contribution: number;
        }[];
    } | null>;
};
export default predictiveTrustService;
//# sourceMappingURL=predictiveTrust.service.d.ts.map