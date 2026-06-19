import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';

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

      // Generate a mock suggestion based on business category
      let equipmentName = 'General POS Kiosk';
      let description = 'Self-service kiosk to speed up ordering and payments.';
      let cost = 85000;
      let servicePrice = 0;
      let bookings = 150;
      let url = 'https://www.alibaba.com/trade/search?SearchText=self+service+kiosk';

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

      const projectedRoiPercent = ((bookings * servicePrice) / cost) * 100;

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
