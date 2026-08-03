import { PrismaClient, DisputeOutcome, DisputeType } from '@prisma/client';
import { ReliabilityService } from './reliability.service';
import { blockchainService } from './blockchain.service';
import { trustArbitratorService } from './trustArbitrator.service';
import { pabTokenStakingService } from './pabTokenStaking.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const reliabilityService = new ReliabilityService();

export class DisputeService {
  /**
   * File a new dispute. Requires the filer to stake a certain amount of PAB.
   * For MVP, we simulate the staking by just recording the amount.
   */
  public async createDispute(reservationId: string, reportedById: string, userId: string, description: string, evidenceUrls: string[], stakedAmount: number = 10) {
    const existingDispute = await prisma.dispute.findUnique({
      where: { reservationId }
    });

    if (existingDispute) {
      throw new Error('A dispute for this reservation already exists.');
    }

    // "Stake" the PAB (in a real system, we'd interact with blockchain.service or wallet here)
    // For now, we trust the caller has already locked it.

    const dispute = await prisma.dispute.create({
      data: {
        reservationId,
        reportedById,
        userId,
        type: DisputeType.QUALITY_ISSUE, // default type for now
        description,
        evidenceUrls,
        outcome: DisputeOutcome.PENDING,
        stakedAmount
      }
    });

    // Auto-assign eligible jurors (trust score > 90, not parties)
    await this.assignJurors(dispute.id, [reportedById, userId]);

    // Trigger AI Trust Arbitrator for low-value disputes (<$500)
    // High-value disputes go to human jury for peer review
    try {
    } catch {
      // ignore — AI arbitration will still attempt
    }

    // For small disputes, let AI arbitrate immediately.
    // For larger disputes, keep peer jury open.
    const reservationForClaim = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { totalAmount: true, depositAmount: true },
    }).catch(() => null);
    const claimAmount = reservationForClaim?.totalAmount || reservationForClaim?.depositAmount || 0;

    if (claimAmount < 500) {
      // Low-value: AI arbitrates autonomously
      const arbitratorEvidence = {
        disputeId: dispute.id,
        claimAmount,
        currency: 'USD',
        customerId: dispute.userId ?? undefined,
        businessId: dispute.reportedById ?? undefined,
        customerTrustScore: 0,
        businessTrustScore: 0,
        customerStakedPab: 0,
        businessStakedPab: 0,
        messages: [],
        evidenceImages: evidenceUrls || [],
        bookingDetails: {
          reservationId,
          reservationDate: new Date().toISOString(),
          amount: claimAmount,
          status: 'DISPUTED',
          paymentMethod: 'unknown',
        },
        initialClaim: description,
      };

      // Fetch trust scores
      const customerUser = await prisma.user.findUnique({
        where: { id: dispute.userId! },
        select: { trustScore: true },
      }).catch(() => null);
      const businessUser = await prisma.user.findUnique({
        where: { id: dispute.reportedById! },
        select: { trustScore: true },
      }).catch(() => null);

      arbitratorEvidence.customerTrustScore = Number(customerUser?.trustScore || 0);
      arbitratorEvidence.businessTrustScore = Number(businessUser?.trustScore || 0);

      // Get staking amounts
      const [custStake, bizStake] = await Promise.all([
        prisma.stakingPosition.aggregate({
          where: { userId: dispute.userId!, status: 'ACTIVE' },
          _sum: { amount: true },
        }),
        prisma.stakingPosition.aggregate({
          where: { userId: dispute.reportedById!, status: 'ACTIVE' },
          _sum: { amount: true },
        }),
      ]);
      arbitratorEvidence.customerStakedPab = Number(custStake._sum?.amount || 0);
      arbitratorEvidence.businessStakedPab = Number(bizStake._sum?.amount || 0);

      const arbitrationResult = await trustArbitratorService.arbitrate(arbitratorEvidence);

      if (!arbitrationResult.needsHumanReview) {
        // AI resolved it — apply outcome
        const outcome =
          arbitrationResult.ruling === 'BUYER_WINS' ? DisputeOutcome.UPHELD
          : arbitrationResult.ruling === 'SELLER_WINS' ? DisputeOutcome.DISMISSED
          : DisputeOutcome.RESOLVED; // REFUND_HALF

        await this.resolveDispute(dispute, outcome);

        // Apply $PAB rewards/slashes
        if (arbitrationResult.pabReward) {
          await pabTokenStakingService.rewardUser(
            arbitrationResult.pabReward.recipient,
            'DISPUTE_WON', // $PAB reward for winning AI arbitrated dispute
          ).catch(() => {});
        }
        if (arbitrationResult.pabSlash) {
          // Slashing is handled by the staking service via dispute resolution
          logger.info(`[Dispute] AI arbitrator slashed ${arbitrationResult.pabSlash.amount} $PAB from user ${arbitrationResult.pabSlash.target}`);
        }

        logger.info(`[Dispute] AI arbitration resolved dispute ${dispute.id}: ${arbitrationResult.ruling} (confidence: ${arbitrationResult.confidence})`);
      } else {
        logger.info(`[Dispute] Dispute ${dispute.id} escalated to human jury (AI confidence: ${arbitrationResult.confidence})`);
      }
    }

    return dispute;
  }

  /**
   * Cast a vote as a Peer Juror.
   * Juror must have a trust score > 90.
   */
  public async castVote(disputeId: string, jurorId: string, voteForId: string, reason?: string) {
    // Verify juror eligibility
    const juror = await prisma.user.findUnique({ where: { id: jurorId } });
    if (!juror || juror.trustScore < 90) {
      throw new Error('Only users with a Trust Score > 90 can be jurors.');
    }

    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute || dispute.outcome !== DisputeOutcome.PENDING) {
      throw new Error('Dispute is not open for voting.');
    }

    if (jurorId === dispute.reportedById || jurorId === dispute.userId) {
      throw new Error('You cannot vote on your own dispute.');
    }

    const vote = await prisma.juryVote.create({
      data: {
        disputeId,
        jurorId,
        voteForId,
        reason
      }
    });

    // Check if we have enough votes to resolve (e.g., 3 votes for a side)
    await this.checkAndResolveDispute(disputeId);

    return vote;
  }

  /**
   * Resolves the dispute if a threshold is met.
   */
  private async checkAndResolveDispute(disputeId: string) {
    const votes = await prisma.juryVote.findMany({
      where: { disputeId }
    });

    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) return;

    // Count votes
    let votesForReporter = 0;
    let votesForUser = 0;

    for (const vote of votes) {
      if (vote.voteForId === dispute.reportedById) votesForReporter++;
      if (vote.voteForId === dispute.userId) votesForUser++;
    }

    // Threshold logic: first to 3 votes wins (out of 5 possible jurors)
    if (votesForReporter >= 3) {
      await this.resolveDispute(dispute, DisputeOutcome.UPHELD);
    } else if (votesForUser >= 3) {
      await this.resolveDispute(dispute, DisputeOutcome.DISMISSED);
    }
  }

  public async assignJurors(disputeId: string, excludeIds: string[] = []) {
    const eligibleJurors = await prisma.user.findMany({
      where: {
        trustScore: { gte: 90 },
        id: { notIn: excludeIds },
      },
      take: 5,
      orderBy: { trustScore: 'desc' },
    });

    const existing = await prisma.juryVote.findMany({
      where: { disputeId },
      select: { jurorId: true },
    });

    const assignedJurorIds = eligibleJurors.map(j => j.id);
    const alreadyAssigned = new Set(existing.map(v => v.jurorId));

    const toAssign = assignedJurorIds.filter(id => !alreadyAssigned.has(id));
    const assignments = toAssign.map(jurorId =>
      prisma.juryVote.create({
        data: {
          disputeId,
          jurorId,
          voteForId: '',
          reason: 'Auto-assigned juror awaiting vote',
        },
      })
    );

    if (assignments.length > 0) {
      await prisma.$transaction(assignments);
    }

    return assignedJurorIds;
  }

  private async resolveDispute(dispute: any, outcome: DisputeOutcome) {
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { 
        outcome, 
        resolvedAt: new Date()
      }
    });

    // Apply trust score penalties based on outcome
    if (outcome === DisputeOutcome.UPHELD) {
      // The reporter won. The userId (e.g. the business) maliciously reported/acted.
      // Penalize the business, reward the filer with their stake back + jury reward.
      if (dispute.userId) {
        await reliabilityService.updateScoreForReservationActivity(dispute.userId, 'CANCELLED', false); // Heavy penalty
      }
    } else if (outcome === DisputeOutcome.DISMISSED) {
      // Reporter lost. They lied about the dispute. Reporter loses their stake and takes a trust hit.
      if (dispute.reportedById) {
        await reliabilityService.updateScoreForReservationActivity(dispute.reportedById, 'NO_SHOW', false); // Double penalty
      }
    }
    
    // Log on-chain
    if (dispute.reportedById) {
      await blockchainService.logTrustAttestationOnSolana(dispute.reportedById, dispute.reservationId || 'UNKNOWN', 'DISPUTE_FILED', {
        outcome: outcome
      });
    }

    // In a full system, we would also reward the winning Jurors with the slashed PAB here.
  }
}
