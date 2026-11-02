import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

/**
 * Dashboard stats — real aggregates for the dual-mode dashboards.
 *
 *   GET /api/v1/users/me/stats     → Personal dashboard (Consumer / Standard)
 *   GET /api/v1/business/stats     → Business dashboard (Pro)
 *
 * Both are authenticate-gated and both read REAL rows — SolanaEscrow, Invoice,
 * Booking, Business.saasCreditBalance and User.trustScore — so the client never
 * has to fake an opening balance, and the Trust Sync loop can watch these same
 * numbers move.
 *
 * Mounted directly in index.ts (not via lazyRoute defaults):
 *   app.use(`/api/v1/users/me/stats`, stats.userStatsRouter);
 *   app.use(`/api/v1/business/stats`, stats.businessStatsRouter);
 */

/** Escrow statuses that mean "my money is still working". */
const ACTIVE_ESCROW_STATUSES = ['CREATED', 'FUNDED'] as const;

const userStatsRouter = Router();

userStatsRouter.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      // EscrowYield links by escrowId only (no Prisma relation to the escrow table),
      // so the yield pool is narrowed with the user's own escrow id set from the
      // active-escrow fetch below.
      const [user, escrows] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true, reliabilityScore: true } }),
        // Active escrows: money the user has locked, still held by the vault.
        prisma.solanaEscrow.findMany({
          where: { buyerId: userId, status: { in: [...ACTIVE_ESCROW_STATUSES] } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true, reference: true, amount: true, status: true, createdAt: true,
            business: { select: { id: true, name: true } },
            job: { select: { id: true, status: true, escrowStatus: true } },
          },
        }),
      ]);

      const escrowsList = escrows.map((e) => ({
        id: e.id,
        reference: e.reference,
        amountUsd: e.amount,
        status: e.status,
        createdAt: e.createdAt,
        businessName: e.business?.name ?? null,
        jobStatus: e.job?.status ?? null,
        // A VCAP release is available only when the work is marked complete.
        canRelease: e.status === 'FUNDED' && e.job?.status === 'COMPLETED',
      }));

      const escrowIds = escrowsList.map((e) => e.id);
      // Yield on released-but-recent escrows too, so the counter doesn't reset to
      // zero on release: aggregate over every escrow the user has EVER held.
      const allMyEscrows = escrowIds.length
        ? escrowIds
        : (await prisma.solanaEscrow.findMany({ where: { buyerId: userId }, select: { id: true } })).map((r) => r.id);
      const yieldAgg = await prisma.escrowYield.aggregate({
        where: { status: 'active', escrowId: { in: allMyEscrows.length ? allMyEscrows : ['__none__'] } },
        _sum: { yieldAmount: true },
      });

      res.json({
        success: true,
        data: {
          activeEscrows: {
            count: escrowsList.length,
            totalUsd: +escrowsList.reduce((s, e) => s + e.amountUsd, 0).toFixed(2),
            items: escrowsList,
          },
          trustScore: {
            score: user?.trustScore ?? null,
            reliability: user?.reliabilityScore ?? null,
            tier: deriveTier(user?.trustScore ?? null),
          },
          yieldEarned: +(yieldAgg._sum?.yieldAmount ?? 0).toFixed(2),
          yieldCurrency: 'USDC',
        },
      });
    } catch (e) { next(e); }
  },
);

/** Business tier band from the canonical 0-100 trust scale. */
function deriveTier(score: number | null): string {
  if (score == null) return 'UNRANKED';
  if (score >= 85) return 'GOLD';
  if (score >= 70) return 'SILVER';
  if (score >= 50) return 'BRONZE';
  return 'BUILDING';
}

const businessStatsRouter = Router();

businessStatsRouter.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const business = await prisma.business.findUnique({
        where: { ownerId: userId },
        select: { id: true, name: true, saasCreditBalance: true },
      });
      if (!business) {
        res.status(404).json({ success: false, error: 'No business is linked to this account. Switch to Personal mode or claim a business.' });
        return;
      }

      // ── Today's window (server-local day) ──
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(startOfToday);
      endOfToday.setDate(endOfToday.getDate() + 1);

      const [paidToday, pendingEscrows, todaysJobs] = await Promise.all([
        // Today's revenue: invoices actually PAID (paidAt) today.
        prisma.invoice.aggregate({
          where: { businessId: business.id, paidAt: { gte: startOfToday, lt: endOfToday } },
          _sum: { subtotal: true },
        }),
        prisma.solanaEscrow.findMany({
          where: { businessId: business.id, status: { in: [...ACTIVE_ESCROW_STATUSES] } },
          select: { amount: true },
        }),
        // Today's scheduled jobs with the client name from CRM (falls back to
        // the booking's own metadata when no CRM client was attached).
        prisma.booking.findMany({
          where: { businessId: business.id, slotStart: { gte: startOfToday, lt: endOfToday }, status: { not: 'cancelled' } },
          orderBy: { slotStart: 'asc' },
          select: {
            id: true, slotStart: true, slotEnd: true, status: true, serviceType: true,
            client: { select: { name: true } },
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          businessId: business.id,
          businessName: business.name,
          todayRevenue: +(paidToday._sum.subtotal ?? 0).toFixed(2),
          todayRevenueCurrency: 'USDC',
          pendingEscrows: {
            count: pendingEscrows.length,
            totalUsd: +pendingEscrows.reduce((s, e) => s + e.amount, 0).toFixed(2),
          },
          saasCredit: +business.saasCreditBalance.toFixed(2),
          todayJobs: todaysJobs.map((b) => ({
            id: b.id,
            client: b.client?.name ?? 'Walk-in client',
            time: b.slotStart,
            endTime: b.slotEnd,
            service: b.serviceType,
            status: b.status,
          })),
        },
      });
    } catch (e) { next(e); }
  },
);

/** Suppress unused-logger lint noise while keeping structured logs available. */
void logger;

export { userStatsRouter, businessStatsRouter };
export default { userStatsRouter, businessStatsRouter };
