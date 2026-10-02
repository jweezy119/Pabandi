import { Router, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { publicFeeSchedule } from '../config/fees';
import {
  feeHistory,
  realisedMargin,
  unbilledTotalCents,
} from '../services/fee-assessment.service';

/**
 * Merchant-facing fee visibility.
 *
 * WHY THIS EXISTS
 * The fee is charged to the business, not the customer. That is only defensible if
 * the business can see it — a merchant discovering a percentage they did not know
 * about, on an invoice with no itemisation, has no way to check it and every
 * reason to leave. So the schedule is public *before* signup and the history is
 * readable *after*, with the reason each rate came out the way it did.
 *
 * SCOPE: reads only. There is no write here. Collection runs on a billing cycle,
 * not on a request from a merchant — a "pay my fees now" endpoint is a payment
 * integration, and there is not one wired for merchant billing yet.
 */

const router = Router();

/**
 * The published schedule.
 *
 * Unauthenticated on purpose. A merchant who has to email support to find out
 * what they will be charged will assume the worst, and the ones who assume the
 * worst are the ones we cannot onboard.
 */
router.get('/schedule', async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: publicFeeSchedule() });
  } catch (err: any) {
    logger.error(`[Fees] Schedule read failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Unbilled balance for the caller, across every business they own. */
router.get('/balance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businesses = await prisma.business.findMany({
      where: { ownerId: req.user!.id },
      select: { id: true, name: true },
    });

    const perBusiness = await Promise.all(
      businesses.map(async (b) => ({
        businessId: b.id,
        businessName: b.name,
        unbilledCents: await unbilledTotalCents(b.id),
      })),
    );

    res.json({
      success: true,
      data: {
        businesses: perBusiness,
        // Summed here rather than trusted from a single query: the caller may own
        // several businesses, and a total that silently covers only the first one
        // would be an undercharge we do not notice.
        totalUnbilledCents: perBusiness.reduce((s, b) => s + b.unbilledCents, 0),
      },
    });
  } catch (err: any) {
    logger.error(`[Fees] Balance read failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Assert the caller owns this business, or 403. */
async function assertOwnsBusiness(req: AuthRequest, businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, ownerId: req.user!.id },
    select: { id: true, name: true, category: true },
  });
  if (!business) throw new CustomError('Business not found', 404);
  return business;
}

/**
 * Fee history for one business, with the reason for each rate.
 *
 * Ownership is checked here rather than trusting a business id from the path —
 * otherwise any authenticated user could read another merchant's fee history,
 * which reveals their transaction volume.
 */
router.get('/business/:businessId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const business = await assertOwnsBusiness(req, req.params.businessId);
    const entries = await feeHistory(business.id, 100);
    const margin = await realisedMargin(business.id);

    res.json({
      success: true,
      data: {
        business,
        entries,
        summary: {
          ...margin,
          unbilledCents: await unbilledTotalCents(business.id),
          // Assessed versus kept. These differ by exactly the processing cost, and
          // showing only the first would imply the second is what we earned.
          assessedDollars: (margin.assessedCents / 100).toFixed(2),
          marginDollars: (margin.marginCents / 100).toFixed(2),
        },
      },
    });
  } catch (err: any) {
    const status = err instanceof CustomError ? err.statusCode : 500;
    if (status === 500) logger.error(`[Fees] History read failed: ${err.message}`);
    res.status(status).json({ success: false, error: err.message });
  }
});

/**
 * Realised margin across the platform.
 *
 * Admin-only. This is the business's P&L, not any merchant's, and unlike the
 * routes above it aggregates every tenant.
 */
router.get('/admin/margin', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const agg = await prisma.feeAssessment.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { feeCents: true, marginCents: true, chargeCents: true },
      _count: { _all: true },
    });

    const byCategory = await prisma.feeAssessment.groupBy({
      by: ['category'],
      where: { createdAt: { gte: since } },
      _sum: { feeCents: true, marginCents: true, chargeCents: true },
      _count: { _all: true },
    });

    const charges = agg._sum.chargeCents ?? 0;
    const assessed = agg._sum.feeCents ?? 0;
    const margin = agg._sum.marginCents ?? 0;

    res.json({
      success: true,
      data: {
        periodDays: days,
        grossVolumeCents: charges,
        assessedCents: assessed,
        marginCents: margin,
        transactions: agg._count._all,
        // The two numbers a marketplace lives or dies on. A take rate that is
        // healthy while margin is negative means processing is being subsidised
        // by volume we do not have.
        takeRate: charges > 0 ? assessed / charges : 0,
        marginRate: charges > 0 ? margin / charges : 0,
        byCategory,
      },
    });
  } catch (err: any) {
    logger.error(`[Fees] Admin margin read failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
