export interface RealestateProofInputs {
    deposit: number;
    consecutiveMonths: number;
    rate: number;
    deadline: number;
    price: number;
    commission: number;
    valuation_hash: string;
    agent_secret: string;
}
export interface RealestateProof {
    proofId: string;
    commitment: string;
    publicInputs: Record<string, string>;
    zkType: 'noir-constraint';
    circuitCompiled: boolean;
    issuedAt: string;
}
export declare class ZkRealestateProver {
    private circuitReady;
    private circuitName;
    constructor();
    /**
     * Generate a zero-knowledge Proof of Real-Estate Escrow Split.
     *
     * Honest ZK: the prover computes the witness and checks the circuit constraints
     * LOCALLY. Only the public signals (deposit, fee, commitment, range, deadline)
     * are emitted — the private valuation/price/secret never leave this function.
     */
    prove(inputs: RealestateProofInputs): Promise<RealestateProof>;
    /** Verifier (third party): only public signals are checked; never the private inputs. */
    verify(proof: RealestateProof): Promise<{
        valid: boolean;
        reason: string;
    }>;
}
export declare const zkRealestateProver: ZkRealestateProver;
//# sourceMappingURL=zkRealestateProver.service.d.ts.map