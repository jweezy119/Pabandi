import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate, optionalAuthenticate, AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { formatBusinessDiscoveryItem } from '../utils/businessDiscovery';
import { assessBookingRisk, quoteBookingRiskAndDeposit } from '../services/bookingRisk.service';
import {
  advanceBookingEscrow,
  bookingEscrowReference,
  ensureBookingEscrow,
  forfeitBookingDeposit,
  refundBookingDeposit,
} from '../services/booking-escrow.service';

const router = Router();

const OSM_CATEGORY_MAP: Record<string, string> = {
  restaurant: 'RESTAURANT',
  cafe: 'RESTAURANT',
  fast_food: 'RESTAURANT',
  bar: 'RESTAURANT',
  hairdresser: 'SALON',
  beauty: 'SALON',
  clinic: 'CLINIC',
  hospital: 'CLINIC',
  doctor: 'CLINIC',
  dentist: 'CLINIC',
  spa: 'SPA',
  massage: 'SPA',
  gym: 'FITNESS_CENTER',
  fitness_centre: 'FITNESS_CENTER',
};

// GET /api/v1/booking/businesses - List businesses for BookingOS Discovery with cursor pagination
router.get('/businesses', async (req: Request, res: Response) => {
  try {
    const { cursor, limit, city, category, query, search, location } = req.query;

    const limitNum = Math.min(Math.max(parseInt(String(limit || '20'), 10) || 20, 1), 100);

    const where: any = {
      isActive: true,
    };

    const searchText = (query || search) as string | undefined;
    if (searchText && typeof searchText === 'string' && searchText.trim()) {
      const q = searchText.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
    }

    const cityText = (city || location) as string | undefined;
    if (cityText && typeof cityText === 'string' && cityText.trim()) {
      const loc = cityText.trim();
      const locConditions = [
        { city: { contains: loc, mode: 'insensitive' } },
        { state: { contains: loc, mode: 'insensitive' } },
        { address: { contains: loc, mode: 'insensitive' } },
      ];
      if (Array.isArray(where.OR)) {
        where.AND = [
          { OR: where.OR },
          { OR: locConditions },
        ];
        delete where.OR;
      } else {
        where.OR = locConditions;
      }
    }

    if (category && typeof category === 'string' && category.toUpperCase() !== 'ALL') {
      where.category = category.toUpperCase();
    }

    const findArgs: any = {
      where,
      include: {
        owner: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { id: 'asc' },
      take: limitNum + 1,
    };

    if (cursor && typeof cursor === 'string' && cursor.trim()) {
      findArgs.cursor = { id: cursor.trim() };
      findArgs.skip = 1;
    }

    const dbBusinesses = await prisma.business.findMany(findArgs);

    let nextCursor: string | null = null;
    if (dbBusinesses.length > limitNum) {
      dbBusinesses.pop();
      nextCursor = dbBusinesses[dbBusinesses.length - 1]?.id || null;
    }

    const items = dbBusinesses.map(formatBusinessDiscoveryItem);

    return res.json({
      items,
      nextCursor,
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] businesses error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

const DEFAULT_SLOT_TIMES = [
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
];

function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// GET /api/v1/booking/my-bookings - Authenticated user's bookings
router.get('/my-bookings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const email = req.user.email?.trim().toLowerCase();
    const matchingClients = email
      ? await prisma.crmClient.findMany({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { id: true },
        })
      : [];
    const clientIds = matchingClients.map((c) => c.id);

    const bookings = await prisma.booking.findMany({
      where:
        clientIds.length > 0
          ? { clientId: { in: clientIds } }
          : { id: { in: [] } },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            address: true,
            category: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { slotStart: 'desc' },
      take: 100,
    });

    return res.json({ success: true, data: bookings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] my-bookings error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// ── Business-owner booking management (/bookings/public/...) ────────────────

async function resolveOwnedBusinessId(
  req: AuthRequest,
  requestedId?: string
): Promise<string | null> {
  const userId = req.user?.id;
  if (!userId) return null;

  const cleanRequested =
    requestedId && !['me', 'null', 'undefined'].includes(requestedId.trim().toLowerCase())
      ? requestedId.trim()
      : undefined;

  if (req.user?.role === 'ADMIN' && cleanRequested) {
    return cleanRequested;
  }

  const owned = await prisma.business.findFirst({
    where: cleanRequested
      ? { id: cleanRequested, ownerId: userId }
      : { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return owned?.id ?? null;
}

async function findAuthorizedBooking(req: AuthRequest, bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { business: { select: { id: true, ownerId: true } } },
  });
  if (!booking) return { error: 404 as const, message: 'Booking not found', booking: null };
  const isAdmin = req.user?.role === 'ADMIN';
  const isOwner = Boolean(req.user?.id && booking.business?.ownerId === req.user.id);
  if (!isAdmin && !isOwner) {
    return { error: 403 as const, message: 'Not authorized to manage this booking', booking: null };
  }
  return { error: null, message: null, booking };
}

// GET /api/v1/bookings/public/business/:businessId - List bookings for business owner
router.get('/public/business/:businessId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = await resolveOwnedBusinessId(req, req.params.businessId);
    if (!businessId) {
      return res.status(403).json({ success: false, error: 'No business found for this account' });
    }

    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'all';
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));

    const where: any = { businessId };
    if (status && status !== 'all') {
      where.status = status;
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { slotStart: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return res.json({
      success: true,
      data: bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] business list error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/bookings/public/:id/confirm
router.post('/public/:id/confirm', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const check = await findAuthorizedBooking(req, req.params.id);
    if (check.error || !check.booking) {
      return res.status(check.error || 404).json({ success: false, error: check.message });
    }
    const updated = await prisma.booking.update({
      where: { id: check.booking.id },
      data: { status: 'confirmed' },
    });
    return res.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] confirm error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/bookings/public/:id/cancel
router.post('/public/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const check = await findAuthorizedBooking(req, req.params.id);
    if (check.error || !check.booking) {
      return res.status(check.error || 404).json({ success: false, error: check.message });
    }
    const updated = await prisma.booking.update({
      where: { id: check.booking.id },
      data: { status: 'cancelled' },
    });
    await refundBookingDeposit(check.booking.id, 'Cancelled by business').catch(() => {});
    await prisma.bookingRisk
      .updateMany({
        where: { bookingId: check.booking.id },
        data: { outcome: 'cancelled', outcomeAt: new Date() },
      })
      .catch(() => {});
    return res.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] cancel error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/bookings/public/:id/attend
router.post('/public/:id/attend', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const check = await findAuthorizedBooking(req, req.params.id);
    if (check.error || !check.booking) {
      return res.status(check.error || 404).json({ success: false, error: check.message });
    }
    const now = new Date();
    const updated = await prisma.booking.update({
      where: { id: check.booking.id },
      data: { status: 'attended', completedAt: now, escrowStatus: 'released' },
    });

    await advanceBookingEscrow(check.booking.id, 'conditions_met', {
      source: 'owner-checkin',
      reason: 'Client checked in by business owner',
    }).catch(() => {});
    await advanceBookingEscrow(check.booking.id, 'released', {
      source: 'owner-checkin',
      reason: 'Appointment attended — deposit released',
    }).catch(() => {});

    if (check.booking.clientId) {
      await prisma.crmClient
        .update({
          where: { id: check.booking.clientId },
          data: { totalJobs: { increment: 1 }, lastJobAt: now },
        })
        .catch(() => {});
    }
    await prisma.bookingRisk
      .updateMany({
        where: { bookingId: check.booking.id },
        data: { outcome: 'attended', outcomeAt: now },
      })
      .catch(() => {});

    return res.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] attend error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/bookings/public/:id/no-show
router.post('/public/:id/no-show', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const check = await findAuthorizedBooking(req, req.params.id);
    if (check.error || !check.booking) {
      return res.status(check.error || 404).json({ success: false, error: check.message });
    }
    const now = new Date();
    const updated = await prisma.booking.update({
      where: { id: check.booking.id },
      data: { status: 'no_show', escrowStatus: 'released' },
    });
    await forfeitBookingDeposit(check.booking.id, 'Marked as no-show by business').catch(() => {});
    await prisma.bookingRisk
      .updateMany({
        where: { bookingId: check.booking.id },
        data: { outcome: 'no_show', outcomeAt: now },
      })
      .catch(() => {});
    return res.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] no-show error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/v1/booking/:businessId/slots - Real slot availability for a business
router.get('/:businessId/slots', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    const dateParam = typeof req.query.date === 'string' ? req.query.date.trim() : '';
    const startDateParam = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : '';
    const endDateParam = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : '';

    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessId }, { slug: businessId }] },
      select: { id: true, maxConcurrentBookings: true },
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    const dates: string[] = [];
    if (dateParam) {
      dates.push(dateParam);
    } else if (startDateParam) {
      const start = new Date(`${startDateParam}T00:00:00Z`);
      const end = endDateParam ? new Date(`${endDateParam}T00:00:00Z`) : new Date(start.getTime() + 6 * 86400000);
      const cur = new Date(start);
      while (cur <= end && dates.length < 14) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    } else {
      dates.push(new Date().toISOString().slice(0, 10));
    }

    const rangeStart = new Date(`${dates[0]}T00:00:00Z`);
    const rangeEnd = new Date(`${dates[dates.length - 1]}T23:59:59Z`);

    const existing = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        slotStart: { gte: rangeStart, lte: rangeEnd },
        status: { in: ['pending', 'confirmed'] },
      },
      select: { slotStart: true },
    });

    const bookedCounts = new Map<string, number>();
    for (const row of existing) {
      const iso = row.slotStart.toISOString();
      const key = `${iso.slice(0, 10)}T${iso.slice(11, 16)}`;
      bookedCounts.set(key, (bookedCounts.get(key) || 0) + 1);
    }

    const capacity = Math.max(1, business.maxConcurrentBookings || 1);
    const slots = dates.flatMap((d) =>
      DEFAULT_SLOT_TIMES.map((time) => {
        const used = bookedCounts.get(`${d}T${time}`) || 0;
        const remainingCapacity = Math.max(0, capacity - used);
        return {
          date: d,
          time,
          startTime: time,
          endTime: addMinutesToTime(time, 60),
          available: remainingCapacity > 0,
          remainingCapacity,
        };
      })
    );

    return res.json({ success: true, data: slots, slots });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] slots error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/booking/risk-quote - Pre-checkout DRPE Trust Score & deposit evaluation
router.post('/risk-quote', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      businessId,
      serviceType,
      serviceValue,
      slotStart: rawSlotStart,
      reservationDate,
      reservationTime,
      customerEmail,
    } = req.body ?? {};

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'businessId is required' });
    }

    let slotStartDate = new Date();
    if (rawSlotStart) {
      const parsed = new Date(rawSlotStart);
      if (!Number.isNaN(parsed.getTime())) slotStartDate = parsed;
    } else if (reservationDate && reservationTime) {
      const parsed = new Date(`${reservationDate}T${reservationTime}:00Z`);
      if (!Number.isNaN(parsed.getTime())) slotStartDate = parsed;
    }

    // Resolve client's Trust Score (defaults to 70 for brand new clients)
    let resolvedTrustScore: number = 70;
    if (req.user?.id) {
      const userRecord = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { trustScore: true },
      });
      if (typeof userRecord?.trustScore === 'number') {
        resolvedTrustScore = userRecord.trustScore;
      }
    } else if (typeof customerEmail === 'string' && customerEmail.trim()) {
      const userRecord = await prisma.user.findUnique({
        where: { email: customerEmail.trim().toLowerCase() },
        select: { trustScore: true },
      });
      if (typeof userRecord?.trustScore === 'number') {
        resolvedTrustScore = userRecord.trustScore;
      }
    }

    const numericServiceValue = Number.isFinite(Number(serviceValue))
      ? Math.max(0, Number(serviceValue))
      : 0;

    const { prediction, drpe } = await quoteBookingRiskAndDeposit({
      businessId: String(businessId),
      slotStart: slotStartDate,
      serviceType: typeof serviceType === 'string' && serviceType.trim() ? serviceType.trim() : 'Booking',
      serviceValue: numericServiceValue,
      trustScore: resolvedTrustScore,
    });

    return res.json({
      success: true,
      data: {
        ...drpe,
        riskScore: prediction.riskScore,
        riskBand: prediction.band,
        policy: prediction.policy,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] risk-quote error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/booking - Create a booking + escrow (supports authenticated & guest bookings)
router.post('/', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      businessId,
      slotStart: rawSlotStart,
      slotEnd: rawSlotEnd,
      reservationDate,
      reservationTime,
      durationMinutes,
      serviceType,
      serviceId,
      serviceName,
      serviceValue,
      numberOfGuests,
      depositAmount,
      customerName,
      customerEmail,
      customerPhone,
      clientAddress,
      serviceAddress,
      specialRequests,
      projectDescription,
      paymentMethod,
    } = req.body ?? {};

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'businessId is required' });
    }

    // Resolve business by id or slug
    const business = await prisma.business.findFirst({
      where: { OR: [{ id: String(businessId) }, { slug: String(businessId) }] },
      select: { id: true, ownerId: true, category: true, maxConcurrentBookings: true },
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    // Resolve slotStart / slotEnd from either ISO timestamps or date + time fields
    let slotStartDate: Date | null = null;
    let slotEndDate: Date | null = null;
    if (rawSlotStart) {
      slotStartDate = new Date(rawSlotStart);
      slotEndDate = rawSlotEnd
        ? new Date(rawSlotEnd)
        : new Date(slotStartDate.getTime() + (Number(durationMinutes) || 60) * 60 * 1000);
    } else if (reservationDate && reservationTime) {
      slotStartDate = new Date(`${reservationDate}T${reservationTime}:00Z`);
      slotEndDate = new Date(slotStartDate.getTime() + (Number(durationMinutes) || 60) * 60 * 1000);
    }

    if (!slotStartDate || !slotEndDate || Number.isNaN(slotStartDate.getTime()) || Number.isNaN(slotEndDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Valid slotStart/slotEnd or reservationDate/reservationTime required' });
    }

    const resolvedServiceType =
      (typeof serviceType === 'string' && serviceType.trim()) ||
      (typeof serviceName === 'string' && serviceName.trim()) ||
      business.category ||
      'Booking';

    // Check if slot is already booked at capacity
    const existingCount = await prisma.booking.count({
      where: {
        businessId: business.id,
        slotStart: slotStartDate,
        status: { in: ['pending', 'confirmed'] },
      },
    });

    const maxConcurrent = Math.max(1, business.maxConcurrentBookings || 1);
    if (existingCount >= maxConcurrent) {
      return res.status(409).json({ success: false, error: 'Slot already booked' });
    }

    // Resolve or create CrmClient for this booking (works for both signed-in users and guests)
    const resolvedEmail = (
      (typeof customerEmail === 'string' && customerEmail.trim()) ||
      req.user?.email ||
      ''
    ).toLowerCase();
    const resolvedName =
      (typeof customerName === 'string' && customerName.trim()) ||
      `${req.user?.firstName ?? ''} ${req.user?.lastName ?? ''}`.trim() ||
      resolvedEmail ||
      'Guest Client';
    const resolvedPhone =
      (typeof customerPhone === 'string' && customerPhone.trim()) ||
      req.user?.phone ||
      null;
    const resolvedAddress =
      (typeof clientAddress === 'string' && clientAddress.trim()) ||
      (typeof serviceAddress === 'string' && serviceAddress.trim()) ||
      null;

    const existingClient = resolvedEmail
      ? await prisma.crmClient.findFirst({
          where: {
            businessId: business.id,
            email: { equals: resolvedEmail, mode: 'insensitive' },
          },
          select: { id: true },
        })
      : null;

    const client =
      existingClient ??
      (await prisma.crmClient.create({
        data: {
          businessId: business.id,
          serviceBusinessId: business.id,
          name: resolvedName,
          email: resolvedEmail || null,
          phone: resolvedPhone,
          address: resolvedAddress,
        },
        select: { id: true },
      }));

    // Run DRPE predictive risk check before finalizing deposit requirements
    let resolvedTrustScore = 70;
    if (req.user?.id) {
      const userRecord = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { trustScore: true },
      });
      if (typeof userRecord?.trustScore === 'number') {
        resolvedTrustScore = userRecord.trustScore;
      }
    } else if (resolvedEmail) {
      const userRecord = await prisma.user.findUnique({
        where: { email: resolvedEmail },
        select: { trustScore: true },
      });
      if (typeof userRecord?.trustScore === 'number') {
        resolvedTrustScore = userRecord.trustScore;
      }
    }

    const numericServiceValue = Number.isFinite(Number(serviceValue))
      ? Math.max(0, Number(serviceValue))
      : 0;

    const { drpe } = await quoteBookingRiskAndDeposit({
      businessId: business.id,
      slotStart: slotStartDate,
      serviceType: resolvedServiceType,
      serviceValue: numericServiceValue,
      trustScore: resolvedTrustScore,
    });

    const requestedDeposit = Number.isFinite(Number(depositAmount)) ? Math.max(0, Number(depositAmount)) : 0;
    const numericDeposit =
      drpe.depositPercent === 0
        ? 0
        : numericServiceValue > 0
          ? drpe.depositAmount
          : requestedDeposit;

    // Create the booking
    const booking = await prisma.booking.create({
      data: {
        businessId: business.id,
        clientId: client.id,
        slotStart: slotStartDate,
        slotEnd: slotEndDate,
        serviceType: resolvedServiceType,
        depositAmount: numericDeposit,
        depositPaid: false,
        depositStatus: numericDeposit > 0 ? 'pending' : 'waived',
        status: numericDeposit > 0 ? 'pending' : 'confirmed',
        clientAddress: resolvedAddress,
        metadata: {
          userId: req.user?.id ?? null,
          customerName: resolvedName,
          customerEmail: resolvedEmail || null,
          customerPhone: resolvedPhone,
          serviceId: serviceId ?? null,
          serviceName: serviceName ?? resolvedServiceType,
          serviceValue: numericServiceValue || null,
          numberOfGuests: Number.isFinite(Number(numberOfGuests)) ? Number(numberOfGuests) : 1,
          specialRequests: specialRequests ?? null,
          projectDescription: projectDescription ?? null,
          paymentMethod: paymentMethod ?? null,
          drpe,
        } as any,
      },
    });

    let risk: any = null;
    try {
      risk = await assessBookingRisk({
        bookingId: booking.id,
        businessId: business.id,
        slotStart: booking.slotStart,
        serviceType: resolvedServiceType,
      });
    } catch (riskError: any) {
      logger.error('[Booking] risk assessment failed:', riskError?.message || riskError);
    }

    const escrowId = bookingEscrowReference(booking.id);
    if (business.ownerId) {
      try {
        await ensureBookingEscrow({
          bookingId: booking.id,
          businessId: business.id,
          sellerPartyId: business.ownerId,
          buyerPartyId: req.user?.id ?? null,
          amount: numericDeposit,
          currency: 'USD',
          slotStart: booking.slotStart,
          slotEnd: booking.slotEnd,
        });
      } catch (escrowError: any) {
        logger.error('[Booking] escrow creation failed:', escrowError?.message || escrowError);
      }
    }

    return res.json({
      success: true,
      data: {
        ...booking,
        bookingId: booking.id,
        escrowId,
        risk,
        drpe,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] create error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/booking/:id/confirm-deposit - Record funded deposit on a booking
router.post('/:id/confirm-deposit', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rail, txHash, paymentRef } = req.body ?? {};

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        depositPaid: true,
        depositStatus: 'paid',
        status: 'confirmed',
        ...(txHash || paymentRef ? { paymentRef: String(txHash || paymentRef) } : {}),
        ...(rail ? { paidVia: String(rail) } : {}),
      },
    });

    await advanceBookingEscrow(booking.id, 'funded', {
      source: 'booking-checkout',
      rail: rail === 'solana' ? 'solana_pay' : rail === 'square' ? 'square' : rail === 'raast' ? 'raast' : undefined,
      txHash: txHash ? String(txHash) : undefined,
      receiptRef: paymentRef ? String(paymentRef) : undefined,
    }).catch(() => {});

    return res.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] confirm-deposit error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
