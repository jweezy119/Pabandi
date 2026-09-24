interface Pool {
    id: string;
    businessId: string;
    title: string;
    description: string;
    category: string;
    expectedApy: number;
    riskBand: string;
    profitShareRatio: string;
    targetAmount: number;
    currentAmount: number;
    minInvestment: number;
    maxInvestment: number | null | undefined;
    status: string;
    city?: string;
    state?: string;
    country?: string;
    viewCount?: number;
    featured?: boolean;
    rating?: number;
    trustScore?: number;
}
interface InvestorProfile {
    preferredRiskBands: string[];
    preferredCategories: string[];
    preferredRegions: string[];
    minApy: number;
    maxApy: number;
    minInvestment: number;
    maxInvestment: number;
    preferredRatios: string[];
    riskToleranceScore: number;
    investmentStyle: string;
    diversificationScore: number;
    totalInvested: number;
    totalPoolsInvested: number;
    avgInvestmentAmount: number;
}
interface MatchFactors {
    [key: string]: number;
    category: number;
    risk: number;
    apy: number;
    location: number;
    profitRatio: number;
    investmentSize: number;
    poolQuality: number;
}
interface MatchResult {
    score: number;
    factors: MatchFactors;
    reasons: string[];
}
/**
 * Compute an investor profile from their past investments, trust scores, and behavior.
 * Cold-start: uses trust scores + default preferences for new users.
 */
export declare function computeInvestorProfile(investments: Array<{
    poolId: string;
    amount: number;
    status: string;
    pool: Pool;
}>, userTrustScore: number, userCity?: string): InvestorProfile;
/**
 * Score a single pool for a given investor profile.
 * Returns a weighted match score 0-100 with transparent factor breakdown.
 */
export declare function scorePoolForInvestor(pool: Pool, profile: InvestorProfile, investorCity?: string, investorCountry?: string): MatchResult;
export interface ScoredPool {
    pool: Pool;
    score: number;
    factors: MatchFactors;
    reasons: string[];
}
/**
 * Recommend top N pools for an investor.
 */
export declare function recommendPoolsForInvestor(allPools: Pool[], profile: InvestorProfile, options?: {
    limit?: number;
    investorCity?: string;
    investorCountry?: string;
    excludePoolIds?: string[];
}): ScoredPool[];
export interface ScoredInvestor {
    investorId: string;
    profile: InvestorProfile;
    score: number;
    factors: MatchFactors;
    reasons: string[];
}
/**
 * Recommend top N investors for a given pool.
 */
export declare function recommendInvestorsForPool(pool: Pool, investors: Array<{
    userId: string;
    profile: InvestorProfile;
    city?: string;
    country?: string;
}>, options?: {
    limit?: number;
}): ScoredInvestor[];
export interface MatchRecord {
    poolId: string;
    investorId: string;
    matchScore: number;
    matchReasons: string[];
    matchFactors: Record<string, number | string | boolean>;
}
/**
 * Generate match records for a pool against all investor profiles.
 * Returns top N matches ready for DB upsert.
 * NOTE: This is the pure computation function. DB writes happen in the controller/cron.
 */
export declare function generateMatchesForPool(pool: Pool, investors: Array<{
    userId: string;
    profile: InvestorProfile;
    city?: string;
    country?: string;
}>, options?: {
    limit?: number;
}): MatchRecord[];
export interface Insight {
    type: 'trending' | 'similar_investors' | 'opportunity' | 'tip';
    title: string;
    description: string;
    poolId?: string;
    data?: Record<string, unknown>;
}
/**
 * Generate personalized insights for an investor.
 */
export declare function generateInsights(profile: InvestorProfile, allPools: Pool[], scoredPools: ScoredPool[], investorCity?: string): Insight[];
export {};
//# sourceMappingURL=mudarabahMatcher.d.ts.map