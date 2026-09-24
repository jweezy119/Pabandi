export type DisputeStatus = 'AI_ADVISORY' | 'JUROR_VOTING' | 'APPEAL' | 'RESOLVED';
export type Verdict = 'TENANT_WINS' | 'LANDLORD_WINS' | 'SPLIT';
export declare class KlerosStyleArbitration {
    /** Open a dispute. AI advisory fires immediately (non-binding). */
    openDispute(disputeId: string, tenantId: string, landlordId: string, claim: string): Promise<any>;
    /** Non-binding AI advisory verdict (instant). Clearly labeled NON-BINDING. */
    private aiAdvisory;
    /** A staked juror casts a vote. Requires $PAB stake (juror risk). */
    castJurorVote(disputeId: string, jurorId: string, stakePab: number, vote: Verdict): Promise<any>;
    /** Tally juror votes (Schelling: majority stake wins). Auto-resolves at deadline. */
    resolve(disputeId: string): Promise<any>;
    /** Appeal: losing side stakes $PAB to escalate. Frivolous appeals get slashed on confirm. */
    appeal(disputeId: string, byParty: string, bondPab: number): Promise<any>;
    private store;
    private persist;
    private load;
}
export declare const klerosArbitration: KlerosStyleArbitration;
//# sourceMappingURL=klerosArbitration.service.d.ts.map