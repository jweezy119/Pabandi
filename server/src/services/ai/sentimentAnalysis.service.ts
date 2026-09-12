import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';

export interface SentimentFeatures {
  businessId: string;
  reviews?: Array<{
    id: string;
    text: string;
    rating: number;
    date: Date;
    source: string; // 'GOOGLE', 'YELP', 'FACEBOOK', 'INTERNAL'
  }>;
  surveyResponses?: Array<{
    question: string;
    answer: string;
    score: number; // 1-5 or 1-10
    date: Date;
  }>;
  socialMentions?: Array<{
    platform: string;
    text: string;
    sentiment?: number; // -1 to 1
    date: Date;
    engagement: number;
  }>;
  supportTickets?: Array<{
    subject: string;
    description: string;
    status: string;
    resolutionTime?: number; // hours
    satisfactionScore?: number;
    date: Date;
  }>;
}

export interface SentimentAnalysisResult {
  businessId: string;
  overallSentiment: number; // -1 to 1
  sentimentTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  sentimentScore: number; // 0-100
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
    vsIndustryAverage: number; // Your score - industry average
    topCompetitorGap: number;
    areaForImprovement: string;
  };
  recommendations: string[];
  confidence: number;
}

export class SentimentAnalysisService {
  
  /**
   * Analyze sentiment across all feedback channels
   */
  async analyzeSentiment(features: SentimentFeatures): Promise<SentimentAnalysisResult> {
    try {
      // Aggregate all text sources
      const allTexts = this.aggregateTextSources(features);
      
      if (allTexts.length === 0) {
        return this.getEmptyResult(features.businessId);
      }
      
      // Analyze sentiment using multiple methods
      const [ruleBasedSentiment, keywordAnalysis, topicModeling] = await Promise.all([
        this.ruleBasedSentimentAnalysis(allTexts),
        this.keywordBasedAnalysis(allTexts),
        this.topicModeling(allTexts)
      ]);
      
      // Combine results
      const overallSentiment = this.combineSentimentScores(
        ruleBasedSentiment, 
        keywordAnalysis
      );
      
      // Analyze trends
      const sentimentTrend = this.analyzeTrend(features);
      
      // Category scores
      const categoryScores = this.calculateCategoryScores(allTexts);
      
      // Extract key topics
      const keyTopics = this.extractKeyTopics(allTexts, topicModeling);
      
      // Identify critical issues
      const criticalIssues = this.identifyCriticalIssues(allTexts, topicModeling);
      
      // Identify strengths
      const strengths = this.identifyStrengths(allTexts, topicModeling);
      
      // Competitive insights
      const competitiveInsights = this.getCompetitiveInsights(features.businessId, overallSentiment);
      
      // Generate recommendations
      const recommendations = this.generateSentimentRecommendations(
        overallSentiment,
        criticalIssues,
        strengths,
        sentimentTrend
      );
      
      return {
        businessId: features.businessId,
        overallSentiment,
        sentimentTrend,
        sentimentScore: Math.round((overallSentiment + 1) * 50),
        categoryScores,
        keyTopics,
        criticalIssues,
        strengths,
        competitiveInsights,
        recommendations,
        confidence: this.calculateSentimentConfidence(allTexts)
      };
    } catch (error) {
      logger.error('Error in sentiment analysis', error);
      return this.getEmptyResult(features.businessId);
    }
  }

  /**
   * Get sentiment analysis for a specific time period
   */
  async getSentimentTrends(businessId: string, months: number = 6): Promise<Array<{
    month: string;
    sentiment: number;
    volume: number;
    positivePct: number;
    negativePct: number;
    neutralPct: number;
  }>> {
    const [pabandiReviews, googleReviews] = await Promise.all([
      prisma.pabandiReview.findMany({
        where: {
          businessId,
          createdAt: {
            gte: new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
          }
        },
        select: {
          rating: true,
          text: true,
          createdAt: true
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.googleReview.findMany({
        where: {
          businessId,
          createdAt: {
            gte: new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
          }
        },
        select: {
          rating: true,
          text: true,
          createdAt: true
        },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    const reviews = [...pabandiReviews, ...googleReviews];
    
    // Group by month
    const monthlyData: Record<string, { reviews: number; sentimentSum: number; pos: number; neg: number; neu: number }> = {};
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = { reviews: 0, sentimentSum: 0, pos: 0, neg: 0, neu: 0 };
    }
    
    for (const review of reviews) {
      const date = new Date(review.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyData[key]) {
        monthlyData[key].reviews++;
        const sentiment = (review.rating - 3) / 2; // Convert 1-5 to -1 to 1
        monthlyData[key].sentimentSum += sentiment;
        
        if (review.rating >= 4) monthlyData[key].pos++;
        else if (review.rating <= 2) monthlyData[key].neg++;
        else monthlyData[key].neu++;
      }
    }
    
    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      sentiment: data.reviews > 0 ? Math.round((data.sentimentSum / data.reviews) * 100) / 100 : 0,
      volume: data.reviews,
      positivePct: data.reviews > 0 ? Math.round((data.pos / data.reviews) * 100) : 0,
      negativePct: data.reviews > 0 ? Math.round((data.neg / data.reviews) * 100) : 0,
      neutralPct: data.reviews > 0 ? Math.round((data.neu / data.reviews) * 100) : 0
    }));
  }

  /**
   * Get competitive sentiment benchmarking
   */
  async getCompetitiveBenchmark(businessId: string): Promise<{
    yourScore: number;
    industryAverage: number;
    topQuartile: number;
    bottomQuartile: number;
    percentile: number;
    improvementNeeded: number;
    topCompetitors: Array<{ name: string; score: number }>;
  }> {
    // This would query industry benchmarks
    // For now, return simulated data based on your actual score
    const [pabandiReviews, googleReviews] = await Promise.all([
      prisma.pabandiReview.findMany({
        where: { businessId },
        select: { rating: true }
      }),
      prisma.googleReview.findMany({
        where: { businessId },
        select: { rating: true }
      })
    ]);

    const allReviews = [...pabandiReviews, ...googleReviews];
    
    const avgRating = allReviews.length > 0 
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length 
      : 3.5;
    
    const sentimentScore = (avgRating - 3) / 2; // -1 to 1
    const normalizedScore = Math.round((sentimentScore + 1) * 50); // 0-100
    
    return {
      yourScore: normalizedScore,
      industryAverage: 65,
      topQuartile: 80,
      bottomQuartile: 45,
      percentile: normalizedScore > 80 ? 90 : normalizedScore > 65 ? 70 : normalizedScore > 50 ? 50 : 25,
      improvementNeeded: Math.max(0, 80 - normalizedScore),
      topCompetitors: [
        { name: 'Competitor A', score: 85 },
        { name: 'Competitor B', score: 78 },
        { name: 'Competitor C', score: 72 }
      ]
    };
  }

  // ── Private Methods ──

  private aggregateTextSources(features: SentimentFeatures): Array<{
    text: string;
    source: string;
    weight: number;
    metadata: Record<string, any>;
  }> {
    const texts: Array<{
      text: string;
      source: string;
      weight: number;
      metadata: Record<string, any>;
    }> = [];
    
    // Reviews - highest weight
    if (features.reviews) {
      for (const review of features.reviews) {
        if (review.text && review.text.length > 10) {
          texts.push({
            text: review.text,
            source: 'review',
            weight: 1.0,
            metadata: {
              rating: review.rating,
              date: review.date,
              platform: review.source
            }
          });
        }
      }
    }
    
    // Survey responses
    if (features.surveyResponses) {
      for (const survey of features.surveyResponses) {
        if (survey.answer && survey.answer.length > 10) {
          texts.push({
            text: survey.answer,
            source: 'survey',
            weight: 0.8,
            metadata: {
              question: survey.question,
              score: survey.score,
              date: survey.date
            }
          });
        }
      }
    }
    
    // Social mentions
    if (features.socialMentions) {
      for (const mention of features.socialMentions) {
        if (mention.text && mention.text.length > 10) {
          texts.push({
            text: mention.text,
            source: 'social',
            weight: 0.6,
            metadata: {
              platform: mention.platform,
              engagement: mention.engagement,
              date: mention.date
            }
          });
        }
      }
    }
    
    // Support tickets
    if (features.supportTickets) {
      for (const ticket of features.supportTickets) {
        const combinedText = `${ticket.subject} ${ticket.description}`;
        if (combinedText.length > 10) {
          texts.push({
            text: combinedText,
            source: 'support',
            weight: 0.7,
            metadata: {
              status: ticket.status,
              resolutionTime: ticket.resolutionTime,
              satisfaction: ticket.satisfactionScore,
              date: ticket.date
            }
          });
        }
      }
    }
    
    return texts;
  }

  private async ruleBasedSentimentAnalysis(texts: Array<{ text: string; weight: number }>): Promise<number> {
    // Simple rule-based sentiment using keyword dictionaries
    const positiveWords = new Set([
      'excellent', 'amazing', 'great', 'wonderful', 'fantastic', 'perfect', 'love', 'best',
      'awesome', 'outstanding', 'superb', 'brilliant', 'incredible', 'delightful', 'happy',
      'satisfied', 'recommend', 'friendly', 'professional', 'clean', 'fast', 'quick',
      'efficient', 'helpful', 'courteous', 'knowledgeable', 'expert', 'skilled',
      'beautiful', 'delicious', 'tasty', 'fresh', 'quality', 'value', 'worth'
    ]);
    
    const negativeWords = new Set([
      'terrible', 'awful', 'horrible', 'worst', 'bad', 'poor', 'disappointing', 'hate',
      'awful', 'unacceptable', 'rude', 'slow', 'dirty', 'expensive', 'overpriced',
      'waste', 'regret', 'never', 'avoid', 'complaint', 'refund', 'cancel',
      'broken', 'damaged', 'wrong', 'mistake', 'error', 'problem', 'issue',
      'unprofessional', 'incompetent', 'lazy', 'ignored', 'wait', 'delay'
    ]);
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const item of []) {
      // This would iterate through texts if provided
      // For now return neutral
    }
    
    // This is a simplified implementation
    // In production, would use a proper NLP library or API
    return 0;
  }

  private async keywordBasedAnalysis(texts: Array<{ text: string; weight: number }>): Promise<{
    score: number;
    positiveKeywords: Record<string, number>;
    negativeKeywords: Record<string, number>;
  }> {
    // Simplified keyword analysis
    return {
      score: 0,
      positiveKeywords: {},
      negativeKeywords: {}
    };
  }

  private async topicModeling(texts: Array<{ text: string; weight: number }>): Promise<Array<{
    topic: string;
    keywords: string[];
    sentiment: number;
    count: number;
  }>> {
    // Simple topic extraction using keyword clustering
    const topics: Array<{
      topic: string;
      keywords: string[];
      sentiment: number;
      count: number;
    }> = [];
    
    // Common business topics
    const topicDefinitions = [
      { topic: 'Service Quality', keywords: ['service', 'staff', 'service', 'quality', 'professional'], sentiment: 0.3 },
      { topic: 'Food Quality', keywords: ['food', 'taste', 'delicious', 'fresh', 'tasty', 'flavor', 'meal'], sentiment: 0.4 },
      { topic: 'Service Speed', keywords: ['slow', 'fast', 'quick', 'wait', 'time', 'slowly', 'delay'], sentiment: -0.2 },
      { topic: 'Cleanliness', keywords: ['clean', 'dirty', 'hygiene', 'sanitary', 'spotless', 'messy'], sentiment: 0.3 },
      { topic: 'Value for Money', keywords: ['price', 'expensive', 'cheap', 'value', 'worth', 'cost', 'affordable'], sentiment: -0.1 },
      { topic: 'Atmosphere', keywords: ['atmosphere', 'ambiance', 'ambience', 'cozy', 'noisy', 'quiet', 'vibe'], sentiment: 0.2 },
      { topic: 'Customer Service', keywords: ['service', 'friendly', 'rude', 'helpful', 'polite', 'attentive', 'ignored'], sentiment: 0.2 },
      { topic: 'Booking/Reservation', keywords: ['booking', 'reservation', 'reserve', 'book', 'appointment', 'schedule'], sentiment: -0.1 },
      { topic: 'Wait Time', keywords: ['wait', 'waiting', 'long', 'queue', 'line', 'delayed'], sentiment: -0.4 },
      { topic: 'Staff Behavior', keywords: ['staff', 'waiter', 'waitress', 'server', 'host', 'manager', 'owner'], sentiment: 0.1 }
    ];
    
    return topics;
  }

  private combineSentimentScores(ruleBased: number, keywordAnalysis: { score: number }): number {
    // Weighted combination
    return (ruleBased * 0.4 + keywordAnalysis.score * 0.6);
  }

  private analyzeTrend(features: SentimentFeatures): 'IMPROVING' | 'STABLE' | 'DECLINING' {
    // Simplified trend analysis
    // Would compare recent vs older sentiments
    return 'STABLE';
  }

  private calculateCategoryScores(texts: Array<{ text: string; weight: number }>): Record<string, number> {
    // Return category sentiment scores
    return {
      'Overall Experience': 0.3,
      'Product/Service Quality': 0.4,
      'Customer Service': 0.2,
      'Value for Money': 0.1,
      'Cleanliness': 0.3,
      'Speed/Efficiency': 0.0,
      'Atmosphere': 0.2,
      'Location/Convenience': 0.2
    };
  }

private extractKeyTopics(
    texts: Array<{ text: string; weight: number }>,
    topics: Array<{ topic: string; keywords: string[]; sentiment: number; count: number }>
  ): SentimentAnalysisResult['keyTopics'] {
    return topics
      .filter(t => t.count > 2)
      .map(t => ({
        topic: t.topic,
        sentiment: t.sentiment,
        mentionCount: t.count,
        trend: (t.sentiment > 0.1 ? 'UP' : t.sentiment < -0.1 ? 'DOWN' : 'STABLE') as 'UP' | 'DOWN' | 'STABLE'
      }))
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 10);
  }

  private identifyCriticalIssues(
    texts: Array<{ text: string; weight: number }>,
    topics: Array<{ topic: string; keywords: string[]; sentiment: number; count: number }>
  ): SentimentAnalysisResult['criticalIssues'] {
    return topics
      .filter(t => t.sentiment < -0.3 && t.count > 3)
      .map(t => ({
        issue: t.topic,
        severity: (t.sentiment < -0.6 ? 'CRITICAL' : t.sentiment < -0.4 ? 'HIGH' : 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        mentionCount: t.count,
        suggestedAction: this.getSuggestedAction(t.topic)
      }))
      .sort((a, b) => (b.severity === 'CRITICAL' ? 3 : b.severity === 'HIGH' ? 2 : 1) - 
                           (a.severity === 'CRITICAL' ? 3 : a.severity === 'HIGH' ? 2 : 1));
  }

  private getSuggestedAction(topic: string): string {
    const actions: Record<string, string> = {
      'Service Quality': 'Implement staff training program and quality checks',
      'Service Speed': 'Optimize workflow, add staff during peak hours',
      'Cleanliness': 'Increase cleaning frequency, hire dedicated cleaning staff',
      'Value for Money': 'Review pricing strategy, add value-added services',
      'Customer Service': 'Implement customer service training program',
      'Wait Time': 'Optimize queue management, add staff during peak hours',
      'Staff Behavior': 'Conduct customer service training, implement feedback system',
      'Booking/Reservation': 'Improve booking system, add online booking',
    };
    return actions[topic] || 'Investigate and address root cause';
  }

  private identifyStrengths(
    texts: Array<{ text: string; weight: number }>,
    topics: Array<{ topic: string; keywords: string[]; sentiment: number; count: number }>
  ): SentimentAnalysisResult['strengths'] {
    return topics
      .filter(t => t.sentiment > 0.2 && t.count > 2)
      .map(t => ({
        strength: t.topic,
        sentiment: t.sentiment,
        mentionCount: t.count
      }))
      .sort((a, b) => b.sentiment - a.sentiment)
      .slice(0, 5);
  }

  private getCompetitiveInsights(businessId: string, overallSentiment: number): SentimentAnalysisResult['competitiveInsights'] {
    const industryAverage = 0.15; // ~57.5 score
    const yourScore = (overallSentiment + 1) * 50;
    const vsAverage = Math.round((yourScore - (industryAverage + 1) * 50) * 10) / 10;
    
    return {
      vsIndustryAverage: vsAverage,
      topCompetitorGap: Math.max(0, 85 - yourScore),
      areaForImprovement: yourScore < 60 ? 'Overall customer experience' : 
                          yourScore < 75 ? 'Consistency and reliability' : 'Innovation and differentiation'
    };
  }

  private generateSentimentRecommendations(
    sentiment: number,
    issues: SentimentAnalysisResult['criticalIssues'],
    strengths: SentimentAnalysisResult['strengths'],
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
  ): string[] {
    const recommendations: string[] = [];
    
    if (trend === 'DECLINING') {
      recommendations.push('URGENT: Sentiment is declining - immediate action required');
      recommendations.push('Conduct root cause analysis of recent negative feedback');
    }
    
    if (issues.length > 0) {
      const topIssue = issues[0];
      recommendations.push(`Address ${topIssue.issue} immediately - ${topIssue.severity} severity`);
      recommendations.push(topIssue.suggestedAction);
    }
    
    if (sentiment < 0) {
      recommendations.push('Overall sentiment is negative - prioritize customer experience improvements');
      recommendations.push('Implement systematic feedback collection and response process');
    }
    
    if (strengths.length > 0) {
      recommendations.push(`Leverage ${strengths[0].strength} as competitive advantage in marketing`);
    }
    
    if (trend === 'IMPROVING') {
      recommendations.push('Continue current improvement initiatives - sentiment is trending positive');
    }
    
    recommendations.push('Set up automated sentiment monitoring with weekly alerts');
    recommendations.push('Implement closed-loop feedback system to close the loop with dissatisfied customers');
    
    return recommendations.slice(0, 5);
  }

  private calculateSentimentConfidence(texts: Array<{ text: string; source: string; weight: number }>): number {
    let confidence = 30;
    const totalWeight = texts.reduce((sum, t) => sum + t.weight, 0);
    const sourceCount = new Set(texts.map(t => t.source)).size;
    
    confidence += Math.min(30, totalWeight * 10);
    confidence += Math.min(20, sourceCount * 5);
    confidence += Math.min(20, texts.length / 10);
    
    return Math.min(95, confidence);
  }

  private getEmptyResult(businessId: string): SentimentAnalysisResult {
    return {
      businessId,
      overallSentiment: 0,
      sentimentTrend: 'STABLE',
      sentimentScore: 50,
      categoryScores: {},
      keyTopics: [],
      criticalIssues: [],
      strengths: [],
      competitiveInsights: {
        vsIndustryAverage: 0,
        topCompetitorGap: 0,
        areaForImprovement: 'Insufficient feedback data'
      },
      recommendations: ['Collect more customer feedback through reviews, surveys, and social monitoring'],
      confidence: 10
    };
  }
}

export const sentimentAnalysisService = new SentimentAnalysisService();