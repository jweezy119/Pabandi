import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';
import { prisma } from '../utils/database';
import {
  bookAppointment,
  cancelAppointment,
  completeAppointment,
  getAvailableSlots,
  getBookingAgenda,
  markNoShow,
} from '../services/appointment.service';
import { shariaDisclosure, shariaPosture } from '../config/sharia';

/**
 * Service booking API — the salon / clinic / home-service surface.
 *
 * Kept separate from the CRM router on purpose. The CRM is the owner's back
 * office; this is the public, transactional surface a customer touches. They
 * have different auth, different rate-limit needs and a different blast radius.
 */
const router = Router();

router.use(authenticate);

/**
 * GET /api/v1/booking-services/sharia
 * The compliance posture and the customer-facing disclosure.
 *
 * Public-facing by design: terms that are only visible in a footer are not
 * disclosure, and najasy is specifically about what is concealed until payment.
 */
router.get('/sharia', (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      posture: shariaPosture(),
      disclosure: shariaDisclosure(),
    },
  });
});

// ── Availability ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/booking-services/slots
 * Bookable slots for a business, service set and date.
 */
router.get('/slots', async (req: AuthRequest, res: Response) => {
  try {
    const { businessId, date, serviceIds, providerId, gender } = req.query as Record<string, string>;

    if (!businessId || !date) throw new CustomError('businessId and date are required', 400);

    const ids = (serviceIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) throw new CustomError('serviceIds is required', 400);

    const slots = await getAvailableSlots({
      businessId,
      serviceIds: ids,
      date,
      providerId: providerId || null,
      gender,
    });

    // Terms must be shown before money moves, so they travel with the slots.
    res.json({
      success: true,
      data: { ...slots, terms: shariaDisclosure() },
    });
  } catch (err) {
    next_(err, res);
  }
});

// ── Booking ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/booking-services/book
 * Create a booking and hold the retainer in escrow.
 */
router.post('/book', async (req: AuthRequest, res: Response) => {
  try {
    const { businessId, serviceIds, startsAt, providerId, resourceId, rail, currency, customerNote } = req.body;

    if (!businessId || !Array.isArray(serviceIds) || !serviceIds.length || !startsAt || !rail) {
      throw new CustomError(
        'businessId, serviceIds[], startsAt and rail are required',
        400
      );
    }

    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) throw new CustomError('startsAt is not a valid date', 400);

    // A booking is always placed by the signed-in customer. Taking a customerId
    // from the body would let anyone book services into another person's name.
    const result = await bookAppointment({
      businessId,
      customerId: req.user!.id,
      serviceIds,
      startsAt: start,
      providerId: providerId ?? null,
      resourceId: resourceId ?? null,
      rail,
      currency,
      customerNote,
    });

    res.status(201).json({
      success: true,
      data: {
        ...result,
        terms: shariaDisclosure(result.escrow.currency),
      },
    });
  } catch (err) {
    next_(err, res);
  }
});

/**
 * POST /api/v1/booking-services/:appointmentId/complete
 * Confirm the service was delivered. Releases the retainer and moves trust.
 */
router.post('/:appointmentId/complete', async (req: AuthRequest, res: Response) => {
  try {
    const result = await completeAppointment(req.params.appointmentId, {
      userId: req.user!.id,
      role: req.user!.role === 'ADMIN' ? 'ADMIN' : 'BUSINESS',
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next_(err, res);
  }
});

/**
 * POST /api/v1/booking-services/:appointmentId/cancel
 * Cancel a booking. Who cancelled determines the settlement.
 */
router.post('/:appointmentId/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const result = await cancelAppointment(
      req.params.appointmentId,
      { userId: req.user!.id, role: req.user!.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER' },
      req.body?.reason
    );
    res.json({
      success: true,
      data: { ...result, terms: shariaDisclosure() },
    });
  } catch (err) {
    next_(err, res);
  }
});

/**
 * POST /api/v1/booking-services/:appointmentId/no-show
 * Business-recorded no-show. Forfeits the retainer per the service terms.
 */
router.post('/:appointmentId/no-show', async (req: AuthRequest, res: Response) => {
  try {
    const result = await markNoShow(req.params.appointmentId, {
      userId: req.user!.id,
      role: req.user!.role === 'ADMIN' ? 'ADMIN' : 'BUSINESS',
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next_(err, res);
  }
});

// ── Business owner surface ────────────────────────────────────────────────────

/**
 * GET /api/v1/booking-services/agenda/:businessId?date=YYYY-MM-DD
 * The one screen a salon owner actually opens.
 */
router.get('/agenda/:businessId', async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.params;
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    await assertOwnsBusiness(businessId, req.user!.id, req.user!.role);

    const agenda = await getBookingAgenda(businessId, date);
    res.json({ success: true, data: agenda });
  } catch (err) {
    next_(err, res);
  }
});

/**
 * GET /api/v1/booking-services/providers/:businessId
 * Staff who can be booked, for the booking screen's "choose a barber" step.
 */
router.get('/providers/:businessId', async (req: AuthRequest, res: Response) => {
  try {
    const providers = await prisma.businessProvider.findMany({
      where: { businessId: req.params.businessId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, role: true, gender: true, bio: true, photoUrl: true,
        defaultCommissionBps: true,
        _count: { select: { appointments: { where: { status: 'COMPLETED' } } } },
        passport: { select: { score: true, deliveryScore: true, verified: true, level: true } },
      },
    });

    res.json({ success: true, data: providers });
  } catch (err) {
    next_(err, res);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertOwnsBusiness(businessId: string, userId: string, role: string) {
  if (role === 'ADMIN') return;
  const business = await prisma.business.findFirst({
    where: { id: businessId, ownerId: userId },
    select: { id: true },
  });
  if (!business) {
    throw new CustomError('You do not have access to this business', 403);
  }
}

function next_(err: unknown, res: Response) {
  const statusCode = err instanceof CustomError ? err.statusCode : 500;
  const message = err instanceof Error ? err.message : 'Internal error';
  res.status(statusCode).json({ success: false, message });
}

export default router;
