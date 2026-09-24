/**
 * blockchain.types.ts
 * ─────────────────────────────────────────────
 * Shared types for Pabandi's blockchain integration (BSC + Solana).
 * Defined here so server code doesn't cross rootDir boundaries.
 */
export declare enum BadgeTier {
    Bronze = 0,
    Silver = 1,
    Gold = 2,
    Platinum = 3
}
export declare const BADGE_TIER_NAMES: Record<BadgeTier, string>;
export declare const BADGE_TIER_CONFIG: Record<BadgeTier, {
    name: string;
    emoji: string;
    minBookings: number;
    minShowRate: number;
}>;
/**
 * Compute which badge tier a user is eligible for based on stats.
 */
export declare function computeEligibleTier(totalBookings: number, showRate: number): BadgeTier | null;
export interface MintBadgeResult {
    success: boolean;
    chain: 'bsc' | 'solana' | 'simulated';
    tokenId?: string;
    txHash?: string;
    badgePDA?: string;
    tier: BadgeTier;
    tierName: string;
    error?: string;
}
export interface EscrowResult {
    success: boolean;
    txHash?: string;
    reservationIdHash: string;
    error?: string;
}
//# sourceMappingURL=blockchain.types.d.ts.map