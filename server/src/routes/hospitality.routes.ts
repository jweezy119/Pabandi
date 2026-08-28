/**
 * hospitality.routes.ts — Open-Finance + Hospitality API.
 *
 *   GET  /api/v1/hospitality/properties           — browse stays (city/category)
 *   POST /api/v1/hospitality/property             — create a stay (business owner)
 *   POST /api/v1/hospitality/book                 — book a stay → guest deposit escrow
 *                                                  + TreasuryPosition + Solana anchor + PTP attestation
 *   POST /api/v1/hospitality/finance/connect      — link an open-finance settlement rail
 *   GET  /api/v1/hospitality/finance/:businessId  — list a business's verified rails
 *   POST /api/v1/hospitality/finance/link         — attach a rail to a property (trust badge)
 *
 * Open-source: no paid geo/booking API. Settlement rails (RAAST, Stripe Treasury,
 * Open Banking, Solana wallet, PayPal) are modeled as verifiable, masked connections.
 */
import { Router, Request, Response } from 'express';
import { hospitalityService } from '../services/hospitality.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Browse stays (public)
router.get('/properties', async (req: any, res: Response) => {
  try {
    const { city, category, businessId } = req.query;
    const props = await hospitalityService.listProperties({
      city: city ? String(city) : undefined,
      category: category ? String(category) : undefined,
      businessId: businessId ? String(businessId) : undefined,
    });
    res.json({ success: true, data: { properties: props } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Create a stay (business owner)
router.post('/property', authenticate, async (req: any, res: Response) => {
  try {
    const property = await hospitalityService.createProperty({
      ...req.body,
      businessId: req.body.businessId || req.user.businessId,
      ownerId: req.user.id,
    });
    res.json({ success: true, data: { property } });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Book a stay (guest) — creates Reservation + StayBooking + guest deposit escrow
router.post('/book', authenticate, async (req: any, res: Response) => {
  try {
    const result = await hospitalityService.bookStay({
      ...req.body,
      guestUserId: req.user.id,
    });
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Connect an open-finance settlement rail (business owner)
router.post('/finance/connect', authenticate, async (req: any, res: Response) => {
  try {
    const { provider, accountRef } = req.body;
    if (!provider || !accountRef) return res.status(400).json({ success: false, error: 'provider + accountRef required' });
    const conn = await hospitalityService.connectFinance({
      businessId: req.body.businessId || req.user.businessId,
      provider,
      accountRef,
    });
    res.json({ success: true, data: { connection: conn } });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// List a business's verified rails (public-ish; auth gate)
router.get('/finance/:businessId', authenticate, async (req: any, res: Response) => {
  try {
    const conns = await hospitalityService.getFinance(req.params.businessId);
    res.json({ success: true, data: { connections: conns } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Attach a rail to a property (drives the trust badge)
router.post('/finance/link', authenticate, async (req: any, res: Response) => {
  try {
    const { propertyId, connectionId } = req.body;
    const prop = await hospitalityService.linkFinanceToProperty(propertyId, connectionId);
    res.json({ success: true, data: { property: prop } });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

export default router;
