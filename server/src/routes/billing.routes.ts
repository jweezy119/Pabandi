import { Router, Request, Response, NextFunction } from 'express';
import { billingService } from '../services/billing.service';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';

const router = Router();

/**
 * POST /api/v1/billing/subscribe
 * Create a new billing customer with an API key.
 */
router.post('/subscribe', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyName, tier } = req.body;
    const email = req.user!.email;

    if (!companyName) {
      res.status(400).json({ success: false, error: 'companyName is required' });
      return;
    }

    const { customer, apiKey } = await billingService.createCustomer(companyName, email, tier);
    res.json({ success: true, data: { customer, apiKey } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/billing/usage
 * Get current billing period usage and invoice preview.
 */
router.get('/usage', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apiKey } = req.query;
    
    if (!apiKey || typeof apiKey !== 'string') {
      res.status(400).json({ success: false, error: 'apiKey query parameter is required' });
      return;
    }

    const preview = billingService.getInvoicePreview(apiKey);
    
    if (!preview) {
      res.status(404).json({ success: false, error: 'Invalid API key or inactive customer' });
      return;
    }

    res.json({ success: true, data: preview });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/billing/stats
 * Admin only: Get platform-wide revenue stats.
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic admin check (could use proper roles)
    if (req.user!.email !== 'jay@pabandi.com') {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    const stats = billingService.getRevenueStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/billing/pricing
 * Get available billing tiers and pricing.
 */
router.get('/pricing', (_req: Request, res: Response) => {
  res.json({ success: true, data: billingService.getTierPricing() });
});

/**
 * GET /api/v1/billing/revenue-dashboard
 * Admin only: Consolidated revenue dashboard across all Pabandi revenue streams.
 * Aggregates escrow platform fees, agent marketplace fees, trust API lookups,
 * data escrow VCAP fees, insurance premiums, and guarantee fees.
 */
router.get('/revenue-dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.email !== 'jay@pabandi.com') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    // ── Escrow platform fees (3.5% on merchant releases) ──
    const escrowFees = await prisma.escrow.aggregate({
      where: {
        platformFeeStatus: 'COLLECTED',
      },
      _sum: { platformFeeAmount: true },
      _count: true,
    });

    // ── Agent marketplace fees (2% on agent-to-agent escrow) ──
    const agentFees = await prisma.agentMarketTransaction.aggregate({
      where: {
        status: 'COMPLETED',
      },
      _sum: { platformFeeUsd: true, amount: true },
      _count: true,
    });

    // ── Billing service stats (trust API, attestations, seals) ──
    const billingStats = billingService.getRevenueStats();

    // ── Recent escrow fee activity ──
    const recentEscrowFees = await prisma.escrow.findMany({
      where: {
        platformFeeStatus: 'COLLECTED',
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        amount: true,
        platformFeeAmount: true,
        updatedAt: true,
        payerId: true,
        payeeId: true,
      },
    });

    // ── Recent agent marketplace activity ──
    const recentAgentFees = await prisma.agentMarketTransaction.findMany({
      where: {
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        amount: true,
        platformFeeUsd: true,
        createdAt: true,
        fromAgentId: true,
        toAgentId: true,
      },
    });

    const escrowRevenue = Number(escrowFees._sum.platformFeeAmount) || 0;
    const agentRevenue = Number(agentFees._sum.platformFeeUsd) || 0;
    const billingRevenue = billingStats.lifetimeRevenueUSD;

    const totalRevenue = escrowRevenue + agentRevenue + billingRevenue;

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenueUSD: Math.round(totalRevenue * 100) / 100,
          escrowPlatformFeesUSD: Math.round(escrowRevenue * 100) / 100,
          agentMarketplaceFeesUSD: Math.round(agentRevenue * 100) / 100,
          trustApiBillingUSD: Math.round(billingRevenue * 100) / 100,
          totalEscrowsWithFees: escrowFees._count,
          totalAgentTransactions: agentFees._count,
        },
        billing: billingStats,
        recentEscrowFees,
        recentAgentFees,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
