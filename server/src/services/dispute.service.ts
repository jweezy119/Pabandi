import { DisputeOutcome, DisputeType } from '@prisma/client';
import { prisma } from '../utils/database';

export class DisputeService {
  public async createDispute(
    reservationId: string,
    reportedById: string,
    userId: string,
    description: string,
    evidenceUrls: string[] = [],
    stakedAmount: number = 10
  ) {
    return prisma.dispute.create({
      data: {
        reportedById,
        userId,
        type: DisputeType.POOR_SERVICE,
        description,
        evidenceUrls,
        outcome: DisputeOutcome.PENDING,
        stakedAmount,
        contextType: 'BOOKING',
        contextId: reservationId,
      },
    });
  }

  public async fileContextDispute(params: {
    contextType: string;
    contextId: string;
    filedById: string;
    againstId: string;
    reason: string;
    evidenceUrls?: string[];
    stakedAmount?: number;
  }) {
    return prisma.dispute.create({
      data: {
        reportedById: params.filedById,
        userId: params.againstId,
        type: DisputeType.POOR_SERVICE,
        description: params.reason,
        evidenceUrls: params.evidenceUrls || [],
        outcome: DisputeOutcome.PENDING,
        stakedAmount: params.stakedAmount || 0,
        contextType: params.contextType,
        contextId: params.contextId,
      },
    });
  }

  public async castVote(disputeId: string, jurorId: string, voteForId: string, reason?: string) {
    return { success: true, disputeId, jurorId, voteForId, reason };
  }
}

export const disputeService = new DisputeService();
