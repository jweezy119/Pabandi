import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';

export interface CustomerFeatures {
  customerId: string;
  businessId: string;
  firstOrderDate: Date;
  lastOrderDate: Date;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  orderFrequency: number; // Orders per month
  daysSinceLastOrder: number;
  favoriteCategory?: string;
  preferredTimeSlot?: string;
  avgGroupSize?: number;
  cancellationRate: number;
  noShowRate: number;
  reviewScore?: number; // Average rating given
  referralCount?: number;
  loyaltyTier?: string;
  engagementScore?: number; // 0-100 based on app usage, reviews, referrals
}

export interface CLVPrediction {
  customerId: string;
  predictedCLV: number; // Customer Lifetime Value in USD
  confidence: number;
  predictedMonthsActive: number;
  expectedFutureOrders: number;
  expectedFutureRevenue: number;
  riskOfChurn: number; // 0-100
  segment: 'CHAMPION' | 'LOYAL' | 'POTENTIAL' | 'AT_RISK' | 'LOST';
  recommendedActions: string[];
  optimalDiscount?: number; // Recommended discount % for retention
  nextBestAction: string;
}

export interface ChurnPrediction {
  customerId: string;
  churnProbability: number; // 0-100
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  timeToChurn: number; // Estimated days until churn
  keyRiskFactors: string[];
  retentionActions: string[];
  optimalIntervention: string;
  estimatedValueAtRisk: number; // CLV * churnProbability
}

export class CustomerIntelligenceService {
  
  /**
   * Predict Customer Lifetime Value
   */
  async predictCLV(features: CustomerFeatures): Promise<CLVPrediction> {
    try {
      // Calculate historical value
      const historicalValue = features.totalRevenue;
      
      // Predict future value using survival analysis approach
      const survivalProbability = this.calculateSurvivalProbability(features);
      const avgOrderValue = features.averageOrderValue || (features.totalRevenue / Math.max(1, features.totalOrders));
      const orderFrequency = features.orderFrequency || (features.totalOrders / Math.max(1, this.monthsSinceFirstOrder(features)));
      
      // Monthly expected revenue
      const monthlyExpectedRevenue = avgOrderValue * orderFrequency;
      
      // Expected months remaining
      const monthsRemaining = survivalProbability * this.estimateMaxLifespan(features);
      
      // Future value
      const futureValue = monthlyExpectedRevenue * monthsRemaining;
      
      // Total CLV
      const predictedCLV = historicalValue + futureValue;
      
      // Risk of churn
      const riskOfChurn = this.calculateChurnRisk(features);
      
      // Segment customer
      const segment = this.segmentCustomer(predictedCLV, riskOfChurn, features);
      
      // Generate recommendations
      const recommendations = this.generateCLVRecommendations(features, segment, riskOfChurn);
      
      // Optimal discount for retention
      const optimalDiscount = this.calculateOptimalDiscount(features, riskOfChurn);
      
      // Next best action
      const nextBestAction = this.determineNextBestAction(features, segment, riskOfChurn);
      
      // Confidence based on data quality
      const confidence = this.calculateConfidence(features);
      
      return {
        customerId: features.customerId,
        predictedCLV: Math.round(predictedCLV * 100) / 100,
        confidence,
        predictedMonthsActive: Math.round(monthsRemaining * 10) / 10,
        expectedFutureOrders: Math.round(orderFrequency * monthsRemaining),
        expectedFutureRevenue: Math.round(futureValue * 100) / 100,
        riskOfChurn,
        segment,
        recommendedActions: recommendations,
        optimalDiscount,
        nextBestAction
      };
    } catch (error) {
      logger.error('Error in CLV prediction', error);
      return this.fallbackCLV(features);
    }
  }

  /**
   * Predict churn probability
   */
  async predictChurn(features: CustomerFeatures): Promise<ChurnPrediction> {
    const churnProbability = this.calculateChurnRisk(features);
    const riskLevel = this.getChurnRiskLevel(churnProbability);
    const timeToChurn = this.estimateTimeToChurn(features, churnProbability);
    const keyRiskFactors = this.identifyRiskFactors(features);
    const retentionActions = this.generateRetentionActions(features, churnProbability);
    const optimalIntervention = this.determineOptimalIntervention(features, churnProbability);
    const estimatedValueAtRisk = (features.totalRevenue + features.averageOrderValue * 12) * (churnProbability / 100);
    
    return {
      customerId: features.customerId,
      churnProbability,
      riskLevel,
      timeToChurn,
      keyRiskFactors,
      retentionActions,
      optimalIntervention,
      estimatedValueAtRisk: Math.round(estimatedValueAtRisk * 100) / 100
    };
  }

  /**
   * Get comprehensive customer intelligence
   */
  async getCustomerIntelligence(customerId: string, businessId: string): Promise<{
    clv: CLVPrediction;
    churn: ChurnPrediction;
    segment: string;
    nextActions: string[];
    valueTier: string;
  }> {
    // Fetch customer features
    const features = await this.fetchCustomerFeatures(customerId, businessId);
    
    const [clv, churn] = await Promise.all([
      this.predictCLV(features),
      this.predictChurn(features)
    ]);
    
    const segment = this.determineSegment(clv.segment, clv.predictedCLV);
    const valueTier = this.determineValueTier(clv.predictedCLV);
    
    const nextActions = [
      ...clv.recommendedActions.slice(0, 2),
      ...churn.retentionActions.slice(0, 2)
    ].filter((a, i, arr) => arr.indexOf(a) === i);
    
    return {
      clv,
      churn,
      segment: clv.segment,
      nextActions: nextActions.slice(0, 3),
      valueTier
    };
  }

  // ── Private Helper Methods ──

  private monthsSinceFirstOrder(features: CustomerFeatures): number {
    const now = new Date();
    const first = new Date(features.firstOrderDate);
    return Math.max(1, (now.getTime() - first.getTime()) / (1000 * 60 * 60 * 24 * 30));
  }

  private calculateSurvivalProbability(features: CustomerFeatures): number {
    // Exponential survival model based on recency, frequency, monetary
    const recencyScore = Math.max(0, 1 - (features.daysSinceLastOrder / 365));
    const frequencyScore = Math.min(1, features.orderFrequency / 4); // Normalize to 4 orders/month
    const monetaryScore = Math.min(1, features.totalRevenue / 10000); // Normalize to $10k
    
    // Weighted survival probability
    const survival = 0.4 * recencyScore + 0.3 * frequencyScore + 0.3 * monetaryScore;
    return Math.max(0.1, Math.min(1, survival));
  }

  private estimateMaxLifespan(features: CustomerFeatures): number {
    // Estimate max customer lifespan in months based on industry
    const baseLifespan = 24; // 2 years base
    
    // Adjust based on loyalty tier
    const tierMultiplier = {
      'PLATINUM': 2.5,
      'GOLD': 2.0,
      'SILVER': 1.5,
      'BRONZE': 1.2,
      'NONE': 1.0
    }[features.loyaltyTier || 'NONE'] || 1;
    
    return baseLifespan * tierMultiplier;
  }

  private calculateChurnRisk(features: CustomerFeatures): number {
    let risk = 20; // Base churn risk
    
    // Recency factor - days since last order
    if (features.daysSinceLastOrder > 90) risk += 30;
    else if (features.daysSinceLastOrder > 60) risk += 20;
    else if (features.daysSinceLastOrder > 30) risk += 10;
    
    // Frequency decline
    const expectedFrequency = 1; // 1 order per month baseline
    if (features.orderFrequency < expectedFrequency * 0.5) risk += 15;
    else if (features.orderFrequency < expectedFrequency) risk += 5;
    
    // Cancellation/No-show history
    if (features.cancellationRate > 0.2) risk += 20;
    else if (features.cancellationRate > 0.1) risk += 10;
    
    if (features.noShowRate > 0.1) risk += 15;
    else if (features.noShowRate > 0.05) risk += 5;
    
    // Low engagement
    if (features.engagementScore !== undefined && features.engagementScore < 30) risk += 15;
    
    // Low review scores
    if (features.reviewScore !== undefined && features.reviewScore < 3.5) risk += 10;
    
    // No referrals
    if (!features.referralCount || features.referralCount === 0) risk += 5;
    
    // Recent negative experience (low review score on last order)
    // This would need additional data
    
    return Math.max(5, Math.min(95, risk));
  }

  private getChurnRiskLevel(probability: number): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    if (probability >= 70) return 'CRITICAL';
    if (probability >= 50) return 'HIGH';
    if (probability >= 30) return 'MODERATE';
    return 'LOW';
  }

  private estimateTimeToChurn(features: CustomerFeatures, churnProb: number): number {
    if (churnProb < 30) return 365; // Low risk - likely to stay a year+
    if (churnProb < 50) return 180; // Moderate - 6 months
    if (churnProb < 70) return 90;  // High - 3 months
    return 30; // Critical - 1 month
  }

  private identifyRiskFactors(features: CustomerFeatures): string[] {
    const factors: string[] = [];
    
    if (features.daysSinceLastOrder > 90) factors.push(`Inactive for ${features.daysSinceLastOrder} days`);
    if (features.orderFrequency < 0.5) factors.push('Order frequency below 0.5/month');
    if (features.cancellationRate > 0.2) factors.push(`${Math.round(features.cancellationRate * 100)}% cancellation rate`);
    if (features.noShowRate > 0.1) factors.push(`${Math.round(features.noShowRate * 100)}% no-show rate`);
    if (features.engagementScore !== undefined && features.engagementScore < 30) factors.push('Low engagement score');
    if (features.reviewScore !== undefined && features.reviewScore < 3.5) factors.push('Below average review scores');
    if (!features.referralCount || features.referralCount === 0) factors.push('No referrals generated');
    
    return factors.length > 0 ? factors : ['No significant risk factors identified'];
  }

  private generateRetentionActions(features: CustomerFeatures, churnProb: number): string[] {
    const actions: string[] = [];
    
    if (churnProb > 70) {
      return [
        'Immediate personal outreach from account manager',
        'Offer 25% discount on next order',
        'Schedule personal check-in call',
        'Provide VIP support channel'
      ];
    }
    
    if (churnProb > 50) {
      actions.push('Send personalized re-engagement email with 15% discount');
      actions.push('Offer free upgrade on next order');
    }
    
    if (features.daysSinceLastOrder > 60) {
      actions.push('Send "We miss you" campaign with special offer');
      actions.push('Recommend popular items based on history');
    }
    
    if (features.orderFrequency < 0.5) {
      actions.push('Enroll in loyalty program with accelerated rewards');
      actions.push('Set up automated reorder reminders');
    }
    
    if (features.cancellationRate > 0.15) {
      actions.push('Implement flexible cancellation policy');
      actions.push('Offer deposit-free booking for trusted customers');
    }
    
    return actions.length > 0 ? actions : ['Monitor and send monthly newsletter'];
  }

  private determineOptimalIntervention(features: CustomerFeatures, churnProb: number): string {
    if (churnProb > 70) return 'Immediate personal outreach with executive sponsorship';
    if (churnProb > 50) return 'Automated re-engagement campaign with personalized offer';
    if (features.daysSinceLastOrder > 60) return 'Win-back email campaign with 20% discount';
    if (features.orderFrequency < 0.5) return 'Enroll in loyalty program with welcome bonus';
    return 'Monthly personalized newsletter with recommendations';
  }

  private segmentCustomer(predictedCLV: number, riskOfChurn: number, features: CustomerFeatures): CLVPrediction['segment'] {
    if (predictedCLV > 5000 && features.totalOrders > 20 && riskOfChurn < 30) return 'CHAMPION';
    if (predictedCLV > 2000 && features.totalOrders > 10 && riskOfChurn < 40) return 'LOYAL';
    if (predictedCLV > 1000 && riskOfChurn < 50) return 'POTENTIAL';
    if (riskOfChurn > 50 || features.daysSinceLastOrder > 90) return 'AT_RISK';
    return 'LOST';
  }

  private determineValueTier(predictedCLV: number): string {
    if (predictedCLV > 10000) return 'PLATINUM';
    if (predictedCLV > 5000) return 'GOLD';
    if (predictedCLV > 2000) return 'SILVER';
    if (predictedCLV > 500) return 'BRONZE';
    return 'STANDARD';
  }

  private determineSegment(clvSegment: CLVPrediction['segment'], predictedCLV: number): string {
    return clvSegment;
  }

  private generateCLVRecommendations(features: CustomerFeatures, segment: CLVPrediction['segment'], risk: number): string[] {
    const recs: string[] = [];
    
    switch (segment) {
      case 'CHAMPION':
        recs.push('VIP treatment with priority support');
        recs.push('Exclusive early access to new services');
        recs.push('Personalized thank you from business owner');
        break;
      case 'LOYAL':
        recs.push('Invite to loyalty program tier upgrade');
        recs.push('Referral bonus program');
        recs.push('Early access to new services');
        break;
      case 'POTENTIAL':
        recs.push('Targeted upsell campaign');
        recs.push('Frequency incentive program');
        recs.push('Personalized recommendations');
        break;
      case 'AT_RISK':
        recs.push('Win-back campaign with 20% discount');
        recs.push('Personal outreach from manager');
        recs.push('Service recovery gesture');
        break;
      case 'LOST':
        recs.push('Win-back campaign with 30% discount');
        recs.push('Survey to understand departure reason');
        recs.push('Remove from active marketing to save costs');
        break;
    }
    
    return recs.slice(0, 3);
  }

  private calculateOptimalDiscount(features: CustomerFeatures, risk: number): number | undefined {
    if (risk < 30) return undefined; // No discount needed
    if (risk > 70) return 25;
    if (risk > 50) return 20;
    return 15;
  }

  private determineNextBestAction(features: CustomerFeatures, segment: CLVPrediction['segment'], risk: number): string {
    if (segment === 'AT_RISK' || segment === 'LOST') {
      return `Send win-back offer with ${this.calculateOptimalDiscount(features, risk)}% discount`;
    }
    if (segment === 'POTENTIAL') {
      return 'Send personalized upsell recommendation';
    }
    if (segment === 'LOYAL') {
      return 'Invite to referral program';
    }
    if (segment === 'CHAMPION') {
      return 'Schedule quarterly business review';
    }
    return 'Add to nurture campaign';
  }

  private calculateConfidence(features: CustomerFeatures): number {
    let confidence = 50;
    
    // More data = higher confidence
    confidence += Math.min(25, features.totalOrders * 2);
    confidence += Math.min(15, this.monthsSinceFirstOrder(features) * 2);
    
    // Consistent behavior = higher confidence
    if (features.cancellationRate < 0.1 && features.noShowRate < 0.05) {
      confidence += 10;
    }
    
    // Engagement data
    if (features.engagementScore !== undefined) confidence += 10;
    if (features.reviewScore !== undefined) confidence += 5;
    
    return Math.max(40, Math.min(95, confidence));
  }

  private fallbackCLV(features: CustomerFeatures): CLVPrediction {
    const avgOrderValue = features.averageOrderValue || 50;
    const orderFrequency = features.orderFrequency || 1;
    const predictedCLV = features.totalRevenue + (avgOrderValue * orderFrequency * 12);
    
    return {
      customerId: features.customerId,
      predictedCLV: Math.round(predictedCLV * 100) / 100,
      confidence: 40,
      predictedMonthsActive: 12,
      expectedFutureOrders: Math.round(orderFrequency * 12),
      expectedFutureRevenue: Math.round(avgOrderValue * orderFrequency * 12 * 100) / 100,
      riskOfChurn: 50,
      segment: 'POTENTIAL',
      recommendedActions: ['Insufficient data for accurate prediction'],
      nextBestAction: 'Collect more customer interaction data'
    };
  }

  private async fetchCustomerFeatures(customerId: string, businessId: string): Promise<CustomerFeatures> {
    const [reservations, reviews, userReferrals] = await Promise.all([
      prisma.reservation.findMany({
        where: { customerId, businessId, status: 'COMPLETED' },
        select: {
          reservationDate: true,
          totalAmount: true,
          status: true,
          numberOfGuests: true
        },
        orderBy: { reservationDate: 'desc' }
      }),
      prisma.pabandiReview.findMany({
        where: { customerId, businessId },
        select: { rating: true }
      }),
      prisma.user.findUnique({
        where: { id: customerId },
        select: { referrals: true }
      })
    ]);

    const completed = reservations.filter(r => r.status === 'COMPLETED');
    const cancelled = reservations.filter(r => r.status === 'CANCELLED');
    const noShows = reservations.filter(r => r.status === 'NO_SHOW');
    
    const totalRevenue = completed.reduce((sum: number, r) => sum + (r.totalAmount || 0), 0);
    const totalOrders = completed.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    const firstOrder = completed.length > 0 ? completed[completed.length - 1].reservationDate : new Date();
    const lastOrder = completed.length > 0 ? completed[0].reservationDate : new Date();
    const monthsSinceFirst = Math.max(1, (Date.now() - firstOrder.getTime()) / (1000 * 60 * 60 * 24 * 30));
    const orderFrequency = totalOrders / Math.max(1, monthsSinceFirst);
    
    const cancellationRate = reservations.length > 0 ? cancelled.length / reservations.length : 0;
    const noShowRate = reservations.length > 0 ? noShows.length / reservations.length : 0;
    
    const avgReview = reviews.length > 0 
      ? reviews.reduce((sum: number, r) => sum + r.rating, 0) / reviews.length 
      : undefined;
    
    const referralCount = userReferrals?.referrals?.length || 0;

    return {
      customerId: '',
      businessId,
      firstOrderDate: firstOrder,
      lastOrderDate: lastOrder,
      totalOrders,
      totalRevenue,
      averageOrderValue: avgOrderValue,
      orderFrequency,
      daysSinceLastOrder: Math.floor((Date.now() - lastOrder.getTime()) / (1000 * 60 * 60 * 24)),
      cancellationRate,
      noShowRate,
      reviewScore: avgReview,
      referralCount,
      engagementScore: 50
    };
  }
}

export const customerIntelligenceService = new CustomerIntelligenceService();