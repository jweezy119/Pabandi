import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export class CODEscrowService {
  async createEscrow(sellerId: string, buyerId: string, data: {
    amount: number;
    description: string;
    shippingAddress?: string;
  }) {
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      // A negative or NaN amount is a negative-amount escrow waiting to happen,
      // and it reaches releaseFunds by way of an amount check that would pass.
      throw new Error('amount must be a positive number');
    }
    if (sellerId === buyerId) {
      // The ownership checks in the route treat buyer and seller as distinct
      // roles, so a self-escrow would let one person satisfy both.
      throw new Error('buyer and seller must be different users');
    }

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
    // DELIVERED only. SHIPPED was accepted here, which let funds be released
    // while the goods were still in transit — the seller could call this
    // themselves the moment they handed the parcel over, so escrow held nothing.
    if (escrow.status !== 'DELIVERED') {
      throw new Error(`Cannot release: status is ${escrow.status} (buyer must confirm delivery)`);
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
