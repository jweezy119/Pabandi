import { Router, Request, Response } from 'express';
import { nightlifeIntegrationService } from '../services/nightlifeIntegration.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// PROMOTER OS — Dashboard & Management
// ═══════════════════════════════════════════════════════════════════════════

// Get promoter dashboard with stats
router.get('/promoter/:id/dashboard', authenticate, async (req: any, res: Response) => {
  try {
    const dashboard = await nightlifeIntegrationService.getPromoterDashboard(req.params.id);
    if (!dashboard) return res.status(404).json({ error: 'Promoter not found' });
    res.json({ success: true, data: dashboard });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Create promoter profile
router.post('/promoter', authenticate, async (req: any, res: Response) => {
  try {
    const promoter = await nightlifeIntegrationService.createPromoterProfile(req.user?.id, req.body);
    res.status(201).json({ success: true, data: promoter });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create promoter profile' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GUEST LIST — Smart Lists with Deposits, QR, Entry Verification
// ═══════════════════════════════════════════════════════════════════════════

// Create smart guest list (with no-show prediction)
router.post('/guest-list/smart', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const guestList = await nightlifeIntegrationService.createSmartGuestList({
      userId,
      ...req.body,
    });
    res.status(201).json({ success: true, data: guestList });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create guest list' });
  }
});

// Generate QR code for entry
router.get('/guest-list/:id/qr', authenticate, async (req: any, res: Response) => {
  try {
    const qr = await nightlifeIntegrationService.generateQRCode(req.params.id);
    if (!qr) return res.status(404).json({ error: 'Guest list not found' });
    res.json({ success: true, data: qr });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to generate QR' });
  }
});

// Verify entry at door (venue scans QR)
router.post('/guest-list/verify', authenticate, async (req: any, res: Response) => {
  try {
    const { confirmationCode, venueId } = req.body;
    const result = await nightlifeIntegrationService.verifyEntry(confirmationCode, venueId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to verify entry' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// VENUE DASHBOARD — Real-time Capacity, Analytics
// ═══════════════════════════════════════════════════════════════════════════

// Get venue dashboard (real-time arrivals, capacity, revenue)
router.get('/venue/:id/dashboard', authenticate, async (req: any, res: Response) => {
  try {
    const dashboard = await nightlifeIntegrationService.getVenueDashboard(req.params.id);
    if (!dashboard) return res.status(404).json({ error: 'Venue not found' });
    res.json({ success: true, data: dashboard });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load venue dashboard' });
  }
});

// Get real-time capacity
router.get('/venue/:id/capacity', async (req: Request, res: Response) => {
  try {
    const capacity = await nightlifeIntegrationService.getRealTimeCapacity(req.params.id);
    if (!capacity) return res.status(404).json({ error: 'Venue not found' });
    res.json({ success: true, data: capacity });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get capacity' });
  }
});

// Add to waitlist
router.post('/venue/:id/waitlist', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { partySize } = req.body;
    const waitlist = await nightlifeIntegrationService.addToWaitlist(req.params.id, userId, partySize);
    res.status(201).json({ success: true, data: waitlist });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to add to waitlist' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION RAILS — WhatsApp, Instagram, Eventbrite, SMS
// ═══════════════════════════════════════════════════════════════════════════

// Send WhatsApp confirmation
router.post('/guest-list/:id/whatsapp', authenticate, async (req: any, res: Response) => {
  try {
    const { phone } = req.body;
    // In production: look up guest list and send
    const result = await nightlifeIntegrationService.sendWhatsAppConfirmation(phone, {});
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to send WhatsApp' });
  }
});

// Send SMS confirmation
router.post('/guest-list/:id/sms', authenticate, async (req: any, res: Response) => {
  try {
    const { phone } = req.body;
    const result = await nightlifeIntegrationService.sendSMSConfirmation(phone, {});
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// Sync Instagram venue data
router.get('/venue/:id/instagram', authenticate, async (req: any, res: Response) => {
  try {
    const { handle } = req.query;
    const result = await nightlifeIntegrationService.syncInstagramVenue(handle as string);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to sync Instagram' });
  }
});

// Sync Eventbrite event
router.get('/events/sync-eventbrite/:id', authenticate, async (req: any, res: Response) => {
  try {
    const result = await nightlifeIntegrationService.syncEventbriteEvent(req.params.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to sync Eventbrite' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FRAUD DETECTION — Promoter Risk Scoring
// ═══════════════════════════════════════════════════════════════════════════

// Check promoter fraud risk
router.get('/promoter/:id/fraud-check', authenticate, async (req: any, res: Response) => {
  try {
    const result = await nightlifeIntegrationService.checkPromoterFraud(req.params.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to check promoter' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PROMOTER PAYOUTS — Commission Tracking
// ═══════════════════════════════════════════════════════════════════════════

// Calculate promoter payout
router.get('/promoter/:id/payout', authenticate, async (req: any, res: Response) => {
  try {
    const { venueId, date } = req.query;
    const result = await nightlifeIntegrationService.calculatePromoterPayout(
      req.params.id,
      venueId as string,
      date as string
    );
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to calculate payout' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENT DISCOVERY — Multi-source
// ═══════════════════════════════════════════════════════════════════════════

// Discover events from all sources
router.get('/events/discover', async (req: Request, res: Response) => {
  try {
    const { city, date, source } = req.query;
    const events = await nightlifeIntegrationService.discoverEvents({
      city: city as string,
      date: date as string,
      source: source as string,
    });
    res.json({ success: true, data: events });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to discover events' });
  }
});

export default router;
