export type ProposalStatus = 'OPEN' | 'PASSED' | 'REJECTED';
export type VoteChoice = 'FOR' | 'AGAINST' | 'ABSTAIN';
export interface Vote {
    voterId: string;
    trustBand: string;
    stakedPpd: number;
    choice: VoteChoice;
    power: number;
}
export declare class AragonStyleDao {
    /** Quadratic voting power: sqrt(trustBandMultiplier * stakedPPD). */
    votePower(trustBand: string, stakedPpd: number): number;
    private proposals;
    createProposal(proposalId: string, title: string, body: string): Promise<any>;
    /** Cast a quadratic vote. power is derived from trust band + staked PPD (not raw tokens). */
    castVote(proposalId: string, voterId: string, trustBand: string, stakedPpd: number, choice: VoteChoice): Promise<any>;
    /** Bicameral check: >50% unique wallets AND >50% trust-weighted power must be FOR.
     *  Requires a minimum quorum (>=2 distinct wallets) so a single vote can't auto-pass. */
    private maybeFinalize;
    getProposal(proposalId: string): any;
}
export declare const aragonDao: AragonStyleDao;
//# sourceMappingURL=aragonDao.service.d.ts.map