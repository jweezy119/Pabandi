import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { ok, fail } from '../utils/apiResponse';
import { logger } from '../utils/logger';

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Parse a profit share ratio string "70/30" into investor/Pabandi decimals.
 * Format: "investorShare/pabandiShare" (e.g. "70/30" → 0.7 / 0.3).
 */
function parseProfitShareRatio(ratio: string): { investorPct: number; pabandiPct: number } {
  const parts = ratio.split('/');
  const investor = parseFloat(parts[0] || '70');
  const pabandi = parseFloat(parts[1] || '30');
  const total = investor + pabandi;
  return { investorPct: investor / total, pabandiPct: pabandi / total };
}

// ── Public Routes ───────────────────────────────────────────────────

/**
 * GET /api/v1/mudarabah/pools
 * List all OPEN/ACTIVE pools with business info.
 */
export const getAllPools = async (_req: Request, res: Response) => {
  try {
    const pools = await prisma.mudarabahPool.findMany({
      where: { status: { in: ['OPEN', 'ACTIVE'] } },
      include: {
        business: { select: { id: true, name: true, category: true, logoUrl: true, city: true, country: true, trustScore: true } },
        _count: { select: { investments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, pools);
  } catch (err: any) {
    logger.error('[Mudarabah] getAllPools error:', err.message);
    return fail(res, 'Failed to fetch pools', 500);
  }
};

/**
 * GET /api/v1/mudarabah/pools/:id
 * Pool detail with investments count.
 */
export const getPoolById = async (req: Request, res: Response) => {
  try {
    const pool = await prisma.mudarabahPool.findUnique({
      where: { id: req.params.id },
      include: {
        business: { select: { id: true, name: true, category: true, logoUrl: true, city: true, country: true, trustScore: true, isVerified: true } },
        _count: { select: { investments: true, distributions: true } },
      },
    });
    if (!pool) return fail(res, 'Pool not found', 404);
    return ok(res, pool);
  } catch (err: any) {
    logger.error('[Mudarabah] getPoolById error:', err.message);
    return fail(res, 'Failed to fetch pool', 500);
  }
};

/**
 * GET /api/v1/mudarabah/transparency/:id
 * Public Sharia transparency data — shows the math, no-riba proof.
 */
export const getTransparencyData = async (req: Request, res: Response) => {
  try {
    const pool = await prisma.mudarabahPool.findUnique({
      where: { id: req.params.id },
      include: {
        business: { select: { name: true, category: true } },
        distributions: { orderBy: { createdAt: 'desc' }, take: 24 },
        _count: { select: { investments: true } },
      },
    });
    if (!pool) return fail(res, 'Pool not found', 404);

    const { investorPct, pabandiPct } = parseProfitShareRatio(pool.profitShareRatio);

    // Aggregate lifetime stats
    const totalDistributed = pool.distributions.reduce((sum, d) => sum + d.investorShare, 0);
    const totalRevenueAllTime = pool.distributions.reduce((sum, d) => sum + d.totalRevenue, 0);

    const transparency = {
      poolId: pool.id,
      title: pool.title,
      business: pool.business,
      revenueSource: pool.revenueSource,
      riskBand: pool.riskBand,
      profitShareRatio: pool.profitShareRatio,
      investorPercentage: `${(investorPct * 100).toFixed(0)}%`,
      pabandiPercentage: `${(pabandiPct * 100).toFixed(0)}%`,
      targetAmount: pool.targetAmount,
      currentAmount: pool.currentAmount,
      expectedApy: pool.expectedApy,
      distributionFreq: pool.distributionFreq,
      investorCount: pool._count.investments,
      totalRevenueAllTime,
      totalProfitDistributed: totalDistributed,
      distributionHistory: pool.distributions.map(d => ({
        period: `${d.periodStart.toISOString().slice(0, 10)} → ${d.periodEnd.toISOString().slice(0, 10)}`,
        totalRevenue: d.totalRevenue,
        totalProfit: d.totalProfit,
        investorShare: d.investorShare,
        pabandiShare: d.pabandiShare,
        perUnitProfit: d.perUnitProfit,
        status: d.status,
        distributedAt: d.distributedAt,
      })),
      shariaCompliance: {
        noRiba: true,
        noGharar: true,
        profitSharing: 'Mudarabah (profit-loss sharing, no guaranteed returns)',
        model: 'Investors provide capital, business provides expertise. Profits shared per pre-agreed ratio. Losses borne by capital provider unless negligence proven.',
        transparency: 'All revenue figures and profit calculations are published on-chain-verifiable records.',
      },
    };

    return ok(res, transparency);
  } catch (err: any) {
    logger.error('[Mudarabah] getTransparencyData error:', err.message);
    return fail(res, 'Failed to fetch transparency data', 500);
  }
};

// ── Authenticated: Pool Management (Business Owner) ─────────────────

/**
 * POST /api/v1/mudarabah/pools
 * Create a new Mudarabah pool (business owner only).
 */
export const createPool = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, description, targetAmount, revenueSource, profitShareRatio, minInvestment, maxInvestment, expectedApy, riskBand, distributionFreq, businessId } = req.body;

    if (!title || !description || !targetAmount || !revenueSource) {
      return fail(res, 'title, description, targetAmount, and revenueSource are required');
    }

    // Find user's business if businessId not explicitly provided
    let targetBusinessId = businessId;
    if (!targetBusinessId) {
      const business = await prisma.business.findFirst({ where: { ownerId: userId } });
      if (!business) return fail(res, 'No business found. Please create a business first.', 400);
      targetBusinessId = business.id;
    } else {
      // Verify ownership
      const business = await prisma.business.findFirst({ where: { id: targetBusinessId, ownerId: userId } });
      if (!business) return fail(res, 'Not authorized: you do not own this business', 403);
    }

    const pool = await prisma.mudarabahPool.create({
      data: {
        businessId: targetBusinessId,
        title,
        description,
        targetAmount: parseFloat(targetAmount),
        revenueSource,
        profitShareRatio: profitShareRatio || '70/30',
        minInvestment: minInvestment ? parseFloat(minInvestment) : 100,
        maxInvestment: maxInvestment ? parseFloat(maxInvestment) : null,
        expectedApy: expectedApy ? parseFloat(expectedApy) : 8.0,
        riskBand: riskBand || 'MEDIUM',
        distributionFreq: distributionFreq || 'MONTHLY',
        status: 'OPEN',
      },
    });

    logger.info(`[Mudarabah] Pool created: ${pool.id} by user ${userId}`);
    return ok(res, pool, 201);
  } catch (err: any) {
    logger.error('[Mudarabah] createPool error:', err.message);
    return fail(res, 'Failed to create pool', 500);
  }
};

/**
 * PATCH /api/v1/mudarabah/pools/:id
 * Update own pool.
 */
export const updatePool = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const pool = await prisma.mudarabahPool.findUnique({
      where: { id: req.params.id },
      include: { business: true },
    });
    if (!pool) return fail(res, 'Pool not found', 404);
    if (pool.business.ownerId !== userId) return fail(res, 'Not authorized: you do not own this pool', 403);

    const allowedFields = ['title', 'description', 'targetAmount', 'revenueSource', 'profitShareRatio', 'minInvestment', 'maxInvestment', 'expectedApy', 'riskBand', 'distributionFreq', 'status'];
    const data: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        data[field] = ['targetAmount', 'minInvestment', 'maxInvestment', 'expectedApy'].includes(field) ? parseFloat(req.body[field]) : req.body[field];
      }
    }

    const updated = await prisma.mudarabahPool.update({ where: { id: pool.id }, data });
    return ok(res, updated);
  } catch (err: any) {
    logger.error('[Mudarabah] updatePool error:', err.message);
    return fail(res, 'Failed to update pool', 500);
  }
};

/**
 * DELETE /api/v1/mudarabah/pools/:id
 * Close own pool.
 */
export const closePool = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const pool = await prisma.mudarabahPool.findUnique({
      where: { id: req.params.id },
      include: { business: true },
    });
    if (!pool) return fail(res, 'Pool not found', 404);
    if (pool.business.ownerId !== userId) return fail(res, 'Not authorized: you do not own this pool', 403);

    const updated = await prisma.mudarabahPool.update({
      where: { id: pool.id },
      data: { status: 'CLOSED' },
    });
    logger.info(`[Mudarabah] Pool closed: ${pool.id}`);
    return ok(res, updated);
  } catch (err: any) {
    logger.error('[Mudarabah] closePool error:', err.message);
    return fail(res, 'Failed to close pool', 500);
  }
};

/**
 * GET /api/v1/mudarabah/my-pools
 * List authenticated business owner's pools.
 */
export const getMyPools = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const businesses = await prisma.business.findMany({ where: { ownerId: userId }, select: { id: true } });
    const businessIds = businesses.map(b => b.id);

    const pools = await prisma.mudarabahPool.findMany({
      where: { businessId: { in: businessIds } },
      include: {
        _count: { select: { investments: true, distributions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, pools);
  } catch (err: any) {
    logger.error('[Mudarabah] getMyPools error:', err.message);
    return fail(res, 'Failed to fetch your pools', 500);
  }
};

// ── Authenticated: Investments ──────────────────────────────────────

/**
 * POST /api/v1/mudarabah/pools/:id/invest
 * Invest in a Mudarabah pool.
 */
export const investInPool = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount } = req.body;
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return fail(res, 'Valid investment amount is required');
    }

    const pool = await prisma.mudarabahPool.findUnique({ where: { id: req.params.id } });
    if (!pool) return fail(res, 'Pool not found', 404);
    if (pool.status !== 'OPEN') return fail(res, `Pool is not open for investments (status: ${pool.status})`);
    if (numAmount < pool.minInvestment) return fail(res, `Minimum investment is ${pool.minInvestment}`);
    if (pool.maxInvestment && numAmount > pool.maxInvestment) return fail(res, `Maximum investment is ${pool.maxInvestment}`);

    // Check if investment would exceed target
    if (pool.currentAmount + numAmount > pool.targetAmount) {
      return fail(res, `Investment exceeds pool target. Available: ${(pool.targetAmount - pool.currentAmount).toFixed(2)}`);
    }

    // Create investment and update pool in transaction
    const result = await prisma.$transaction(async (tx) => {
      const investment = await tx.mudarabahInvestment.create({
        data: {
          poolId: pool.id,
          investorId: userId,
          amount: numAmount,
          status: 'ACTIVE',
        },
      });

      const newAmount = pool.currentAmount + numAmount;
      const updatedPool = await tx.mudarabahPool.update({
        where: { id: pool.id },
        data: {
          currentAmount: newAmount,
          status: newAmount >= pool.targetAmount ? 'FULLY_SUBSCRIBED' : 'OPEN',
        },
      });

      return { investment, pool: updatedPool };
    });

    logger.info(`[Mudarabah] Investment: user=${userId} pool=${pool.id} amount=${numAmount}`);
    return ok(res, result, 201);
  } catch (err: any) {
    logger.error('[Mudarabah] investInPool error:', err.message);
    return fail(res, 'Failed to invest in pool', 500);
  }
};

/**
 * POST /api/v1/mudarabah/pools/:id/withdraw
 * Withdraw investment (marks as WITHDRAWN, returns capital).
 */
export const withdrawInvestment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const poolId = req.params.id;

    const investment = await prisma.mudarabahInvestment.findFirst({
      where: { poolId, investorId: userId, status: 'ACTIVE' },
    });
    if (!investment) return fail(res, 'No active investment found in this pool', 404);

    const result = await prisma.$transaction(async (tx) => {
      const withdrawn = await tx.mudarabahInvestment.update({
        where: { id: investment.id },
        data: { status: 'WITHDRAWN' },
      });

      // Decrease pool currentAmount, reopen if needed
      const pool = await tx.mudarabahPool.findUnique({ where: { id: poolId } });
      if (pool) {
        const newAmount = Math.max(0, pool.currentAmount - investment.amount);
        await tx.mudarabahPool.update({
          where: { id: poolId },
          data: {
            currentAmount: newAmount,
            status: pool.status === 'FULLY_SUBSCRIBED' && newAmount < pool.targetAmount ? 'OPEN' : pool.status,
          },
        });
      }

      return withdrawn;
    });

    logger.info(`[Mudarabah] Withdrawal: user=${userId} pool=${poolId} amount=${investment.amount}`);
    return ok(res, result);
  } catch (err: any) {
    logger.error('[Mudarabah] withdrawInvestment error:', err.message);
    return fail(res, 'Failed to withdraw investment', 500);
  }
};

/**
 * GET /api/v1/mudarabah/my-investments
 * List authenticated user's investments with profit totals.
 */
export const getMyInvestments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const investments = await prisma.mudarabahInvestment.findMany({
      where: { investorId: userId },
      include: {
        pool: {
          include: {
            business: { select: { name: true, category: true, logoUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalInvested = investments.filter(i => i.status === 'ACTIVE').reduce((sum, i) => sum + i.amount, 0);
    const totalProfitReceived = investments.reduce((sum, i) => sum + i.totalProfitReceived, 0);

    return ok(res, {
      investments,
      summary: {
        totalInvested,
        totalProfitReceived,
        activePositions: investments.filter(i => i.status === 'ACTIVE').length,
      },
    });
  } catch (err: any) {
    logger.error('[Mudarabah] getMyInvestments error:', err.message);
    return fail(res, 'Failed to fetch your investments', 500);
  }
};

// ── Authenticated: Profit Distribution ──────────────────────────────

/**
 * POST /api/v1/mudarabah/pools/:id/distribute
 * Calculate and distribute profits (business owner).
 * Body: { totalRevenue: number, periodStart: ISO date, periodEnd: ISO date }
 */
export const distributeProfits = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { totalRevenue, periodStart, periodEnd } = req.body;

    if (!totalRevenue || !periodStart || !periodEnd) {
      return fail(res, 'totalRevenue, periodStart, and periodEnd are required');
    }

    const pool = await prisma.mudarabahPool.findUnique({
      where: { id: req.params.id },
      include: { business: true, investments: { where: { status: 'ACTIVE' } } },
    });
    if (!pool) return fail(res, 'Pool not found', 404);
    if (pool.business.ownerId !== userId) return fail(res, 'Not authorized: you do not own this pool', 403);

    if (pool.investments.length === 0) return fail(res, 'No active investments to distribute to');

    const { investorPct, pabandiPct } = parseProfitShareRatio(pool.profitShareRatio);
    const totalRevenueNum = parseFloat(totalRevenue);
    const totalProfit = totalRevenueNum; // In Mudarabah, revenue IS the profit (no interest-based debt)
    const investorShare = totalProfit * investorPct;
    const pabandiShare = totalProfit * pabandiPct;
    const totalInvested = pool.investments.reduce((sum, inv) => sum + inv.amount, 0);
    const perUnitProfit = totalInvested > 0 ? investorShare / totalInvested : 0;

    const result = await prisma.$transaction(async (tx) => {
      // Create distribution record
      const distribution = await tx.mudarabahProfitDistribution.create({
        data: {
          poolId: pool.id,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          totalRevenue: totalRevenueNum,
          totalProfit,
          investorShare,
          pabandiShare,
          perUnitProfit,
          status: 'DISTRIBUTED',
          distributedAt: new Date(),
        },
      });

      // Update each active investor's totalProfitReceived
      for (const inv of pool.investments) {
        const profitForThisInvestor = inv.amount * perUnitProfit;
        await tx.mudarabahInvestment.update({
          where: { id: inv.id },
          data: {
            totalProfitReceived: { increment: profitForThisInvestor },
            lastDistributionAt: new Date(),
          },
        });
      }

      return distribution;
    });

    logger.info(`[Mudarabah] Profit distributed: pool=${pool.id} revenue=${totalRevenueNum} investors=${pool.investments.length}`);
    return ok(res, result);
  } catch (err: any) {
    logger.error('[Mudarabah] distributeProfits error:', err.message);
    return fail(res, 'Failed to distribute profits', 500);
  }
};

/**
 * GET /api/v1/mudarabah/pools/:id/distributions
 * List distributions for a pool (business owner only).
 */
export const getPoolDistributions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const pool = await prisma.mudarabahPool.findUnique({
      where: { id: req.params.id },
      include: { business: true },
    });
    if (!pool) return fail(res, 'Pool not found', 404);
    if (pool.business.ownerId !== userId) return fail(res, 'Not authorized: you do not own this pool', 403);

    const distributions = await prisma.mudarabahProfitDistribution.findMany({
      where: { poolId: pool.id },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, distributions);
  } catch (err: any) {
    logger.error('[Mudarabah] getPoolDistributions error:', err.message);
    return fail(res, 'Failed to fetch distributions', 500);
  }
};
