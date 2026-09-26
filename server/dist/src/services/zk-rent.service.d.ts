/**
 * Service to handle Proof of Rent (PoR) using simulated Zero-Knowledge Proofs.
 * In production, this would interface with @noir-lang/noir_js or a similar
 * ZK proving system to generate and verify UltraPlonk/Honk proofs.
 */
export declare class ZKRentService {
    private vcService;
    constructor();
    /**
     * Records a rent payment and updates consecutive on-time metrics.
     */
    recordPayment(leaseId: string, amount: number, isOnTime: boolean): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        amount: number;
        txHash: string | null;
        dueDate: Date;
        leaseId: string;
        paymentDate: Date;
        isOnTime: boolean;
    }>;
    /**
     * Generates a ZK Proof of Rent asserting consecutive on-time payments,
     * wrapped in a W3C Verifiable Credential.
     */
    generateProofOfRentVC(leaseId: string): Promise<{
        vcId: string;
        proof: string;
        consecutiveOnTime: number;
    }>;
    /**
     * Verifies a presented ZK Proof of Rent.
     */
    verifyProofOfRent(proof: string, publicInputs: any): Promise<boolean>;
    private simulateNoirProofGeneration;
    private simulateNoirProofVerification;
}
export declare const zkRentService: ZKRentService;
//# sourceMappingURL=zk-rent.service.d.ts.map