import { PrismaClient, DisputeStatus } from '@prisma/client';
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
  public async createDispute(reservationId: string, filedById: string, againstId: string, reason: string, evidenceUrls: string[], stakedAmount: number = 10) {
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
        filedById,
        againstId,
        reason,
        evidenceUrls,
        status: DisputeStatus.VOTING,
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
    if (!dispute || dispute.status !== DisputeStatus.VOTING) {
      throw new Error('Dispute is not open for voting.');
    }

    if (jurorId === dispute.filedById || jurorId === dispute.againstId) {
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
    let votesForFiler = 0;
    let votesForAgainst = 0;

    for (const vote of votes) {
      if (vote.voteForId === dispute.filedById) votesForFiler++;
      if (vote.voteForId === dispute.againstId) votesForAgainst++;
    }

    // Threshold logic: first to 3 votes wins (out of 5 possible jurors)
    if (votesForFiler >= 3) {
      await this.resolveDispute(dispute, DisputeStatus.RESOLVED_FAVOR_FILER);
    } else if (votesForAgainst >= 3) {
      await this.resolveDispute(dispute, DisputeStatus.RESOLVED_FAVOR_AGAINST);
    }
  }

  private async resolveDispute(dispute: any, status: DisputeStatus) {
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { 
        status, 
        resolvedAt: new Date(),
        resolution: `Resolved by Peer Jury: ${status}`
      }
    });

    // Apply trust score penalties based on outcome
    if (status === DisputeStatus.RESOLVED_FAVOR_FILER) {
      // The filer won. The againstId (e.g. the business) maliciously reported.
      // Penalize the business, reward the filer with their stake back + jury reward.
      await reliabilityService.updateScoreForReservationActivity(dispute.againstId, 'CANCELLATION', 0); // Heavy penalty for lying
    } else if (status === DisputeStatus.RESOLVED_FAVOR_AGAINST) {
      // Filer lost. They lied about the dispute. Filer loses their stake and takes a trust hit.
      await reliabilityService.updateScoreForReservationActivity(dispute.filedById, 'NO_SHOW', 0); // Double penalty
    }
    
    // Log on-chain
    await blockchainService.logTrustAttestationOnSolana(dispute.filedById, dispute.reservationId, 'DISPUTE_FILED', {
      outcome: status
    });

    // In a full system, we would also reward the winning Jurors with the slashed PAB here.
  }
}
