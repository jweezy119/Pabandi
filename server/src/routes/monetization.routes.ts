/**
 * monetization.routes.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Revenue API routes for the three monetization layers:
 *   - /trust-brokerage/*     — Trust Data Bundles (data product sales)
 *   - /trust-api/*          — API-as-a-Service (recurring subscriptions)
 *   - /insurance/*          — Reputation Insurance (premium revenue)
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// ── Trust Brokerage API ──────────────────────────────────────────────────────

/**
 * POST /api/v1/monetization/trust-brokerage/bundle
 * Generate a Trust Data Bundle for resale.
 * Body: { entityId, entityType, buyerId }
 */
router.post('/trust-brokerage/bundle', async (req: Request, res: Response): Promise<any> => {
  const { entityId, entityType, buyerId } = req.body;
  if (!entityId || !entityType) {
    return res.status(400).json({ success: false, error: 'entityId and entityType required' });
  }
  try {
    const { trustBrokerageService } = await import('../services/trustBrokerage.service');
    const bundle = await trustBrokerageService.createBundle(entityId, entityType, buyerId);
    if (!bundle) {
      return res.status(404).json({ success: false, error: 'Insufficient confidence to generate bundle' });
    }
    res.json({ success: true, data: bundle });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/monetization/trust-brokerage/revenue
 * Get daily revenue from trust data sales.
 */
router.get('/trust-brokerage/revenue', async (_req: Request, res: Response): Promise<any> => {
  try {
    const { trustBrokerageService } = await import('../services/trustBrokerage.service');
    res.json({ success: true, data: { dailyRevenue: trustBrokerageService.getDailyRevenue() } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Trust API-as-a-Service ────────────────────────────────────────────────────

// Route removed, handled by billing.routes.ts (/api/v1/billing/subscribe)

/**
 * POST /api/v1/monetization/trust-api/verify
 * Verify an entity via API.
 * Body: { apiKey, entityId, entityType }
 */
router.post('/trust-api/verify', async (req: Request, res: Response): Promise<any> => {
  const { apiKey, entityId, entityType } = req.body;
  if (!apiKey || !entityId || !entityType) {
    return res.status(400).json({ success: false, error: 'apiKey, entityId, entityType required' });
  }
  try {
    const { trustApiAsService } = await import('../services/trustApiAsService.service');
    const result = await trustApiAsService.verifyEntity(apiKey, entityId, entityType);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stats and pricing handled by billing.routes.ts

// ── Reputation Insurance API ──────────────────────────────────────────────────

/**
 * POST /api/v1/monetization/insurance/underwrite
 * Underwrite a new insurance policy for a booking.
 * Body: { providerId, customerId, reservationId, coverageAmount, coverageType }
 */
router.post('/insurance/underwrite', async (req: Request, res: Response): Promise<any> => {
  const { providerId, customerId, reservationId, coverageAmount, coverageType } = req.body;
  if (!providerId || !reservationId || !coverageAmount) {
    return res.status(400).json({ success: false, error: 'providerId, reservationId, coverageAmount required' });
  }
  try {
    const { reputationInsuranceService } = await import('../services/reputationInsurance.service');
    const result = await reputationInsuranceService.underwrite(
      providerId, customerId, reservationId, coverageAmount, coverageType || 'NO_SHOW'
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/monetization/insurance/claim
 * Process an insurance claim.
 * Body: { policyId, evidence, reason }
 */
router.post('/insurance/claim', async (req: Request, res: Response): Promise<any> => {
  const { policyId, evidence, reason } = req.body;
  if (!policyId) {
    return res.status(400).json({ success: false, error: 'policyId required' });
  }
  try {
    const { reputationInsuranceService } = await import('../services/reputationInsurance.service');
    const result = await reputationInsuranceService.processClaim(policyId, evidence, reason);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/monetization/insurance/stats
 * Get actuarial stats for insurance underwriting.
 */
router.get('/insurance/stats', async (_req: Request, res: Response): Promise<any> => {
  try {
    const { reputationInsuranceService } = await import('../services/reputationInsurance.service');
    const stats = reputationInsuranceService.getStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
