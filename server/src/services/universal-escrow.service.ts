import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { trustCore } from '../trust/trust-core';

export interface EscrowParty {
  partyId: string;
  role: 'buyer' | 'seller' | 'broker';
}

export interface EscrowCondition {
  type: 'delivery' | 'milestone' | 'checkin' | 'manual';
  verify: Record<string, any>;
}

export class UniversalEscrowService {
  async create(input: {
    referenceId: string;
    template: string;
    parties: EscrowParty[];
    amount: number;
    currency?: string;
    conditions: EscrowCondition[];
    deadline?: string;
    metadata?: Record<string, any>;
  }) {
    const existing = await prisma.universalEscrow.findUnique({
      where: { referenceId: input.referenceId },
    });

    if (existing) {
      return existing;
    }

    return prisma.universalEscrow.create({
      data: {
        referenceId: input.referenceId,
        template: input.template,
        parties: input.parties as any,
        amount: input.amount,
        currency: input.currency || 'USDC',
        conditions: input.conditions as any,
        deadline: input.deadline ? new Date(input.deadline) : null,
        metadata: input.metadata,
        status: 'draft',
      },
    });
  }

  async updateStatus(referenceId: string, status: string) {
    const valid = ['draft', 'funded', 'in_progress', 'conditions_met', 'released', 'disputed', 'refunded'];
    if (!valid.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const escrow = await prisma.universalEscrow.update({
      where: { referenceId },
      data: { status },
    });

    if (status === 'released') {
      const seller = (escrow.parties as any[]).find((p) => p.role === 'seller');
      if (seller?.partyId) {
        trustCore.emit('escrow.released', {
          passportId: seller.partyId,
          escrowId: escrow.id,
          amount: escrow.amount,
        }).catch(err => {
          logger.error(`[UniversalEscrow] trust event failed: ${err.message}`);
        });
      }
    } else if (status === 'disputed') {
      const parties = escrow.parties as any[];
      for (const party of parties) {
        if (party.partyId) {
          trustCore.emit('escrow.disputed', {
            passportId: party.partyId,
            escrowId: escrow.id,
            reason: 'escrow disputed',
          }).catch(err => {
            logger.error(`[UniversalEscrow] trust event failed: ${err.message}`);
          });
        }
      }
    }

    return escrow;
  }

  async getByReference(referenceId: string) {
    return prisma.universalEscrow.findUnique({
      where: { referenceId },
    });
  }

  async listByParty(partyId: string) {
    return prisma.universalEscrow.findMany({
      where: {
        parties: {
          path: ['partyId'],
          equals: partyId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const universalEscrowService = new UniversalEscrowService();
