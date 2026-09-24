"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codEscrowService = exports.CODEscrowService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
class CODEscrowService {
    async createEscrow(sellerId, buyerId, data) {
        const escrow = await database_1.prisma.cODEscrow.create({
            data: {
                sellerId,
                buyerId,
                amount: data.amount,
                description: data.description,
                shippingAddress: data.shippingAddress,
                status: 'PENDING',
            },
        });
        return escrow;
    }
    async payIntoEscrow(escrowId) {
        const escrow = await database_1.prisma.cODEscrow.findUnique({ where: { id: escrowId } });
        if (!escrow)
            throw new Error('Escrow not found');
        if (escrow.status !== 'PENDING')
            throw new Error(`Cannot pay: status is ${escrow.status}`);
        return database_1.prisma.cODEscrow.update({
            where: { id: escrowId },
            data: { status: 'PAID' },
        });
    }
    async confirmShipment(escrowId, trackingNumber) {
        const escrow = await database_1.prisma.cODEscrow.findUnique({ where: { id: escrowId } });
        if (!escrow)
            throw new Error('Escrow not found');
        if (escrow.status !== 'PAID')
            throw new Error(`Cannot ship: status is ${escrow.status}`);
        return database_1.prisma.cODEscrow.update({
            where: { id: escrowId },
            data: { status: 'SHIPPED', trackingNumber },
        });
    }
    async confirmDelivery(escrowId) {
        const escrow = await database_1.prisma.cODEscrow.findUnique({ where: { id: escrowId } });
        if (!escrow)
            throw new Error('Escrow not found');
        if (escrow.status !== 'SHIPPED')
            throw new Error(`Cannot deliver: status is ${escrow.status}`);
        return database_1.prisma.cODEscrow.update({
            where: { id: escrowId },
            data: { status: 'DELIVERED' },
        });
    }
    async releaseFunds(escrowId) {
        const escrow = await database_1.prisma.cODEscrow.findUnique({ where: { id: escrowId } });
        if (!escrow)
            throw new Error('Escrow not found');
        if (!['DELIVERED', 'SHIPPED'].includes(escrow.status)) {
            throw new Error(`Cannot release: status is ${escrow.status}`);
        }
        // In production: trigger actual fund transfer here
        logger_1.logger.info(`Releasing ${escrow.amount} to seller ${escrow.sellerId} for escrow ${escrowId}`);
        return database_1.prisma.cODEscrow.update({
            where: { id: escrowId },
            data: { status: 'RELEASED' },
        });
    }
    async raiseDispute(escrowId, reason) {
        const escrow = await database_1.prisma.cODEscrow.findUnique({ where: { id: escrowId } });
        if (!escrow)
            throw new Error('Escrow not found');
        if (['RELEASED', 'REFUNDED'].includes(escrow.status)) {
            throw new Error(`Cannot dispute: status is ${escrow.status}`);
        }
        return database_1.prisma.cODEscrow.update({
            where: { id: escrowId },
            data: { status: 'DISPUTED' },
        });
    }
    async resolveDispute(escrowId, resolution) {
        const escrow = await database_1.prisma.cODEscrow.findUnique({ where: { id: escrowId } });
        if (!escrow)
            throw new Error('Escrow not found');
        if (escrow.status !== 'DISPUTED')
            throw new Error(`Cannot resolve: status is ${escrow.status}`);
        const newStatus = resolution === 'REFUND' ? 'REFUNDED' : 'RELEASED';
        if (resolution === 'RELEASE') {
            logger_1.logger.info(`Dispute resolved: releasing ${escrow.amount} to seller ${escrow.sellerId}`);
        }
        else {
            logger_1.logger.info(`Dispute resolved: refunding ${escrow.amount} to buyer ${escrow.buyerId}`);
        }
        return database_1.prisma.cODEscrow.update({
            where: { id: escrowId },
            data: { status: newStatus },
        });
    }
    async getEscrowHistory(userId) {
        return database_1.prisma.cODEscrow.findMany({
            where: {
                OR: [{ sellerId: userId }, { buyerId: userId }],
            },
            include: {
                seller: { select: { id: true, firstName: true, lastName: true, email: true } },
                buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });
    }
    async getEscrowById(escrowId) {
        return database_1.prisma.cODEscrow.findUnique({
            where: { id: escrowId },
            include: {
                seller: { select: { id: true, firstName: true, lastName: true, email: true } },
                buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
    }
}
exports.CODEscrowService = CODEscrowService;
exports.codEscrowService = new CODEscrowService();
//# sourceMappingURL=codEscrow.service.js.map