/**
 * predictive.routes.ts — Predictive Intelligence API.
 *
 *   GET /api/v1/predictive/customer/:id/risk     — per-customer no-show risk
 *   GET /api/v1/predictive/business/:id/risk     — per-business reliability
 *   POST /api/v1/predictive/booking              — forward prediction for a
 *                                                   PROSPECTIVE booking
 *   GET /api/v1/predictive/business/:id/demand    — hourly demand forecast
 *   POST /api/v1/predictive/recommend-slots       — optimal slot suggestions
 *
 * Open-source: pure Postgres aggregates, no external ML dependency.
 */
import { Router, Request, Response } from 'express';
import { predictiveTrustService } from '../services/predictiveTrust.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Per-customer risk (auth: the requester must be the customer or an admin/owner)
router.get('/customer/:id/risk', authenticate, async (req: any, res: Response) => {
  try {
    const risk = await predictiveTrustService.customerRisk(req.params.id);
    res.json({ success: true, data: risk });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Per-business reliability (public-ish; auth gate to avoid scrapers)
router.get('/business/:id/risk', authenticate, async (req: any, res: Response) => {
  try {
    const risk = await predictiveTrustService.businessRisk(req.params.id);
    res.json({ success: true, data: risk });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Forward prediction for a prospective booking (no auth needed for the model,
// but require a valid session to avoid open enumeration). Provide minimal input.
router.post('/booking', authenticate, async (req: any, res: Response) => {
  try {
    const { customerId, businessId, reservationTime } = req.body ?? {};
    const pred = await predictiveTrustService.predictBooking({ customerId, businessId, reservationTime });
    res.json({ success: true, data: pred });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Hourly demand forecast for a business
router.get('/business/:id/demand', authenticate, async (req: any, res: Response) => {
  try {
    const demand = await predictiveTrustService.demandForecast(req.params.id);
    res.json({ success: true, data: demand });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Optimal slot recommendation
router.post('/recommend-slots', authenticate, async (req: any, res: Response) => {
  try {
    const { customerId, businessId, daysAhead } = req.body ?? {};
    if (!businessId) return res.status(400).json({ success: false, error: 'businessId required' });
    const slots = await predictiveTrustService.recommendSlots({ customerId, businessId, daysAhead });
    res.json({ success: true, data: { slots } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
