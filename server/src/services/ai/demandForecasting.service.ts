import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';

export interface DemandFeatures {
  businessId: string;
  category: string;
  serviceId?: string;
  historicalDemand: number[]; // Daily/weekly demand
  historicalDates: Date[];
  seasonalityFactors?: Record<string, number>;
  events?: Array<{
    date: Date;
    impact: number; // Expected % change
    type: 'HOLIDAY' | 'EVENT' | 'PROMOTION' | 'WEATHER';
  }>;
  weatherData?: Array<{
    date: Date;
    temperature: number;
    precipitation: number;
    condition: string;
  }>;
  promotionSchedule?: Array<{
    startDate: Date;
    endDate: Date;
    discountPercent: number;
    channel: string;
  }>;
  externalFactors?: {
    economicIndicator?: number;
    competitorActivity?: number;
    localEvents?: number;
  };
}

export interface DemandForecast {
  businessId: string;
  serviceId?: string;
  period: string;
  predictions: Array<{
    date: string;
    predictedDemand: number;
    confidenceInterval: { lower: number; upper: number };
    dayOfWeek: number;
    isHoliday: boolean;
    factors: Record<string, number>;
  }>;
  totalPredictedDemand: number;
  peakDays: Array<{ date: string; predictedDemand: number }>;
  lowDays: Array<{ date: string; predictedDemand: number }>;
  seasonalityPattern: Record<string, number>;
  recommendations: string[];
  confidence: number;
}

export interface CapacityPlanning {
  businessId: string;
  recommendedCapacity: number;
  currentCapacity: number;
  utilizationRate: number;
  peakUtilization: number;
  recommendedStaffing: Array<{
    date: string;
    recommendedStaff: number;
    peakHours: number[];
  }>;
  costSavings: number;
  overCapacityDays: number;
  underCapacityDays: number;
}

export class DemandForecastingService {
  
  /**
   * Generate demand forecast
   */
  async forecast(features: DemandFeatures): Promise<DemandForecast> {
    try {
      // Prepare time series data
      const timeSeries = this.prepareTimeSeries(features);
      
      // Decompose time series
      const decomposition = this.decomposeTimeSeries(timeSeries);
      
      // Generate predictions
      const predictions = this.generatePredictions(
        timeSeries, 
        decomposition, 
        features
      );
      
      // Identify peak and low days
      const { peakDays, lowDays } = this.identifyPeakLowDays(predictions);
      
      // Calculate seasonality pattern
      const seasonalityPattern = this.extractSeasonalityPattern(predictions);
      
      // Calculate total demand
      const totalPredictedDemand = predictions.reduce((sum, p) => sum + p.predictedDemand, 0);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(predictions, features);
      
      // Calculate confidence
      const confidence = this.calculateConfidence(timeSeries);
      
      return {
        businessId: features.businessId,
        serviceId: features.serviceId,
        period: `${predictions.length} days`,
        predictions,
        totalPredictedDemand: Math.round(predictions.reduce((sum, p) => sum + p.predictedDemand, 0)),
        peakDays,
        lowDays,
        seasonalityPattern,
        recommendations,
        confidence: this.calculateConfidence(timeSeries)
      };
    } catch (error) {
      logger.error('Error in demand forecasting', error);
      return this.fallbackForecast(features);
    }
  }

  /**
   * Get capacity planning recommendations
   */
  async getCapacityPlanning(businessId: string, days: number = 30): Promise<CapacityPlanning> {
    const features: DemandFeatures = {
      businessId,
      category: 'GENERAL',
      historicalDemand: [],
      historicalDates: []
    };
    
    const forecast = await this.forecast({ ...features, businessId });
    const predictions = forecast.predictions.slice(0, days);
    
    // Current capacity (would come from business settings)
    const currentCapacity = await this.getBusinessCapacity(businessId);
    
    const maxPredicted = Math.max(...predictions.map(p => p.predictedDemand));
    const avgDemand = predictions.reduce((sum, p) => sum + p.predictedDemand, 0) / predictions.length;
    const peakDemand = Math.max(...predictions.map(p => p.predictedDemand));
    
    const utilizationRate = (predictions.reduce((sum, p) => sum + p.predictedDemand, 0) / predictions.length) / 100; // Assuming 100 is max capacity
    const peakUtilization = Math.max(...predictions.map(p => p.predictedDemand)) / 100;
    
    // Staffing recommendations
    const staffing = this.calculateStaffingRecommendations(
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return date;
      }).map((date, i) => ({
        date: date.toISOString().split('T')[0],
        predictedDemand: Math.max(...predictions.filter(p => {
          const predDate = new Date(p.date);
          return predDate.getDay() === new Date(predictions[i].date).getDay();
        }).map(p => p.predictedDemand), 0)
      }))
    );
    
    const overCapacityDays = predictions.filter(p => p.predictedDemand > 80).length; // Assuming 80% = over capacity
    const underCapacityDays = predictions.filter(p => p.predictedDemand < 30).length; // Below 30% = under utilized
    
    return {
      businessId,
      recommendedCapacity: Math.ceil(predictions.reduce((sum, p) => sum + p.predictedDemand, 0) / predictions.length * 1.2),
      currentCapacity: 100, // Would come from business settings
      utilizationRate: Math.round(predictions.reduce((sum, p) => sum + p.predictedDemand, 0) / predictions.length),
      peakUtilization: Math.max(...predictions.map(p => p.predictedDemand)),
      recommendedStaffing: this.generateStaffingSchedule(predictions),
      costSavings: this.calculateCostSavings(predictions),
      overCapacityDays: predictions.filter(p => p.predictedDemand > 80).length,
      underCapacityDays: predictions.filter(p => p.predictedDemand < 30).length
    };
  }

  // ── Core Forecasting Methods ──

  private prepareTimeSeries(features: DemandFeatures): Array<{ date: Date; demand: number }> {
    const timeSeries: Array<{ date: Date; demand: number }> = [];
    
    for (let i = 0; i < features.historicalDemand.length; i++) {
      timeSeries.push({
        date: features.historicalDates[i] || new Date(Date.now() - (features.historicalDemand.length - i) * 86400000),
        demand: features.historicalDemand[i]
      });
    }
    
    return timeSeries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private decomposeTimeSeries(timeSeries: Array<{ date: Date; demand: number }>): {
    trend: number[];
    seasonal: number[];
    residual: number[];
    seasonalPattern: number[];
  } {
    const values = timeSeries.map(t => t.demand);
    const n = values.length;
    
    if (n < 7) {
      return {
        trend: values,
        seasonal: Array(n).fill(0),
        residual: Array(n).fill(0),
        seasonalPattern: Array(7).fill(1)
      };
    }

    // Simple moving average for trend (7-day window)
    const window = Math.min(7, Math.floor(values.length / 4));
    const trend: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(values.length, i + Math.ceil(window / 2));
      const windowValues = values.slice(start, end);
      trend.push(windowValues.reduce((a, b) => a + b, 0) / windowValues.length);
    }

    // Seasonal component (7-day weekly pattern)
    const seasonal: number[] = [];
    const seasonalPattern: number[] = Array(7).fill(1);
    const daySums: number[] = Array(7).fill(0);
    const dayCounts: number[] = Array(7).fill(0);
    
    for (let i = 0; i < timeSeries.length; i++) {
      const dayOfWeek = timeSeries[i].date.getDay();
      const detrended = values[i] / (timeSeries[i].demand > 0 ? timeSeries[i].demand : 1); // Simplified
      seasonalPattern[dayOfWeek] += values[i];
      dayCounts[timeSeries[i].date.getDay()]++;
    }
    
    for (let d = 0; d < 7; d++) {
      seasonalPattern[d] = dayCounts[d] > 0 ? seasonalPattern[d] / dayCounts[d] : 1;
    }
    
    const avgSeasonal = seasonalPattern.reduce((a, b) => a + b, 0) / 7;
    const normalizedPattern = seasonalPattern.map(s => s / (avgSeasonal || 1));
    
    for (let i = 0; i < timeSeries.length; i++) {
      const dayOfWeek = timeSeries[i].date.getDay();
      seasonal.push(normalizedPattern[timeSeries[i].date.getDay()]);
    }
    
    // Residual
    const residual = values.map((v, i) => v - trend[i] * (seasonal[i] || 1));
    
    return { trend, seasonal, residual, seasonalPattern: normalizedPattern };
  }

  private generatePredictions(
    timeSeries: Array<{ date: Date; demand: number }>,
    decomposition: { trend: number[]; seasonal: number[]; seasonalPattern: number[] },
    features: DemandFeatures
  ): DemandForecast['predictions'] {
    const predictions: DemandForecast['predictions'] = [];
    const lastDate = timeSeries[timeSeries.length - 1]?.date || new Date();
    const trend = decomposition.trend;
    const seasonalPattern = decomposition.seasonalPattern;
    
    // Calculate trend slope
    const trendValues = decomposition.trend.filter(v => v > 0);
    const trendSlope = trendValues.length > 1 
      ? (trendValues[trendValues.length - 1] - trendValues[0]) / trendValues.length
      : 0;
    
    const lastTrend = trend[trend.length - 1] || 0;
    const lastValue = timeSeries[timeSeries.length - 1]?.demand || 0;
    
    // Generate 30-day forecast
    for (let i = 1; i <= 30; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);
      
      const dayOfWeek = forecastDate.getDay();
      const seasonalFactor = decomposition.seasonalPattern[dayOfWeek] || 1;
      
      // Trend projection
      const trendProjection = (lastValue || 0) + (decomposition.trend[decomposition.trend.length - 1] || 0) * 0.1 * i;
      
      // Base prediction
      let prediction = Math.max(0, (lastValue || 10) + i * 0.5); // Simple fallback
      
      // Apply seasonality
      const baseDemand = lastValue || 10;
      const trendComponent = trendSlope * i * 0.1;
      
      let predictedDemand = (baseDemand + trendComponent) * seasonalFactor;
      
      // Apply event effects
      let eventAdjustment = 0;
      if (features.events) {
        for (const event of features.events) {
          const daysDiff = Math.abs((event.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff < 7) {
            eventAdjustment += event.impact;
          }
        }
      }
      
      // Apply promotion effects
      let promoAdjustment = 0;
      if (features.promotionSchedule) {
        for (const promo of features.promotionSchedule) {
          const promoStart = new Date(promo.startDate);
          const promoEnd = new Date(promo.endDate);
          const forecastDate = new Date();
          forecastDate.setDate(forecastDate.getDate() + 1);
          if (promoStart <= forecastDate && forecastDate <= promoEnd) {
            promoAdjustment += promo.discountPercent / 100 * 0.3; // 30% of discount translates to demand increase
          }
        }
      }
      
      // Weather effects
      let weatherAdjustment = 0;
      if (features.weatherData) {
        // Would need weather forecast - simplified
      }
      
      const finalPrediction = Math.max(0, predictedDemand * (1 + eventAdjustment / 100) * (1 + promoAdjustment));
      
      // Confidence interval (simplified)
      const volatility = this.calculateVolatility();
      const margin = predictedDemand * 0.2;
      
      const factors: Record<string, number> = {
        baseTrend: Math.round(trendSlope * 100) / 100,
        seasonal: Math.round((decomposition.seasonalPattern[dayOfWeek] || 1 - 1) * 100) / 100
      };
      
      if (eventAdjustment !== 0) factors.events = eventAdjustment;
      if (promoAdjustment !== 0) factors.promotions = promoAdjustment;
      
      predictions.push({
        date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
        predictedDemand: Math.round(predictedDemand * 100) / 100,
        confidenceInterval: {
          lower: Math.max(0, Math.round((predictedDemand - predictedDemand * 0.2) * 100) / 100),
          upper: Math.round((predictedDemand + predictedDemand * 0.2) * 100) / 100
        },
        dayOfWeek,
        isHoliday: false, // Would check holiday calendar
        factors
      });
    }
    
    return predictions;
  }

  private identifyPeakLowDays(predictions: DemandForecast['predictions']): {
    peakDays: DemandForecast['peakDays'];
    lowDays: DemandForecast['lowDays'];
  } {
    const sorted = [...predictions].sort((a, b) => b.predictedDemand - a.predictedDemand);
    
    return {
      peakDays: sorted.slice(0, 5).map(p => ({
        date: p.date,
        predictedDemand: p.predictedDemand
      })),
      lowDays: sorted.slice(-5).map(p => ({
        date: p.date,
        predictedDemand: p.predictedDemand
      }))
    };
  }

  private extractSeasonalityPattern(predictions: DemandForecast['predictions']): Record<string, number> {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const pattern: Record<string, number> = {};
    
    for (let d = 0; d < 7; d++) {
      const dayPredictions = predictions.filter(p => p.dayOfWeek === d);
      if (dayPredictions.length > 0) {
        const avg = dayPredictions.reduce((sum, p) => sum + p.predictedDemand, 0) / dayPredictions.length;
        pattern[dayNames[d]] = Math.round(avg * 100) / 100;
      }
    }
    
    return pattern;
  }

  private generateRecommendations(predictions: DemandForecast['predictions'], features: DemandFeatures): string[] {
    const recommendations: string[] = [];
    
    const peakDays = predictions.filter(p => p.predictedDemand > 80);
    const lowDays = predictions.filter(p => p.predictedDemand < 30);
    
    if (peakDays.length > 0) {
      recommendations.push(`Prepare for ${peakDays.length} high-demand days - increase staffing and inventory`);
      const peakDayNames = peakDays.slice(0, 3).map(p => new Date(p.date).toLocaleDateString('en-US', { weekday: 'short' })).join(', ');
      recommendations.push(`Peak days: ${peakDayNames} - ensure full staffing`);
    }
    
    if (lowDays.length > 0) {
      recommendations.push(`Run promotions on ${lowDays.length} low-demand days to boost utilization`);
      const lowDayNames = lowDays.slice(0, 3).map(p => new Date(p.date).toLocaleDateString('en-US', { weekday: 'short' })).join(', ');
      recommendations.push(`Low demand days: ${lowDayNames} - run targeted promotions`);
    }
    
    // Weekly pattern recommendations
    const weekendAvg = predictions.filter(p => p.dayOfWeek === 0 || p.dayOfWeek === 6)
      .reduce((sum, p) => sum + p.predictedDemand, 0) / Math.max(1, predictions.filter(p => p.dayOfWeek === 0 || p.dayOfWeek === 6).length);
    const weekdayAvg = predictions.filter(p => p.dayOfWeek >= 1 && p.dayOfWeek <= 5)
      .reduce((sum, p) => sum + p.predictedDemand, 0) / Math.max(1, predictions.filter(p => p.dayOfWeek >= 1 && p.dayOfWeek <= 5).length);
    
    if (weekendAvg > weekdayAvg * 1.5) {
      recommendations.push('Weekend demand significantly higher - ensure weekend staffing');
    }
    
    if (features.promotionSchedule && features.promotionSchedule.length > 0) {
      recommendations.push('Track promotion effectiveness - measure lift vs baseline');
    }
    
    return recommendations.length > 0 ? recommendations : ['Monitor demand patterns weekly and adjust staffing accordingly'];
  }

  private calculateConfidence(timeSeries: Array<{ date: Date; demand: number }>): number {
    if (timeSeries.length < 7) return 30;
    if (timeSeries.length < 30) return 50;
    if (timeSeries.length < 90) return 70;
    return 85;
  }

  private calculateVolatility(): number {
    // Return a default volatility factor (0.2 = 20%)
    return 0.2;
  }

  private fallbackForecast(features: DemandFeatures): DemandForecast {
    return {
      businessId: features.businessId,
      serviceId: features.serviceId,
      period: '30 days',
      predictions: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
        predictedDemand: 50,
        confidenceInterval: { lower: 35, upper: 65 },
        dayOfWeek: (new Date().getDay() + i) % 7,
        isHoliday: false,
        factors: {}
      })),
      totalPredictedDemand: 1500,
      peakDays: [],
      lowDays: [],
      seasonalityPattern: {},
      recommendations: ['Insufficient historical data for accurate forecasting'],
      confidence: 30
    };
  }

  private async getBusinessCapacity(businessId: string): Promise<number> {
    // Would fetch from business settings
    return 100;
  }

  private generateStaffingSchedule(predictions: DemandForecast['predictions']): CapacityPlanning['recommendedStaffing'] {
    return predictions.slice(0, 7).map(p => ({
      date: p.date,
      recommendedStaff: Math.ceil(p.predictedDemand / 10), // 1 staff per 10 units
      peakHours: [10, 11, 12, 13, 17, 18, 19, 20] // Typical peak hours
    }));
  }

  private calculateCostSavings(predictions: DemandForecast['predictions']): number {
    // Simplified: 10% cost savings from optimized staffing
    const avgDemand = predictions.reduce((sum, p) => sum + p.predictedDemand, 0) / predictions.length;
    const overstaffed = predictions.filter(p => p.predictedDemand < 30).length;
    return overstaffed * 50 * 7; // $50/day per overstaffed person * 7 days
  }

  private calculateStaffingRecommendations(weeklyDemand: Array<{ date: string; predictedDemand: number }>) {
    return weeklyDemand.map(day => ({
      date: day.date,
      recommendedStaff: Math.ceil(day.predictedDemand / 10),
      peakHours: [11, 12, 13, 18, 19, 20]
    }));
  }
}

export const demandForecastingService = new DemandForecastingService();