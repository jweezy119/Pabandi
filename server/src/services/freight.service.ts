import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const freightService = {
  // ── Load Management ──────────────────────────────────────────────────────
  
  async createLoad(data: {
    shipperId: string;
    title: string;
    description?: string;
    cargoType: string;
    weightLbs: number;
    dimensions?: string;
    valueUsd: number;
    originAddress: string;
    originCity: string;
    originState: string;
    originZip: string;
    destAddress: string;
    destCity: string;
    destState: string;
    destZip: string;
    pickupDate: Date;
    deliveryDate: Date;
    budgetUsd: number;
  }) {
    return prisma.freightLoad.create({
      data: {
        ...data,
        status: 'OPEN',
      },
    });
  },

  async listLoads(params?: { status?: string; shipperId?: string; originCity?: string; destCity?: string }) {
    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.shipperId) where.shipperId = params.shipperId;
    if (params?.originCity) where.originCity = params.originCity;
    if (params?.destCity) where.destCity = params.destCity;

    return prisma.freightLoad.findMany({
      where,
      include: {
        _count: { select: { bids: true } },
        bids: { select: { id: true, amountUsd: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getLoad(id: string) {
    return prisma.freightLoad.findUnique({
      where: { id },
      include: {
        shipper: { select: { id: true, firstName: true, lastName: true } },
        bids: {
          include: { carrier: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { amountUsd: 'asc' },
        },
        tracking: { orderBy: { createdAt: 'desc' } },
        escrow: true,
      },
    });
  },

  async updateLoadStatus(id: string, status: string) {
    return prisma.freightLoad.update({
      where: { id },
      data: { status },
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
  }) {
    return prisma.freightBid.create({
      data: {
        ...data,
        status: 'PENDING',
      },
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
        load: { select: { id: true, title: true, originCity: true, destCity: true, status: true } },
        carrier: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async acceptBid(bidId: string) {
    const bid = await prisma.freightBid.findUnique({ where: { id: bidId } });
    if (!bid) throw new Error('Bid not found');

    // Update bid status and load
    const [updatedBid] = await prisma.$transaction([
      prisma.freightBid.update({
        where: { id: bidId },
        data: { status: 'ACCEPTED' },
      }),
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

  // ── Escrow Management ────────────────────────────────────────────────────
  
  async createEscrow(data: {
    loadId: string;
    amountUsd: number;
    amountSol?: number;
    currency: string;
    shipperId: string;
    carrierId: string;
  }) {
    return prisma.freightEscrow.create({
      data: {
        ...data,
        status: 'PENDING',
      },
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

  // ── Tracking ─────────────────────────────────────────────────────────────
  
  async addTrackingUpdate(data: {
    loadId: string;
    status: string;
    location?: string;
    notes?: string;
  }) {
    return prisma.freightTracking.create({ data });
  },

  async getTracking(loadId: string) {
    return prisma.freightTracking.findMany({
      where: { loadId },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ── Carrier Management ───────────────────────────────────────────────────
  
  async createCarrierProfile(data: {
    userId: string;
    companyName: string;
    dotNumber?: string;
    mcNumber?: string;
    fleetSize?: number;
    equipmentType?: string[];
    operatingStates?: string[];
    maxLoadLbs?: number;
  }) {
    return prisma.carrierProfile.create({ data });
  },

  async getCarrierProfile(userId: string) {
    return prisma.carrierProfile.findUnique({ where: { userId } });
  },

  async listCarriers(params?: { verified?: boolean; state?: string }) {
    const where: any = {};
    if (params?.verified !== undefined) where.verified = params.verified;
    if (params?.state) where.operatingStates = { has: params.state };

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

  // ── Stats ────────────────────────────────────────────────────────────────
  
  async getStats() {
    const [totalLoads, activeLoads, completedLoads, totalCarriers] = await Promise.all([
      prisma.freightLoad.count(),
      prisma.freightLoad.count({ where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_TRANSIT'] } } }),
      prisma.freightLoad.count({ where: { status: 'COMPLETED' } }),
      prisma.carrierProfile.count({ where: { verified: true } }),
    ]);

    return {
      totalLoads,
      activeLoads,
      completedLoads,
      verifiedCarriers: totalCarriers,
    };
  },
};
