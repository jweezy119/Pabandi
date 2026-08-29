export interface PorProof {
    proofId: string;
    commitment: string;
    nullifier: string;
    merkleRoot: string;
    consecutiveMonths: number;
    zkType: 'noir-constraint';
    circuitCompiled: boolean;
    anchor: any;
    issuedAt: string;
}
export declare class ZkNullifierService {
    private circuitReady;
    constructor();
    /**
     * Issue a nullifier-protected Proof of Rent.
     * Replay-protected: same (tenantDID, propertyDID) can only be issued once.
     * Real ZK: secret stays with the prover; only public signals are emitted.
     */
    issueProof(tenantDID: string, propertyDID: string, consecutiveMonths: number, secret?: string): Promise<PorProof>;
    /** Verify: nullifier registered + merkle root matches (third party never sees the secret). */
    verifyProof(proof: {
        commitment: string;
        nullifier: string;
        merkleRoot: string;
    }): Promise<{
        valid: boolean;
        reason: string;
    }>;
    merkleRoot(nullifiers: string[]): string;
    getIssuedCount(): number;
}
export declare const zkNullifierService: ZkNullifierService;
//# sourceMappingURL=zkNullifier.service.d.ts.map