import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { trustCore } from '../trust/trust-core';
import { CustomError } from '../middleware/errorHandler';
import {
  canUniversalTransition,
  explainTransition,
  isUniversalEscrowStatus,
} from './universal-escrow.rules';

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
    if (!isUniversalEscrowStatus(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    // Read before write. The previous version updated blind and validated only
    // the target string, so the current state was never consulted and every
    // transition in the 7x7 grid was reachable.
    const current = await prisma.universalEscrow.findUnique({
      where: { referenceId },
      select: { status: true },
    });
    if (!current) throw new CustomError(`Escrow not found: ${referenceId}`, 404);

    // Self-transition is an idempotent no-op, not a transition. Two callers rely
    // on this: failure-ownership.service.ts guards against released/refunded but
    // not against an escrow that is ALREADY disputed, and one of its two call
    // sites has no try/catch, so refusing `disputed -> disputed` would throw
    // during dispute creation.
    //
    // Returning early rather than writing also stops a repeated dispute from
    // emitting a second `escrow.disputed` trust event, which would double-count
    // the negative signal against the counterparty.
    if (current.status === status) {
      return prisma.universalEscrow.findUnique({ where: { referenceId } });
    }

    // 409, not 400 or 500: the request was well-formed and the caller is a party,
    // but the escrow's current state does not permit this move. The previous code
    // had no such refusal at all; adding one as a bare Error would surface as a
    // 500 and read as "the server is broken" rather than "that transition is not
    // allowed from here".
    if (!canUniversalTransition(current.status, status)) {
      throw new CustomError(explainTransition(current.status, status), 409);
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
