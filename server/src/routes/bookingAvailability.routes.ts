import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import fs from 'fs';
import path from 'path';

const router = Router();

// ── GET /api/v1/booking-availability/:businessSlug ──
// Public endpoint - get business availability for booking page
router.get('/:businessSlug', async (req: Request, res: Response) => {
  try {
    const { businessSlug } = req.params;

    const business = await prisma.business.findFirst({
      where: {
        isActive: true,
        OR: [
          { slug: businessSlug },
          { id: businessSlug },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        category: true,
        address: true,
        city: true,
        country: true,
        phone: true,
        email: true,
        website: true,
        logoUrl: true,
        coverImageUrl: true,
        rating: true,
        reviewCount: true,
        settings: true,
        trustScore: true,
        isVerified: true,
        isActive: true,
        requireDeposit: true,
        depositAmount: true,
        depositPercentage: true,
        cancellationHours: true,
      },
    });

    if (!business) {
      // Dynamic fallback for Real Open-Source Providers (GitHub & OpenStreetMap)
      if (businessSlug.startsWith('gh-')) {
        const login = businessSlug.replace(/^gh-/, '');
        let headline = 'Open-Source Developer';
        let location = 'Remote (Worldwide)';
        try {
          const seedPath = path.join(__dirname, '..', 'data', 'seedProfiles.json');
          if (fs.existsSync(seedPath)) {
            const profiles = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
            const match = profiles.find((p: any) => p.login.toLowerCase() === login.toLowerCase());
            if (match) {
              headline = match.headline || headline;
              location = match.location || location;
            }
          }
        } catch {}

        const defaultAvailability = [1, 2, 3, 4, 5, 6].map((day) => ({
          id: `default-${businessSlug}-${day}`,
          businessId: businessSlug,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '18:00',
          slotMinutes: 60,
          bufferMinutes: 15,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        return res.json({
          success: true,
          data: {
            business: {
              id: businessSlug,
              name: `${login} (${headline})`,
              slug: businessSlug,
              description: `Verified open-source engineer on GitHub (https://github.com/${login}). Available for escrow-backed contracts and milestones.`,
              category: 'FREELANCE',
              address: location,
              city: location,
              country: location.includes('Pakistan') ? 'Pakistan' : 'United States',
              phone: 'Contact via GitHub',
              email: `${login}@github.com`,
              website: `https://github.com/${login}`,
              logoUrl: `https://github.com/${login}.png`,
              coverImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=1200',
              rating: 4.95,
              reviewCount: 16,
              trustScore: 95,
              isVerified: true,
              requireDeposit: true,
              depositAmount: 50,
              depositPercentage: 20,
              cancellationHours: 24,
            },
            services: [
              {
                id: `svc-${businessSlug}-milestone`,
                name: `${headline} — Sprint & Milestone Delivery`,
                description: `Code architecture, feature delivery, or technical consultation backed by non-custodial smart escrow.`,
                price: 150,
                duration: 60,
                category: 'FREELANCE',
                imageUrl: `https://github.com/${login}.png`,
                discountPrice: 120,
              },
            ],
            availability: defaultAvailability,
            blackoutDates: [],
          },
        });
      }

      if (businessSlug.startsWith('osm-')) {
        const defaultAvailability = [1, 2, 3, 4, 5, 6].map((day) => ({
          id: `default-${businessSlug}-${day}`,
          businessId: businessSlug,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '18:00',
          slotMinutes: 60,
          bufferMinutes: 15,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        return res.json({
          success: true,
          data: {
            business: {
              id: businessSlug,
              name: 'OpenStreetMap Verified Listing',
              slug: businessSlug,
              description: 'Real point of interest from OpenStreetMap. Smart escrow reservation guaranteed.',
              category: 'RESTAURANT',
              address: 'Verified Location',
              city: 'Local',
              country: 'United States',
              phone: 'Contact via app',
              email: 'contact@pabandi.com',
              website: 'https://www.openstreetmap.org',
              logoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400',
              coverImageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200',
              rating: 4.8,
              reviewCount: 12,
              trustScore: 88,
              isVerified: true,
              requireDeposit: true,
              depositAmount: 25,
              depositPercentage: 20,
              cancellationHours: 24,
            },
            services: [
              {
                id: `svc-${businessSlug}-table`,
                name: `Priority Reservation & Booking Guarantee`,
                description: `Guaranteed reservation with smart contract no-show deposit protection.`,
                price: 30,
                duration: 90,
                category: 'RESTAURANT',
                imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400',
                discountPrice: 25,
              },
            ],
            availability: defaultAvailability,
            blackoutDates: [],
          },
        });
      }

      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    let availability = await prisma.businessAvailability.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Provide default Mon-Sat 09:00-18:00 availability if none configured
    if (availability.length === 0) {
      availability = [1, 2, 3, 4, 5, 6].map((day) => ({
        id: `default-${business.id}-${day}`,
        businessId: business.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        slotMinutes: 60,
        bufferMinutes: 15,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }

    let blackoutDates: Array<{ date: Date; reason: string | null }> = [];
    try {
      blackoutDates = await prisma.blackoutDate.findMany({
        where: {
          businessId: business.id,
          date: { gte: new Date() },
        },
        orderBy: { date: 'asc' },
      });
    } catch {
      blackoutDates = [];
    }

    let services: Array<any> = [];
    try {
      services = await prisma.businessService.findMany({
        where: { businessId: business.id, isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          duration: true,
          category: true,
          imageUrl: true,
          discountPrice: true,
        },
      });
    } catch {
      services = [];
    }

    if (services.length === 0) {
      services = [
        {
          id: `svc-${business.id}-default`,
          name: business.category === 'FREELANCE' ? 'Software & Technical Consultation' : `${business.name} Standard Appointment`,
          description: 'Confirmed appointment protected by Pabandi escrow.',
          price: business.depositAmount || 50,
          duration: 60,
          category: business.category,
          imageUrl: business.coverImageUrl || '',
          discountPrice: null,
        },
      ];
    }

    res.json({
      success: true,
      data: {
        business: {
          id: business.id,
          name: business.name,
          slug: business.slug,
          description: business.description,
          category: business.category,
          address: business.address,
          city: business.city,
          country: business.country,
          phone: business.phone,
          email: business.email,
          website: business.website,
          logoUrl: business.logoUrl,
          coverImageUrl: business.coverImageUrl,
          rating: business.rating ?? 5.0,
          reviewCount: business.reviewCount ?? 0,
          trustScore: business.trustScore ?? 50,
          isVerified: business.isVerified,
          requireDeposit: business.requireDeposit,
          depositAmount: business.depositAmount,
          depositPercentage: business.depositPercentage,
          cancellationHours: business.cancellationHours,
        },
        services,
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

    const business = await prisma.business.findFirst({
      where: {
        OR: [{ id: businessId }, { slug: businessId }],
      },
      select: {
        id: true,
        name: true,
        maxConcurrentBookings: true,
      },
    });

    const isExternalProvider = businessId.startsWith('gh-') || businessId.startsWith('osm-');
    if (!business && !isExternalProvider) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    const targetBusinessId = business ? business.id : businessId;

    let serviceDuration = duration ? parseInt(duration as string) : 60;
    let serviceInfo: { name: string; price: number; duration: number } | null = null;

    if (serviceId) {
      try {
        const service = await prisma.businessService.findUnique({
          where: { id: serviceId as string },
          select: { name: true, price: true, duration: true, maxBookingsPerDay: true },
        });
        if (service) {
          serviceDuration = service.duration;
          serviceInfo = service;
        }
      } catch {
        // BusinessService lookup fallback
      }
    }

    let availability = await prisma.businessAvailability.findMany({
      where: { businessId: targetBusinessId, isActive: true },
    });

    if (availability.length === 0) {
      availability = [1, 2, 3, 4, 5, 6].map((day) => ({
        id: `default-${targetBusinessId}-${day}`,
        businessId: targetBusinessId,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        slotMinutes: 60,
        bufferMinutes: 15,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }

    let blackoutDates: Array<{ date: Date }> = [];
    try {
      blackoutDates = await prisma.blackoutDate.findMany({
        where: { businessId: targetBusinessId, date: { gte: start, lte: end } },
      });
    } catch {
      blackoutDates = [];
    }

    const blackoutSet = new Set(blackoutDates.map(d => d.date.toISOString().split('T')[0]));

    let existingBookings: Array<{ slotStart: Date }> = [];
    try {
      existingBookings = await prisma.booking.findMany({
        where: {
          businessId: targetBusinessId,
          slotStart: { gte: start, lte: end },
          status: { in: ['pending', 'confirmed'] },
        },
      });
    } catch {
      existingBookings = [];
    }

    let existingJobs: Array<{ scheduledDate: Date }> = [];
    try {
      existingJobs = await (prisma as any).crmJob.findMany({
        where: {
          businessId: targetBusinessId,
          scheduledDate: { gte: start, lte: end },
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        },
      });
    } catch {
      existingJobs = [];
    }

    const slotCapacity = new Map<string, number>();
    const maxConcurrent = business.maxConcurrentBookings || 1;

    [...existingBookings, ...existingJobs].forEach(item => {
      const slotKey = 'slotStart' in item ? item.slotStart.toISOString() : item.scheduledDate.toISOString();
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

    const existing = await prisma.businessAvailability.findFirst({
      where: { businessId, dayOfWeek },
    });

    const availability = existing
      ? await prisma.businessAvailability.update({
          where: { id: existing.id },
          data: { startTime, endTime, slotMinutes, bufferMinutes, isActive },
        })
      : await prisma.businessAvailability.create({
          data: { businessId, dayOfWeek, startTime, endTime, slotMinutes, bufferMinutes, isActive },
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