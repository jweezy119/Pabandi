"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const revenueForecasting_service_1 = require("../services/ai/revenueForecasting.service");
const customerIntelligence_service_1 = require("../services/ai/customerIntelligence.service");
const pricingOptimization_service_1 = require("../services/ai/pricingOptimization.service");
const demandForecasting_service_1 = require("../services/ai/demandForecasting.service");
const sentimentAnalysis_service_1 = require("../services/ai/sentimentAnalysis.service");
const inventoryOptimization_service_1 = require("../services/ai/inventoryOptimization.service");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.post('/revenue-forecast', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const input = req.body;
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
        const result = await revenueForecasting_service_1.revenueForecastingService.forecast(features);
        res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('Revenue forecast error', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/customer-intelligence', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const input = req.body;
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
            const clv = await customerIntelligence_service_1.customerIntelligenceService.predictCLV(features);
            const churn = await customerIntelligence_service_1.customerIntelligenceService.predictChurn(features);
            results.push({ clv, churn });
        }
        res.json({ success: true, data: { customers: results } });
    }
    catch (e) {
        logger_1.logger.error('Customer intelligence error', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/pricing-optimization', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const input = req.body;
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
            const result = await pricingOptimization_service_1.pricingOptimizationService.optimizePrice(features);
            results.push({ productId: product.productId, name: product.name, ...result });
        }
        res.json({ success: true, data: { recommendations: results } });
    }
    catch (e) {
        logger_1.logger.error('Pricing optimization error', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/demand-forecast', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const input = req.body;
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
        const forecast = await demandForecasting_service_1.demandForecastingService.forecast(features);
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
    }
    catch (e) {
        logger_1.logger.error('Demand forecast error', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/sentiment-analysis', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const input = req.body;
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
        const result = await sentimentAnalysis_service_1.sentimentAnalysisService.analyzeSentiment(features);
        res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('Sentiment analysis error', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/inventory-optimization', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const input = req.body;
        if (!input.businessId || !input.items || input.items.length === 0) {
            return res.status(400).json({ success: false, error: 'businessId and items array required' });
        }
        const result = await inventoryOptimization_service_1.inventoryOptimizationService.optimizeInventory(input);
        res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('Inventory optimization error', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
// ABC Analysis
router.post('/inventory-optimization/abc', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { businessId } = req.body;
        if (!businessId) {
            return res.status(400).json({ success: false, error: 'businessId required' });
        }
        const result = await inventoryOptimization_service_1.inventoryOptimizationService.getABCAnalysis(businessId);
        res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('ABC analysis error', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
// EOQ Calculation
router.post('/inventory-optimization/eoq', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { businessId } = req.body;
        if (!businessId) {
            return res.status(400).json({ success: false, error: 'businessId required' });
        }
        const result = await inventoryOptimization_service_1.inventoryOptimizationService.calculateEOQ(businessId);
        res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('EOQ calculation error', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════
router.get('/health', async (req, res) => {
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
exports.default = router;
//# sourceMappingURL=aiBusiness.routes.js.map