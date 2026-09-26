import { MerkleProof } from './merkle-zk.engine';
export declare class ZKMarketplaceService {
    /**
     * PHASE 1: Brand Preview
     * Returns ONLY the audience count and the Merkle Root hash.
     * The brand cannot derive any wallet address from the root.
     */
    getAudiencePreview(criteria: any): Promise<{
        audienceSize: number;
        merkleRoot: string;
    }>;
    /**
     * PHASE 2: Campaign Execution
     * Builds the full Merkle Tree, stores proofs, and notifies each user
     * with their personal Merkle Proof so they can claim trustlessly.
     */
    executeCampaign(campaignId: string): Promise<{
        merkleRoot: string;
        usersNotified: number;
    }>;
    /**
     * PHASE 3: User Claims Their Reward
     * The user presents their wallet address + Merkle Proof.
     * We verify it against the published root — pure math, no DB lookup.
     * If valid and unclaimed, we transfer USDC.
     */
    claimReward(campaignId: string, walletAddress: string, proof: MerkleProof): Promise<{
        success: boolean;
        reason?: string;
    }>;
}
export declare const zkMarketplaceService: ZKMarketplaceService;
//# sourceMappingURL=zk-marketplace.service.d.ts.map