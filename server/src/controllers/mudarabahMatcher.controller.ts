import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { ok, fail } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import {
  computeInvestorProfile,
  scorePoolForInvestor,
  recommendPoolsForInvestor,
  recommendInvestorsForPool,
  generateMatchesForPool,
  generateInsights,
} from '../services/mudarabahMatcher';

// ── Helpers ───────────────────────────────────────────────────────────

async function getPoolsWithBusiness() {
  return prisma.mudarabahPool.findMany({
    where: { status: { in: ['OPEN', 'ACTIVE', 'FULLY_SUBSCRIBED'] } },
    include: {
      business: {
        select: { city: true, state: true, country: true, rating: true, trustScore: true },
      },
    },
  });
}

async function mapPoolToMatcherPool(pool: any) {
  return {
    id: pool.id,
    businessId: pool.businessId,
    title: pool.title,
    description: pool.description,
    category: pool.category,
    expectedApy: pool.expectedApy,
    riskBand: pool.riskBand,
    profitShareRatio: pool.profitShareRatio,
    targetAmount: pool.targetAmount,
    currentAmount: pool.currentAmount,
    minInvestment: pool.minInvestment,
    maxInvestment: pool.maxInvestment ?? undefined,
    status: pool.status,
    city: pool.business?.city || undefined,
    state: pool.business?.state || undefined,
    country: pool.business?.country || undefined,
    viewCount: pool.viewCount,
    featured: pool.featured,
    rating: pool.business?.rating ?? undefined,
    trustScore: pool.business?.trustScore ?? undefined,
  };
}

// ── GET /recommendations ──────────────────────────────────────────────

export const getRecommendations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 10;

    // Get or compute investor profile
    let profile = await prisma.investorProfile.findUnique({ where: { userId } });
    if (!profile) {
      // Cold-start: compute from trust score
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { trustScore: true, business: { select: { city: true } } },
      });
      if (!user) return fail(res, 'User not found', 404);

      const investments = await prisma.mudarabahInvestment.findMany({
        where: { investorId: userId },
        include: { pool: { include: { business: true } } },
      });

      const computed = computeInvestorProfile(
        investments.map(i => ({ poolId: i.poolId, amount: i.amount, status: i.status, pool: i.pool as any })),
        user.trustScore,
        user.business?.city || undefined
      );

      // Persist computed profile
      profile = await prisma.investorProfile.create({
        data: {
          userId,
          preferredRiskBands: computed.preferredRiskBands,
          preferredCategories: computed.preferredCategories,
          preferredRegions: computed.preferredRegions,
          minApy: computed.minApy,
          maxApy: computed.maxApy,
          minInvestment: computed.minInvestment,
          maxInvestment: computed.maxInvestment,
          preferredRatios: computed.preferredRatios,
          riskToleranceScore: computed.riskToleranceScore,
          investmentStyle: computed.investmentStyle,
          diversificationScore: computed.diversificationScore,
          totalInvested: computed.totalInvested,
          totalPoolsInvested: computed.totalPoolsInvested,
          avgInvestmentAmount: computed.avgInvestmentAmount,
          profileComplete: computed.totalPoolsInvested > 0,
        },
      });
    }

    // Get pools
    const rawPools = await getPoolsWithBusiness();
    const excludePoolIds = await prisma.mudarabahInvestment.findMany({
      where: { investorId: userId, status: 'ACTIVE' },
      select: { poolId: true },
    }).then(rows => rows.map(r => r.poolId));

    const pools = await Promise.all(rawPools.map(mapPoolToMatcherPool));
    const profileObj = {
      preferredRiskBands: profile.preferredRiskBands,
      preferredCategories: profile.preferredCategories,
      preferredRegions: profile.preferredRegions,
      minApy: profile.minApy,
      maxApy: profile.maxApy,
      minInvestment: profile.minInvestment,
      maxInvestment: profile.maxInvestment,
      preferredRatios: profile.preferredRatios,
      riskToleranceScore: profile.riskToleranceScore,
      investmentStyle: profile.investmentStyle,
      diversificationScore: profile.diversificationScore,
      totalInvested: profile.totalInvested,
      totalPoolsInvested: profile.totalPoolsInvested,
      avgInvestmentAmount: profile.avgInvestmentAmount,
    };

    const recommendations = recommendPoolsForInvestor(pools, profileObj, {
      limit,
      excludePoolIds,
      investorCity: profile.preferredRegions[0] || undefined,
    });

    return ok(res, {
      profile: {
        style: profile.investmentStyle,
        riskTolerance: profile.riskToleranceScore,
        diversificationScore: profile.diversificationScore,
      },
      recommendations: recommendations.map(r => ({
        poolId: r.pool.id,
        title: r.pool.title,
        category: r.pool.category,
        expectedApy: r.pool.expectedApy,
        riskBand: r.pool.riskBand,
        score: r.score,
        factors: r.factors,
        reasons: r.reasons,
      })),
    });
  } catch (error: any) {
    logger.error('[mudarabahMatcher] getRecommendations error:', error);
    return fail(res, error.message || 'Failed to get recommendations', 500);
  }
};

// ── GET /investors/:poolId ─────────────────────────────────────────────

export const getRecommendedInvestors = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { poolId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    // Verify pool exists and belongs to user
    const pool = await prisma.mudarabahPool.findUnique({
      where: { id: poolId },
      include: { business: true },
    });
    if (!pool) return fail(res, 'Pool not found', 404);

    // Check ownership (business owner)
    if (pool.business?.ownerId !== userId) {
      return fail(res, 'Only pool owner can view recommended investors', 403);
    }

    // Get all investor profiles
    const allProfiles = await prisma.investorProfile.findMany({
      include: { user: { select: { id: true, business: { select: { city: true, country: true } } } } },
    });

    const matcherPool = await mapPoolToMatcherPool(pool);
    const investors = allProfiles.map(p => ({
      userId: p.userId,
      profile: {
        preferredRiskBands: p.preferredRiskBands,
        preferredCategories: p.preferredCategories,
        preferredRegions: p.preferredRegions,
        minApy: p.minApy,
        maxApy: p.maxApy,
        minInvestment: p.minInvestment,
        maxInvestment: p.maxInvestment,
        preferredRatios: p.preferredRatios,
        riskToleranceScore: p.riskToleranceScore,
        investmentStyle: p.investmentStyle,
        diversificationScore: p.diversificationScore,
        totalInvested: p.totalInvested,
        totalPoolsInvested: p.totalPoolsInvested,
        avgInvestmentAmount: p.avgInvestmentAmount,
      },
      city: p.user.business?.city || p.preferredRegions[0] || undefined,
      country: p.user.business?.country || undefined,
    }));

    const scored = recommendInvestorsForPool(matcherPool, investors, { limit });

    // Upsert matches into DB
    const matchRecords = generateMatchesForPool(matcherPool, investors, { limit });
    await Promise.all(
      matchRecords.map(m =>
        prisma.businessInvestorMatch.upsert({
          where: { poolId_investorId: { poolId: m.poolId, investorId: m.investorId } },
          create: m,
          update: { matchScore: m.matchScore, matchReasons: m.matchReasons, matchFactors: m.matchFactors },
        })
      )
    );

    return ok(res, {
      poolId,
      investors: scored.map(s => ({
        investorId: s.investorId,
        score: s.score,
        factors: s.factors,
        reasons: s.reasons,
        investmentStyle: s.profile.investmentStyle,
        totalInvested: s.profile.totalInvested,
      })),
    });
  } catch (error: any) {
    logger.error('[mudarabahMatcher] getRecommendedInvestors error:', error);
    return fail(res, error.message || 'Failed to get investor recommendations', 500);
  }
};

// ── POST /profile ─────────────────────────────────────────────────────

export const upsertProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      preferredRiskBands,
      preferredCategories,
      preferredRegions,
      minApy,
      maxApy,
      minInvestment,
      maxInvestment,
      preferredRatios,
    } = req.body;

    // Validate risk bands
    const validBands = ['LOW', 'MEDIUM', 'HIGH'];
    if (preferredRiskBands && !Array.isArray(preferredRiskBands)) {
      return fail(res, 'preferredRiskBands must be an array', 400);
    }
    if (preferredRiskBands && preferredRiskBands.some((b: string) => !validBands.includes(b.toUpperCase()))) {
      return fail(res, `Invalid risk band. Valid: ${validBands.join(', ')}`, 400);
    }

    const existing = await prisma.investorProfile.findUnique({ where: { userId } });

    const data = {
      preferredRiskBands: preferredRiskBands?.map((b: string) => b.toUpperCase()) ?? existing?.preferredRiskBands ?? ['LOW', 'MEDIUM'],
      preferredCategories: preferredCategories ?? existing?.preferredCategories ?? [],
      preferredRegions: preferredRegions ?? existing?.preferredRegions ?? [],
      minApy: minApy ?? existing?.minApy ?? 5.0,
      maxApy: maxApy ?? existing?.maxApy ?? 50.0,
      minInvestment: minInvestment ?? existing?.minInvestment ?? 100,
      maxInvestment: maxInvestment ?? existing?.maxInvestment ?? 10000,
      preferredRatios: preferredRatios ?? existing?.preferredRatios ?? ['70/30', '60/40'],
      profileComplete: true,
    };

    const profile = await prisma.investorProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    // Recompute scores based on updated preferences
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true } });
    const investments = await prisma.mudarabahInvestment.findMany({
      where: { investorId: userId },
      include: { pool: { include: { business: true } } },
    });
    const computed = computeInvestorProfile(
      investments.map(i => ({ poolId: i.poolId, amount: i.amount, status: i.status, pool: i.pool as any })),
      user?.trustScore ?? 50
    );

    await prisma.investorProfile.update({
      where: { userId },
      data: {
        riskToleranceScore: computed.riskToleranceScore,
        investmentStyle: computed.investmentStyle,
        diversificationScore: computed.diversificationScore,
        totalInvested: computed.totalInvested,
        totalPoolsInvested: computed.totalPoolsInvested,
        avgInvestmentAmount: computed.avgInvestmentAmount,
      },
    });

    return ok(res, {
      ...profile,
      riskToleranceScore: computed.riskToleranceScore,
      investmentStyle: computed.investmentStyle,
      diversificationScore: computed.diversificationScore,
    });
  } catch (error: any) {
    logger.error('[mudarabahMatcher] upsertProfile error:', error);
    return fail(res, error.message || 'Failed to update profile', 500);
  }
};

// ── GET /profile ──────────────────────────────────────────────────────

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const profile = await prisma.investorProfile.findUnique({ where: { userId } });

    if (!profile) {
      return ok(res, {
        profileComplete: false,
        investmentStyle: 'MODERATE',
        riskToleranceScore: 50,
        message: 'No profile found. Complete your preferences to get personalized recommendations.',
      });
    }

    return ok(res, profile);
  } catch (error: any) {
    logger.error('[mudarabahMatcher] getProfile error:', error);
    return fail(res, error.message || 'Failed to get profile', 500);
  }
};

// ── GET /insights ─────────────────────────────────────────────────────

export const getInsights = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const profile = await prisma.investorProfile.findUnique({ where: { userId } });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { trustScore: true, business: { select: { city: true } } },
    });

    const investorCity = profile?.preferredRegions?.[0] || user?.business?.city || undefined;

    // Compute profile if missing
    let profileObj = profile ? {
      preferredRiskBands: profile.preferredRiskBands,
      preferredCategories: profile.preferredCategories,
      preferredRegions: profile.preferredRegions,
      minApy: profile.minApy,
      maxApy: profile.maxApy,
      minInvestment: profile.minInvestment,
      maxInvestment: profile.maxInvestment,
      preferredRatios: profile.preferredRatios,
      riskToleranceScore: profile.riskToleranceScore,
      investmentStyle: profile.investmentStyle,
      diversificationScore: profile.diversificationScore,
      totalInvested: profile.totalInvested,
      totalPoolsInvested: profile.totalPoolsInvested,
      avgInvestmentAmount: profile.avgInvestmentAmount,
    } : {
      preferredRiskBands: ['LOW', 'MEDIUM'] as string[],
      preferredCategories: [] as string[],
      preferredRegions: investorCity ? [investorCity] : [] as string[],
      minApy: 5,
      maxApy: 50,
      minInvestment: 100,
      maxInvestment: 10000,
      preferredRatios: ['70/30', '60/40'],
      riskToleranceScore: 50,
      investmentStyle: 'MODERATE',
      diversificationScore: 50,
      totalInvested: 0,
      totalPoolsInvested: 0,
      avgInvestmentAmount: 0,
    };

    const rawPools = await getPoolsWithBusiness();
    const pools = await Promise.all(rawPools.map(mapPoolToMatcherPool));
    const scored = recommendPoolsForInvestor(pools, profileObj, { limit: 5, investorCity });
    const insights = generateInsights(profileObj, pools, scored, investorCity);

    return ok(res, { insights });
  } catch (error: any) {
    logger.error('[mudarabahMatcher] getInsights error:', error);
    return fail(res, error.message || 'Failed to get insights', 500);
  }
};

// ── POST /feedback ────────────────────────────────────────────────────

export const recordFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { poolId, viewed, saved, invested } = req.body;

    if (!poolId) return fail(res, 'poolId is required', 400);

    const match = await prisma.businessInvestorMatch.findUnique({
      where: { poolId_investorId: { poolId, investorId: userId } },
    });

    if (!match) {
      // Create a new match record with feedback
      await prisma.businessInvestorMatch.create({
        data: {
          poolId,
          investorId: userId,
          matchScore: 0,
          matchReasons: [],
          matchFactors: {},
          investorViewed: !!viewed,
          investorSaved: !!saved,
          investorInvested: !!invested,
        },
      });
    } else {
      await prisma.businessInvestorMatch.update({
        where: { id: match.id },
        data: {
          investorViewed: viewed !== undefined ? viewed : match.investorViewed,
          investorSaved: saved !== undefined ? saved : match.investorSaved,
          investorInvested: invested !== undefined ? invested : match.investorInvested,
        },
      });
    }

    // Update investor profile stats if invested
    if (invested) {
      const profile = await prisma.investorProfile.findUnique({ where: { userId } });
      if (profile) {
        await prisma.investorProfile.update({
          where: { userId },
          data: {
            totalPoolsInvested: profile.totalPoolsInvested + 1,
            lastInvestmentAt: new Date(),
          },
        });
      }
    }

    return ok(res, { recorded: true });
  } catch (error: any) {
    logger.error('[mudarabahMatcher] recordFeedback error:', error);
    return fail(res, error.message || 'Failed to record feedback', 500);
  }
};

// ── GET /stats ────────────────────────────────────────────────────────

export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const totalMatches = await prisma.businessInvestorMatch.count();
    const viewedCount = await prisma.businessInvestorMatch.count({ where: { investorViewed: true } });
    const savedCount = await prisma.businessInvestorMatch.count({ where: { investorSaved: true } });
    const investedCount = await prisma.businessInvestorMatch.count({ where: { investorInvested: true } });

    const poolCount = await prisma.mudarabahPool.count({ where: { status: { in: ['OPEN', 'ACTIVE'] } } });
    const investorCount = await prisma.investorProfile.count();

    const avgMatchesPerPool = poolCount > 0 ? totalMatches / poolCount : 0;
    const conversionRate = viewedCount > 0 ? (investedCount / viewedCount) * 100 : 0;

    return ok(res, {
      totalMatches,
      poolCount,
      investorCount,
      avgMatchesPerPool: Math.round(avgMatchesPerPool * 100) / 100,
      viewRate: totalMatches > 0 ? Math.round((viewedCount / totalMatches) * 100) : 0,
      saveRate: viewedCount > 0 ? Math.round((savedCount / viewedCount) * 100) : 0,
      conversionRate: Math.round(conversionRate * 100) / 100,
      viewedCount,
      savedCount,
      investedCount,
    });
  } catch (error: any) {
    logger.error('[mudarabahMatcher] getStats error:', error);
    return fail(res, error.message || 'Failed to get stats', 500);
  }
};

// ── Cron: Batch Generate Matches ─────────────────────────────────────

export const batchGenerateMatches = async (_req: Request, res: Response) => {
  try {
    const pools = await prisma.mudarabahPool.findMany({
      where: { status: { in: ['OPEN', 'ACTIVE', 'FULLY_SUBSCRIBED'] } },
      include: { business: { select: { city: true, state: true, country: true } } },
    });

    const allProfiles = await prisma.investorProfile.findMany({
      include: { user: { select: { id: true, business: { select: { city: true, country: true } } } } },
    });

    const investors = allProfiles.map(p => ({
      userId: p.userId,
      profile: {
        preferredRiskBands: p.preferredRiskBands,
        preferredCategories: p.preferredCategories,
        preferredRegions: p.preferredRegions,
        minApy: p.minApy,
        maxApy: p.maxApy,
        minInvestment: p.minInvestment,
        maxInvestment: p.maxInvestment,
        preferredRatios: p.preferredRatios,
        riskToleranceScore: p.riskToleranceScore,
        investmentStyle: p.investmentStyle,
        diversificationScore: p.diversificationScore,
        totalInvested: p.totalInvested,
        totalPoolsInvested: p.totalPoolsInvested,
        avgInvestmentAmount: p.avgInvestmentAmount,
      },
      city: p.user.business?.city || p.preferredRegions[0] || undefined,
      country: p.user.business?.country || undefined,
    }));

    let totalUpserts = 0;
    for (const pool of pools) {
      const matcherPool = await mapPoolToMatcherPool(pool);
      const records = generateMatchesForPool(matcherPool, investors, { limit: 50 });

      await Promise.all(
        records.map(r =>
          prisma.businessInvestorMatch.upsert({
            where: { poolId_investorId: { poolId: r.poolId, investorId: r.investorId } },
            create: r,
            update: { matchScore: r.matchScore, matchReasons: r.matchReasons, matchFactors: r.matchFactors },
          })
        )
      );

      totalUpserts += records.length;
    }

    return ok(res, {
      poolsProcessed: pools.length,
      totalUpserts,
      investorsScored: investors.length,
    });
  } catch (error: any) {
    logger.error('[mudarabahMatcher] batchGenerateMatches error:', error);
    return fail(res, error.message || 'Failed to generate batch matches', 500);
  }
};
