export interface PassportObject {
    wallet_address: string | null;
    trust_score: number;
    score_tier: ScoreTier;
    total_actions: number;
    punctuality_rate: number;
    completed_bookings: number;
    missed_bookings: number;
    disputes_lost: number;
    disputes_won: number;
    first_seen: string;
    last_updated: string;
    flags: string[];
}
export type ScoreTier = 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Unrated';
export interface EligibilityResult {
    status: 'eligible' | 'not_eligible';
    score_tier: ScoreTier;
    trust_score: number;
    action_required?: string;
}
export interface VerifyResult {
    status: 'ok' | 'below_threshold' | 'not_found';
    passport?: PassportObject;
    required_tier?: ScoreTier;
    actual_tier?: ScoreTier;
    action_required?: string;
    message?: string;
}
/**
 * Derive the score tier from a 0–1000 trust score.
 */
export declare function deriveScoreTier(score: number): ScoreTier;
/**
 * Assemble the full Passport object for a user.
 */
export declare function assemblePassport(userId: string): Promise<PassportObject | null>;
/**
 * Assemble a Passport by wallet address.
 */
export declare function assemblePassportByWallet(walletAddress: string): Promise<PassportObject | null>;
/**
 * Check if a user meets a required tier threshold.
 */
export declare function checkEligibility(walletAddress: string, requiredTier: ScoreTier): Promise<EligibilityResult>;
/**
 * Verify a user's Passport with an optional tier threshold.
 */
export declare function verifyPassport(walletAddress: string, requiredTier?: ScoreTier): Promise<VerifyResult>;
/**
 * Record an incident (dispute) against a user and update their reliability score.
 */
export declare function recordIncident(walletAddress: string, type: string, description?: string, apiClientId?: string): Promise<{
    incident_id: string;
    status: string;
    score_impact: number;
} | null>;
/**
 * Bind an X.509 PKI certificate to a wallet (GB/Z 185.3 Compliance)
 */
export declare function bindX509Certificate(walletAddress: string, certificate: string, signedNonce: string): Promise<{
    success: boolean;
    message: string;
}>;
//# sourceMappingURL=passport.service.d.ts.map