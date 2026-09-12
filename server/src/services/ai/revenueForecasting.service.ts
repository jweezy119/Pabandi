import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';

export interface RevenueFeatures {
  businessId: string;
  category: string;
  location?: { latitude: number; longitude: number };
  historicalRevenue?: number[]; // Last 12 months
  historicalOrders?: number[];
  seasonalityFactors?: Record<string, number>;
  marketingSpend?: number[];
  competitorActivity?: number;
  economicIndicators?: {
    inflationRate?: number;
    unemploymentRate?: number;
    consumerConfidence?: number;
  };
}

export interface ForecastResult {
  businessId: string;
  period: string;
  predictedRevenue: number;
  confidenceInterval: { lower: number; upper: number };
  growthRate: number;
  seasonalityAdjustment: number;
  trend: 'GROWING' | 'STABLE' | 'DECLINING';
  keyDrivers: string[];
  recommendations: string[];
  confidence: number;
}

export interface RevenueTrend {
  month: string;
  actualRevenue: number;
  predictedRevenue: number;
  confidence: number;
}

export class RevenueForecastingService {
  
  /**
   * Generate revenue forecast for the next 12 months
   */
  async forecast(features: RevenueFeatures): Promise<ForecastResult> {
    try {
      // Get historical data if not provided
      let historicalRevenue = features.historicalRevenue;
      let historicalOrders = features.historicalOrders;
      
      if (!historicalRevenue || historicalRevenue.length === 0) {
        const historical = await this.getHistoricalRevenue(features.businessId, 12);
        historicalRevenue = historical.map(h => h.revenue);
        historicalOrders = historical.map(h => h.orders);
      }

      // Calculate trend
      const trend = this.calculateTrend(historicalRevenue);
      
      // Calculate seasonality
      const seasonality = this.calculateSeasonality(historicalRevenue);
      
      // Generate predictions
      const predictions = this.generatePredictions(
        historicalRevenue, 
        trend, 
        seasonality, 
        features
      );

      // Calculate confidence intervals
      const confidenceIntervals = this.calculateConfidenceIntervals(
        historicalRevenue, 
        predictions
      );

      // Identify key drivers
      const keyDrivers = this.identifyKeyDrivers(features, historicalRevenue);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(
        predictions, 
        trend, 
        features
      );

      // Overall confidence
      const confidence = this.calculateConfidence(historicalRevenue, features);

      return {
        businessId: features.businessId,
        period: '12 months',
        predictedRevenue: predictions.reduce((sum, p) => sum + p, 0),
        confidenceInterval: {
          lower: confidenceIntervals.lower.reduce((sum, p) => sum + p, 0),
          upper: confidenceIntervals.upper.reduce((sum, p) => sum + p, 0)
        },
        growthRate: this.calculateGrowthRate(historicalRevenue, predictions),
        seasonalityAdjustment: seasonality.averageAdjustment,
        trend: trend.direction,
        keyDrivers,
        recommendations,
        confidence
      };
    } catch (error) {
      logger.error('Error in revenue forecasting', error);
      return this.fallbackPrediction(features);
    }
  }

  /**
   * Get monthly revenue predictions for visualization
   */
  async getMonthlyPredictions(businessId: string, months: number = 12): Promise<RevenueTrend[]> {
    const features: RevenueFeatures = { businessId, category: 'general' };
    const result = await this.forecast(features);
    
    // Generate monthly breakdown
    const historical = await this.getHistoricalRevenue(businessId, 12);
    const historicalRevenue = historical.map(h => h.revenue);
    
    const trend = this.calculateTrend(historicalRevenue);
    const seasonality = this.calculateSeasonality(historicalRevenue);
    const predictions = this.generatePredictions(historicalRevenue, trend, seasonality, { businessId, category: 'general' });
    const confidenceIntervals = this.calculateConfidenceIntervals(historicalRevenue, predictions);
    
    return predictions.map((pred, i) => ({
      month: this.getMonthName(i),
      actualRevenue: i < historicalRevenue.length ? historicalRevenue[i] : 0,
      predictedRevenue: pred,
      confidence: Math.max(50, 95 - i * 3) // Decreasing confidence over time
    }));
  }

  /**
   * Get historical revenue data
   */
  private async getHistoricalRevenue(businessId: string, months: number): Promise<{ month: string; revenue: number; orders: number }[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const reservations = await prisma.reservation.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        reservationDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        reservationDate: true,
        totalAmount: true
      }
    });

    // Aggregate by month
    const monthlyData: Record<string, { revenue: number; orders: number }> = {};
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = { revenue: 0, orders: 0 };
    }

    for (const res of reservations) {
      const date = new Date(res.reservationDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) {
        monthlyData[key].revenue += res.totalAmount || 0;
        monthlyData[key].orders += 1;
      }
    }

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      revenue: data.revenue,
      orders: data.orders
    }));
  }

  /**
   * Calculate trend direction and strength
   */
  private calculateTrend(revenue: number[]): { direction: 'GROWING' | 'STABLE' | 'DECLINING'; strength: number } {
    if (revenue.length < 3) {
      return { direction: 'STABLE', strength: 0 };
    }

    // Simple linear regression
    const n = revenue.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = revenue;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgRevenue = sumY / n;
    const strength = Math.abs(slope) / (avgRevenue || 1);
    
    let direction: 'GROWING' | 'STABLE' | 'DECLINING' = 'STABLE';
    if (slope > avgRevenue * 0.02) direction = 'GROWING';
    else if (slope < -avgRevenue * 0.02) direction = 'DECLINING';
    
    return { direction, strength: Math.min(1, strength) };
  }

  /**
   * Calculate seasonality patterns
   */
  private calculateSeasonality(revenue: number[]): { pattern: number[]; averageAdjustment: number } {
    if (revenue.length < 12) {
      return { pattern: Array(12).fill(1), averageAdjustment: 0 };
    }

    // Calculate monthly indices
    const avgRevenue = revenue.reduce((a, b) => a + b, 0) / revenue.length;
    const monthlyIndices = revenue.map(r => r / (avgRevenue || 1));
    
    // Average seasonal adjustment
    const avgAdjustment = monthlyIndices.reduce((sum, idx) => sum + Math.abs(idx - 1), 0) / 12;
    
    return { pattern: monthlyIndices, averageAdjustment: avgAdjustment };
  }

  /**
   * Generate future predictions
   */
  private generatePredictions(
    historical: number[], 
    trend: { direction: string; strength: number }, 
    seasonality: { pattern: number[] },
    features: RevenueFeatures
  ): number[] {
    const predictions: number[] = [];
    const lastValue = historical[historical.length - 1] || 0;
    const avgSeasonality = seasonality.pattern.reduce((a, b) => a + b, 0) / 12;
    
    // Trend component
    const monthlyGrowth = trend.direction === 'GROWING' ? 0.02 : 
                          trend.direction === 'DECLINING' ? -0.015 : 0;
    const trendStrength = trend.strength;
    
    for (let i = 0; i < 12; i++) {
      const monthIndex = (new Date().getMonth() + i) % 12;
      const seasonalFactor = seasonality.pattern[monthIndex] || 1;
      
      // Base prediction with trend
      const trendValue = lastValue * Math.pow(1 + monthlyGrowth * trendStrength, i + 1);
      
      // Apply seasonality
      const prediction = trendValue * (seasonalFactor / avgSeasonality);
      
      // Apply marketing impact if available
      let marketingBoost = 1;
      if (features.marketingSpend && features.marketingSpend.length > i) {
        marketingBoost = 1 + (features.marketingSpend[i] / 10000) * 0.1; // $10k spend = 10% boost
      }
      
      predictions.push(Math.max(0, prediction * marketingBoost));
    }
    
    return predictions;
  }

  /**
   * Calculate confidence intervals
   */
  private calculateConfidenceIntervals(
    historical: number[], 
    predictions: number[]
  ): { lower: number[]; upper: number[] } {
    if (historical.length < 3) {
      return { 
        lower: predictions.map(p => p * 0.7), 
        upper: predictions.map(p => p * 1.3) 
      };
    }

    // Calculate historical volatility
    const returns = [];
    for (let i = 1; i < historical.length; i++) {
      if (historical[i - 1] > 0) {
        returns.push((historical[i] - historical[i - 1]) / historical[i - 1]);
      }
    }
    
    const volatility = returns.length > 0 
      ? Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length)
      : 0.15; // Default 15% volatility
    
    const lower = predictions.map(p => p * (1 - 1.96 * volatility));
    const upper = predictions.map(p => p * (1 + 1.96 * volatility));
    
    return { lower, upper };
  }

  /**
   * Identify key revenue drivers
   */
  private identifyKeyDrivers(
    features: RevenueFeatures, 
    historical: number[]
  ): string[] {
    const drivers: string[] = [];
    
    // Trend driver
    if (historical.length >= 3) {
      const recent = historical.slice(-3);
      const older = historical.slice(-6, -3);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / 3;
      const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
      
      if (recentAvg > olderAvg * 1.1) drivers.push('Strong recent growth momentum');
      else if (recentAvg < olderAvg * 0.9) drivers.push('Recent revenue decline');
    }
    
    // Seasonality
    if (features.seasonalityFactors) {
      const peakMonth = Object.entries(features.seasonalityFactors)
        .sort(([,a], [,b]) => b - a)[0];
      if (peakMonth) drivers.push(`Seasonal peak in ${peakMonth[0]}`);
    }
    
    // Marketing impact
    if (features.marketingSpend && features.marketingSpend.length > 0) {
      const totalSpend = features.marketingSpend.reduce((a, b) => a + b, 0);
      if (totalSpend > 0) drivers.push('Active marketing investment');
    }
    
    // Competitive pressure
    if (features.competitorActivity && features.competitorActivity > 0.7) {
      drivers.push('High competitive pressure');
    }
    
    // Economic factors
    if (features.economicIndicators?.inflationRate && features.economicIndicators.inflationRate > 5) {
      drivers.push('High inflation environment');
    }
    
    return drivers.length > 0 ? drivers : ['Stable baseline performance'];
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    predictions: number[],
    trend: { direction: string },
    features: RevenueFeatures
  ): string[] {
    const recommendations: string[] = [];
    const totalPredicted = predictions.reduce((a, b) => a + b, 0);
    const avgMonthly = totalPredicted / 12;
    
    if (trend.direction === 'DECLINING') {
      recommendations.push('Implement customer retention campaigns to reverse decline');
      recommendations.push('Consider targeted promotions during low-demand months');
      recommendations.push('Review pricing strategy for competitive positioning');
    } else if (trend.direction === 'GROWING') {
      recommendations.push('Scale marketing spend during peak growth periods');
      recommendations.push('Consider capacity expansion to capture growing demand');
      recommendations.push('Explore upsell/cross-sell opportunities for existing customers');
    } else {
      recommendations.push('Focus on customer acquisition to break stagnation');
      recommendations.push('Test new service offerings or packages');
    }
    
    // Seasonal recommendations
    if (features.seasonalityFactors) {
      const peakMonth = Object.entries(features.seasonalityFactors)
        .sort(([,a], [,b]) => b - a)[0];
      const lowMonth = Object.entries(features.seasonalityFactors)
        .sort(([,a], [,b]) => a - b)[0];
      if (peakMonth && lowMonth) {
        recommendations.push(`Prepare for ${peakMonth[0]} peak - increase staffing and inventory`);
        recommendations.push(`Run promotions during ${lowMonth[0]} to boost off-peak revenue`);
      }
    }
    
    // Marketing recommendations
    if (features.marketingSpend) {
      const avgSpend = features.marketingSpend.reduce((a, b) => a + b, 0) / features.marketingSpend.length;
      if (avgSpend < 1000) {
        recommendations.push('Increase marketing budget to drive customer acquisition');
      }
    }
    
    return recommendations.length > 0 ? recommendations : ['Maintain current strategy with monthly reviews'];
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(historical: number[], features: RevenueFeatures): number {
    let confidence = 50; // Base confidence
    
    // More historical data = higher confidence
    confidence += Math.min(30, historical.length * 2.5);
    
    // Consistent data = higher confidence
    if (historical.length > 3) {
      const cv = this.coefficientOfVariation(historical);
      confidence += Math.max(0, 20 - cv * 100); // Lower CV = higher confidence
    }
    
    // External factors reduce confidence
    if (features.economicIndicators?.inflationRate && features.economicIndicators.inflationRate > 5) {
      confidence -= 10;
    }
    if (features.competitorActivity && features.competitorActivity > 0.7) {
      confidence -= 10;
    }
    
    return Math.max(30, Math.min(95, confidence));
  }

  private coefficientOfVariation(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    if (mean === 0) return 1;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance) / mean;
  }

  private calculateGrowthRate(historical: number[], predictions: number[]): number {
    const lastHistorical = historical[historical.length - 1] || 0;
    const firstPredicted = predictions[0] || 0;
    if (lastHistorical === 0) return 0;
    return ((firstPredicted - lastHistorical) / lastHistorical) * 100;
  }

  private getMonthName(index: number): string {
    const date = new Date();
    date.setMonth(date.getMonth() + index);
    return date.toLocaleString('default', { month: 'short', year: 'numeric' });
  }

  private fallbackPrediction(features: RevenueFeatures): ForecastResult {
    return {
      businessId: features.businessId,
      period: '12 months',
      predictedRevenue: 0,
      confidenceInterval: { lower: 0, upper: 0 },
      growthRate: 0,
      seasonalityAdjustment: 0,
      trend: 'STABLE',
      keyDrivers: ['Insufficient historical data'],
      recommendations: ['Collect at least 6 months of revenue data for accurate forecasting'],
      confidence: 20
    };
  }
}

export const revenueForecastingService = new RevenueForecastingService();