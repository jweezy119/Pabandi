export interface GigOutcomeInput {
    passportId: string;
    gigId?: string;
    title: string;
    description?: string;
    scheduledDate: Date;
    locationHash?: string;
    zipCode?: string;
    status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
    clientRating?: number;
    leadTimeHours?: number;
    cancellationReason?: string;
}
export interface BestFitMatch {
    passportId: string;
    handle: string;
    displayName: string;
    trustScore: number;
    gigFitness: number;
    breakdown: {
        baseTrust: number;
        behavioralSimilarity: number;
        skillMatch: number;
    };
}
export declare class BestFitEngineService {
    /**
     * Ingests a completed or cancelled gig, records it, and updates the provider's behavior vector.
     */
    ingestGigOutcome(input: GigOutcomeInput): Promise<void>;
    /**
     * Recomputes the behavior vector based on all historical gigs.
     */
    private recomputeVector;
    /**
     * Predicts the best fit providers for an open gig.
     */
    predictBestFit(req: {
        scheduledDate: Date;
        skills: string[];
        limit?: number;
        weights?: {
            baseTrust: number;
            temporal: number;
            skill: number;
        };
    }): Promise<BestFitMatch[]>;
    private cosineSimilarity;
}
export declare const bestFitEngineService: BestFitEngineService;
//# sourceMappingURL=bestFitEngine.service.d.ts.map