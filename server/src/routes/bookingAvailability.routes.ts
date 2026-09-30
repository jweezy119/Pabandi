import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// ── GET /api/v1/booking-availability/:businessSlug ──
// Public endpoint - get business availability for booking page
router.get('/:businessSlug', async (req: Request, res: Response) => {
  try {
    const { businessSlug } = req.params;

    const business = await prisma.business.findUnique({
      where: { slug: businessSlug },
      select: { id: true, name: true, logoUrl: true, settings: true, trustScore: true, isVerified: true },
    });

    if (!business || !business.isActive) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    const availability = await prisma.businessAvailability.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { dayOfWeek: 'asc' },
    });

    const blackoutDates = await prisma.blackoutDate.findMany({
      where: {
        businessId: business.id,
        date: { gte: new Date() },
      },
      orderBy: { date: 'asc' },
    });

    res.json({
      success: true,
      data: {
        business: {
          id: business.id,
          name: business.name,
          logoUrl: business.logoUrl,
          trustScore: business.trustScore,
          isVerified: business.isVerified,
        },
        availability,
        blackoutDates: blackoutDates.map(d => ({
          date: d.date.toISOString().split('T')[0],
          reason: d.reason,
        })),
      },
    });
  } catch (e: any) {
    console.error('Get availability error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/booking-availability/:businessId/slots ──
// Public endpoint - get available slots for a date range
router.get('/:businessId/slots', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    const { startDate, endDate, serviceId, duration, guests } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'startDate and endDate required' });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, maxConcurrentBookings: true },
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    let serviceDuration = duration ? parseInt(duration as string) : 60;
    let serviceInfo: { name: string; price: number; duration: number } | null = null;

    if (serviceId) {
      const service = await prisma.businessService.findUnique({
        where: { id: serviceId as string },
        select: { name: true, price: true, duration: true, maxBookingsPerDay: true },
      });
      if (service) {
        serviceDuration = service.duration;
        serviceInfo = service;
      }
    }

    const availability = await prisma.businessAvailability.findMany({
      where: { businessId, isActive: true },
    });

    const blackoutDates = await prisma.blackoutDate.findMany({
      where: { businessId, date: { gte: start, lte: end } },
    });

    const blackoutSet = new Set(blackoutDates.map(d => d.date.toISOString().split('T')[0]));

    const existingBookings = await prisma.booking.findMany({
      where: {
        businessId,
        slotStart: { gte: start, lte: end },
        status: { in: ['pending', 'confirmed'] },
      },
    });

    const existingJobs = await prisma.crmJob.findMany({
      where: {
        businessId,
        scheduledDate: { gte: start, lte: end },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
    });

    const slotCapacity = new Map<string, number>();
    const maxConcurrent = business.maxConcurrentBookings || 1;

    [...existingBookings, ...existingJobs].forEach(item => {
      const slotKey = item.slotStart.toISOString();
      slotCapacity.set(slotKey, (slotCapacity.get(slotKey) || 0) + 1);
    });

    const slots: Array<{
      date: string;
      startTime: string;
      endTime: string;
      available: boolean;
      remainingCapacity: number;
      service?: { name: string; price: number; duration: number };
    }> = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay();

      if (blackoutSet.has(dateStr)) continue;

      const dayAvailability = availability.find(a => a.dayOfWeek === dayOfWeek);
      if (!dayAvailability) continue;

      const slotMinutes = dayAvailability.slotMinutes;
      const bufferMinutes = dayAvailability.bufferMinutes;

      const [startHour, startMin] = dayAvailability.startTime.split(':').map(Number);
      const [endHour, endMin] = dayAvailability.endTime.split(':').map(Number);

      let current = new Date(d);
      current.setHours(startHour, startMin, 0, 0);
      const endTime = new Date(d);
      endTime.setHours(endHour, endMin, 0, 0);

      while (current < endTime) {
        const slotEnd = new Date(current.getTime() + serviceDuration * 60000);
        if (slotEnd > endTime) break;

        const slotKey = current.toISOString();
        const currentCapacity = slotCapacity.get(slotKey) || 0;
        const remainingCapacity = Math.max(0, maxConcurrent - currentCapacity);

        slots.push({
          date: dateStr,
          startTime: current.toTimeString().slice(0, 5),
          endTime: slotEnd.toTimeString().slice(0, 5),
          available: remainingCapacity > 0,
          remainingCapacity,
          service: serviceInfo || undefined,
        });

        current = new Date(current.getTime() + (slotMinutes + bufferMinutes) * 60000);
      }
    }

    res.json({ success: true, data: slots });
  } catch (e: any) {
    console.error('Get slots error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/booking-availability/lock-slot ──
// Temporarily hold a slot during checkout
router.post('/lock-slot', async (req: Request, res: Response) => {
  try {
    const { businessId, slotStart, slotEnd, sessionId } = req.body;

    if (!businessId || !slotStart || !slotEnd || !sessionId) {
      return res.status(400).json({ success: false, error: 'businessId, slotStart, slotEnd, sessionId required' });
    }

    const lockKey = `${businessId}:${new Date(slotStart).toISOString()}`;

    const existing = await prisma.booking.findFirst({
      where: {
        businessId,
        slotStart: new Date(slotStart),
        status: { in: ['pending', 'confirmed'] },
      },
    });

    if (existing) {
      return res.status(409).json({ success: false, error: 'Slot no longer available' });
    }

    const lock = await prisma.slotLock.upsert({
      where: { lockKey },
      create: {
        lockKey,
        businessId,
        slotStart: new Date(slotStart),
        slotEnd: new Date(slotEnd),
        sessionId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      update: {
        sessionId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    res.json({ success: true, data: lock });
  } catch (e: any) {
    console.error('Lock slot error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── DELETE /api/v1/booking-availability/lock-slot/:lockKey ──
// Release a slot lock
router.delete('/lock-slot/:lockKey', async (req: Request, res: Response) => {
  try {
    await prisma.slotLock.delete({ where: { lockKey: req.params.lockKey } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/booking-availability ──
// Authenticated - create/update business availability (admin)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId, dayOfWeek, startTime, endTime, slotMinutes, bufferMinutes, isActive } = req.body;

    if (!businessId || dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'businessId, dayOfWeek, startTime, endTime required' });
    }

    // Verify ownership
    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: req.user!.id },
    });

    if (!business) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const availability = await prisma.businessAvailability.upsert({
      where: {
        businessId_dayOfWeek: { businessId, dayOfWeek },
      },
      update: { startTime, endTime, slotMinutes, bufferMinutes, isActive },
      create: { businessId, dayOfWeek, startTime, endTime, slotMinutes, bufferMinutes, isActive },
    });

    res.json({ success: true, data: availability });
  } catch (e: any) {
    console.error('Create availability error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── PUT /api/v1/booking-availability/:id ──
// Authenticated - update availability
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { startTime, endTime, slotMinutes, bufferMinutes, isActive } = req.body;

    const availability = await prisma.businessAvailability.findUnique({
      where: { id: req.params.id },
      include: { business: true },
    });

    if (!availability || availability.business.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const updated = await prisma.businessAvailability.update({
      where: { id: req.params.id },
      data: { startTime, endTime, slotMinutes, bufferMinutes, isActive },
    });

    res.json({ success: true, data: updated });
  } catch (e: any) {
    console.error('Update availability error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── DELETE /api/v1/booking-availability/:id ──
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const availability = await prisma.businessAvailability.findUnique({
      where: { id: req.params.id },
      include: { business: true },
    });

    if (!availability || availability.business.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await prisma.businessAvailability.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Availability deleted' });
  } catch (e: any) {
    console.error('Delete availability error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/booking-availability/blackout ──
// Add blackout date
router.post('/blackout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId, date, reason } = req.body;

    if (!businessId || !date) {
      return res.status(400).json({ success: false, error: 'businessId and date required' });
    }

    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: req.user!.id },
    });

    if (!business) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const blackout = await prisma.blackoutDate.create({
      data: { businessId, date: new Date(date), reason },
    });

    res.json({ success: true, data: blackout });
  } catch (e: any) {
    console.error('Create blackout error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── DELETE /api/v1/booking-availability/blackout/:id ──
router.delete('/blackout/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const blackout = await prisma.blackoutDate.findUnique({
      where: { id: req.params.id },
      include: { business: true },
    });

    if (!blackout || blackout.business.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await prisma.blackoutDate.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Blackout date deleted' });
  } catch (e: any) {
    console.error('Delete blackout error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;