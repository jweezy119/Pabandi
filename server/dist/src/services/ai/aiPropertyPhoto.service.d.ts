export type PropertyPhotoAnalysis = {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    issues: string[];
    suggestions: string[];
    isCover: boolean;
    confidence: number;
};
export declare class AIPropertyPhotoService {
    /**
     * Analyze a property photo using AI vision
     */
    analyzePhoto(photoUrl: string, context?: {
        propertyType?: string;
        roomType?: string;
    }): Promise<PropertyPhotoAnalysis>;
    private analyzeWithProvider;
    private parseTextAnalysis;
    private extractList;
    private heuristicAnalysis;
    private logAnalysis;
}
export declare const aiPropertyPhotoService: AIPropertyPhotoService;
//# sourceMappingURL=aiPropertyPhoto.service.d.ts.map