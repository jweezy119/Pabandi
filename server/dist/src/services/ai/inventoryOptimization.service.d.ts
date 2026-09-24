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
        dailyDemand: number[];
        seasonalityFactor?: number;
        shelfLifeDays?: number;
        minOrderQuantity?: number;
        supplierReliability?: number;
        criticality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }>;
    warehouseCapacity?: {
        maxCapacity: number;
        currentUtilization: number;
        costPerUnitStorage: number;
    };
    serviceLevelTarget?: number;
    demandForecastHorizon?: number;
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
        stockoutRisk: number;
        excessStockRisk: number;
        recommendedAction: 'ORDER_NOW' | 'SCHEDULE_ORDER' | 'REDUCE_STOCK' | 'MONITOR' | 'DISCONTINUE';
        estimatedAnnualSavings: number;
        confidence: number;
    }>;
    totalOptimizedValue: number;
    totalSavingsPotential: number;
    stockoutRiskItems: number;
    excessStockItems: number;
    overallHealthScore: number;
    recommendationsSummary: string;
}
export declare class InventoryOptimizationService {
    /**
     * Optimize inventory levels across all items
     */
    optimizeInventory(features: InventoryFeatures): Promise<InventoryOptimizationResult>;
    /**
     * Get ABC analysis for inventory categorization
     */
    getABCAnalysis(businessId: string): Promise<Array<{
        itemId: string;
        itemName: string;
        annualConsumptionValue: number;
        percentageOfTotal: number;
        cumulativePercentage: number;
        category: 'A' | 'B' | 'C';
        recommendedPolicy: string;
    }>>;
    /**
     * Calculate Economic Order Quantity (EOQ) for each item
     */
    calculateEOQ(businessId: string): Promise<Array<{
        itemId: string;
        itemName: string;
        eoq: number;
        annualDemand: number;
        orderingCost: number;
        holdingCost: number;
        ordersPerYear: number;
        cycleDays: number;
        totalAnnualCost: number;
    }>>;
    private optimizeSingleItem;
    private calculateStdDev;
    private getZScore;
    private calculateStockoutRisk;
    private calculateExcessStockRisk;
    private calculateSavings;
    private calculateItemConfidence;
    private getCV;
    private calculateHealthScore;
    private generateSummary;
    private getPolicyForCategory;
    private getInventoryItems;
    private fallbackResult;
}
export declare const inventoryOptimizationService: InventoryOptimizationService;
//# sourceMappingURL=inventoryOptimization.service.d.ts.map