import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

/**
 * dao.service.ts
 * 
 * Handles Pabandi DAO governance mechanics.
 * Trust Passports act as the identity for voting, and voting power is dynamically 
 * weighted based on the user's Trust Score (and theoretically staked $PAB).
 */
export class DaoService {
  /**
   * Create a new DAO proposal.
   */
  async createProposal(proposerPassportId: string, title: string, description: string, durationDays: number = 7) {
    const passport = await prisma.trustPassport.findUnique({ where: { id: proposerPassportId } });
    if (!passport) throw new Error('Trust Passport not found');

    // Only trusted users can create proposals
    if ((passport.riskScore ?? 0) < 50) {
      throw new Error('Trust Score too low to create a proposal');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const proposal = await prisma.daoProposal.create({
      data: {
        proposerId: proposerPassportId,
        title,
        description,
        expiresAt
      }
    });

    logger.info(`[DAO] Proposal created: ${proposal.id} - "${title}" by ${passport.handle}`);
    return proposal;
  }

  /**
   * Cast a vote on a proposal. 
   * Weight is determined by the voter's Trust Score.
   */
  async castVote(proposalId: string, voterPassportId: string, vote: 'FOR' | 'AGAINST') {
    const proposal = await prisma.daoProposal.findUnique({ where: { id: proposalId } });
    if (!proposal || proposal.status !== 'ACTIVE') {
      throw new Error('Proposal not found or inactive');
    }

    if (new Date() > proposal.expiresAt) {
      await this.evaluateProposal(proposalId);
      throw new Error('Proposal has expired');
    }

    const passport = await prisma.trustPassport.findUnique({ where: { id: voterPassportId } });
    if (!passport) throw new Error('Trust Passport not found');

    // Weight = Trust Score (0-100)
    // In the future, this would also add staked PAB token amounts.
    const weight = passport.riskScore ?? 10;

    const daoVote = await prisma.daoVote.create({
      data: {
        proposalId,
        voterId: voterPassportId,
        vote,
        weight
      }
    });

    // Update tallies
    if (vote === 'FOR') {
      await prisma.daoProposal.update({
        where: { id: proposalId },
        data: { forVotes: { increment: weight } }
      });
    } else {
      await prisma.daoProposal.update({
        where: { id: proposalId },
        data: { againstVotes: { increment: weight } }
      });
    }

    logger.info(`[DAO] Vote cast on ${proposalId}: ${vote} (Weight: ${weight}) by ${passport.handle}`);
    return daoVote;
  }

  /**
   * Evaluate a proposal to see if it passed or failed.
   */
  async evaluateProposal(proposalId: string) {
    const proposal = await prisma.daoProposal.findUnique({ where: { id: proposalId } });
    if (!proposal || proposal.status !== 'ACTIVE') return;

    const totalVotes = proposal.forVotes + proposal.againstVotes;
    
    let newStatus = 'REJECTED';
    if (totalVotes >= proposal.quorum && proposal.forVotes > proposal.againstVotes) {
      newStatus = 'PASSED';
    } else if (new Date() < proposal.expiresAt) {
      return; // Still active
    }

    await prisma.daoProposal.update({
      where: { id: proposalId },
      data: { status: newStatus }
    });

    logger.info(`[DAO] Proposal ${proposalId} evaluated: ${newStatus}`);
  }
}

export const daoService = new DaoService();
