"use strict";
// Mudarabah AI/ML Investor-Business Matching Engine
// Pure function module — no DB writes. All scoring is transparent and explainable.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeInvestorProfile = computeInvestorProfile;
exports.scorePoolForInvestor = scorePoolForInvestor;
exports.recommendPoolsForInvestor = recommendPoolsForInvestor;
exports.recommendInvestorsForPool = recommendInvestorsForPool;
exports.generateMatchesForPool = generateMatchesForPool;
exports.generateInsights = generateInsights;
// Risk bands in ascending order of risk
const RISK_BANDS = ['LOW', 'MEDIUM', 'HIGH'];
// Category families for partial matching
const CATEGORY_FAMILIES = {
    FOOD_BEVERAGE: ['RESTAURANT', 'CAFE', 'BAKERY', 'CATERING'],
    RETAIL: ['RETAIL', 'ECOMMERCE', 'MARKETPLACE', 'SHOP'],
    SERVICES: ['SERVICES', 'FREELANCE', 'CONSULTING'],
    HEALTH_BEAUTY: ['SALON', 'SPA', 'CLINIC', 'FITNESS_CENTER', 'HOSPITAL'],
    HOSPITALITY: ['HOTEL', 'EVENT_VENUE', 'PROPERTY_RENTAL'],
    TECH: ['TECH', 'LIVE_SELLER', 'SOFTWARE'],
    REAL_ESTATE: ['REAL_ESTATE', 'PROPERTY_RENTAL'],
};
// ─── a. Compute Investor Profile ───────────────────────────────────────────────
/**
 * Compute an investor profile from their past investments, trust scores, and behavior.
 * Cold-start: uses trust scores + default preferences for new users.
 */
function computeInvestorProfile(investments, userTrustScore, userCity) {
    const activeInvestments = investments.filter(i => i.status === 'ACTIVE' || i.status === 'COMPLETED');
    const totalInvested = activeInvestments.reduce((sum, i) => sum + i.amount, 0);
    const uniquePools = new Set(activeInvestments.map(i => i.poolId));
    // Category distribution
    const categoryCount = {};
    const riskBandCount = {};
    const regionSet = new Set();
    let totalApy = 0;
    for (const inv of activeInvestments) {
        const pool = inv.pool;
        if (pool?.category) {
            categoryCount[pool.category] = (categoryCount[pool.category] || 0) + 1;
        }
        if (pool?.riskBand) {
            riskBandCount[pool.riskBand] = (riskBandCount[pool.riskBand] || 0) + 1;
        }
        if (pool?.city)
            regionSet.add(pool.city);
        if (pool?.state)
            regionSet.add(pool.state);
        if (pool?.expectedApy)
            totalApy += pool.expectedApy;
    }
    // Preferred categories: top 3 by frequency
    const preferredCategories = Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat);
    // Preferred risk bands: bands the investor has actually used, plus adjacent if score is high
    const preferredRiskBands = [...RISK_BANDS].filter(band => riskBandCount[band] > 0);
    if (preferredRiskBands.length === 0) {
        // Cold-start: derive from trust score (higher trust = can handle more risk)
        if (userTrustScore >= 70)
            preferredRiskBands.push('MEDIUM', 'HIGH');
        else if (userTrustScore >= 40)
            preferredRiskBands.push('LOW', 'MEDIUM');
        else
            preferredRiskBands.push('LOW');
    }
    // Preferred regions
    const preferredRegions = userCity ? [userCity] : [...regionSet].slice(0, 3);
    if (preferredRegions.length === 0 && userCity)
        preferredRegions.push(userCity);
    // APY range based on past investments
    const avgApy = activeInvestments.length > 0 ? totalApy / activeInvestments.length : 15;
    const minApy = Math.max(0, avgApy * 0.5);
    const maxApy = avgApy * 2;
    // Investment amount range
    const avgAmount = activeInvestments.length > 0 ? totalInvested / activeInvestments.length : 500;
    const minInvestment = Math.max(50, avgAmount * 0.3);
    const maxInvestment = avgAmount * 3;
    // Risk tolerance score: 0-100
    // Based on: avg risk band weight, total invested (more invested = higher tolerance), diversification
    const avgRiskWeight = activeInvestments.length > 0
        ? activeInvestments.reduce((sum, inv) => {
            const band = inv.pool?.riskBand;
            return sum + (band === 'HIGH' ? 80 : band === 'MEDIUM' ? 50 : 20);
        }, 0) / activeInvestments.length
        : 50;
    const amountFactor = Math.min(30, totalInvested / 1000); // up to 30 points for amount
    const diversificationFactor = Math.min(20, uniquePools.size * 5); // up to 20 points for diversification
    const trustFactor = Math.min(20, userTrustScore / 5); // up to 20 points from trust score
    const riskToleranceScore = Math.min(100, avgRiskWeight + amountFactor + diversificationFactor + trustFactor);
    // Investment style
    let investmentStyle = 'MODERATE';
    if (riskToleranceScore < 30)
        investmentStyle = 'CONSERVATIVE';
    else if (riskToleranceScore > 70)
        investmentStyle = 'AGGRESSIVE';
    // Diversification score: 0-100
    const categoryDiversification = Object.keys(categoryCount).length;
    const regionDiversification = regionSet.size;
    const diversificationScore = Math.min(100, categoryDiversification * 15 + regionDiversification * 10);
    return {
        preferredRiskBands,
        preferredCategories,
        preferredRegions,
        minApy,
        maxApy,
        minInvestment,
        maxInvestment,
        preferredRatios: ['70/30', '60/40', '50/50'],
        riskToleranceScore: Math.round(riskToleranceScore),
        investmentStyle,
        diversificationScore: Math.round(diversificationScore),
        totalInvested,
        totalPoolsInvested: uniquePools.size,
        avgInvestmentAmount: Math.round(avgAmount),
    };
}
// ─── b. Score Pool for Investor ─────────────────────────────────────────────────
/**
 * Score a single pool for a given investor profile.
 * Returns a weighted match score 0-100 with transparent factor breakdown.
 */
function scorePoolForInvestor(pool, profile, investorCity, investorCountry) {
    const factors = {
        category: 0,
        risk: 0,
        apy: 0,
        location: 0,
        profitRatio: 0,
        investmentSize: 0,
        poolQuality: 0,
    };
    const reasons = [];
    // ── Category match (25%) ──────────────────────────────────────────────
    const poolCategory = pool.category?.toUpperCase() || '';
    if (profile.preferredCategories.map(c => c.toUpperCase()).includes(poolCategory)) {
        factors.category = 1.0;
        reasons.push(`Category ${poolCategory} matches your preferences`);
    }
    else {
        // Check if in same category family
        const familyMatch = Object.entries(CATEGORY_FAMILIES).find(([, cats]) => cats.includes(poolCategory) && profile.preferredCategories.some(pc => cats.includes(pc.toUpperCase())));
        if (familyMatch) {
            factors.category = 0.5;
            reasons.push(`Category ${poolCategory} is in a family you invest in (${familyMatch[0]})`);
        }
        else {
            factors.category = 0.1;
        }
    }
    // ── Risk alignment (20%) ──────────────────────────────────────────────
    const poolRisk = pool.riskBand?.toUpperCase() || 'MEDIUM';
    if (profile.preferredRiskBands.map(r => r.toUpperCase()).includes(poolRisk)) {
        factors.risk = 1.0;
        reasons.push(`Risk band ${poolRisk} aligns with your preferences`);
    }
    else {
        // Check if adjacent in risk band ordering
        const poolIdx = RISK_BANDS.indexOf(poolRisk);
        const preferredIndices = profile.preferredRiskBands
            .map(b => RISK_BANDS.indexOf(b.toUpperCase()))
            .filter(i => i >= 0);
        const isAdjacent = preferredIndices.some(idx => Math.abs(idx - poolIdx) === 1);
        if (isAdjacent) {
            factors.risk = 0.5;
            reasons.push(`Risk band ${poolRisk} is adjacent to your preferred bands`);
        }
        else {
            factors.risk = 0.1;
        }
    }
    // ── APY fit (15%) ─────────────────────────────────────────────────────
    const poolApy = pool.expectedApy || 0;
    if (poolApy >= profile.minApy && poolApy <= profile.maxApy) {
        factors.apy = 1.0;
        reasons.push(`APY ${poolApy}% is within your preferred range (${profile.minApy}-${profile.maxApy}%)`);
    }
    else if (poolApy < profile.minApy) {
        const distance = (profile.minApy - poolApy) / profile.minApy;
        factors.apy = Math.max(0, 1 - distance);
    }
    else {
        const distance = (poolApy - profile.maxApy) / profile.maxApy;
        factors.apy = Math.max(0, 1 - distance);
    }
    // ── Location (15%) ────────────────────────────────────────────────────
    const poolCity = pool.city || '';
    const poolCountry = pool.country || '';
    if (investorCity && poolCity && investorCity.toLowerCase() === poolCity.toLowerCase()) {
        factors.location = 1.0;
        reasons.push(`Located in your city: ${poolCity}`);
    }
    else if (investorCountry && poolCountry && investorCountry.toLowerCase() === poolCountry.toLowerCase()) {
        factors.location = 0.5;
        reasons.push(`Same country: ${poolCountry}`);
    }
    else {
        factors.location = 0.1;
    }
    // ── Profit ratio (10%) ────────────────────────────────────────────────
    const poolRatio = pool.profitShareRatio || '70/30';
    if (profile.preferredRatios.includes(poolRatio)) {
        factors.profitRatio = 1.0;
        reasons.push(`Profit ratio ${poolRatio} matches your preference`);
    }
    else {
        // Partial match if investor has no strong preference
        factors.profitRatio = 0.5;
    }
    // ── Investment size (10%) ─────────────────────────────────────────────
    const poolMin = pool.minInvestment || 100;
    const poolMax = poolMaxFromPool(pool);
    const fitsMin = poolMin >= profile.minInvestment && poolMin <= profile.maxInvestment;
    const fitsMax = !poolMax || poolMax <= profile.maxInvestment;
    if (fitsMin && fitsMax) {
        factors.investmentSize = 1.0;
        reasons.push(`Investment size fits your range`);
    }
    else if (poolMin > profile.maxInvestment) {
        factors.investmentSize = 0.2;
    }
    else {
        factors.investmentSize = 0.5;
    }
    // ── Pool quality (5%) ─────────────────────────────────────────────────
    const rating = pool.rating || 0;
    const trustScore = pool.trustScore || 50;
    const viewCount = pool.viewCount || 0;
    const featured = pool.featured ? 0.2 : 0;
    const ratingScore = rating > 0 ? (rating / 5) * 0.3 : 0.15;
    const trustScoreNorm = (trustScore / 100) * 0.3;
    const viewScore = Math.min(0.2, viewCount / 500);
    factors.poolQuality = Math.min(1.0, ratingScore + trustScoreNorm + viewScore + featured);
    // ── Weighted sum ──────────────────────────────────────────────────────
    const score = factors.category * 25 +
        factors.risk * 20 +
        factors.apy * 15 +
        factors.location * 15 +
        factors.profitRatio * 10 +
        factors.investmentSize * 10 +
        factors.poolQuality * 5;
    return {
        score: Math.round(score * 10) / 10,
        factors,
        reasons,
    };
}
function poolMaxFromPool(pool) {
    if (pool.maxInvestment)
        return pool.maxInvestment;
    // If no explicit max, use remaining capacity as soft max
    return pool.targetAmount - pool.currentAmount;
}
/**
 * Recommend top N pools for an investor.
 */
function recommendPoolsForInvestor(allPools, profile, options = {}) {
    const { limit = 10, investorCity, investorCountry, excludePoolIds = [] } = options;
    const eligiblePools = allPools.filter(p => ['OPEN', 'ACTIVE', 'FULLY_SUBSCRIBED'].includes(p.status?.toUpperCase()) &&
        !excludePoolIds.includes(p.id));
    const scored = eligiblePools.map(pool => {
        const { score, factors, reasons } = scorePoolForInvestor(pool, profile, investorCity, investorCountry);
        return { pool, score, factors, reasons };
    });
    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}
/**
 * Recommend top N investors for a given pool.
 */
function recommendInvestorsForPool(pool, investors, options = {}) {
    const { limit = 20 } = options;
    const scored = investors.map(({ userId, profile, city, country }) => {
        // For investor→pool scoring, we use the same scorePoolForInvestor function
        // but from the pool's perspective. The "investor profile" here IS the scoring target.
        const { score, factors, reasons } = scorePoolForInvestor(pool, profile, city, country);
        return {
            investorId: userId,
            profile,
            score,
            factors,
            reasons,
        };
    });
    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}
/**
 * Generate match records for a pool against all investor profiles.
 * Returns top N matches ready for DB upsert.
 * NOTE: This is the pure computation function. DB writes happen in the controller/cron.
 */
function generateMatchesForPool(pool, investors, options = {}) {
    const { limit = 50 } = options;
    const scored = recommendInvestorsForPool(pool, investors, { limit });
    return scored.map(s => ({
        poolId: pool.id,
        investorId: s.investorId,
        matchScore: s.score,
        matchReasons: s.reasons,
        matchFactors: s.factors,
    }));
}
/**
 * Generate personalized insights for an investor.
 */
function generateInsights(profile, allPools, scoredPools, investorCity) {
    const insights = [];
    // Trending in your area
    if (investorCity) {
        const cityPools = allPools.filter(p => p.city?.toLowerCase() === investorCity.toLowerCase() &&
            ['OPEN', 'ACTIVE'].includes(p.status?.toUpperCase()));
        const trending = cityPools.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 3);
        if (trending.length > 0) {
            insights.push({
                type: 'trending',
                title: `Trending pools in ${investorCity}`,
                description: `${trending.length} pool(s) in your area are gaining attention`,
                data: { pools: trending.map(p => ({ id: p.id, title: p.title, views: p.viewCount })) },
            });
        }
    }
    // Investment style tip
    if (profile.investmentStyle === 'CONSERVATIVE') {
        insights.push({
            type: 'tip',
            title: 'Diversification Tip',
            description: 'Consider spreading investments across 3-5 pools to reduce risk while maintaining steady returns.',
        });
    }
    else if (profile.investmentStyle === 'AGGRESSIVE') {
        insights.push({
            type: 'tip',
            title: 'Risk Management',
            description: 'High-risk pools offer higher APY. Keep at most 30% of portfolio in HIGH risk band.',
        });
    }
    // Similar investors also viewed
    if (scoredPools.length > 0) {
        const topCategory = scoredPools[0].pool.category;
        insights.push({
            type: 'similar_investors',
            title: `Investors like you also viewed ${topCategory}`,
            description: `Pools in ${topCategory} are popular with investors matching your profile`,
        });
    }
    // Cold-start guidance
    if (profile.totalPoolsInvested === 0) {
        insights.push({
            type: 'opportunity',
            title: 'Start your investment journey',
            description: `Your trust score qualifies you for LOW and MEDIUM risk pools. Start with small amounts to build your track record.`,
        });
    }
    return insights;
}
//# sourceMappingURL=mudarabahMatcher.js.map