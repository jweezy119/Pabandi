import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { getBusinessTrustScore } from '../services/trust.service';
import { apiLimiter } from '../middleware/rateLimit.middleware';

/**
 * Agentic storefront.
 *
 * A public, unauthenticated, read-only projection of a business that an agent
 * can fetch in one call and act on: what this place is, what it sells, what it
 * costs, how much to trust it, and whether a deposit is needed before booking.
 *
 * ─── WHY NOT REUSE GET /api/v1/businesses/:id ───────────────────────────────
 * Two reasons, both disqualifying for an agent-facing surface.
 *
 * `getBusiness` in business.controller.ts creates Business rows from
 * osm-prefixed ids when a user is attached (business.controller.ts:152-221),
 * so a read endpoint has a write side effect. And its public projection returns
 * `ownerId` and `googleReviews`, neither of which an agent needs and both of
 * which are more than a storefront should publish.
 *
 * So this is a separate `select`, not a filtered version of the other one. What
 * is not published is decided here rather than inherited.
 *
 * ─── ON THE SCALE OF trustScore ─────────────────────────────────────────────
 * This is 0-1000, matching the passport scale and the session tiers, NOT the
 * 0-100 `Business.reliabilityScore` column it is derived from. See
 * `toThousandScale` in trust.service.ts for why those two scales coexist in
 * this schema and what has already gone wrong because of it.
 */

const router = Router();

/** Cap so a business with a thousand services cannot produce a 10MB response. */
const MAX_SERVICES = 100;

router.get('/:businessId', apiLimiter, async (req: Request, res: Response) => {
  const { businessId } = req.params;

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        city: true,
        country: true,
        currency: true,
        logoUrl: true,
        rating: true,
        reviewCount: true,
        isVerified: true,
        // Deposit policy. An agent needs this to know whether it can book
        // directly or must ask the user to fund first.
        requireDeposit: true,
        depositAmount: true,
        depositPercentage: true,
        isActive: true,
      },
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // An inactive business is not bookable, but the storefront is a
    // discovery surface: an agent asking "does this exist and what did it
    // offer" should get an answer, marked closed, rather than a 404 that reads
    // as "never existed".
    const [services, trust] = await Promise.all([
      prisma.businessService.findMany({
        where: { businessId, isActive: true },
        orderBy: [{ price: 'asc' }],
        take: MAX_SERVICES,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          discountPrice: true,
          duration: true,
          category: true,
          imageUrl: true,
          bookingLeadTime: true,
          maxBookingsPerDay: true,
          minNoticeHours: true,
          cancellationNoticeHours: true,
          cancellationCostAmount: true,
          retainerBps: true,
          requiresProvider: true,
        },
      }),
      getBusinessTrustScore(businessId),
    ]);

    // A business can have requireDeposit set while carrying neither an amount nor
// a percentage -- the flag and the figure are separate columns and nothing
// enforces that they arrive together. Reporting `depositRequired: true` with no
// number beside it would tell an agent to interrupt the user for a deposit it
// cannot size, so a deposit is only reported as required when there is
// actually something to collect.
const hasDepositAmount =
      (business.depositAmount !== null && business.depositAmount > 0) ||
      (business.depositPercentage !== null && business.depositPercentage > 0);
    const depositRequired = Boolean(business.requireDeposit) && hasDepositAmount;

    return res.json({
      success: true,
      data: {
        businessId: business.id,
        businessName: business.name,
        description: business.description,
        category: business.category,
        location: [business.city, business.country].filter(Boolean).join(', ') || null,
        currency: business.currency,
        logoUrl: business.logoUrl,
        rating: business.rating,
        reviewCount: business.reviewCount,
        isVerified: business.isVerified,
        /** Accepting bookings. False means discoverable but closed. */
        acceptingBookings: business.isActive,

        // 0-1000, same scale as the session tiers.
        trustScore: trust.score,
        trustScoreSource: trust.source,

        depositRequired,
        depositAmount: business.depositAmount,
        depositPercentage: business.depositPercentage,

        services: services.map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          // Effective price, so an agent does not have to know that
          // discountPrice is the one that wins when it is set.
          price: service.discountPrice ?? service.price,
          listPrice: service.discountPrice !== null ? service.price : null,
          currency: business.currency,
          durationMinutes: service.duration,
          category: service.category,
          imageUrl: service.imageUrl,
          bookingLeadTimeHours: service.bookingLeadTime,
          maxBookingsPerDay: service.maxBookingsPerDay,
          minNoticeHours: service.minNoticeHours,
          cancellationNoticeHours: service.cancellationNoticeHours,
          cancellationCostAmount: service.cancellationCostAmount,
          retainerBps: service.retainerBps,
          requiresProvider: service.requiresProvider,
        })),

        // How to act on this. An agent that reads a storefront and has no idea
        // what the next call is has learned nothing useful.
        actions: {
          openSession: 'POST /api/v1/engine/session/open',
          book: 'POST /api/v1/engine/session/action',
          pay: 'POST /api/v1/x402/pay',
        },
      },
    });
  } catch (err: unknown) {
    logger.error(`[Storefront] lookup failed for ${businessId}: ${err instanceof Error ? err.message : String(err)}`);
    // The cause is logged, not returned. This is a public unauthenticated
    // endpoint and a Prisma error string can carry schema detail.
    return res.status(500).json({ error: 'Failed to fetch storefront' });
  }
});

export default router;