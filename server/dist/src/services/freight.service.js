"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.freightRate = exports.freightMatching = exports.freightCarrier = exports.freightLoad = exports.FreightRateService = exports.FreightMatchingService = exports.FreightCarrierService = exports.FreightLoadService = void 0;
const database_1 = require("../utils/database");
class FreightLoadService {
    async postLoad(data) {
        return database_1.prisma.freightLoad.create({ data: { ...data, status: 'OPEN' } });
    }
    async getLoads(filters) {
        const where = {};
        if (filters?.status)
            where.status = filters.status;
        if (filters?.shipperId)
            where.shipperId = filters.shipperId;
        if (filters?.originCity)
            where.originCity = filters.originCity;
        if (filters?.destCity)
            where.destCity = filters.destCity;
        if (filters?.cargoType)
            where.cargoType = filters.cargoType;
        return database_1.prisma.freightLoad.findMany({
            where,
            include: { shipper: { select: { id: true, firstName: true, lastName: true, companyName: true } }, _count: { select: { bids: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getLoadDetail(loadId) {
        return database_1.prisma.freightLoad.findUnique({
            where: { id: loadId },
            include: {
                shipper: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
                bids: { include: { carrier: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { amountUsd: 'asc' } },
                tracking: { orderBy: { createdAt: 'desc' } },
                documents: true,
            },
        });
    }
    async updateLoadStatus(loadId, status) {
        return database_1.prisma.freightLoad.update({ where: { id: loadId }, data: { status: status.toUpperCase() } });
    }
    async deleteLoad(loadId) {
        return database_1.prisma.freightLoad.delete({ where: { id: loadId } });
    }
}
exports.FreightLoadService = FreightLoadService;
class FreightCarrierService {
    async registerCarrier(data) {
        return database_1.prisma.carrierProfile.create({ data });
    }
    async getCarriers(filters) {
        const where = {};
        if (filters?.verified !== undefined)
            where.verified = filters.verified;
        if (filters?.state)
            where.operatingStates = { has: filters.state };
        return database_1.prisma.carrierProfile.findMany({
            where,
            include: { user: { select: { firstName: true, lastName: true, email: true } }, _count: { select: { scorecards: true } } },
            orderBy: { rating: 'desc' },
        });
    }
    async getCarrierDetail(carrierId) {
        return database_1.prisma.carrierProfile.findUnique({
            where: { id: carrierId },
            include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } }, scorecards: { orderBy: { createdAt: 'desc' }, take: 10 }, availability: true },
        });
    }
    async rateCarrier(carrierId, rating, review) {
        const carrier = await database_1.prisma.carrierProfile.findUnique({ where: { id: carrierId } });
        if (!carrier)
            throw new Error('Carrier not found');
        const newRating = carrier.rating ? (carrier.rating + rating) / 2 : rating;
        return database_1.prisma.carrierProfile.update({ where: { id: carrierId }, data: { rating: newRating } });
    }
}
exports.FreightCarrierService = FreightCarrierService;
class FreightMatchingService {
    async matchLoadToCarrier(loadId) {
        const load = await database_1.prisma.freightLoad.findUnique({ where: { id: loadId }, include: { bids: true } });
        if (!load)
            throw new Error('Load not found');
        return database_1.prisma.carrierProfile.findMany({
            where: { verified: true, maxLoadLbs: { gte: load.weightLbs } },
            orderBy: { rating: 'desc' },
            take: 5,
        });
    }
    async acceptLoad(carrierId, loadId, amountUsd) {
        return database_1.prisma.freightBid.create({ data: { loadId, carrierId, amountUsd, deliveryDays: 3, status: 'PENDING' } });
    }
    async getMatchingHistory(shipperId) {
        return database_1.prisma.freightLoad.findMany({
            where: { shipperId, status: { in: ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'] } },
            include: { bids: { where: { status: 'ACCEPTED' } } },
            orderBy: { updatedAt: 'desc' },
        });
    }
}
exports.FreightMatchingService = FreightMatchingService;
class FreightRateService {
    async calculateRate(distance, weight, cargoType) {
        const baseRate = distance * 1.5;
        const weightFactor = weight / 1000;
        const cargoMultipliers = { GENERAL: 1.0, REFRIGERATED: 1.3, HAZARDOUS: 1.5, OVERSIZED: 1.4, FRAGILE: 1.2 };
        const multiplier = cargoMultipliers[cargoType] || 1.0;
        const total = baseRate * weightFactor * multiplier;
        return { distance, weight, cargoType, baseRate, multiplier, total: Math.round(total * 100) / 100, currency: 'USD' };
    }
    async getRateHistory(shipperId) {
        return database_1.prisma.freightLoad.findMany({
            where: { shipperId },
            select: { id: true, originCity: true, destCity: true, distanceMiles: true, weightLbs: true, budgetUsd: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
    }
}
exports.FreightRateService = FreightRateService;
exports.freightLoad = new FreightLoadService();
exports.freightCarrier = new FreightCarrierService();
exports.freightMatching = new FreightMatchingService();
exports.freightRate = new FreightRateService();
//# sourceMappingURL=freight.service.js.map