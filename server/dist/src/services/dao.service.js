"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.daoService = exports.DaoService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
/**
 * dao.service.ts
 *
 * Handles Pabandi DAO governance mechanics.
 * Trust Passports act as the identity for voting, and voting power is dynamically
 * weighted based on the user's Trust Score (and theoretically staked $PAB).
 */
class DaoService {
    /**
     * Create a new DAO proposal.
     */
    async createProposal(proposerPassportId, title, description, durationDays = 7) {
        const passport = await database_1.prisma.trustPassport.findUnique({ where: { id: proposerPassportId } });
        if (!passport)
            throw new Error('Trust Passport not found');
        // Only trusted users can create proposals
        if ((passport.riskScore ?? 0) < 50) {
            throw new Error('Trust Score too low to create a proposal');
        }
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);
        const proposal = await database_1.prisma.daoProposal.create({
            data: {
                proposerId: proposerPassportId,
                title,
                description,
                expiresAt
            }
        });
        logger_1.logger.info(`[DAO] Proposal created: ${proposal.id} - "${title}" by ${passport.handle}`);
        return proposal;
    }
    /**
     * Cast a vote on a proposal.
     * Weight is determined by the voter's Trust Score.
     */
    async castVote(proposalId, voterPassportId, vote) {
        const proposal = await database_1.prisma.daoProposal.findUnique({ where: { id: proposalId } });
        if (!proposal || proposal.status !== 'ACTIVE') {
            throw new Error('Proposal not found or inactive');
        }
        if (new Date() > proposal.expiresAt) {
            await this.evaluateProposal(proposalId);
            throw new Error('Proposal has expired');
        }
        const passport = await database_1.prisma.trustPassport.findUnique({ where: { id: voterPassportId } });
        if (!passport)
            throw new Error('Trust Passport not found');
        // Weight = Trust Score (0-100)
        // In the future, this would also add staked PAB token amounts.
        const weight = passport.riskScore ?? 10;
        const daoVote = await database_1.prisma.daoVote.create({
            data: {
                proposalId,
                voterId: voterPassportId,
                vote,
                weight
            }
        });
        // Update tallies
        if (vote === 'FOR') {
            await database_1.prisma.daoProposal.update({
                where: { id: proposalId },
                data: { forVotes: { increment: weight } }
            });
        }
        else {
            await database_1.prisma.daoProposal.update({
                where: { id: proposalId },
                data: { againstVotes: { increment: weight } }
            });
        }
        logger_1.logger.info(`[DAO] Vote cast on ${proposalId}: ${vote} (Weight: ${weight}) by ${passport.handle}`);
        return daoVote;
    }
    /**
     * Evaluate a proposal to see if it passed or failed.
     */
    async evaluateProposal(proposalId) {
        const proposal = await database_1.prisma.daoProposal.findUnique({ where: { id: proposalId } });
        if (!proposal || proposal.status !== 'ACTIVE')
            return;
        const totalVotes = proposal.forVotes + proposal.againstVotes;
        let newStatus = 'REJECTED';
        if (totalVotes >= proposal.quorum && proposal.forVotes > proposal.againstVotes) {
            newStatus = 'PASSED';
        }
        else if (new Date() < proposal.expiresAt) {
            return; // Still active
        }
        await database_1.prisma.daoProposal.update({
            where: { id: proposalId },
            data: { status: newStatus }
        });
        logger_1.logger.info(`[DAO] Proposal ${proposalId} evaluated: ${newStatus}`);
    }
}
exports.DaoService = DaoService;
exports.daoService = new DaoService();
//# sourceMappingURL=dao.service.js.map