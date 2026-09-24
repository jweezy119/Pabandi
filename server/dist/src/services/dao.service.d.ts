/**
 * dao.service.ts
 *
 * Handles Pabandi DAO governance mechanics.
 * Trust Passports act as the identity for voting, and voting power is dynamically
 * weighted based on the user's Trust Score (and theoretically staked $PAB).
 */
export declare class DaoService {
    /**
     * Create a new DAO proposal.
     */
    createProposal(proposerPassportId: string, title: string, description: string, durationDays?: number): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date;
        status: string;
        description: string;
        title: string;
        proposerId: string;
        forVotes: number;
        againstVotes: number;
        quorum: number;
    }>;
    /**
     * Cast a vote on a proposal.
     * Weight is determined by the voter's Trust Score.
     */
    castVote(proposalId: string, voterPassportId: string, vote: 'FOR' | 'AGAINST'): Promise<{
        id: string;
        createdAt: Date;
        voterId: string;
        weight: number;
        vote: string;
        proposalId: string;
    }>;
    /**
     * Evaluate a proposal to see if it passed or failed.
     */
    evaluateProposal(proposalId: string): Promise<void>;
}
export declare const daoService: DaoService;
//# sourceMappingURL=dao.service.d.ts.map