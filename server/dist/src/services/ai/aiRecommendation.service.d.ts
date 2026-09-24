export declare class AIRecommendationService {
    /**
     * Generate embeddings for a property and store them
     */
    embedProperty(propertyId: string): Promise<{
        propertyId: string;
        embedded: boolean;
        provider: string;
    }>;
    /**
     * Find similar properties using semantic search
     */
    findSimilarProperties(propertyId: string, limit?: number): Promise<any[]>;
    /**
     * Batch embed all properties (for initial setup)
     */
    batchEmbedProperties(limit?: number): Promise<{
        embedded: number;
        total: number;
    }>;
}
export declare const aiRecommendationService: AIRecommendationService;
//# sourceMappingURL=aiRecommendation.service.d.ts.map