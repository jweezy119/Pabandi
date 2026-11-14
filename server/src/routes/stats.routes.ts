import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

function deriveTier(score: number | null): string {
  if (score == null) return 'UNRANKED';
  if (score >= 85) return 'GOLD';
  if (score >= 70) return 'SILVER';
  if (score >= 50) return 'BRONZE';
  return 'BUILDING';
}

export const userStatsRouter = Router();
userStatsRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const [user, escrows] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true, reliabilityScore: true } }),
      prisma.escrow.findMany({
        where: { payerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const escrowsList = escrows.map((e) => ({
      id: e.id,
      reference: e.id,
      amountUsd: e.amount,
      status: e.status,
      createdAt: e.createdAt,
      businessName: null,
      jobStatus: null,
      canRelease: e.status === 'HELD',
    }));

    return res.json({
      success: true,
      data: {
        activeEscrows: {
          count: escrowsList.length,
          totalUsd: +escrowsList.reduce((s, e) => s + e.amountUsd, 0).toFixed(2),
          items: escrowsList,
        },
        trustScore: {
          score: user?.trustScore ?? 70,
          reliability: user?.reliabilityScore ?? 50,
          tier: deriveTier(user?.trustScore ?? 70),
        },
        yieldEarned: 0,
        yieldCurrency: 'USDC',
      },
    });
  } catch (e) {
    next(e);
  }
});

export const businessStatsRouter = Router();
businessStatsRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const business = await prisma.business.findUnique({
      where: { ownerId: userId },
      select: { id: true, name: true, trustScore: true, reliabilityScore: true },
    });
    if (!business) {
      return res.json({
        success: true,
        data: {
          business: null,
          openInvoices: { count: 0, totalUsd: 0 },
          todayBookings: { count: 0 },
        },
      });
    }

    const [invoices, bookings] = await Promise.all([
      prisma.invoice.findMany({
        where: { businessId: business.id, status: 'PENDING' },
      }),
      prisma.booking.count({
        where: { businessId: business.id },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        business: {
          id: business.id,
          name: business.name,
          trustScore: business.trustScore,
        },
        openInvoices: {
          count: invoices.length,
          totalUsd: invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0),
        },
        todayBookings: { count: bookings },
      },
    });
  } catch (e) {
    next(e);
  }
});
