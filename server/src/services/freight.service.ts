// ── Comprehensive Freight Service ─────────────────────────────────────────
// One-stop shop: loads, bids, escrow, documents, messaging, tracking,
// insurance, rate cards, carrier scorecards, fuel surcharges, multi-stop

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const freightService = {
  // ── Load Management ──────────────────────────────────────────────────────
  
  async createLoad(data: any) {
    // Calculate distance (simplified - would use Google Maps API)
    const distanceMiles = data.distanceMiles || calculateDistance(
      data.originLat, data.originLng, data.destLat, data.destLng
    );
    
    // Calculate fuel surcharge
    const fuelSurcharge = calculateFuelSurcharge(data.weightLbs, distanceMiles);
    
    return prisma.freightLoad.create({
      data: {
        ...data,
        distanceMiles,
        fuelSurcharge,
        status: 'OPEN',
      },
    });
  },

  async listLoads(params?: { 
    status?: string; 
    shipperId?: string; 
    originCity?: string; 
    destCity?: string;
    cargoType?: string;
    minWeight?: number;
    maxWeight?: number;
    pickupDate?: string;
  }) {
    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.shipperId) where.shipperId = params.shipperId;
    if (params?.originCity) where.originCity = params.originCity;
    if (params?.destCity) where.destCity = params.destCity;
    if (params?.cargoType) where.cargoType = params.cargoType;
    if (params?.minWeight) where.weightLbs = { gte: params.minWeight };
    if (params?.maxWeight) where.weightLbs = { ...where.weightLbs, lte: params.maxWeight };
    if (params?.pickupDate) where.pickupDate = { gte: new Date(params.pickupDate) };

    return prisma.freightLoad.findMany({
      where,
      include: {
        shipper: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { bids: true, documents: true } },
        bids: { 
          select: { id: true, amountUsd: true, status: true, carrier: { select: { id: true, companyName: true, rating: true } } },
          orderBy: { amountUsd: 'asc' },
          take: 3,
        },
        stops: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getLoad(id: string) {
    return prisma.freightLoad.findUnique({
      where: { id },
      include: {
        shipper: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        bids: {
          include: { 
            carrier: { 
              include: { 
                user: { select: { firstName: true, lastName: true } },
                documents: true,
              } 
            } 
          },
          orderBy: { amountUsd: 'asc' },
        },
        tracking: { orderBy: { createdAt: 'desc' } },
        documents: true,
        escrow: true,
        stops: { orderBy: { sequence: 'asc' } },
        messages: { 
          include: { sender: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        insurance: true,
        scorecard: true,
      },
    });
  },

  async updateLoadStatus(id: string, status: string, location?: string) {
    const load = await prisma.freightLoad.update({
      where: { id },
      data: { status },
    });
    
    // Add tracking update for status changes
    if (['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
      await prisma.freightTracking.create({
        data: {
          loadId: id,
          status,
          location: location || 'Unknown',
        },
      });
    }
    
    return load;
  },

  // ── Multi-Stop Loads ─────────────────────────────────────────────────────
  
  async addStop(loadId: string, data: {
    sequence: number;
    address: string;
    city: string;
    state: string;
    zip: string;
    type: 'PICKUP' | 'DROPOFF';
    cargoDescription?: string;
    weightLbs?: number;
    scheduledTime?: Date;
  }) {
    return prisma.freightStop.create({
      data: { loadId, ...data },
    });
  },

  async updateStop(stopId: string, data: { status: string; actualTime?: Date; notes?: string }) {
    return prisma.freightStop.update({
      where: { id: stopId },
      data,
    });
  },

  // ── Bid Management ───────────────────────────────────────────────────────
  
  async placeBid(data: {
    loadId: string;
    carrierId: string;
    amountUsd: number;
    currency?: string;
    deliveryDays: number;
    notes?: string;
    expiresAt?: Date;
  }) {
    return prisma.freightBid.create({
      data: { ...data, status: 'PENDING' },
    });
  },

  async listBids(params?: { loadId?: string; carrierId?: string; status?: string }) {
    const where: any = {};
    if (params?.loadId) where.loadId = params.loadId;
    if (params?.carrierId) where.carrierId = params.carrierId;
    if (params?.status) where.status = params.status;

    return prisma.freightBid.findMany({
      where,
      include: {
        load: { select: { id: true, title: true, originCity: true, destCity: true, status: true, budgetUsd: true } },
        carrier: { select: { id: true, companyName: true, rating: true, totalDeliveries: true } },
      },
      orderBy: { amountUsd: 'asc' },
    });
  },

  async acceptBid(bidId: string) {
    const bid = await prisma.freightBid.findUnique({ where: { id: bidId } });
    if (!bid) throw new Error('Bid not found');

    const [updatedBid] = await prisma.$transaction([
      prisma.freightBid.update({ where: { id: bidId }, data: { status: 'ACCEPTED' } }),
      prisma.freightBid.updateMany({
        where: { loadId: bid.loadId, id: { not: bidId } },
        data: { status: 'REJECTED' },
      }),
      prisma.freightLoad.update({
        where: { id: bid.loadId },
        data: { status: 'ASSIGNED', acceptedBidId: bidId },
      }),
    ]);

    return updatedBid;
  },

  async rejectBid(bidId: string) {
    return prisma.freightBid.update({
      where: { id: bidId },
      data: { status: 'REJECTED' },
    });
  },

  // ── Escrow Management ────────────────────────────────────────────────────
  
  async createEscrow(data: { loadId: string; amountUsd: number; currency: string; shipperId: string; carrierId: string }) {
    return prisma.freightEscrow.create({
      data: { ...data, status: 'PENDING' },
    });
  },

  async fundEscrow(loadId: string) {
    return prisma.freightEscrow.update({
      where: { loadId },
      data: { status: 'FUNDED', fundedAt: new Date() },
    });
  },

  async releaseEscrow(loadId: string) {
    const [escrow] = await prisma.$transaction([
      prisma.freightEscrow.update({
        where: { loadId },
        data: { status: 'RELEASED', releasedAt: new Date() },
      }),
      prisma.freightLoad.update({
        where: { id: loadId },
        data: { status: 'COMPLETED' },
      }),
    ]);
    return escrow;
  },

  async disputeEscrow(loadId: string, reason: string) {
    return prisma.freightEscrow.update({
      where: { loadId },
      data: { status: 'DISPUTED', disputeReason: reason },
    });
  },

  async refundEscrow(loadId: string) {
    const [escrow] = await prisma.$transaction([
      prisma.freightEscrow.update({
        where: { loadId },
        data: { status: 'REFUNDED', releasedAt: new Date() },
      }),
      prisma.freightLoad.update({
        where: { id: loadId },
        data: { status: 'CANCELLED' },
      }),
    ]);
    return escrow;
  },

  // ── Documents ────────────────────────────────────────────────────────────
  
  async uploadDocument(data: {
    loadId?: string;
    carrierId?: string;
    uploadedById: string;
    documentType: string;
    fileName: string;
    fileUrl: string;
    fileSize?: number;
  }) {
    return prisma.freightDocument.create({ data });
  },

  async getDocuments(loadId?: string, carrierId?: string) {
    const where: any = {};
    if (loadId) where.loadId = loadId;
    if (carrierId) where.carrierId = carrierId;
    
    return prisma.freightDocument.findMany({ where, orderBy: { uploadedAt: 'desc' } });
  },

  // ── Messages ─────────────────────────────────────────────────────────────
  
  async sendMessage(data: {
    loadId: string;
    senderId: string;
    message: string;
    messageType?: string;
  }) {
    return prisma.freightMessage.create({
      data: { ...data, messageType: data.messageType || 'MESSAGE' },
    });
  },

  async getMessages(loadId: string) {
    return prisma.freightMessage.findMany({
      where: { loadId },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  },

  // ── Tracking ─────────────────────────────────────────────────────────────
  
  async addTrackingUpdate(data: { loadId: string; status: string; location?: string; notes?: string }) {
    return prisma.freightTracking.create({ data });
  },

  async getTracking(loadId: string) {
    return prisma.freightTracking.findMany({
      where: { loadId },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ── Insurance ────────────────────────────────────────────────────────────
  
  async purchaseInsurance(data: {
    loadId: string;
    provider: string;
    coverageAmount: number;
    premium: number;
    policyNumber: string;
  }) {
    return prisma.freightInsurance.create({ data });
  },

  async getInsurance(loadId: string) {
    return prisma.freightInsurance.findUnique({ where: { loadId } });
  },

  // ── Carrier Scorecard ────────────────────────────────────────────────────
  
  async createScorecard(data: {
    loadId: string;
    shipperId: string;
    carrierId: string;
    onTimeDelivery?: number;
    cargoCondition?: number;
    communication?: number;
    professionalism?: number;
    notes?: string;
  }) {
    const overallRating = ((data.onTimeDelivery || 0) + (data.cargoCondition || 0) + (data.communication || 0) + (data.professionalism || 0)) / 4;
    
    const scorecard = await prisma.carrierScorecard.create({
      data: { ...data, overallRating },
    });
    
    // Update carrier's aggregate rating
    await this.updateCarrierRating(data.carrierId);
    
    return scorecard;
  },

  async updateCarrierRating(carrierId: string) {
    const scorecards = await prisma.carrierScorecard.findMany({
      where: { carrierId },
      select: { overallRating: true },
    });
    
    if (scorecards.length === 0) return;
    
    const avgRating = scorecards.reduce((sum, s) => sum + s.overallRating, 0) / scorecards.length;
    
    await prisma.carrierProfile.update({
      where: { userId: carrierId },
      data: { rating: Math.round(avgRating) },
    });
  },

  // ── Carrier Management ───────────────────────────────────────────────────
  
  async createCarrierProfile(data: any) {
    return prisma.carrierProfile.create({ data });
  },

  async getCarrierProfile(userId: string) {
    return prisma.carrierProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        documents: true,
        scorecards: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  },

  async listCarriers(params?: { verified?: boolean; state?: string; equipmentType?: string }) {
    const where: any = {};
    if (params?.verified !== undefined) where.verified = params.verified;
    if (params?.state) where.operatingStates = { has: params.state };
    if (params?.equipmentType) where.equipmentType = { has: params.equipmentType };

    return prisma.carrierProfile.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { rating: 'desc' },
    });
  },

  async verifyCarrier(userId: string) {
    return prisma.carrierProfile.update({
      where: { userId },
      data: { verified: true },
    });
  },

  async updateCarrierAvailability(userId: string, data: {
    availableFrom?: Date;
    availableTo?: Date;
    preferredRegions?: string[];
    maxDistance?: number;
  }) {
    return prisma.carrierProfile.update({
      where: { userId },
      data,
    });
  },

  // ── Rate Cards ───────────────────────────────────────────────────────────
  
  async createRateCard(data: {
    carrierId: string;
    originRegion: string;
    destRegion: string;
    ratePerMile: number;
    minimumCharge: number;
    cargoType?: string;
  }) {
    return prisma.carrierRateCard.create({ data });
  },

  async getRateCards(carrierId: string) {
    return prisma.carrierRateCard.findMany({ where: { carrierId } });
  },

  async calculateRate(carrierId: string, origin: string, dest: string, cargoType?: string) {
    const rateCard = await prisma.carrierRateCard.findFirst({
      where: {
        carrierId,
        OR: [
          { originRegion: origin, destRegion: dest },
          { originRegion: 'ANY', destRegion: 'ANY' },
        ],
        cargoType: cargoType || undefined,
      },
    });
    return rateCard;
  },

  // ── Fuel Surcharge ───────────────────────────────────────────────────────
  
  async getFuelSurchargeRate() {
    // In production, this would fetch from EIA API
    return 0.45; // $0.45 per mile current national average
  },

  // ── Stats & Analytics ────────────────────────────────────────────────────
  
  async getStats() {
    const [totalLoads, activeLoads, completedLoads, totalCarriers, totalRevenue] = await Promise.all([
      prisma.freightLoad.count(),
      prisma.freightLoad.count({ where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_TRANSIT'] } } }),
      prisma.freightLoad.count({ where: { status: 'COMPLETED' } }),
      prisma.carrierProfile.count({ where: { verified: true } }),
      prisma.freightEscrow.aggregate({ where: { status: 'RELEASED' }, _sum: { amountUsd: true } }),
    ]);

    return {
      totalLoads,
      activeLoads,
      completedLoads,
      verifiedCarriers: totalCarriers,
      totalRevenue: totalRevenue._sum.amountUsd || 0,
    };
  },

  async getCarrierStats(carrierId: string) {
    const [scorecards, loads, revenue] = await Promise.all([
      prisma.carrierScorecard.findMany({ where: { carrierId } }),
      prisma.freightLoad.count({ where: { acceptedBidId: { contains: carrierId } } }),
      prisma.freightEscrow.aggregate({ where: { carrierId, status: 'RELEASED' }, _sum: { amountUsd: true } }),
    ]);
    
    const avgRating = scorecards.length > 0 
      ? scorecards.reduce((sum, s) => sum + s.overallRating, 0) / scorecards.length 
      : 0;
    
    return {
      totalLoads: loads,
      avgRating: Math.round(avgRating * 10) / 10,
      totalRevenue: revenue._sum.amountUsd || 0,
      completedScorecards: scorecards.length,
    };
  },
};

// ── Helper Functions ───────────────────────────────────────────────────────

function calculateDistance(lat1?: number, lng1?: number, lat2?: number, lng2?: number): number {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 0;
  
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function calculateFuelSurcharge(weightLbs: number, distanceMiles: number): number {
  const ratePerMile = 0.45;
  return Math.round(ratePerMile * distanceMiles * (weightLbs / 40000) * 100) / 100;
}
