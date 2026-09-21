import { prisma } from '../utils/database';

export class FreightLoadService {
  async postLoad(data: any) {
    return prisma.freightLoad.create({ data: { ...data, status: 'OPEN' } });
  }

  async getLoads(filters?: { status?: string; shipperId?: string; originCity?: string; destCity?: string; cargoType?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.shipperId) where.shipperId = filters.shipperId;
    if (filters?.originCity) where.originCity = filters.originCity;
    if (filters?.destCity) where.destCity = filters.destCity;
    if (filters?.cargoType) where.cargoType = filters.cargoType;
    return prisma.freightLoad.findMany({
      where,
      include: { shipper: { select: { id: true, firstName: true, lastName: true, companyName: true } }, _count: { select: { bids: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLoadDetail(loadId: string) {
    return prisma.freightLoad.findUnique({
      where: { id: loadId },
      include: {
        shipper: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        bids: { include: { carrier: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { amountUsd: 'asc' } },
        tracking: { orderBy: { createdAt: 'desc' } },
        documents: true,
      },
    });
  }

  async updateLoadStatus(loadId: string, status: string) {
    return prisma.freightLoad.update({ where: { id: loadId }, data: { status: status.toUpperCase() } });
  }

  async deleteLoad(loadId: string) {
    return prisma.freightLoad.delete({ where: { id: loadId } });
  }
}

export class FreightCarrierService {
  async registerCarrier(data: any) {
    return prisma.carrierProfile.create({ data });
  }

  async getCarriers(filters?: { verified?: boolean; state?: string }) {
    const where: any = {};
    if (filters?.verified !== undefined) where.verified = filters.verified;
    if (filters?.state) where.operatingStates = { has: filters.state };
    return prisma.carrierProfile.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, email: true } }, _count: { select: { scorecards: true } } },
      orderBy: { rating: 'desc' },
    });
  }

  async getCarrierDetail(carrierId: string) {
    return prisma.carrierProfile.findUnique({
      where: { id: carrierId },
      include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } }, scorecards: { orderBy: { createdAt: 'desc' }, take: 10 }, availability: true },
    });
  }

  async rateCarrier(carrierId: string, rating: number, review?: string) {
    const carrier = await prisma.carrierProfile.findUnique({ where: { id: carrierId } });
    if (!carrier) throw new Error('Carrier not found');
    const newRating = carrier.rating ? (carrier.rating + rating) / 2 : rating;
    return prisma.carrierProfile.update({ where: { id: carrierId }, data: { rating: newRating } });
  }
}

export class FreightMatchingService {
  async matchLoadToCarrier(loadId: string) {
    const load = await prisma.freightLoad.findUnique({ where: { id: loadId }, include: { bids: true } });
    if (!load) throw new Error('Load not found');
    return prisma.carrierProfile.findMany({
      where: { verified: true, maxLoadLbs: { gte: load.weightLbs } },
      orderBy: { rating: 'desc' },
      take: 5,
    });
  }

  async acceptLoad(carrierId: string, loadId: string, amountUsd: number) {
    return prisma.freightBid.create({ data: { loadId, carrierId, amountUsd, deliveryDays: 3, status: 'PENDING' } });
  }

  async getMatchingHistory(shipperId: string) {
    return prisma.freightLoad.findMany({
      where: { shipperId, status: { in: ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'] } },
      include: { bids: { where: { status: 'ACCEPTED' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }
}

export class FreightRateService {
  async calculateRate(distance: number, weight: number, cargoType: string) {
    const baseRate = distance * 1.5;
    const weightFactor = weight / 1000;
    const cargoMultipliers: Record<string, number> = { GENERAL: 1.0, REFRIGERATED: 1.3, HAZARDOUS: 1.5, OVERSIZED: 1.4, FRAGILE: 1.2 };
    const multiplier = cargoMultipliers[cargoType] || 1.0;
    const total = baseRate * weightFactor * multiplier;
    return { distance, weight, cargoType, baseRate, multiplier, total: Math.round(total * 100) / 100, currency: 'USD' };
  }

  async getRateHistory(shipperId: string) {
    return prisma.freightLoad.findMany({
      where: { shipperId },
      select: { id: true, originCity: true, destCity: true, distanceMiles: true, weightLbs: true, budgetUsd: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}

export const freightLoad = new FreightLoadService();
export const freightCarrier = new FreightCarrierService();
export const freightMatching = new FreightMatchingService();
export const freightRate = new FreightRateService();
