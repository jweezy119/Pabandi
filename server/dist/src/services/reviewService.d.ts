export declare class ReviewService {
    /**
     * Fetch and sync reviews for a business from Google
     */
    syncBusinessReviews(businessId: string, googlePlaceId: string): Promise<void>;
    /**
     * Calculate reliability score for a business
     * (googleRating * 0.4) + (bookingCompletionRate * 0.6)
     */
    calculateReliabilityScore(businessId: string): Promise<number>;
}
export declare const reviewService: ReviewService;
//# sourceMappingURL=reviewService.d.ts.map