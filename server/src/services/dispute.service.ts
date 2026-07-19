import { PrismaClient, DisputeOutcome, DisputeType } from '@prisma/client';
import { ReliabilityService } from './reliability.service';
import { TrustScoreService } from './trustScore.service';
import { blockchainService } from './blockchain.service';

const prisma = new PrismaClient();
const reliabilityService = new ReliabilityService();
const trustScoreService = new TrustScoreService();

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
