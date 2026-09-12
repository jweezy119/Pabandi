import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';

export interface InventoryFeatures {
  businessId: string;
  category: string;
  items: Array<{
    itemId: string;
    name: string;
    currentStock: number;
    unitCost: number;
    sellingPrice: number;
    leadTimeDays: number;
    dailyDemand: number[]; // Last 30-90 days
    seasonalityFactor?: number;
    shelfLifeDays?: number;
    minOrderQuantity?: number;
    supplierReliability?: number; // 0-1
    criticality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
  warehouseCapacity?: {
    maxCapacity: number;
    currentUtilization: number;
    costPerUnitStorage: number;
  };
  serviceLevelTarget?: number; // 0-1 (e.g., 0.95 = 95% service level)
  demandForecastHorizon?: number; // Days
}

export interface InventoryOptimizationResult {
  businessId: string;
  recommendations: Array<{
    itemId: string;
    itemName: string;
    currentStock: number;
    recommendedOrderQuantity: number;
    reorderPoint: number;
    safetyStock: number;
    maxStock: number;
    daysOfSupply: number;
    stockoutRisk: number; // 0-100
    excessStockRisk: number; // 0-100
    recommendedAction: 'ORDER_NOW' | 'SCHEDULE_ORDER' | 'REDUCE_STOCK' | 'MONITOR' | 'DISCONTINUE';
    estimatedAnnualSavings: number;
    confidence: number;
  }>;
  totalOptimizedValue: number;
  totalSavingsPotential: number;
  stockoutRiskItems: number;
  excessStockItems: number;
  overallHealthScore: number; // 0-100
  recommendationsSummary: string;
}

export class InventoryOptimizationService {
  
  /**
   * Optimize inventory levels across all items
   */
  async optimizeInventory(features: InventoryFeatures): Promise<InventoryOptimizationResult> {
    try {
      const recommendations = [];
      let totalOptimizedValue = 0;
      let totalSavingsPotential = 0;
      let stockoutRiskItems = 0;
      let excessStockItems = 0;
      
      for (const item of features.items) {
        const recommendation = await this.optimizeSingleItem(item, features);
        recommendations.push(recommendation);
        
        totalOptimizedValue += item.currentStock * item.unitCost;
        totalSavingsPotential += recommendation.estimatedAnnualSavings;
        
        if (recommendation.stockoutRisk > 70) stockoutRiskItems++;
        if (recommendation.excessStockRisk > 70) excessStockItems++;
      }
      
      // Sort by priority (stockout risk first, then savings)
      recommendations.sort((a, b) => {
        if (a.stockoutRisk !== b.stockoutRisk) return b.stockoutRisk - a.stockoutRisk;
        return b.estimatedAnnualSavings - a.estimatedAnnualSavings;
      });
      
      const overallHealthScore = this.calculateHealthScore(recommendations);
      const summary = this.generateSummary(recommendations, stockoutRiskItems, excessStockItems);
      
      return {
        businessId: features.businessId,
        recommendations,
        totalOptimizedValue: Math.round(totalOptimizedValue * 100) / 100,
        totalSavingsPotential: Math.round(totalSavingsPotential * 100) / 100,
        stockoutRiskItems,
        excessStockItems,
        overallHealthScore,
        recommendationsSummary: summary
      };
    } catch (error) {
      logger.error('Error in inventory optimization', error);
      return this.fallbackResult(features.businessId);
    }
  }

  /**
   * Get ABC analysis for inventory categorization
   */
  async getABCAnalysis(businessId: string): Promise<Array<{
    itemId: string;
    itemName: string;
    annualConsumptionValue: number;
    percentageOfTotal: number;
    cumulativePercentage: number;
    category: 'A' | 'B' | 'C';
    recommendedPolicy: string;
  }>> {
    const items = await this.getInventoryItems(businessId);
    
    // Calculate annual consumption value
    const itemsWithValue = items.map(item => ({
      ...item,
      annualConsumptionValue: item.dailyDemand.reduce((a, b) => a + b, 0) / item.dailyDemand.length * 365 * item.unitCost
    }));
    
    // Sort by value descending
    itemsWithValue.sort((a, b) => b.annualConsumptionValue - a.annualConsumptionValue);
    
    const totalValue = itemsWithValue.reduce((sum, item) => sum + item.annualConsumptionValue, 0);
    
    let cumulative = 0;
    return itemsWithValue.map((item, index) => {
      cumulative += item.annualConsumptionValue;
      const percentage = (item.annualConsumptionValue / totalValue) * 100;
      const cumulativePercentage = (cumulative / totalValue) * 100;
      
      let category: 'A' | 'B' | 'C';
      if (cumulativePercentage <= 80) category = 'A';
      else if (cumulativePercentage <= 95) category = 'B';
      else category = 'C';
      
      const policy = this.getPolicyForCategory(category);
      
      return {
        itemId: item.itemId,
        itemName: item.name,
        annualConsumptionValue: Math.round(item.annualConsumptionValue * 100) / 100,
        percentageOfTotal: Math.round(percentage * 100) / 100,
        cumulativePercentage: Math.round(cumulativePercentage * 100) / 100,
        category,
        recommendedPolicy: policy
      };
    });
  }

  /**
   * Calculate Economic Order Quantity (EOQ) for each item
   */
  async calculateEOQ(businessId: string): Promise<Array<{
    itemId: string;
    itemName: string;
    eoq: number;
    annualDemand: number;
    orderingCost: number;
    holdingCost: number;
    ordersPerYear: number;
    cycleDays: number;
    totalAnnualCost: number;
  }>> {
    const items = await this.getInventoryItems(businessId);
    const orderingCost = 50; // Default ordering cost
    const holdingCostRate = 0.25; // 25% per year
    
    return items.map(item => {
      const avgDailyDemand = item.dailyDemand.reduce((a, b) => a + b, 0) / Math.max(1, item.dailyDemand.length);
      const annualDemand = avgDailyDemand * 365;
      const holdingCost = item.unitCost * holdingCostRate;
      
      // EOQ = sqrt(2 * D * S / H)
      const eoq = Math.sqrt(2 * annualDemand * orderingCost / holdingCost);
      const ordersPerYear = annualDemand / eoq;
      const cycleDays = 365 / ordersPerYear;
      const totalCost = (annualDemand / eoq) * orderingCost + (eoq / 2) * holdingCost;
      
      return {
        itemId: item.itemId,
        itemName: item.name,
        eoq: Math.round(eoq),
        annualDemand: Math.round(annualDemand),
        orderingCost: Math.round(orderingCost * 100) / 100,
        holdingCost: Math.round(holdingCost * 100) / 100,
        ordersPerYear: Math.round(ordersPerYear * 10) / 10,
        cycleDays: Math.round(cycleDays * 10) / 10,
        totalAnnualCost: Math.round(totalCost * 100) / 100
      };
    });
  }

  // ── Private Methods ──

  private async optimizeSingleItem(
    item: InventoryFeatures['items'][0], 
    features: InventoryFeatures
  ): Promise<InventoryOptimizationResult['recommendations'][0]> {
    
    // Calculate average daily demand
    const avgDailyDemand = item.dailyDemand.length > 0
      ? item.dailyDemand.reduce((a, b) => a + b, 0) / item.dailyDemand.length
      : 1;
    
    // Calculate demand variability
    const demandStdDev = this.calculateStdDev(item.dailyDemand);
    const coefficientOfVariation = avgDailyDemand > 0 ? demandStdDev / avgDailyDemand : 0;
    
    // Safety stock calculation
    // SS = Z * σ * sqrt(L) where Z = service level factor, σ = std dev, L = lead time
    const serviceLevel = features.serviceLevelTarget || 0.95;
    const zScore = this.getZScore(serviceLevel);
    const safetyStock = Math.ceil(zScore * demandStdDev * Math.sqrt(item.leadTimeDays));
    
    // Reorder point = Average demand during lead time + Safety stock
    const avgDemandDuringLeadTime = avgDailyDemand * item.leadTimeDays;
    const reorderPoint = Math.ceil(avgDemandDuringLeadTime + safetyStock);
    
    // EOQ calculation
    const annualDemand = avgDailyDemand * 365;
    const orderingCost = 50; // Fixed cost per order
    const holdingCost = item.unitCost * 0.25; // 25% annual holding cost
    const eoq = Math.sqrt(2 * annualDemand * 50 / (item.unitCost * 0.25));
    
    // Adjust for minimum order quantity
    const minOrderQty = item.minOrderQuantity || 1;
    const recommendedOrderQuantity = Math.max(Math.ceil(eoq), minOrderQty);
    
    // Maximum stock level
    const maxStock = reorderPoint + recommendedOrderQuantity;
    
    // Current days of supply
    const daysOfSupply = item.currentStock > 0 ? item.currentStock / avgDailyDemand : 0;
    
    // Risk assessments
    const stockoutRisk = this.calculateStockoutRisk(item, avgDailyDemand, reorderPoint);
    const excessStockRisk = this.calculateExcessStockRisk(item, avgDailyDemand, maxStock);
    
    // Determine action
    let recommendedAction: 'ORDER_NOW' | 'SCHEDULE_ORDER' | 'REDUCE_STOCK' | 'MONITOR' | 'DISCONTINUE' = 'MONITOR';
    
    if (item.currentStock <= reorderPoint) {
      recommendedAction = 'ORDER_NOW';
    } else if (item.currentStock <= reorderPoint * 1.2) {
      recommendedAction = 'SCHEDULE_ORDER';
    } else if (daysOfSupply > 90 && excessStockRisk > 50) {
      recommendedAction = 'REDUCE_STOCK';
    } else if (item.dailyDemand.reduce((a, b) => a + b, 0) === 0) {
      recommendedAction = 'DISCONTINUE';
    }
    
    // Estimated savings
    const estimatedAnnualSavings = this.calculateSavings(
      item, 
      recommendedOrderQuantity, 
      reorderPoint, 
      maxStock
    );
    
    return {
      itemId: item.itemId,
      itemName: item.name,
      currentStock: item.currentStock,
      recommendedOrderQuantity,
      reorderPoint,
      safetyStock,
      maxStock,
      daysOfSupply: Math.round(daysOfSupply * 10) / 10,
      stockoutRisk: Math.round(stockoutRisk),
      excessStockRisk: Math.round(excessStockRisk),
      recommendedAction,
      estimatedAnnualSavings: Math.round(estimatedAnnualSavings * 100) / 100,
      confidence: this.calculateItemConfidence(item)
    };
  }

  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private getZScore(serviceLevel: number): number {
    // Z-scores for common service levels
    const zScores: Record<number, number> = {
      0.90: 1.28,
      0.95: 1.65,
      0.97: 1.88,
      0.99: 2.33,
      0.995: 2.58
    };
    return zScores[serviceLevel] || 1.65;
  }

  private calculateStockoutRisk(
    item: InventoryFeatures['items'][0], 
    avgDailyDemand: number, 
    reorderPoint: number
  ): number {
    if (item.currentStock <= 0) return 100;
    if (item.currentStock >= reorderPoint * 2) return 5;
    
    const daysUntilStockout = item.currentStock / Math.max(1, avgDailyDemand);
    const daysUntilReorder = (item.currentStock - reorderPoint) / Math.max(1, avgDailyDemand);
    
    if (daysUntilReorder <= 0) return 90;
    if (daysUntilReorder <= 2) return 70;
    if (daysUntilReorder <= 5) return 40;
    if (daysUntilReorder <= 10) return 20;
    return 10;
  }

  private calculateExcessStockRisk(
    item: InventoryFeatures['items'][0], 
    avgDailyDemand: number, 
    maxStock: number
  ): number {
    const daysOfSupply = item.currentStock / Math.max(1, avgDailyDemand);
    
    // Check shelf life
    if (item.shelfLifeDays && daysOfSupply > item.shelfLifeDays * 0.8) {
      return 90;
    }
    
    if (daysOfSupply > 180) return 80;
    if (daysOfSupply > 120) return 60;
    if (daysOfSupply > 90) return 40;
    if (daysOfSupply > 60) return 20;
    return 5;
  }

  private calculateSavings(
    item: InventoryFeatures['items'][0],
    orderQty: number,
    reorderPoint: number,
    maxStock: number
  ): number {
    const currentHoldingCost = item.currentStock * item.unitCost * 0.25;
    const optimizedAvgStock = (maxStock + reorderPoint) / 2;
    const optimizedHoldingCost = optimizedAvgStock * item.unitCost * 0.25;
    
    // Annual ordering cost savings
    const currentOrdersPerYear = (item.dailyDemand.reduce((a, b) => a + b, 0) / 
      Math.max(1, item.dailyDemand.length)) * 365 / Math.max(1, item.currentStock);
    const optimizedOrdersPerYear = (item.dailyDemand.reduce((a, b) => a + b, 0) / 
      Math.max(1, item.dailyDemand.length)) * 365 / orderQty;
    
    const orderingCostSavings = (currentOrdersPerYear - optimizedOrdersPerYear) * 50;
    const holdingCostSavings = currentHoldingCost - optimizedHoldingCost;
    
    // Stockout cost avoidance (estimated)
    const stockoutCostAvoidance = 0; // Would need lost sales data
    
    return Math.max(0, orderingCostSavings + holdingCostSavings + stockoutCostAvoidance);
  }

  private calculateItemConfidence(item: InventoryFeatures['items'][0]): number {
    let confidence = 40;
    
    // More demand history = higher confidence
    confidence += Math.min(30, item.dailyDemand.length * 0.3);
    
    // Stable demand = higher confidence
    if (item.dailyDemand.length > 10) {
      const cv = this.getCV(item.dailyDemand);
      if (cv < 0.3) confidence += 15;
      else if (cv < 0.5) confidence += 10;
    }
    
    // Known lead time
    if (item.leadTimeDays > 0) confidence += 10;
    
    // Known shelf life
    if (item.shelfLifeDays) confidence += 5;
    
    return Math.min(95, Math.max(30, confidence));
  }

  private getCV(values: number[]): number {
    if (values.length < 2) return 1;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 1;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  private calculateHealthScore(recommendations: InventoryOptimizationResult['recommendations']): number {
    if (recommendations.length === 0) return 50;
    
    const avgStockoutRisk = recommendations.reduce((sum, r) => sum + r.stockoutRisk, 0) / recommendations.length;
    const avgExcessRisk = recommendations.reduce((sum, r) => sum + r.excessStockRisk, 0) / recommendations.length;
    
    let score = 100;
    score -= avgStockoutRisk * 0.5;
    score -= avgExcessRisk * 0.3;
    
    return Math.max(0, Math.round(score));
  }

  private generateSummary(
    recommendations: InventoryOptimizationResult['recommendations'],
    stockoutItems: number,
    excessItems: number
  ): string {
    const totalItems = recommendations.length;
    const orderNow = recommendations.filter(r => r.recommendedAction === 'ORDER_NOW').length;
    const scheduleOrder = recommendations.filter(r => r.recommendedAction === 'SCHEDULE_ORDER').length;
    const reduceStock = recommendations.filter(r => r.recommendedAction === 'REDUCE_STOCK').length;
    const discontinue = recommendations.filter(r => r.recommendedAction === 'DISCONTINUE').length;
    
    let summary = `Inventory Health Check Complete: ${totalItems} items analyzed. `;
    
    if (orderNow > 0) {
      summary += `${orderNow} items need immediate ordering. `;
    }
    if (scheduleOrder > 0) {
      summary += `${scheduleOrder} items need scheduling. `;
    }
    if (reduceStock > 0) {
      summary += `${reduceStock} items have excess stock - consider reduction. `;
    }
    if (discontinue > 0) {
      summary += `${discontinue} items have zero demand - consider discontinuation. `;
    }
    if (stockoutItems > 0) {
      summary += `⚠️ ${stockoutItems} items at high stockout risk. `;
    }
    if (excessItems > 0) {
      summary += `⚠️ ${excessItems} items with excess inventory. `;
    }
    
    return summary;
  }

  private getPolicyForCategory(category: 'A' | 'B' | 'C'): string {
    switch (category) {
      case 'A': return 'Tight control, weekly review, safety stock optimization, dedicated supplier management';
      case 'B': return 'Moderate control, bi-weekly review, standard EOQ, standard safety stock';
      case 'C': return 'Loose control, monthly review, simple reorder points, minimal safety stock';
      default: return 'Standard review';
    }
  }

  private async getInventoryItems(businessId: string): Promise<InventoryFeatures['items']> {
    // Would fetch from database
    // For now, return mock data structure
    return [];
  }

  private fallbackResult(businessId: string): InventoryOptimizationResult {
    return {
      businessId,
      recommendations: [],
      totalOptimizedValue: 0,
      totalSavingsPotential: 0,
      stockoutRiskItems: 0,
      excessStockItems: 0,
      overallHealthScore: 50,
      recommendationsSummary: 'Insufficient data for inventory optimization'
    };
  }
}

export const inventoryOptimizationService = new InventoryOptimizationService();