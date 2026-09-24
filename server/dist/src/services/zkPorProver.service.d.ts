export interface PorProofInputs {
    months_paid: number;
    graceDays: number;
    issuedAt: number;
    tenant_secret: string;
    rent_amount: number;
    paid_ts: number;
    due_ts: number;
    salt: string;
}
export interface PorProof {
    proofId: string;
    commitment: string;
    publicInputs: Record<string, string>;
    zkType: 'noir-constraint';
    circuitCompiled: boolean;
    issuedAt: string;
}
export declare class ZkPorProver {
    private circuitReady;
    private circuitName;
    constructor();
    /**
     * Generate a zero-knowledge Proof of Rent (on-time payment, identity/amount hidden).
     */
    prove(inputs: PorProofInputs): Promise<PorProof>;
    /** Verifier (third party): only public signals are checked; never the private inputs. */
    verify(proof: PorProof): Promise<{
        valid: boolean;
        reason: string;
    }>;
}
export declare const zkPorProver: ZkPorProver;
//# sourceMappingURL=zkPorProver.service.d.ts.map