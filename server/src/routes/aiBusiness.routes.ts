import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { revenueForecastingService } from '../services/ai/revenueForecasting.service';
import { customerIntelligenceService } from '../services/ai/customerIntelligence.service';
import { pricingOptimizationService } from '../services/ai/pricingOptimization.service';
import { demandForecastingService } from '../services/ai/demandForecasting.service';
import { sentimentAnalysisService } from '../services/ai/sentimentAnalysis.service';
import { inventoryOptimizationService } from '../services/ai/inventoryOptimization.service';
import { logger } from '../utils/logger';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// REVENUE FORECASTING
// ═══════════════════════════════════════════════════════════════════════════

interface RevenueForecastInput {
  businessId: string;
  historicalData: Array<{
    date: string; // YYYY-MM-DD
    revenue: number;
    transactions?: number;
    customers?: number;
  }>;
  forecastHorizonMonths?: number; // default 12
  includeSeasonality?: boolean; // default true
  confidenceLevel?: number; // default 0.95
}

router.post('/revenue-forecast', authenticate, async (req: Request, res: Response) => {
  try {
    const input: RevenueForecastInput = req.body;
    if (!input.businessId || !input.historicalData || input.historicalData.length < 3) {
      return res.status(400).json({ success: false, error: 'businessId and at least 3 months of historicalData required' });
    }
    // Convert to service format
    const features = {
      businessId: input.businessId,
      category: 'general',
      historicalRevenue: input.historicalData.map(d => d.revenue),
      historicalOrders: input.historicalData.map(d => d.transactions || 0),
    };
    const result = await revenueForecastingService.forecast(features);
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error('Revenue forecast error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════

interface CustomerIntelligenceInput {
  businessId: string;
  customers: Array<{
    customerId: string;
    firstOrderDate: string;
    lastOrderDate: string;
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    daysSinceLastOrder: number;
    emailOpens?: number;
    emailClicks?: number;
    supportTickets?: number;
    referrals?: number;
  }>;
}

router.post('/customer-intelligence', authenticate, async (req: Request, res: Response) => {
  try {
    const input: CustomerIntelligenceInput = req.body;
    if (!input.businessId || !input.customers || input.customers.length === 0) {
      return res.status(400).json({ success: false, error: 'businessId and customers array required' });
    }
    
    const results = [];
    for (const customer of input.customers) {
      const features = {
        customerId: customer.customerId,
        businessId: input.businessId,
        firstOrderDate: new Date(customer.firstOrderDate),
        lastOrderDate: new Date(customer.lastOrderDate),
        totalOrders: customer.totalOrders,
        totalRevenue: customer.totalRevenue,
        averageOrderValue: customer.averageOrderValue,
        orderFrequency: customer.totalOrders / Math.max(1, (new Date(customer.lastOrderDate).getTime() - new Date(customer.firstOrderDate).getTime()) / (1000 * 60 * 60 * 24 * 30)),
        daysSinceLastOrder: customer.daysSinceLastOrder,
        cancellationRate: 0,
        noShowRate: 0,
      };
      const clv = await customerIntelligenceService.predictCLV(features);
      const churn = await customerIntelligenceService.predictChurn(features);
      results.push({ clv, churn });
    }
    
    res.json({ success: true, data: { customers: results } });
  } catch (e: any) {
    logger.error('Customer intelligence error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PRICING OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════════════

interface PricingOptimizationInput {
  businessId: string;
  products: Array<{
    productId: string;
    name: string;
    currentPrice: number;
    cost: number;
    monthlyVolume: number;
    priceHistory: Array<{ price: number; volume: number; date: string }>;
    competitorPrices?: number[];
    category: string;
    elasticity?: number; // if known
  }>;
  objective?: 'maximize_revenue' | 'maximize_profit' | 'maximize_volume' | 'maintain_share';
  constraints?: {
    minMargin?: number;
    maxPriceChange?: number; // percentage
    minPrice?: number;
    maxPrice?: number;
  };
}

router.post('/pricing-optimization', authenticate, async (req: Request, res: Response) => {
  try {
    const input: PricingOptimizationInput = req.body;
    if (!input.businessId || !input.products || input.products.length === 0) {
      return res.status(400).json({ success: false, error: 'businessId and products array required' });
    }
    
    const results = [];
    for (const product of input.products) {
      const features = {
        businessId: input.businessId,
        category: product.category,
        serviceId: product.productId,
        currentPrice: product.currentPrice,
        cost: product.cost,
        historicalDemand: product.priceHistory.map(p => p.volume),
        historicalPrices: product.priceHistory.map(p => p.price),
        competitorPrices: product.competitorPrices,
        elasticity: product.elasticity,
        seasonalityFactors: {},
        customerSegments: [],
      };
      const result = await pricingOptimizationService.optimizePrice(features);
      results.push({ productId: product.productId, name: product.name, ...result });
    }
    
    res.json({ success: true, data: { recommendations: results } });
  } catch (e: any) {
    logger.error('Pricing optimization error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DEMAND FORECASTING
// ═══════════════════════════════════════════════════════════════════════════

interface DemandForecastInput {
  businessId: string;
  items: Array<{
    itemId: string;
    name: string;
    category: string;
    dailyDemand: number[]; // last 30-90 days
    leadTimeDays: number;
    currentStock: number;
    unitCost: number;
    sellingPrice: number;
    seasonalityPattern?: 'none' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    promotions?: Array<{ date: string; lift: number }>;
  }>;
  forecastHorizonDays?: number; // default 30
  serviceLevel?: number; // default 0.95
}

router.post('/demand-forecast', authenticate, async (req: Request, res: Response) => {
  try {
    const input: DemandForecastInput = req.body;
    if (!input.businessId || !input.items || input.items.length === 0) {
      return res.status(400).json({ success: false, error: 'businessId and items array required' });
    }
    
    // Convert to service format
    const historicalDemand = input.items.flatMap(item => item.dailyDemand);
    const historicalDates = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - historicalDemand.length);
    for (let i = 0; i < historicalDemand.length; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      historicalDates.push(d);
    }
    
    const features = {
      businessId: input.businessId,
      category: input.items[0]?.category || 'general',
      historicalDemand,
      historicalDates,
      seasonality: 1.0,
      trend: 1.0,
      leadTimeDays: input.items[0]?.leadTimeDays || 7,
    };
    
    const forecast = await demandForecastingService.forecast(features);
    
    // Add per-item details
    const itemResults = input.items.map(item => {
      const avgDailyDemand = item.dailyDemand.reduce((a, b) => a + b, 0) / Math.max(1, item.dailyDemand.length);
      const predictedDemand = Math.round(avgDailyDemand * (input.forecastHorizonDays || 30));
      const reorderPoint = Math.ceil(avgDailyDemand * item.leadTimeDays * 1.5);
      
      return {
        itemId: item.itemId,
        name: item.name,
        currentStock: item.currentStock,
        avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
        predictedDemand,
        reorderPoint,
        needsReorder: item.currentStock < reorderPoint,
        daysOfSupply: item.currentStock > 0 ? Math.round(item.currentStock / avgDailyDemand * 10) / 10 : 0,
      };
    });
    
    res.json({ 
      success: true, 
      data: { 
        forecast,
        items: itemResults 
      } 
    });
  } catch (e: any) {
    logger.error('Demand forecast error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SENTIMENT ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

interface SentimentAnalysisInput {
  businessId: string;
  sources: {
    reviews?: Array<{ source: string; text: string; rating?: number; date: string }>;
    socialMedia?: Array<{ platform: string; text: string; engagement?: number; date: string }>;
    surveys?: Array<{ question: string; response: string; score?: number; date: string }>;
    supportTickets?: Array<{ subject: string; body: string; priority: string; date: string }>;
  };
  competitorNames?: string[];
  industry?: string;
}

router.post('/sentiment-analysis', authenticate, async (req: Request, res: Response) => {
  try {
    const input: SentimentAnalysisInput = req.body;
    if (!input.businessId || (!input.sources?.reviews?.length && !input.sources?.socialMedia?.length && !input.sources?.surveys?.length && !input.sources?.supportTickets?.length)) {
      return res.status(400).json({ success: false, error: 'businessId and at least one data source required' });
    }
    
    // Convert to service format
    const allTexts = [
      ...(input.sources.reviews || []).map(r => ({ text: r.text, weight: r.rating ? r.rating / 5 : 1 })),
      ...(input.sources.socialMedia || []).map(s => ({ text: s.text, weight: s.engagement ? Math.min(2, s.engagement / 100) : 1 })),
      ...(input.sources.surveys || []).map(s => ({ text: s.response, weight: 1 })),
      ...(input.sources.supportTickets || []).map(t => ({ text: t.body, weight: 1 })),
    ];
    
    const features = {
      businessId: input.businessId,
      texts: allTexts,
      competitorNames: input.competitorNames,
      industry: input.industry,
    };
    
    const result = await sentimentAnalysisService.analyzeSentiment(features);
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error('Sentiment analysis error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// INVENTORY OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════════════

interface InventoryOptimizationInput {
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

router.post('/inventory-optimization', authenticate, async (req: Request, res: Response) => {
  try {
    const input: InventoryOptimizationInput = req.body;
    if (!input.businessId || !input.items || input.items.length === 0) {
      return res.status(400).json({ success: false, error: 'businessId and items array required' });
    }
    const result = await inventoryOptimizationService.optimizeInventory(input);
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error('Inventory optimization error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ABC Analysis
router.post('/inventory-optimization/abc', authenticate, async (req: Request, res: Response) => {
  try {
    const { businessId } = req.body;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'businessId required' });
    }
    const result = await inventoryOptimizationService.getABCAnalysis(businessId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error('ABC analysis error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// EOQ Calculation
router.post('/inventory-optimization/eoq', authenticate, async (req: Request, res: Response) => {
  try {
    const { businessId } = req.body;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'businessId required' });
    }
    const result = await inventoryOptimizationService.calculateEOQ(businessId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    logger.error('EOQ calculation error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

router.get('/health', async (req: Request, res: Response) => {
  res.json({ 
    success: true, 
    service: 'ai-business',
    endpoints: [
      'POST /revenue-forecast',
      'POST /customer-intelligence',
      'POST /pricing-optimization',
      'POST /demand-forecast',
      'POST /sentiment-analysis',
      'POST /inventory-optimization',
      'POST /inventory-optimization/abc',
      'POST /inventory-optimization/eoq'
    ]
  });
});

export default router;