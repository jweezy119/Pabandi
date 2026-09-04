import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const nightlifeService = {
  // ── Venue Management ─────────────────────────────────────────────────────
  
  async createVenue(data: any) {
    return prisma.nightlifeVenue.create({ data });
  },

  async listVenues(params?: { city?: string; type?: string; genre?: string }) {
    const where: any = { isActive: true };
    if (params?.city) where.city = params.city;
    if (params?.type) where.type = params.type;
    if (params?.genre) where.musicGenres = { has: params.genre };

    return prisma.nightlifeVenue.findMany({
      where,
      include: {
        bottlePackages: { where: { isActive: true } },
        coverCharges: { where: { isActive: true } },
        tableTypes: { where: { isActive: true } },
        events: { where: { date: { gte: new Date() } }, take: 5 },
      },
      orderBy: { rating: 'desc' },
    });
  },

  async getVenue(id: string) {
    return prisma.nightlifeVenue.findUnique({
      where: { id },
      include: {
        bottlePackages: { where: { isActive: true } },
        coverCharges: { where: { isActive: true } },
        tableTypes: { where: { isActive: true } },
        events: { where: { date: { gte: new Date() } } },
      },
    });
  },

  // ── Bottle Service ────────────────────────────────────────────────────────
  
  async createBottlePackage(data: any) {
    return prisma.bottlePackage.create({ data });
  },

  async getAvailableTables(venueId: string, date: string, guestCount: number) {
    const tableTypes = await prisma.tableType.findMany({
      where: { venueId, isActive: true, maxCapacity: { gte: guestCount } },
    });

    const existingReservations = await prisma.bottleReservation.findMany({
      where: {
        venueId,
        date: new Date(date),
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    });

    const dynamicMultiplier = await this.calculateDynamicPricing(venueId, date);
    const available = [];

    for (const table of tableTypes) {
      const reservedCount = existingReservations.filter((r: any) => r.tableTypeId === table.id).length;
      const totalCount = table.totalCount || 1;
      
      if (reservedCount < totalCount) {
        available.push({
          ...table,
          availableCount: totalCount - reservedCount,
          price: table.basePrice * dynamicMultiplier,
          minSpend: table.minSpend * dynamicMultiplier,
        });
      }
    }

    return available.sort((a, b) => a.price - b.price);
  },

  async createBottleReservation(data: any) {
    const table = await prisma.tableType.findUnique({ where: { id: data.tableTypeId } });
    const pkg = await prisma.bottlePackage.findUnique({ where: { id: data.bottlePackageId } });
    
    if (!table || !pkg) throw new Error('Invalid table or package');

    const dynamicMultiplier = await this.calculateDynamicPricing(data.venueId, data.date);
    const totalPrice = pkg.basePrice * dynamicMultiplier;

    return prisma.bottleReservation.create({
      data: {
        ...data,
        date: new Date(data.date),
        totalPrice,
        status: 'PENDING',
        confirmationCode: `BTL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      },
    });
  },

  // ── Dynamic Pricing Algorithm ─────────────────────────────────────────────
  
  async calculateDynamicPricing(venueId: string, date: string): Promise<number> {
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    
    let multiplier = 1.0;

    // Day of week multiplier
    const dayMultipliers: Record<number, number> = {
      0: 0.7, 1: 0.6, 2: 0.7, 3: 0.8, 4: 1.0, 5: 1.3, 6: 1.5,
    };
    multiplier *= dayMultipliers[dayOfWeek] || 1.0;

    // Check for events
    const events = await prisma.nightlifeEvent.findMany({
      where: {
        venueId,
        date: {
          gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          lt: new Date(targetDate.setHours(23, 59, 59, 999)),
        },
      },
    });

    if (events.length > 0) {
      const maxEventMultiplier = Math.max(...events.map((e: any) => e.coverChargeMultiplier || 1.0));
      multiplier *= maxEventMultiplier;
    }

    // Demand-based pricing
    const reservations = await prisma.bottleReservation.count({
      where: {
        venueId,
        date: {
          gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          lt: new Date(targetDate.setHours(23, 59, 59, 999)),
        },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    });

    const venue = await prisma.nightlifeVenue.findUnique({ where: { id: venueId } });
    if (venue && venue.capacity > 0) {
      const demandRatio = reservations / (venue.capacity * 0.3);
      if (demandRatio > 0.8) multiplier *= 1.3;
      else if (demandRatio > 0.5) multiplier *= 1.1;
    }

    // Seasonality
    const month = targetDate.getMonth();
    const seasonMultipliers = [1.0, 1.0, 1.1, 1.1, 1.2, 1.3, 1.3, 1.2, 1.1, 1.0, 1.1, 1.2];
    multiplier *= seasonMultipliers[month];

    return Math.round(multiplier * 100) / 100;
  },

  // ── Cover Charge ──────────────────────────────────────────────────────────
  
  async createCoverCharge(data: any) {
    return prisma.coverCharge.create({ data });
  },

  async getCoverCharge(venueId: string, params: any) {
    const targetDate = new Date(params.date);
    const dayOfWeek = targetDate.getDay();
    const hour = params.time ? parseInt(params.time.split(':')[0]) : new Date().getHours();

    const charges = await prisma.coverCharge.findMany({
      where: {
        venueId,
        isActive: true,
        daysOfWeek: { has: dayOfWeek },
      },
    });

    const validCharges = charges.filter((c: any) => {
      const start = parseInt(c.startTime.split(':')[0]);
      const end = parseInt(c.endTime.split(':')[0]);
      if (end < start) {
        return hour >= start || hour <= end;
      }
      return hour >= start && hour <= end;
    });

    let filtered = validCharges.filter((c: any) => !c.gender || c.gender === 'ALL' || c.gender === params.gender);

    if (params.isGuestList) {
      const guestListCharge = filtered.find((c: any) => c.guestListIncluded);
      if (guestListCharge) return { amount: 0, type: 'GUEST_LIST', name: guestListCharge.name };
    }

    if (params.isVIP) {
      const vipCharge = filtered.find((c: any) => c.type === 'VIP');
      if (vipCharge) return { amount: vipCharge.amount, type: 'VIP', name: vipCharge.name };
    }

    const generalCharge = filtered.find((c: any) => c.type === 'GENERAL');
    return generalCharge ? { amount: generalCharge.amount, type: 'GENERAL', name: generalCharge.name } : null;
  },

  // ── Guest List ────────────────────────────────────────────────────────────
  
  async addToGuestList(data: any) {
    const noShowProbability = await this.predictNoShow(data.userId, data.venueId);

    return prisma.guestList.create({
      data: {
        ...data,
        date: new Date(data.date),
        status: 'CONFIRMED',
        noShowProbability,
        confirmationCode: `GL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      },
    });
  },

  async predictNoShow(userId: string, venueId: string): Promise<number> {
    const userHistory = await prisma.guestList.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 10,
    });

    if (userHistory.length === 0) return 0.3;

    const noShows = userHistory.filter((g: any) => g.status === 'NO_SHOW').length;
    const noShowRate = noShows / userHistory.length;

    const venueHistory = await prisma.guestList.findMany({
      where: { venueId },
      orderBy: { date: 'desc' },
      take: 50,
    });

    const venueNoShowRate = venueHistory.length > 0
      ? venueHistory.filter((g: any) => g.status === 'NO_SHOW').length / venueHistory.length
      : 0.2;

    return Math.round(((noShowRate * 0.7) + (venueNoShowRate * 0.3)) * 100) / 100;
  },

  // ── Demand Forecasting ───────────────────────────────────────────────────
  
  async forecastDemand(venueId: string, daysAhead: number = 7) {
    const historicalData = await prisma.venueAnalytics.findMany({
      where: { venueId },
      orderBy: { date: 'asc' },
      take: 90,
    });

    if (historicalData.length === 0) {
      return Array(daysAhead).fill({ date: null, predictedDemand: 0 });
    }

    const demand = historicalData.map((d: any) => d.totalAttendees);
    const alpha = 0.3;

    let forecast = demand[0];
    const forecasts: number[] = [];

    for (let i = 1; i <= daysAhead; i++) {
      if (i <= demand.length) {
        forecast = alpha * demand[i - 1] + (1 - alpha) * forecast;
      }
      forecasts.push(Math.round(forecast));
    }

    const today = new Date();
    return forecasts.map((predictedDemand, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() + i + 1);
      return {
        date: date.toISOString().split('T')[0],
        predictedDemand,
      };
    });
  },

  // ── Wait Time Estimation ─────────────────────────────────────────────────
  
  async estimateWaitTime(venueId: string): Promise<{ estimatedMinutes: number; confidence: number }> {
    const venue = await prisma.nightlifeVenue.findUnique({ where: { id: venueId } });
    if (!venue) return { estimatedMinutes: 0, confidence: 0 };

    const now = new Date();
    const recentArrivals = await prisma.guestList.count({
      where: {
        venueId,
        date: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
        status: 'ARRIVED',
      },
    });

    const currentQueue = await prisma.guestList.count({
      where: {
        venueId,
        status: 'WAITING',
        date: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
      },
    });

    const serviceRate = 12;
    const estimatedMinutes = currentQueue > 0 && recentArrivals > 0
      ? Math.ceil(currentQueue / serviceRate)
      : 0;

    const confidence = Math.min(recentArrivals / 10, 1);

    return {
      estimatedMinutes: Math.min(estimatedMinutes, 120),
      confidence: Math.round(confidence * 100) / 100,
    };
  },

  // ── Fraud Detection ──────────────────────────────────────────────────────
  
  async detectFraudulentPromoter(promoterId: string): Promise<{
    isFraudulent: boolean;
    riskScore: number;
    reasons: string[];
  }> {
    const promoter = await prisma.promoter.findUnique({
      where: { id: promoterId },
      include: {
        guestLists: true,
        reviews: true,
      },
    });

    if (!promoter) return { isFraudulent: false, riskScore: 0, reasons: [] };

    const reasons: string[] = [];
    let riskScore = 0;

    const noShowRate = promoter.guestLists.filter((g: any) => g.status === 'NO_SHOW').length / promoter.guestLists.length;
    if (noShowRate > 0.5) {
      riskScore += 30;
      reasons.push(`High no-show rate: ${(noShowRate * 100).toFixed(0)}%`);
    }

    const avgRating = promoter.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / promoter.reviews.length;
    if (avgRating < 3 && promoter.reviews.length > 5) {
      riskScore += 25;
      reasons.push(`Low review average: ${avgRating.toFixed(1)}/5`);
    }

    const accountAge = Date.now() - promoter.createdAt.getTime();
    if (accountAge < 7 * 24 * 60 * 60 * 1000 && promoter.guestLists.length > 10) {
      riskScore += 20;
      reasons.push('New account with high activity');
    }

    return {
      isFraudulent: riskScore >= 50,
      riskScore: Math.min(riskScore, 100),
      reasons,
    };
  },

  // ── Recommendations ──────────────────────────────────────────────────────
  
  async getRecommendations(userId: string, limit: number = 10) {
    const allVenues = await prisma.nightlifeVenue.findMany({
      where: { isActive: true },
      include: { events: { where: { date: { gte: new Date() } }, take: 3 } },
    });

    const scoredVenues = allVenues.map((venue: any) => {
      let score = 0;
      score += venue.rating * 5;
      return { venue, score };
    });

    return scoredVenues
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s: any) => s.venue);
  },

  // ── Events ────────────────────────────────────────────────────────────────
  
  async createEvent(data: any) {
    return prisma.nightlifeEvent.create({
      data: {
        ...data,
        date: new Date(data.date),
        attendeeIds: data.attendeeIds || [],
      },
    });
  },

  async listEvents(params?: { venueId?: string; date?: string; city?: string }) {
    const where: any = { date: { gte: new Date() } };
    if (params?.venueId) where.venueId = params.venueId;
    if (params?.date) {
      const target = new Date(params.date);
      where.date = {
        gte: new Date(target.setHours(0, 0, 0, 0)),
        lt: new Date(target.setHours(23, 59, 59, 999)),
      };
    }

    return prisma.nightlifeEvent.findMany({
      where,
      include: { venue: true },
      orderBy: { date: 'asc' },
    });
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  
  async trackAnalytics(venueId: string, data: any) {
    return prisma.venueAnalytics.upsert({
      where: { venueId_date: { venueId, date: new Date(data.date) } },
      update: data,
      create: { venueId, ...data, date: new Date(data.date) },
    });
  },

  async getVenueStats(venueId: string) {
    const [totalEvents, totalAttendees, avgRevenue] = await Promise.all([
      prisma.nightlifeEvent.count({ where: { venueId } }),
      prisma.venueAnalytics.aggregate({ where: { venueId }, _sum: { totalAttendees: true } }),
      prisma.venueAnalytics.aggregate({ where: { venueId }, _avg: { totalRevenue: true } }),
    ]);

    return {
      totalEvents,
      totalAttendees: totalAttendees._sum.totalAttendees || 0,
      avgRevenue: avgRevenue._avg.totalRevenue || 0,
    };
  },
};
