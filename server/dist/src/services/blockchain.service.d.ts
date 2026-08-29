/**
 * blockchain.service.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Server-side integration with Pabandi's smart contracts.
 *
 * BSC (EVM) — via ethers.js v6 (install: npm i ethers):
 *   • PABToken.sol      — mint PAB rewards on-chain
 *   • PabandiEscrow.sol — create/release/refund booking deposits
 *   • PabandiSoulbound  — mint soulbound NFT loyalty badges
 *
 * Solana — via @solana/web3.js (already in server deps):
 *   • Badge PDA verification (read-only)
 *
 * All actions gracefully degrade — if contract addresses are not set in .env,
 * the server logs a warning but continues (DB-only mode).
 *
 * To fully activate:
 *   1. npm i ethers           (in /server)
 *   2. Deploy contracts:  cd contracts && npm run deploy:testnet
 *   3. Set env vars:  PAB_TOKEN_ADDRESS, ESCROW_CONTRACT_ADDRESS,
 *                     SOULBOUND_CONTRACT_ADDRESS, MINTER_PRIVATE_KEY
 */
import { BadgeTier, MintBadgeResult, EscrowResult } from '../types/blockchain.types';
export { BadgeTier } from '../types/blockchain.types';
export declare class BlockchainService {
    private getEthers;
    private getSolanaWeb3;
    private getProvider;
    private getSigner;
    mintPabOnChain(walletAddress: string, amount: number, reservationId: string, rewardType: string): Promise<{
        txHash?: string;
        simulated: boolean;
    }>;
    private escrowAction;
    releaseEscrow(reservationId: string): Promise<EscrowResult>;
    refundEscrow(reservationId: string): Promise<EscrowResult>;
    forfeitEscrow(reservationId: string): Promise<EscrowResult>;
    mintBadge(walletAddress: string, tier: BadgeTier, pseudonymousId: string, reliabilityScore: number, totalBookings: number, aiTrustProfile?: string): Promise<MintBadgeResult>;
    verifyBscBadge(walletAddress: string, minTier: BadgeTier): Promise<boolean>;
    /**
     * Verify Solana badge via PDA account existence check.
     */
    verifySolanaBadge(walletAddress: string, minTier: BadgeTier): Promise<{
        verified: boolean;
        highestTier: BadgeTier | null;
    }>;
    /**
     * Compute tier eligibility and mint if not already minted.
     */
    checkAndMintEligibleBadge(walletAddress: string | null, pseudonymousId: string, reliabilityScore: number, totalBookings: number, showRate: number, aiTrustProfile: string): Promise<MintBadgeResult | null>;
    executeSolanaTransfer(walletAddress: string, amount: number): Promise<{
        txHash?: string;
        error?: string;
    }>;
    /**
     * Fetches the Solana wallet profile for a given address.
     * In a production environment, this would call Solana RPCs or indexers (like Helius/Shyft)
     * to get accurate balance, NFT holdings, and DeFi history.
     * For the current prototype, it returns a simulated but realistic profile based on the address structure.
     */
    getSolanaWalletProfile(walletAddress: string): Promise<any>;
    /**
     * Simulates logging a trust event as a cryptographically verifiable attestation on Solana.
     * This provides public proof for naysayers that the trust history is immutable.
     */
    logTrustAttestationOnSolana(userId: string, reservationId: string, action: 'COMPLETED_BOOKING' | 'NO_SHOW' | 'DISPUTE_FILED' | 'LATE_CANCELLATION', metadata?: Record<string, any>): Promise<{
        txHash?: string;
        error?: string;
    }>;
}
export declare const blockchainService: BlockchainService;
//# sourceMappingURL=blockchain.service.d.ts.map