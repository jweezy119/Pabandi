export interface SentimentFeatures {
    businessId: string;
    reviews?: Array<{
        id: string;
        text: string;
        rating: number;
        date: Date;
        source: string;
    }>;
    surveyResponses?: Array<{
        question: string;
        answer: string;
        score: number;
        date: Date;
    }>;
    socialMentions?: Array<{
        platform: string;
        text: string;
        sentiment?: number;
        date: Date;
        engagement: number;
    }>;
    supportTickets?: Array<{
        subject: string;
        description: string;
        status: string;
        resolutionTime?: number;
        satisfactionScore?: number;
        date: Date;
    }>;
}
export interface SentimentAnalysisResult {
    businessId: string;
    overallSentiment: number;
    sentimentTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    sentimentScore: number;
    categoryScores: Record<string, number>;
    keyTopics: Array<{
        topic: string;
        sentiment: number;
        mentionCount: number;
        trend: 'UP' | 'DOWN' | 'STABLE';
    }>;
    criticalIssues: Array<{
        issue: string;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        mentionCount: number;
        suggestedAction: string;
    }>;
    strengths: Array<{
        strength: string;
        sentiment: number;
        mentionCount: number;
    }>;
    competitiveInsights: {
        vsIndustryAverage: number;
        topCompetitorGap: number;
        areaForImprovement: string;
    };
    recommendations: string[];
    confidence: number;
}
export declare class SentimentAnalysisService {
    /**
     * Analyze sentiment across all feedback channels
     */
    analyzeSentiment(features: SentimentFeatures): Promise<SentimentAnalysisResult>;
    /**
     * Get sentiment analysis for a specific time period
     */
    getSentimentTrends(businessId: string, months?: number): Promise<Array<{
        month: string;
        sentiment: number;
        volume: number;
        positivePct: number;
        negativePct: number;
        neutralPct: number;
    }>>;
    /**
     * Get competitive sentiment benchmarking
     */
    getCompetitiveBenchmark(businessId: string): Promise<{
        yourScore: number;
        industryAverage: number;
        topQuartile: number;
        bottomQuartile: number;
        percentile: number;
        improvementNeeded: number;
        topCompetitors: Array<{
            name: string;
            score: number;
        }>;
    }>;
    private aggregateTextSources;
    private ruleBasedSentimentAnalysis;
    private keywordBasedAnalysis;
    private topicModeling;
    private combineSentimentScores;
    private analyzeTrend;
    private calculateCategoryScores;
    private extractKeyTopics;
    private identifyCriticalIssues;
    private getSuggestedAction;
    private identifyStrengths;
    private getCompetitiveInsights;
    private generateSentimentRecommendations;
    private calculateSentimentConfidence;
    private getEmptyResult;
}
export declare const sentimentAnalysisService: SentimentAnalysisService;
//# sourceMappingURL=sentimentAnalysis.service.d.ts.map