import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export class CODEscrowService {
  async createEscrow(sellerId: string, buyerId: string, data: {
    amount: number;
    description: string;
    shippingAddress?: string;
  }) {
    const escrow = await prisma.cODEscrow.create({
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

  async payIntoEscrow(escrowId: string) {
    const escrow = await prisma.cODEscrow.findUnique({ where: { id: escrowId } });
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.status !== 'PENDING') throw new Error(`Cannot pay: status is ${escrow.status}`);

    return prisma.cODEscrow.update({
      where: { id: escrowId },
      data: { status: 'PAID' },
    });
  }

  async confirmShipment(escrowId: string, trackingNumber: string) {
    const escrow = await prisma.cODEscrow.findUnique({ where: { id: escrowId } });
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.status !== 'PAID') throw new Error(`Cannot ship: status is ${escrow.status}`);

    return prisma.cODEscrow.update({
      where: { id: escrowId },
      data: { status: 'SHIPPED', trackingNumber },
    });
  }

  async confirmDelivery(escrowId: string) {
    const escrow = await prisma.cODEscrow.findUnique({ where: { id: escrowId } });
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.status !== 'SHIPPED') throw new Error(`Cannot deliver: status is ${escrow.status}`);

    return prisma.cODEscrow.update({
      where: { id: escrowId },
      data: { status: 'DELIVERED' },
    });
  }

  async releaseFunds(escrowId: string) {
    const escrow = await prisma.cODEscrow.findUnique({ where: { id: escrowId } });
    if (!escrow) throw new Error('Escrow not found');
    if (!['DELIVERED', 'SHIPPED'].includes(escrow.status)) {
      throw new Error(`Cannot release: status is ${escrow.status}`);
    }

    // In production: trigger actual fund transfer here
    logger.info(`Releasing ${escrow.amount} to seller ${escrow.sellerId} for escrow ${escrowId}`);

    return prisma.cODEscrow.update({
      where: { id: escrowId },
      data: { status: 'RELEASED' },
    });
  }

  async raiseDispute(escrowId: string, reason: string) {
    const escrow = await prisma.cODEscrow.findUnique({ where: { id: escrowId } });
    if (!escrow) throw new Error('Escrow not found');
    if (['RELEASED', 'REFUNDED'].includes(escrow.status)) {
      throw new Error(`Cannot dispute: status is ${escrow.status}`);
    }

    return prisma.cODEscrow.update({
      where: { id: escrowId },
      data: { status: 'DISPUTED' },
    });
  }

  async resolveDispute(escrowId: string, resolution: 'REFUND' | 'RELEASE') {
    const escrow = await prisma.cODEscrow.findUnique({ where: { id: escrowId } });
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.status !== 'DISPUTED') throw new Error(`Cannot resolve: status is ${escrow.status}`);

    const newStatus = resolution === 'REFUND' ? 'REFUNDED' : 'RELEASED';
    
    if (resolution === 'RELEASE') {
      logger.info(`Dispute resolved: releasing ${escrow.amount} to seller ${escrow.sellerId}`);
    } else {
      logger.info(`Dispute resolved: refunding ${escrow.amount} to buyer ${escrow.buyerId}`);
    }

    return prisma.cODEscrow.update({
      where: { id: escrowId },
      data: { status: newStatus },
    });
  }

  async getEscrowHistory(userId: string) {
    return prisma.cODEscrow.findMany({
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

  async getEscrowById(escrowId: string) {
    return prisma.cODEscrow.findUnique({
      where: { id: escrowId },
      include: {
        seller: { select: { id: true, firstName: true, lastName: true, email: true } },
        buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }
}

export const codEscrowService = new CODEscrowService();
