export interface SoulboundReputationTier {
    tier: 'UNVERIFIED' | 'OSINT_VERIFIED' | 'BURNED';
    metadataUrl: string;
}
/**
 * SoulboundReputationService
 *
 * Takes the concept of Trust and puts it on-chain using dynamically
 * updating Soulbound NFTs (Non-Transferable Tokens).
 *
 * Instead of static badges, a user's NFT literally "rots" or "glows"
 * depending on their continuous OSINT MCP footprint and TrustFlux momentum.
 */
export declare class SoulboundReputationService {
    /**
     * Mint a baseline Soulbound Token for a new user/business.
     */
    mintReputationToken(userId: string, walletAddress: string): Promise<{
        success: boolean;
        tokenId: string;
        txHash: string;
        tier: string;
    }>;
    /**
     * Dynamically upgrades the NFT metadata when a user passes the OSINT MCP Pipeline.
     * Gives them the "Glowing" Trust artifact.
     */
    upgradeToOsintVerified(userId: string, tokenId: string): Promise<{
        success: boolean;
        tokenId: string;
        updatedTier: string;
        metadataUrl: string;
        visual: string;
    }>;
    /**
     * Dynamically rots the NFT if the user is caught in the Shadow Escrow
     * or if the OSINT MCP returns highly suspicious threat actor associations.
     */
    rotToken(userId: string, tokenId: string, reason: string): Promise<{
        success: boolean;
        tokenId: string;
        updatedTier: string;
        metadataUrl: string;
        visual: string;
    }>;
}
export declare const soulboundReputationService: SoulboundReputationService;
//# sourceMappingURL=soulboundReputation.service.d.ts.map