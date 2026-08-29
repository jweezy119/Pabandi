export interface BadgePayload {
    pseudonymousId: string;
    tier: 'EXCELLENT' | 'AVERAGE' | 'RISKY';
    reliabilityScore: number;
    commerceScore: number;
    hospitalityScore: number;
    appointmentScore: number;
    freelanceScore: number;
    attendanceRate: number;
    totalBookings: number;
    completedBookings: number;
    socialSignals: string[];
    badges: string[];
    socialTrustBoost: number;
    graphTrustBoost?: number;
    verifiedAt: string;
    signedHash: string;
}
export interface SocialTrustBoostResult {
    totalBoost: number;
    breakdown: Record<string, number>;
}
export declare class BadgeService {
    /**
     * Generate a deterministic, privacy-preserving pseudonymous ID
     * from a real user ID. Salted with a server secret so it's never guessable.
     */
    generatePseudonymousId(userId: string): string;
    /**
     * Reverse-lookup: find userId from a pseudonymousId.
     * Required for the public badge endpoint — we must scan all users.
     * In production, store the mapping in a dedicated encrypted table.
     */
    resolveUserFromPseudonymousId(pseudonymousId: string): Promise<string | null>;
    /**
     * Compute social trust boost from a user's linked SocialIdentity records.
     */
    computeSocialTrustBoost(identities: any[]): SocialTrustBoostResult;
    /**
     * Compute the full badge status for a user.
     */
    computeBadgeStatus(userId: string): Promise<BadgePayload>;
    /**
     * Generate the share card payload for a user's social post.
     */
    getShareCard(userId: string, platform: string): Promise<Record<string, string>>;
}
export declare const badgeService: BadgeService;
//# sourceMappingURL=badge.service.d.ts.map