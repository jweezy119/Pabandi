import { Router, Request, Response } from 'express';
import { nightlifeService } from '../services/nightlife.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ── Venues ────────────────────────────────────────────────────────────────
router.get('/venues', async (req: Request, res: Response) => {
  try {
    const { city, type, genre } = req.query;
    const venues = await nightlifeService.listVenues({
      city: city as string,
      type: type as string,
      genre: genre as string,
    });
    res.json({ success: true, data: venues });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load venues' });
  }
});

router.get('/venues/:id', async (req: Request, res: Response) => {
  try {
    const venue = await nightlifeService.getVenue(req.params.id);
    if (!venue) return res.status(404).json({ error: 'Venue not found' });
    res.json({ success: true, data: venue });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load venue' });
  }
});

router.post('/venues', authenticate, async (req: any, res: Response) => {
  try {
    const venue = await nightlifeService.createVenue(req.body);
    res.status(201).json({ success: true, data: venue });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create venue' });
  }
});

// ── Bottle Service ─────────────────────────────────────────────────────────
router.get('/venues/:id/tables', async (req: Request, res: Response) => {
  try {
    const { date, guests } = req.query;
    const tables = await nightlifeService.getAvailableTables(
      req.params.id,
      date as string,
      Number(guests) || 2
    );
    res.json({ success: true, data: tables });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load tables' });
  }
});

router.post('/bottle-packages', authenticate, async (req: any, res: Response) => {
  try {
    const pkg = await nightlifeService.createBottlePackage(req.body);
    res.status(201).json({ success: true, data: pkg });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create package' });
  }
});

router.post('/bottle-reservations', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const reservation = await nightlifeService.createBottleReservation({
      userId,
      ...req.body,
    });
    res.status(201).json({ success: true, data: reservation });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create reservation' });
  }
});

// ── Cover Charge ───────────────────────────────────────────────────────────
router.get('/venues/:id/cover', async (req: Request, res: Response) => {
  try {
    const { date, time, gender, guestList, vip } = req.query;
    const charge = await nightlifeService.getCoverCharge(req.params.id, {
      date: date as string || new Date().toISOString().split('T')[0],
      time: time as string,
      gender: gender as string,
      isGuestList: guestList === 'true',
      isVIP: vip === 'true',
    });
    res.json({ success: true, data: charge });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get cover charge' });
  }
});

router.post('/cover-charges', authenticate, async (req: any, res: Response) => {
  try {
    const charge = await nightlifeService.createCoverCharge(req.body);
    res.status(201).json({ success: true, data: charge });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create cover charge' });
  }
});

// ── Guest List ─────────────────────────────────────────────────────────────
router.post('/guest-list', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const guestList = await nightlifeService.addToGuestList({
      userId,
      ...req.body,
    });
    res.status(201).json({ success: true, data: guestList });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to add to guest list' });
  }
});

// ── Events ─────────────────────────────────────────────────────────────────
router.get('/events', async (req: Request, res: Response) => {
  try {
    const { venueId, date, city } = req.query;
    const events = await nightlifeService.listEvents({
      venueId: venueId as string,
      date: date as string,
      city: city as string,
    });
    res.json({ success: true, data: events });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load events' });
  }
});

router.post('/events', authenticate, async (req: any, res: Response) => {
  try {
    const event = await nightlifeService.createEvent(req.body);
    res.status(201).json({ success: true, data: event });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create event' });
  }
});

// ── Demand Forecasting ─────────────────────────────────────────────────────
router.get('/venues/:id/forecast', async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    const forecast = await nightlifeService.forecastDemand(
      req.params.id,
      Number(days) || 7
    );
    res.json({ success: true, data: forecast });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get forecast' });
  }
});

// ── Wait Time ──────────────────────────────────────────────────────────────
router.get('/venues/:id/wait-time', async (req: Request, res: Response) => {
  try {
    const waitTime = await nightlifeService.estimateWaitTime(req.params.id);
    res.json({ success: true, data: waitTime });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to estimate wait time' });
  }
});

// ── Recommendations ───────────────────────────────────────────────────────
router.get('/recommendations', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { limit } = req.query;
    const recommendations = await nightlifeService.getRecommendations(
      userId,
      Number(limit) || 10
    );
    res.json({ success: true, data: recommendations });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// ── Fraud Detection ───────────────────────────────────────────────────────
router.get('/promoters/:id/fraud-check', authenticate, async (req: any, res: Response) => {
  try {
    const result = await nightlifeService.detectFraudulentPromoter(req.params.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to check promoter' });
  }
});

// ── Stats ──────────────────────────────────────────────────────────────────
router.get('/venues/:id/stats', async (req: Request, res: Response) => {
  try {
    const stats = await nightlifeService.getVenueStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

export default router;
