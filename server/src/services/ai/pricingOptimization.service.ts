import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';

export interface PricingFeatures {
  businessId: string;
  category: string;
  serviceId?: string;
  currentPrice: number;
  cost: number; // Cost of goods/service
  historicalDemand: number[]; // Units sold per period
  historicalPrices: number[];
  competitorPrices?: number[];
  seasonalityFactors?: Record<string, number>;
  customerSegments?: Array<{
    segment: string;
    priceSensitivity: number; // -1 to 1 (negative = price sensitive)
    size: number; // % of customers
  }>;
  costStructure?: {
    fixedCosts: number;
    variableCostPerUnit: number;
  };
  inventoryConstraints?: {
    maxCapacity: number;
    currentInventory: number;
    leadTimeDays: number;
  };
  businessGoals?: {
    maximizeRevenue?: boolean;
    maximizeProfit?: boolean;
    maximizeMarketShare?: boolean;
    minMargin?: number; // Minimum acceptable margin %
  };
}

export interface PricingRecommendation {
  businessId: string;
  serviceId?: string;
  currentPrice: number;
  recommendedPrice: number;
  priceChange: number; // Absolute change
  priceChangePercent: number; // Percentage change
  expectedRevenueChange: number;
  expectedProfitChange: number;
  expectedVolumeChange: number;
  elasticity: number; // Price elasticity of demand
  confidence: number;
  reasoning: string[];
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  implementationStrategy: 'IMMEDIATE' | 'GRADUAL' | 'TEST_THEN_SCALE';
  testPeriodDays?: number;
  competitorAnalysis?: {
    priceVsCompetitors: number; // % difference
    position: 'PREMIUM' | 'COMPETITIVE' | 'BUDGET';
  };
  sensitivityAnalysis: {
    pricePoints: Array<{ price: number; expectedVolume: number; expectedRevenue: number; expectedProfit: number }>;
  };
}

export class PricingOptimizationService {
  
  /**
   * Generate optimal pricing recommendation
   */
  async optimizePrice(features: PricingFeatures): Promise<PricingRecommendation> {
    try {
      // Calculate price elasticity of demand
      const elasticity = this.calculateElasticity(
        features.historicalDemand, 
        features.historicalPrices
      );
      
      // Estimate demand curve
      const demandCurve = this.estimateDemandCurve(features, elasticity);
      
      // Calculate optimal price based on business goals
      const optimalPrice = this.calculateOptimalPrice(features, demandCurve, elasticity);
      
      // Calculate expected changes
      const currentVolume = demandCurve(features.currentPrice);
      const predictedVolume = demandCurve(optimalPrice);
      const volumeChange = predictedVolume - currentVolume;
      const volumeChangePercent = currentVolume > 0 ? (volumeChange / currentVolume) * 100 : 0;
      
      const currentRevenue = features.currentPrice * currentVolume;
      const predictedRevenue = optimalPrice * predictedVolume;
      const revenueChange = predictedRevenue - currentRevenue;
      const revenueChangePercent = currentRevenue > 0 ? (revenueChange / currentRevenue) * 100 : 0;
      
      const currentProfit = (features.currentPrice - features.cost) * currentVolume;
      const predictedProfit = (optimalPrice - features.cost) * predictedVolume;
      const profitChange = predictedProfit - currentProfit;
      
      // Competitor analysis
      const competitorAnalysis = features.competitorPrices && features.competitorPrices.length > 0
        ? this.analyzeCompetitors(features.currentPrice, features.competitorPrices)
        : undefined;
      
      // Sensitivity analysis
      const sensitivityAnalysis = this.generateSensitivityAnalysis(
        demandCurve, 
        features.cost, 
        features.currentPrice
      );
      
      // Determine risk level
      const riskLevel = this.assessRisk(features, optimalPrice, elasticity);
      
      // Implementation strategy
      const implementationStrategy = this.determineImplementationStrategy(
        features.currentPrice, 
        optimalPrice, 
        riskLevel
      );
      
      // Generate reasoning
      const reasoning = this.generateReasoning(
        features, 
        optimalPrice, 
        elasticity, 
        revenueChangePercent,
        competitorAnalysis
      );

      return {
        businessId: features.businessId,
        serviceId: features.serviceId,
        currentPrice: features.currentPrice,
        recommendedPrice: Math.round(optimalPrice * 100) / 100,
        priceChange: Math.round((optimalPrice - features.currentPrice) * 100) / 100,
        priceChangePercent: Math.round(((optimalPrice - features.currentPrice) / features.currentPrice) * 10000) / 100,
        expectedRevenueChange: Math.round(revenueChange * 100) / 100,
        expectedProfitChange: Math.round(profitChange * 100) / 100,
        expectedVolumeChange: Math.round(volumeChangePercent * 100) / 100,
        elasticity: Math.round(elasticity * 100) / 100,
        confidence: this.calculateConfidence(features, elasticity),
        reasoning,
        riskLevel,
        implementationStrategy,
        testPeriodDays: riskLevel === 'HIGH' ? 14 : 7,
        competitorAnalysis,
        sensitivityAnalysis
      };
    } catch (error) {
      logger.error('Error in price optimization', error);
      return this.fallbackRecommendation(features);
    }
  }

  /**
   * Get price elasticity of demand from historical data
   */
  private calculateElasticity(demand: number[], prices: number[]): number {
    if (demand.length < 3 || prices.length < 3 || demand.length !== prices.length) {
      return -1.5; // Default elasticity for services
    }

    // Log-log regression: ln(Q) = a + b*ln(P) => b = elasticity
    const n = demand.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    let validPoints = 0;

    for (let i = 0; i < n; i++) {
      if (demand[i] > 0 && prices[i] > 0) {
        const logP = Math.log(prices[i]);
        const logQ = Math.log(demand[i]);
        sumX += Math.log(prices[i]);
        sumY += Math.log(demand[i]);
        sumXY += Math.log(prices[i]) * Math.log(demand[i]);
        sumX2 += Math.log(prices[i]) ** 2;
        validPoints++;
      }
    }

    if (validPoints < 3) return -1.5;

    const slope = (validPoints * sumXY - sumX * sumY) / (validPoints * sumX2 - sumX * sumX);
    
    // Elasticity should be negative (higher price -> lower demand)
    // Typical range: -0.5 (inelastic) to -3.0 (elastic)
    return Math.max(-3.0, Math.min(-0.3, slope));
  }

  /**
   * Estimate demand curve: Q = a * P^b (constant elasticity model)
   */
  private estimateDemandCurve(features: PricingFeatures, elasticity: number): (price: number) => number {
    // Use current price and demand to calibrate
    const currentPrice = features.currentPrice;
    const currentDemand = features.historicalDemand[features.historicalDemand.length - 1] || 100;
    
    // Q = a * P^elasticity => a = Q / P^elasticity
    const a = currentDemand / Math.pow(features.currentPrice, elasticity);
    
    return (price: number) => {
      if (price <= 0) return 0;
      const demand = a * Math.pow(price, elasticity);
      return Math.max(0, demand);
    };
  }

  /**
   * Calculate optimal price based on business objectives
   */
  private calculateOptimalPrice(
    features: PricingFeatures, 
    demandCurve: (price: number) => number,
    elasticity: number
  ): number {
    const cost = features.cost;
    const currentPrice = features.currentPrice;
    
    // Default: profit maximization (MR = MC)
    // For constant elasticity: P* = MC * (elasticity / (elasticity + 1))
    // Since elasticity is negative: P* = MC * (|elasticity| / (|elasticity| - 1))
    const absElasticity = Math.abs(elasticity);
    
    if (absElasticity <= 1) {
      // Inelastic demand - can increase price significantly
      // But cap at reasonable multiplier
      return Math.min(currentPrice * 1.5, cost * 3);
    }
    
    // Profit-maximizing price
    let optimalPrice = features.cost * (absElasticity / (absElasticity - 1));
    
    // Apply business goal modifiers
    if (features.businessGoals) {
      if (features.businessGoals.maximizeRevenue) {
        // Revenue max: elasticity = -1
        // For constant elasticity, this is at infinite price if |e| < 1
        // or at boundary if |e| > 1
        if (absElasticity > 1) {
          optimalPrice = currentPrice * 1.2; // Move toward unit elasticity
        }
      }
      
      if (features.businessGoals.maximizeMarketShare) {
        // Lower price to gain share
        optimalPrice = Math.max(features.cost * 1.1, currentPrice * 0.9);
      }
      
      // Apply minimum margin constraint
      if (features.businessGoals.minMargin) {
        const minPrice = features.cost / (1 - features.businessGoals.minMargin / 100);
        optimalPrice = Math.max(optimalPrice, minPrice);
      }
    }
    
    // Apply capacity constraints
    if (features.inventoryConstraints) {
      const predictedDemand = this.predictDemandAtPrice(optimalPrice, features);
      if (predictedDemand > features.inventoryConstraints.maxCapacity) {
        // Raise price to reduce demand to capacity
        optimalPrice = this.findPriceForDemand(
          features.inventoryConstraints.maxCapacity * 0.95,
          features
        );
      }
    }
    
    // Competitive constraints
    if (features.competitorPrices && features.competitorPrices.length > 0) {
      const avgCompetitorPrice = features.competitorPrices.reduce((a, b) => a + b, 0) / features.competitorPrices.length;
      const minCompetitorPrice = Math.min(...features.competitorPrices);
      
      // Don't price more than 50% above average competitor without justification
      if (optimalPrice > avgCompetitorPrice * 1.5) {
        optimalPrice = avgCompetitorPrice * 1.3;
      }
      
      // Don't price below minimum competitor price unless cost leadership
      if (optimalPrice < minCompetitorPrice * 0.8 && features.cost < minCompetitorPrice * 0.7) {
        optimalPrice = minCompetitorPrice * 0.9;
      }
    }
    
    // Seasonal adjustments
    const currentMonth = new Date().getMonth();
    const seasonalMultiplier = this.getSeasonalMultiplier(new Date().getMonth());
    optimalPrice *= seasonalMultiplier;
    
    // Bounds checking
    const minPrice = features.cost * 1.05; // At least 5% margin
    const maxPrice = features.currentPrice * 2; // Don't double price in one go
    
    return Math.max(features.cost * 1.05, Math.min(optimalPrice, features.currentPrice * 1.5));
  }

  /**
   * Generate sensitivity analysis
   */
  private generateSensitivityAnalysis(
    demandCurve: (price: number) => number,
    cost: number,
    currentPrice: number
  ): PricingRecommendation['sensitivityAnalysis'] {
    const pricePoints = [];
    const step = currentPrice * 0.1; // 10% steps
    const range = 5; // +/- 50%
    
    for (let i = -range; i <= range; i++) {
      const price = currentPrice * (1 + i * 0.1);
      if (price <= 0) continue;
      
      const volume = demandCurve(price);
      const revenue = price * volume;
      const profit = (price - cost) * volume;
      
      pricePoints.push({
        price: Math.round(price * 100) / 100,
        expectedVolume: Math.round(volume),
        expectedRevenue: Math.round(revenue * 100) / 100,
        expectedProfit: Math.round(profit * 100) / 100
      });
    }
    
    return { pricePoints };
  }

  /**
   * Analyze competitor positioning
   */
  private analyzeCompetitors(
    currentPrice: number, 
    competitorPrices: number[]
  ): PricingRecommendation['competitorAnalysis'] {
    const avgPrice = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;
    const minPrice = Math.min(...competitorPrices);
    const maxPrice = Math.max(...competitorPrices);
    const diff = ((currentPrice - avgPrice) / avgPrice) * 100;
    
    let position: 'PREMIUM' | 'COMPETITIVE' | 'BUDGET';
    if (currentPrice > avgPrice * 1.2) position = 'PREMIUM';
    else if (currentPrice < avgPrice * 0.85) position = 'BUDGET';
    else position = 'COMPETITIVE';
    
    return {
      priceVsCompetitors: Math.round(diff * 10) / 10,
      position
    };
  }

  /**
   * Assess risk of price change
   */
  private assessRisk(
    features: PricingFeatures, 
    newPrice: number, 
    elasticity: number
  ): 'LOW' | 'MODERATE' | 'HIGH' {
    const priceChangePercent = Math.abs((newPrice - features.currentPrice) / features.currentPrice) * 100;
    const absElasticity = Math.abs(elasticity);
    
    let riskScore = 0;
    
    // Large price changes = higher risk
    if (priceChangePercent > 20) riskScore += 30;
    else if (priceChangePercent > 10) riskScore += 15;
    
    // High elasticity = demand sensitive to price
    if (Math.abs(elasticity) > 2) riskScore += 25;
    else if (Math.abs(elasticity) > 1.5) riskScore += 15;
    
    // No competitor data = uncertainty
    if (!features.competitorPrices || features.competitorPrices.length === 0) {
      riskScore += 15;
    }
    
    // Low historical data
    if (features.historicalPrices.length < 6) riskScore += 20;
    else if (features.historicalPrices.length < 12) riskScore += 10;
    
    if (riskScore >= 50) return 'HIGH';
    if (riskScore >= 25) return 'MODERATE';
    return 'LOW';
  }

  /**
   * Determine implementation strategy
   */
  private determineImplementationStrategy(
    currentPrice: number, 
    newPrice: number, 
    riskLevel: string
  ): 'IMMEDIATE' | 'GRADUAL' | 'TEST_THEN_SCALE' {
    const changePercent = Math.abs((newPrice - currentPrice) / currentPrice) * 100;
    
    if (riskLevel === 'HIGH') return 'TEST_THEN_SCALE';
    if (riskLevel === 'MODERATE' || changePercent > 15) return 'GRADUAL';
    return 'IMMEDIATE';
  }

  /**
   * Generate reasoning for recommendation
   */
  private generateReasoning(
    features: PricingFeatures,
    newPrice: number,
    elasticity: number,
    revenueChange: number,
    competitorAnalysis?: PricingRecommendation['competitorAnalysis']
  ): string[] {
    const reasoning: string[] = [];
    const priceChange = ((newPrice - features.currentPrice) / features.currentPrice) * 100;
    
    if (priceChange > 0) {
      reasoning.push(`Increasing price by ${Math.abs(priceChange).toFixed(1)}% to $${newPrice.toFixed(2)}`);
    } else {
      reasoning.push(`Decreasing price by ${Math.abs(priceChange).toFixed(1)}% to $${newPrice.toFixed(2)}`);
    }
    
    // Elasticity reasoning
    const absElasticity = Math.abs(elasticity);
    if (absElasticity < 1) {
      reasoning.push('Demand is inelastic (|E| < 1) - price increase will increase revenue');
    } else if (absElasticity > 2) {
      reasoning.push('Demand is highly elastic - small price changes significantly impact volume');
    } else {
      reasoning.push('Moderate elasticity - balanced price-volume tradeoff');
    }
    
    // Margin reasoning
    const currentMargin = ((features.currentPrice - features.cost) / features.currentPrice) * 100;
    const newMargin = ((newPrice - features.cost) / newPrice) * 100;
    if (newMargin > currentMargin + 5) {
      reasoning.push(`Margin improves from ${currentMargin.toFixed(1)}% to ${newMargin.toFixed(1)}%`);
    }
    
    // Competitor reasoning
    if (competitorAnalysis) {
      if (competitorAnalysis.position === 'PREMIUM') {
        reasoning.push('Currently positioned as premium vs competitors');
      } else if (competitorAnalysis.position === 'BUDGET') {
        reasoning.push('Currently positioned as budget option vs competitors');
      }
    }
    
    // Goal-based reasoning
    if (features.businessGoals?.maximizeProfit) {
      reasoning.push('Optimized for profit maximization');
    } else if (features.businessGoals?.maximizeRevenue) {
      reasoning.push('Optimized for revenue growth');
    } else if (features.businessGoals?.maximizeMarketShare) {
      reasoning.push('Optimized for market share growth');
    }
    
    return reasoning;
  }

  private calculateConfidence(features: PricingFeatures, elasticity: number): number {
    let confidence = 40;
    
    // More historical data = higher confidence
    confidence += Math.min(30, features.historicalPrices.length * 2);
    
    // More elasticity data points = higher confidence
    if (features.historicalDemand.length >= 12) confidence += 20;
    else if (features.historicalDemand.length >= 6) confidence += 15;
    
    // Competitor data
    if (features.competitorPrices && features.competitorPrices.length > 0) confidence += 10;
    
    // Cost data available
    confidence += 5;
    
    // Elasticity certainty
    const absElasticity = Math.abs(elasticity);
    if (absElasticity > 0.5 && absElasticity < 3) confidence += 10;
    
    return Math.max(30, Math.min(95, confidence));
  }

  private getSeasonalMultiplier(month: number): number {
    // Seasonal multipliers for different months (0-indexed)
    const multipliers: Record<number, number> = {
      0: 1.0,   // Jan
      1: 1.05,  // Feb (Valentine's)
      2: 1.0,   // Mar
      3: 1.0,   // Apr
      4: 1.05,  // May (Mother's Day)
      5: 1.1,   // Jun (Weddings, graduations)
      6: 1.15,  // Jul (Summer peak)
      7: 1.1,   // Aug (Summer)
      8: 1.0,   // Sep
      9: 1.05,  // Oct (Halloween)
      10: 1.1,  // Nov (Black Friday prep)
      11: 1.2   // Dec (Holiday peak)
    };
    return multipliers[month] || 1.0;
  }

  private predictDemandAtPrice(price: number, features: PricingFeatures): number {
    const elasticity = this.calculateElasticity(
      features.historicalDemand, 
      features.historicalPrices
    );
    const demandCurve = this.estimateDemandCurve(features, elasticity);
    return demandCurve(price);
  }

  private findPriceForDemand(targetDemand: number, features: PricingFeatures): number {
    const elasticity = this.calculateElasticity(
      features.historicalDemand, 
      features.historicalPrices
    );
    const demandCurve = this.estimateDemandCurve(features, elasticity);
    
    // Binary search for price that gives target demand
    let low = features.cost * 1.05;
    let high = features.currentPrice * 3;
    
    for (let i = 0; i < 50; i++) {
      const mid = (low + high) / 2;
      const demand = demandCurve(mid);
      if (demand > targetDemand) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return (low + high) / 2;
  }

  private fallbackRecommendation(features: PricingFeatures): PricingRecommendation {
    return {
      businessId: features.businessId,
      serviceId: features.serviceId,
      currentPrice: features.currentPrice,
      recommendedPrice: features.currentPrice * 1.05,
      priceChange: features.currentPrice * 0.05,
      priceChangePercent: 5,
      expectedRevenueChange: 0,
      expectedProfitChange: 0,
      expectedVolumeChange: -2,
      elasticity: -1.5,
      confidence: 30,
      reasoning: ['Insufficient data for reliable optimization', 'Applying conservative 5% increase'],
      riskLevel: 'MODERATE',
      implementationStrategy: 'TEST_THEN_SCALE',
      testPeriodDays: 14,
      sensitivityAnalysis: { pricePoints: [] }
    };
  }
}

export const pricingOptimizationService = new PricingOptimizationService();