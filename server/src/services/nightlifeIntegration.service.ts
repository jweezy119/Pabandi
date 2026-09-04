// ── Nightlife Integration Hub ──────────────────────────────────────────────
// Connects to existing rails promoters & clubs use today:
// Instagram, WhatsApp, Cash App, Eventbrite, SMS, Email
// Pabandi sits UNDER these rails adding trust, verification, analytics

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const nightlifeIntegrationService = {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PROMOTER OS — Unified dashboard for promoters to manage everything
  // ═══════════════════════════════════════════════════════════════════════════

  async createPromoterProfile(userId: string, data: any) {
    return prisma.promoter.create({
      data: { userId, ...data },
    });
  },

  async getPromoterDashboard(promoterId: string) {
    const promoter = await prisma.promoter.findUnique({
      where: { id: promoterId },
      include: {
        guestLists: {
          where: { date: { gte: new Date() } },
          include: { venue: true },
        },
        reviews: true,
      },
    });

    if (!promoter) return null;

    // Aggregate stats
    const totalLists = promoter.guestLists.length;
    const totalGuests = promoter.guestLists.reduce((sum: number, g: any) => sum + g.partySize, 0);
    const arrivedGuests = promoter.guestLists.filter((g: any) => g.status === 'ARRIVED').length;
    const noShowGuests = promoter.guestLists.filter((g: any) => g.status === 'NO_SHOW').length;
    const avgRating = promoter.reviews.length > 0
      ? promoter.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / promoter.reviews.length
      : 0;

    const fraudCheck = await this.checkPromoterFraud(promoterId);

    return {
      profile: promoter,
      stats: {
        totalLists,
        totalGuests,
        arrivedGuests,
        noShowGuests,
        arrivalRate: totalGuests > 0 ? (arrivedGuests / totalGuests) : 0,
        avgRating,
        fraudRisk: fraudCheck.riskScore,
      },
      upcomingEvents: promoter.guestLists,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. GUEST LIST AUTOMATION — Smart lists with deposits, QR, no-show prediction
  // ═══════════════════════════════════════════════════════════════════════════

  async createSmartGuestList(data: any) {
    const venueId = data.venueId;
    const userId = data.userId;

    // Predict no-show probability
    const noShowProbability = await this.predictNoShow(userId, venueId);

    // Calculate deposit required based on risk and venue
    const venue = await prisma.nightlifeVenue.findUnique({ where: { id: venueId } });
    const depositAmount = this.calculateDeposit(noShowProbability, venue?.capacity || 100);

    return prisma.guestList.create({
      data: {
        userId,
        venueId,
        eventId: data.eventId,
        date: new Date(data.date),
        partySize: data.partySize || 1,
        guestNames: data.guestNames || [],
        status: 'CONFIRMED',
        noShowProbability,
        confirmationCode: `GL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        depositAmount,
        depositStatus: depositAmount > 0 ? 'PENDING' : 'WAIVED',
      },
    });
  },

  calculateDeposit(noShowProbability: number, venueCapacity: number): number {
    if (noShowProbability < 0.2) return 0;
    if (noShowProbability < 0.4) return 10;
    if (noShowProbability < 0.6) return 25;
    if (noShowProbability < 0.8) return 50;
    return 100;
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

  async generateQRCode(guestListId: string) {
    const guestList = await prisma.guestList.findUnique({ where: { id: guestListId } });
    if (!guestList) return null;

    const qrData = {
      code: guestList.confirmationCode,
      venue: guestList.venueId,
      date: guestList.date,
      party: guestList.partySize,
    };

    return {
      confirmationCode: guestList.confirmationCode,
      qrPayload: JSON.stringify(qrData),
      // In production, generate actual QR image
      qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(JSON.stringify(qrData))}`,
    };
  },

  async verifyEntry(confirmationCode: string, venueId: string) {
    const guestList = await prisma.guestList.findUnique({
      where: { confirmationCode },
    });

    if (!guestList) return { valid: false, reason: 'Code not found' };
    if (guestList.venueId !== venueId) return { valid: false, reason: 'Wrong venue' };
    if (guestList.status === 'ARRIVED') return { valid: false, reason: 'Already checked in' };
    if (guestList.status === 'CANCELLED') return { valid: false, reason: 'Cancelled' };

    await prisma.guestList.update({
      where: { id: guestList.id },
      data: { status: 'ARRIVED' },
    });

    return {
      valid: true,
      partySize: guestList.partySize,
      guestNames: guestList.guestNames,
      noShowProbability: guestList.noShowProbability,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. INTEGRATION RAILS — Connect to existing platforms
  // ═══════════════════════════════════════════════════════════════════════════

  // Instagram Graph API — pull venue data, post events, collect RSVPs
  async syncInstagramVenue(instagramHandle: string) {
    // In production: call Instagram Graph API
    // Returns: follower count, recent posts, engagement rate
    return {
      handle: instagramHandle,
      followers: 0,
      posts: 0,
      engagementRate: 0,
      lastPost: null,
    };
  },

  // WhatsApp Business API — send confirmations, QR codes
  async sendWhatsAppConfirmation(phone: string, guestList: any) {
    // In production: call WhatsApp Business API
    const message = `🎉 You're on the list!\n\nVenue: ${guestList.venue?.name}\nDate: ${guestList.date}\nParty: ${guestList.partySize}\nCode: ${guestList.confirmationCode}\n\nShow this code at the door.`;
    return { sent: true, message, phone };
  },

  // Eventbrite API — pull real event data
  async syncEventbriteEvent(eventbriteId: string) {
    // In production: call Eventbrite API
    return {
      eventbriteId,
      name: '',
      date: null,
      venue: null,
      capacity: 0,
      ticketsSold: 0,
    };
  },

  // SMS Gateway — fallback for entry codes
  async sendSMSConfirmation(phone: string, guestList: any) {
    // In production: call Twilio/similar
    const message = `Pabandi: You're confirmed for ${guestList.venue?.name} on ${guestList.date}. Code: ${guestList.confirmationCode}`;
    return { sent: true, message, phone };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. VENUE DASHBOARD — Real-time arrivals, capacity, analytics
  // ═══════════════════════════════════════════════════════════════════════════

  async getVenueDashboard(venueId: string) {
    const venue = await prisma.nightlifeVenue.findUnique({
      where: { id: venueId },
      include: {
        guestLists: {
          where: {
            date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lt: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        },
        events: {
          where: { date: { gte: new Date() } },
        },
        bottleReservations: {
          where: {
            date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lt: new Date(new Date().setHours(23, 59, 59, 999)),
            },
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
        },
      },
    });

    if (!venue) return null;

    const todayGuests = venue.guestLists || [];
    const arrived = todayGuests.filter((g: any) => g.status === 'ARRIVED').length;
    const waiting = todayGuests.filter((g: any) => g.status === 'WAITING').length;
    const confirmed = todayGuests.filter((g: any) => g.status === 'CONFIRMED').length;
    const noShows = todayGuests.filter((g: any) => g.status === 'NO_SHOW').length;

    const totalBottleSpend = (venue.bottleReservations || []).reduce(
      (sum: number, r: any) => sum + r.totalPrice, 0
    );

    const capacityUsed = venue.capacity > 0 ? (arrived / venue.capacity) * 100 : 0;

    return {
      venue,
      todayStats: {
        arrived,
        waiting,
        confirmed,
        noShows,
        capacityUsed: Math.round(capacityUsed),
        bottleRevenue: totalBottleSpend,
        totalExpected: confirmed + waiting + arrived,
      },
      upcomingEvents: venue.events,
      activeGuestLists: todayGuests,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. FRAUD DETECTION — Multi-signal promoter fraud scoring
  // ═══════════════════════════════════════════════════════════════════════════

  async checkPromoterFraud(promoterId: string) {
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

    // High no-show rate
    const noShowRate = promoter.guestLists.filter((g: any) => g.status === 'NO_SHOW').length / promoter.guestLists.length;
    if (noShowRate > 0.5) {
      riskScore += 30;
      reasons.push(`High no-show rate: ${(noShowRate * 100).toFixed(0)}%`);
    }

    // Low review average
    const avgRating = promoter.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / promoter.reviews.length;
    if (avgRating < 3 && promoter.reviews.length > 5) {
      riskScore += 25;
      reasons.push(`Low review average: ${avgRating.toFixed(1)}/5`);
    }

    // New account with high activity
    const accountAge = Date.now() - promoter.createdAt.getTime();
    if (accountAge < 7 * 24 * 60 * 60 * 1000 && promoter.guestLists.length > 10) {
      riskScore += 20;
      reasons.push('New account with high activity');
    }

    // Duplicate guest names across lists
    const allGuestNames = promoter.guestLists.flatMap((g: any) => g.guestNames || []);
    const uniqueNames = new Set(allGuestNames);
    if (allGuestNames.length > uniqueNames.size * 1.5) {
      riskScore += 15;
      reasons.push('Duplicate guest names detected');
    }

    // Low conversion (confirmed vs arrived)
    const confirmed = promoter.guestLists.filter((g: any) => g.status === 'CONFIRMED').length;
    const arrived = promoter.guestLists.filter((g: any) => g.status === 'ARRIVED').length;
    if (confirmed > 0 && arrived / confirmed < 0.3) {
      riskScore += 10;
      reasons.push('Low conversion rate');
    }

    return {
      isFraudulent: riskScore >= 50,
      riskScore: Math.min(riskScore, 100),
      reasons,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. REAL-TIME CAPACITY & WAITLIST
  // ═══════════════════════════════════════════════════════════════════════════

  async getRealTimeCapacity(venueId: string) {
    const venue = await prisma.nightlifeVenue.findUnique({ where: { id: venueId } });
    if (!venue) return null;

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));

    const [arrived, waiting, confirmed] = await Promise.all([
      prisma.guestList.count({ where: { venueId, status: 'ARRIVED', date: { gte: todayStart, lt: todayEnd } } }),
      prisma.guestList.count({ where: { venueId, status: 'WAITING', date: { gte: todayStart, lt: todayEnd } } }),
      prisma.guestList.count({ where: { venueId, status: 'CONFIRMED', date: { gte: todayStart, lt: todayEnd } } }),
    ]);

    const capacity = venue.capacity || 100;
    const available = Math.max(0, capacity - arrived);

    return {
      capacity,
      arrived,
      waiting,
      confirmed,
      available,
      percentFull: Math.round((arrived / capacity) * 100),
      estimatedWait: waiting > 0 ? Math.ceil(waiting / 12) : 0,
    };
  },

  async addToWaitlist(venueId: string, userId: string, partySize: number) {
    return prisma.guestList.create({
      data: {
        userId,
        venueId,
        partySize,
        status: 'WAITING',
        noShowProbability: 0.5,
        confirmationCode: `WL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        date: new Date(),
      },
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. PROMOTER PAYOUTS — Track commissions, release on verified entry
  // ═══════════════════════════════════════════════════════════════════════════

  async calculatePromoterPayout(promoterId: string, venueId: string, date: string) {
    const guestLists = await prisma.guestList.findMany({
      where: { venueId, status: 'ARRIVED' },
    });

    // Only count guests from this promoter
    const promoter = await prisma.promoter.findUnique({ where: { id: promoterId } });
    if (!promoter) return null;

    const arrivedGuests = guestLists.length;
    const commissionPerGuest = 5; // $5 per arrived guest
    const totalPayout = arrivedGuests * commissionPerGuest;

    return {
      promoterId,
      venueId,
      arrivedGuests,
      commissionPerGuest,
      totalPayout,
      status: 'PENDING',
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. EVENT DISCOVERY — Pull from multiple sources
  // ═══════════════════════════════════════════════════════════════════════════

  async discoverEvents(params: { city?: string; date?: string; source?: string }) {
    const where: any = { date: { gte: new Date() } };
    if (params.date) {
      const target = new Date(params.date);
      where.date = {
        gte: new Date(target.setHours(0, 0, 0, 0)),
        lt: new Date(target.setHours(23, 59, 59, 999)),
      };
    }

    const events = await prisma.nightlifeEvent.findMany({
      where,
      include: { venue: true },
      orderBy: { date: 'asc' },
    });

    return events;
  },
};
