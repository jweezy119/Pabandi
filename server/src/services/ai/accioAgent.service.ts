import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';
import { dashscopeService } from './dashscope.service';

export interface AccioSourcingItem {
  itemName: string;
  quantity: number;
  estimatedPricePKR: number;
  accioUrl: string;
}

export class AccioAgentService {
  /**
   * Analyze upcoming reservations for a business to detect supply needs.
   */
  async analyzeUpcomingDemand(businessId: string) {
    try {
      const business = await prisma.business.findUnique({ where: { id: businessId } });
      if (!business) throw new Error('Business not found');

      // Fetch upcoming reservations in the next 7 days
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const upcomingReservations = await prisma.reservation.findMany({
        where: {
          businessId,
          reservationDate: {
            gte: new Date(),
            lte: nextWeek,
          },
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
      });

      const totalGuests = upcomingReservations.reduce((sum, res) => sum + res.numberOfGuests, 0);

      // Determine mock supply needs based on category and total guests
      const needs: AccioSourcingItem[] = [];

      if (business.category === 'RESTAURANT') {
        if (totalGuests > 50) {
          needs.push({
            itemName: 'Premium Bulk Napkins (1000 pcs)',
            quantity: Math.ceil(totalGuests / 50),
            estimatedPricePKR: 1500,
            accioUrl: 'https://www.alibaba.com/trade/search?SearchText=bulk+napkins',
          });
          needs.push({
            itemName: 'Wholesale Cooking Oil (10 Liters)',
            quantity: Math.ceil(totalGuests / 100),
            estimatedPricePKR: 4500,
            accioUrl: 'https://www.alibaba.com/trade/search?SearchText=wholesale+cooking+oil',
          });
        }
      } else if (business.category === 'SALON' || business.category === 'SPA') {
        if (totalGuests > 20) {
          needs.push({
            itemName: 'Professional Shampoo Bulk (5 Gallons)',
            quantity: Math.ceil(totalGuests / 40),
            estimatedPricePKR: 6000,
            accioUrl: 'https://www.alibaba.com/trade/search?SearchText=professional+shampoo+gallon',
          });
          needs.push({
            itemName: 'Disposable Salon Towels (500 pcs)',
            quantity: Math.ceil(totalGuests / 20),
            estimatedPricePKR: 3200,
            accioUrl: 'https://www.alibaba.com/trade/search?SearchText=disposable+salon+towels',
          });
        }
      } else {
        // Generic supplies
        if (totalGuests > 30) {
          needs.push({
            itemName: 'Wholesale Hand Sanitizer (5 Liters)',
            quantity: Math.ceil(totalGuests / 50),
            estimatedPricePKR: 2000,
            accioUrl: 'https://www.alibaba.com/trade/search?SearchText=bulk+hand+sanitizer',
          });
        }
      }

      return {
        totalGuestsPredicted: totalGuests,
        needs,
      };
    } catch (error) {
      logger.error('Accio Agent Analysis Error', error);
      throw error;
    }
  }

  /**
   * Draft a sourcing order using Accio Work.
   */
  async draftSourcingOrder(businessId: string, needs: AccioSourcingItem[]) {
    if (!needs.length) return null;

    const totalCost = needs.reduce((sum, item) => sum + (item.quantity * item.estimatedPricePKR), 0);

    const order = await prisma.sourcingOrder.create({
      data: {
        businessId,
        items: needs as any,
        estimatedCostPKR: totalCost,
        status: 'SUGGESTED',
      },
    });

    return order;
  }

  /**
   * Confirm the order via Accio Work (Mock API).
   */
  async confirmOrder(orderId: string) {
    const order = await prisma.sourcingOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');

    // Simulate API call to Alibaba Accio Work Agent
    const mockAccioWorkOrderId = `AW-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const updated = await prisma.sourcingOrder.update({
      where: { id: orderId },
      data: {
        status: 'ORDERED',
        accioWorkOrderId: mockAccioWorkOrderId,
      },
    });

    return updated;
  }
  /**
   * Trend-to-Service: Analyze local trends to suggest new profitable equipment/services.
   */
  async discoverTrends(businessId: string) {
    try {
      const business = await prisma.business.findUnique({ where: { id: businessId } });
      if (!business) throw new Error('Business not found');

      // Default mock suggestions if AI is disabled or fails
      let equipmentName = 'General POS Kiosk';
      let description = 'Self-service kiosk to speed up ordering and payments.';
      let cost = 85000;
      let servicePrice = 0;
      let bookings = 150;
      let url = 'https://www.alibaba.com/trade/search?SearchText=self+service+kiosk';
      let projectedRoiPercent = ((bookings * servicePrice) / cost) * 100;

      if (business.category === 'SALON' || business.category === 'SPA') {
        equipmentName = 'Professional LED Therapy Bed';
        description = 'High-demand red light therapy bed. Proven to increase customer retention and session value.';
        cost = 450000;
        servicePrice = 5000;
        bookings = 120;
        url = 'https://www.alibaba.com/trade/search?SearchText=led+light+therapy+bed';
      } else if (business.category === 'RESTAURANT') {
        equipmentName = 'Commercial Espresso Machine';
        description = 'Premium dual-boiler espresso machine to capture high-margin coffee sales.';
        cost = 320000;
        servicePrice = 800;
        bookings = 500;
        url = 'https://www.alibaba.com/trade/search?SearchText=commercial+espresso+machine';
      }

      const apiKey = process.env.DASHSCOPE_API_KEY;
      if (apiKey && apiKey !== 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
        try {
          logger.info(`[Accio Sourcing Opportunities] Requesting Qwen AI suggestion for business: ${businessId}`);
          const systemPrompt = 'You are an AI business growth advisor for a premium booking platform globally. You must suggest high-margin, trending equipment/services that the business can source on Alibaba to grow their sales. Only output a valid JSON object matching the requested schema.';
          const userPrompt = `
            Analyze this business profile and suggest one specific profitable trending equipment or tech item they can source on Alibaba to expand their services:
            Business Name: ${business.name}
            Category: ${business.category}
            Description: ${business.description || 'A service business.'}
            City: ${business.city || 'Karachi'}
            
            Return ONLY a valid JSON object with the following schema:
            {
              "equipmentName": "Name of the equipment or technology",
              "description": "2-sentence compelling description of why this is a high-growth trend for this business",
              "estimatedCostPKR": <number representing local equipment purchase cost, between 50000 and 1000000>,
              "suggestedServicePrice": <number representing fee charged per session/order in PKR, between 300 and 10000>,
              "projectedBookings": <estimated number of monthly bookings/sales for this service, between 30 and 300>,
              "projectedRoiPercent": <ROI percentage value, between 10 and 200>
            }
          `;

          const aiResponse = await dashscopeService.generateText(systemPrompt, userPrompt);
          const cleaned = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
          const aiResult = JSON.parse(cleaned);

          if (aiResult.equipmentName && aiResult.description) {
            equipmentName = aiResult.equipmentName;
            description = aiResult.description;
            cost = Number(aiResult.estimatedCostPKR) || cost;
            servicePrice = Number(aiResult.suggestedServicePrice) || servicePrice;
            bookings = Number(aiResult.projectedBookings) || bookings;
            projectedRoiPercent = Number(aiResult.projectedRoiPercent) || projectedRoiPercent;
            url = `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(equipmentName)}`;
          }
        } catch (apiError: any) {
          logger.error(`[DashScope Sourcing Opportunity] AI Sourcing suggestion failed, falling back to heuristics: ${apiError.message}`);
        }
      }

      projectedRoiPercent = servicePrice > 0 ? ((bookings * servicePrice) / cost) * 100 : projectedRoiPercent;

      // Check if it already exists
      const existing = await prisma.trendSuggestion.findFirst({
        where: { businessId, equipmentName }
      });

      if (existing) return [existing];

      const suggestion = await prisma.trendSuggestion.create({
        data: {
          businessId,
          equipmentName,
          description,
          estimatedCostPKR: cost,
          suggestedServicePrice: servicePrice,
          projectedBookings: bookings,
          projectedRoiPercent: parseFloat(projectedRoiPercent.toFixed(2)),
          status: 'SUGGESTED',
          accioWorkUrl: url,
        }
      });

      return [suggestion];
    } catch (error) {
      logger.error('Accio Agent Trend Error', error);
      throw error;
    }
  }

  /**
   * One-click Launch Service from a Trend.
   */
  async launchTrendService(trendId: string) {
    const trend = await prisma.trendSuggestion.findUnique({ where: { id: trendId } });
    if (!trend) throw new Error('Trend not found');

    const updated = await prisma.trendSuggestion.update({
      where: { id: trendId },
      data: { status: 'SERVICE_LAUNCHED' },
    });

    return updated;
  }
}

export const accioAgentService = new AccioAgentService();
