export interface MerkleProof {
    leaf: string;
    proof: {
        hash: string;
        position: 'left' | 'right';
    }[];
    root: string;
}
export declare class MerkleZKEngine {
    /**
     * Build a Merkle Tree from a list of wallet addresses.
     * Returns the root hash and individual proofs for each address.
     */
    buildTree(walletAddresses: string[]): {
        root: string;
        proofs: Map<string, MerkleProof>;
        leafCount: number;
    };
    /**
     * Verify a Merkle Proof. This can be done by ANYONE — the user, the brand,
     * or a Solana smart contract. No database access needed.
     */
    verifyProof(walletAddress: string, proof: MerkleProof): boolean;
}
export declare const merkleZKEngine: MerkleZKEngine;
//# sourceMappingURL=merkle-zk.engine.d.ts.map