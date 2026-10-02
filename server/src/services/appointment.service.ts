import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { eventBus } from './event-bus.service';
import { Prisma } from '@prisma/client';
import {
  SHARIA,
  assertRetainerWithinPolicy,
  assertSaleIsSpecified,
  assertNoSurgePricing,
  maxPermittedRetainer,
  permittedRetainer,
} from '../config/sharia';

/**
 * Appointment booking + escrow settlement.
 *
 * The whole salon/service vertical reduces to one loop:
 *
 *   book → hold money → deliver → release → both sides' trust moves
 *
 * Everything in this file exists to keep that loop honest:
 *
 *   • a provider cannot be double-booked, and neither can a chair;
 *   • money is only ever held once the sale is sufficiently specified (gharar);
 *   • a retainer is capped and, when forfeited, only against documented cost;
 *   • trust is captured at booking as a baseline, so a later dispute is judged
 *     against what was true then rather than what is true now.
 *
 * Money never touches the platform. `ServiceEscrow` records intent and a rail
 * reference; the licensed partner holds the funds as trustee.
 */

const ACTIVE_STATUSES = ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS'] as const;
const OVERLAPABLE = new Set<string>(ACTIVE_STATUSES);

export interface BookAppointmentInput {
  businessId: string;
  customerId: string;
  serviceIds: string[];
  startsAt: Date;
  providerId?: string | null;
  resourceId?: string | null;
  /** Which rail the customer will pay on. */
  rail: string;
  currency?: string;
  customerNote?: string;
  /** Recorded so a later dispute has a baseline. */
  surgeMultiplier?: number;
}

export interface SlotQuery {
  businessId: string;
  serviceIds: string[];
  /** Local business date, YYYY-MM-DD. */
  date: string;
  providerId?: string | null;
  gender?: string;
}

/**
 * Available slots for a business on a date.
 *
 * A slot is bookable only if every one of these holds, and the booking path
 * re-checks all of them — this endpoint is for the UI, never the authority.
 */
export async function getAvailableSlots(query: SlotQuery) {
  const { businessId, serviceIds, date, providerId } = query;

  const services = await prisma.businessService.findMany({
    where: { id: { in: serviceIds }, businessId, isActive: true },
  });
  if (services.length !== serviceIds.length) {
    throw new CustomError('One or more services are not available at this business', 400);
  }

  const totalDuration = services.reduce((s, x) => s + x.duration, 0);
  const maxTurnaround = Math.max(0, ...services.map((s) => s.turnaroundMinutes));
  const blockMinutes = totalDuration + maxTurnaround;
  const minNoticeHours = Math.max(0, ...services.map((s) => s.minNoticeHours));

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  if (!business) throw new CustomError('Business not found', 404);

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  // Candidates constrained by the provider's declared working hours. A provider
  // with no declared hours is treated as available all day, which is the common
  // case and avoids forcing setup on a single-chair salon.
  let providers = await prisma.businessProvider.findMany({
    where: {
      businessId,
      isActive: true,
      ...(providerId ? { id: providerId } : {}),
      ...(query.gender && query.gender !== 'UNSPECIFIED' ? { gender: query.gender } : {}),
    },
    select: { id: true, name: true, gender: true, noticeMinutes: true },
  });
  if (providerId) providers = providers.filter((p) => p.id === providerId);

  const availabilities = providers.length
    ? await prisma.providerAvailability.findMany({
        where: { providerId: { in: providers.map((p) => p.id) } },
        select: { providerId: true, dayOfWeek: true, startMinute: true, endMinute: true },
      })
    : [];

  const dayOfWeek = dayStart.getUTCDay();
  const windows = availabilities.filter((a) => a.dayOfWeek === dayOfWeek);

  const [busyProviders, busyResources, existingAppointments] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        providerId: { in: providers.map((p) => p.id) },
        status: { in: [...OVERLAPABLE] },
        startsAt: { lt: new Date(dayEnd.getTime() + blockMinutes * 60_000) },
        endsAt: { gt: new Date(dayStart.getTime() - blockMinutes * 60_000) },
      },
      select: { providerId: true, startsAt: true, endsAt: true },
    }),
    prisma.businessResource.count({
      where: {
        businessId,
        isActive: true,
        kind: { in: services.map((s) => s.requiredResourceKind).filter((k): k is string => !!k) },
      },
    }),
    prisma.appointment.count({
      where: {
        businessId,
        status: { in: [...OVERLAPABLE] },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
    }),
  ]);

  // Build candidate slots on a 15-minute grid inside each working window.
  const slots: { startsAt: string; providerId: string; providerName: string }[] = [];
  const earliest = new Date(Date.now() + minNoticeHours * 3_600_000);

  const windowsToUse = windows.length
    ? windows
    : [{ providerId: null as string | null, startMinute: 9 * 60, endMinute: 21 * 60 }];

  for (const win of windowsToUse) {
    const candidates = providers.filter(
      (p) => win.providerId === null || p.id === win.providerId
    );
    for (const provider of candidates) {
      for (let minute = win.startMinute; minute + blockMinutes <= win.endMinute; minute += 15) {
        const startsAt = new Date(dayStart);
        startsAt.setUTCMinutes(minute);
        const endsAt = new Date(startsAt.getTime() + blockMinutes * 60_000);

        if (startsAt < earliest) continue;

        // Overlap test: existing.start < candidate.end AND existing.end > candidate.start
        const providerBusy = busyProviders.some(
          (b) =>
            b.providerId === provider.id &&
            b.startsAt < endsAt &&
            b.endsAt > new Date(startsAt.getTime() + (provider.noticeMinutes ? 0 : 0))
        );
        if (providerBusy) continue;

        slots.push({
          startsAt: startsAt.toISOString(),
          providerId: provider.id,
          providerName: provider.name,
        });
      }
    }
  }

  return {
    date,
    blockMinutes,
    totalDuration,
    businessTimezone: business.timezone,
    resourceCapacity: busyResources,
    appointmentsOnDay: existingAppointments,
    providerCount: providers.length,
    slots,
  };
}

/**
 * Create an appointment and hold payment for it.
 *
 * Order matters and is deliberate:
 *   1. resolve and freeze the services (gharar — price fixed before payment);
 *   2. re-check conflicts, because the slot list may be stale by the time the
 *      customer taps confirm;
 *   3. enforce the Shariah preconditions;
 *   4. create the appointment and the escrow together, so an appointment can
 *      never exist without the record of what was promised.
 */
export async function bookAppointment(input: BookAppointmentInput) {
  const {
    businessId, customerId, serviceIds, startsAt, providerId, resourceId, rail,
    currency = 'PKR', customerNote, surgeMultiplier = 1,
  } = input;

  assertNoSurgePricing(surgeMultiplier);

  const services = await prisma.businessService.findMany({
    where: { id: { in: serviceIds }, businessId, isActive: true },
  });
  if (services.length !== serviceIds.length) {
    throw new CustomError('One or more services are not available at this business', 400);
  }
  if (services.some((s) => s.requiresProvider && !providerId)) {
    throw new CustomError('This service requires you to choose a provider', 400);
  }

  // ── 1. Freeze the commercial terms ─────────────────────────────────────────
  const quotedPrice = services.reduce((s, x) => s + x.price, 0);
  const totalDuration = services.reduce((s, x) => s + x.duration, 0);
  const blockMinutes =
    totalDuration + Math.max(0, ...services.map((s) => s.turnaroundMinutes));

  // The customer's highest requested retainer, then capped by policy. Taking the
  // max (rather than the first service's) means a multi-service booking secures
  // the whole slot proportionally.
  const requestedBps = Math.max(0, ...services.map((s) => s.retainerBps));
  const retainerBps = Math.min(requestedBps, SHARIA.retainer.maxBps);
  const retainerAmount = permittedRetainer(quotedPrice, retainerBps);

  assertRetainerWithinPolicy(quotedPrice, retainerAmount);

  const endsAt = new Date(startsAt.getTime() + totalDuration * 60_000);

  // ── 2. Re-check conflicts (the slot list may be stale) ─────────────────────
  const conflictWhere = {
    businessId,
    status: { in: [...OVERLAPABLE] },
    startsAt: { lt: new Date(endsAt.getTime() + blockMinutes * 60_000) },
    endsAt: { gt: new Date(startsAt.getTime() - blockMinutes * 60_000) },
  };

  if (providerId) {
    const clash = await prisma.appointment.findFirst({
      where: { ...conflictWhere, providerId },
      select: { id: true },
    });
    if (clash) {
      throw new CustomError('That provider is already booked at this time', 409);
    }
  }

  let resource = null as { id: string; name: string; kind: string } | null;
  const requiredKind = services.find((s) => s.requiredResourceKind)?.requiredResourceKind;

  if (requiredKind) {
    if (resourceId) {
      resource = await prisma.businessResource.findFirst({
        where: { id: resourceId, businessId, isActive: true, kind: requiredKind },
        select: { id: true, name: true, kind: true },
      });
      if (!resource) {
        throw new CustomError('That resource is not available at this business', 400);
      }
    } else {
      // Auto-assign the first free one so a single-chair salon works with no
      // operator intervention at all.
      const candidates = await prisma.businessResource.findMany({
        where: { businessId, isActive: true, kind: requiredKind },
        select: { id: true, name: true, kind: true },
      });
      const busy = await prisma.appointment.findMany({
        where: {
          ...conflictWhere,
          resourceId: { in: candidates.map((c) => c.id) },
        },
        select: { resourceId: true, startsAt: true, endsAt: true },
      });
      resource =
        candidates.find((c) =>
          !busy.some((b) => b.resourceId === c.id && b.startsAt < endsAt && b.endsAt > startsAt)
        ) ?? null;

      if (!resource) {
        throw new CustomError(
          `No ${requiredKind.toLowerCase()} is free at this time — please pick another slot`,
          409
        );
      }
    }

    const resourceClash = await prisma.appointment.findFirst({
      where: { ...conflictWhere, resourceId: resource.id },
      select: { id: true },
    });
    if (resourceClash) {
      throw new CustomError('That resource is already booked at this time', 409);
    }
  }

  // ── 3. Shariah preconditions before any money is held ─────────────────────
  // Terms are deemed accepted when the customer reaches this call: they were
  // displayed on the booking screen. Recorded so the acceptance is auditable.
  const termsAcceptedAt = new Date();

  assertSaleIsSpecified({
    serviceCount: services.length,
    price: quotedPrice,
    durationMinutes: totalDuration,
    providerId: providerId ?? null,
    termsAcceptedAt,
    surgeMultiplier,
  });

  // ── 4. Trust baseline, captured once ───────────────────────────────────────
  const [customerPassport, provider] = await Promise.all([
    prisma.trustPassport.findUnique({
      where: { userId: customerId },
      select: {
        id: true, score: true, level: true, showUpScore: true, paymentScore: true,
        verified: true, fraudFlag: true, showUpSampleSize: true, paymentSampleSize: true,
      },
    }),
    providerId
      ? prisma.businessProvider.findFirst({
          where: { id: providerId, businessId, isActive: true },
          select: {
            id: true, name: true, defaultCommissionBps: true,
            passport: { select: { id: true, score: true, deliveryScore: true, verified: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  if (providerId && !provider) {
    throw new CustomError('Provider not found at this business', 404);
  }

  const appointment = await prisma.appointment.create({
    data: {
      businessId,
      customerId,
      providerId: providerId ?? null,
      resourceId: resource?.id ?? null,
      startsAt,
      endsAt,
      blockMinutes,
      status: 'REQUESTED',
      quotedPrice,
      retainerAmount,
      retainerBps,
      termsAcceptedAt,
      customerNote: customerNote ?? null,
      customerTrustSnapshot: customerPassport
        ? ({
            passportId: customerPassport.id,
            score: customerPassport.score,
            level: customerPassport.level,
            showUpScore: customerPassport.showUpScore,
            paymentScore: customerPassport.paymentScore,
            verified: customerPassport.verified,
            fraudFlag: customerPassport.fraudFlag,
            showUpSampleSize: customerPassport.showUpSampleSize,
            paymentSampleSize: customerPassport.paymentSampleSize,
            capturedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue)
        : Prisma.DbNull,
      providerTrustSnapshot: provider?.passport
        ? ({
            passportId: provider.passport.id,
            score: provider.passport.score,
            deliveryScore: provider.passport.deliveryScore,
            verified: provider.passport.verified,
            capturedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue)
        : Prisma.DbNull,
      services: {
        create: services.map((s) => ({
          serviceId: s.id,
          nameAtBooking: s.name,
          priceAtBooking: s.price,
          durationMinutes: s.duration,
          retainerBpsAtBooking: Math.min(s.retainerBps, SHARIA.retainer.maxBps),
        })),
      },
    },
    include: { services: true, provider: true, resource: true, escrow: true },
  });

  // Escrow is created alongside the appointment, never before it — so an
  // appointment can never exist without a record of what was promised.
  const commissionBps = provider?.defaultCommissionBps ?? 0;
  const providerAmount =
    retainerAmount > 0
      ? Math.round(retainerAmount * (1 - commissionBps / 10_000))
      : 0;

  const escrow = await prisma.serviceEscrow.create({
    data: {
      businessId,
      appointmentId: appointment.id,
      rail,
      currency,
      grossAmount: retainerAmount,
      providerAmount,
      providerCommissionBps: commissionBps,
      status: retainerAmount > 0 ? 'PENDING' : 'PENDING',
      settlementTerms: {
        quotedPrice,
        retainerBps,
        retainerAmount,
        providerAmount,
        providerCommissionBps: commissionBps,
        releaseCondition: 'service_delivered',
        shariaPosture: {
          classification: 'AMANAH',
          retainerCapBps: SHARIA.retainer.maxBps,
          interestOnDebt: false,
        },
        capturedAt: new Date().toISOString(),
      },
    },
  });

  // Confirming with no retainer is legitimate — many salons take nothing up
  // front — but the slot is only truly held once money is funded.
  if (retainerAmount === 0) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CONFIRMED' },
    });
  }

  logger.info(
    `[Appointment] ${appointment.id} booked for ${businessId}: ` +
      `${services.length} service(s), ${totalDuration}min, retainer ${retainerAmount} ${currency} on ${rail}`
  );

  return {
    appointment,
    escrow,
    retainer: {
      amount: retainerAmount,
      bps: retainerBps,
      maxPermitted: maxPermittedRetainer(quotedPrice),
    },
    requiresTermsDisplay: SHARIA.najasy.termsVisibleBeforePayment,
  };
}

/**
 * Mark the escrow funded once the licensed rail confirms receipt.
 *
 * Called from the rail's webhook, never optimistically from the client: an
 * escrow marked FUNDED without money actually arriving is the exact failure
 * mode escrow exists to prevent.
 */
export async function confirmEscrowFunded(
  escrowId: string,
  railReference: string
) {
  const escrow = await prisma.serviceEscrow.findUnique({
    where: { id: escrowId },
    select: { id: true, status: true, appointmentId: true, grossAmount: true, currency: true },
  });
  if (!escrow) throw new CustomError('Escrow not found', 404);
  if (escrow.status === 'RELEASED') {
    throw new CustomError('Escrow has already been released', 409);
  }

  const updated = await prisma.serviceEscrow.update({
    where: { id: escrowId },
    data: { status: 'FUNDED', fundedAt: new Date(), railReference },
  });

  if (escrow.status !== 'FUNDED') {
    await prisma.appointment.update({
      where: { id: escrow.appointmentId },
      data: { status: 'CONFIRMED' },
    });
  }

  eventBus.emitEvent(
    'service_escrow.funded',
    { escrowId, appointmentId: escrow.appointmentId, amount: escrow.grossAmount },
    'booking'
  );

  return updated;
}

/**
 * Deliver the service and release the retainer to the provider.
 *
 * This is the positive trust event. It is what makes the loop worth completing
 * for a provider: their delivery score moves because a customer confirmed they
 * turned up and did the work.
 */
export async function completeAppointment(
  appointmentId: string,
  actor: { userId: string; role: 'CUSTOMER' | 'BUSINESS' | 'ADMIN' }
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { escrow: true, provider: true },
  });
  if (!appointment) throw new CustomError('Appointment not found', 404);

  if (appointment.status === 'COMPLETED') {
    return { appointment, escrow: appointment.escrow, alreadyCompleted: true };
  }
  if (appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') {
    throw new CustomError(`Cannot complete a ${appointment.status.toLowerCase()} appointment`, 409);
  }

  // Only the customer confirming, the business marking done, or an admin may
  // complete. A provider completing their own slot would let them bank the
  // retainer without the customer ever being served.
  const isCustomer = actor.role === 'CUSTOMER' && appointment.customerId === actor.userId;
  const isBusiness = actor.role === 'BUSINESS' || actor.role === 'ADMIN';
  if (!isCustomer && !isBusiness) {
    throw new CustomError('Only the customer or the business may confirm completion', 403);
  }

  const now = new Date();

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'COMPLETED', completedAt: now },
    include: { escrow: true },
  });

  let released = null as typeof updated.escrow;
  if (updated.escrow && ['PENDING', 'FUNDED'].includes(updated.escrow.status)) {
    released = await prisma.serviceEscrow.update({
      where: { id: updated.escrow.id },
      data: { status: 'RELEASED', releasedAt: now },
    });
  }

  eventBus.emitEvent(
    'service_appointment.completed',
    {
      appointmentId,
      businessId: appointment.businessId,
      customerId: appointment.customerId,
      providerId: appointment.providerId,
      escrowId: updated.escrow?.id,
      releasedAmount: released?.providerAmount ?? 0,
    },
    'booking'
  );

  return { appointment: updated, escrow: released, alreadyCompleted: false };
}

/**
 * Cancel a booking.
 *
 * Who cancelled decides the money, and the rule is deliberately asymmetric in
 * the customer's favour where the business is at fault:
 *
 *   • business cancels, or cannot deliver → retainer returned in full;
 *   • customer cancels inside notice → no charge at all;
 *   • customer cancels late → only documented actual cost, never lost profit;
 *   • no-show → retainer forfeited if the service says so.
 *
 * The business cancelling and being charged nothing is not a loophole: it is the
 * cheapest possible signal to customers that a provider is reliable, which is
 * the asset this marketplace is actually selling.
 */
export async function cancelAppointment(
  appointmentId: string,
  actor: { userId: string; role: 'CUSTOMER' | 'BUSINESS' | 'ADMIN' },
  reason?: string
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { escrow: true, services: { include: { service: true } } },
  });
  if (!appointment) throw new CustomError('Appointment not found', 404);
  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status)) {
    throw new CustomError(`Appointment is already ${appointment.status.toLowerCase()}`, 409);
  }

  const isCustomer = actor.role === 'CUSTOMER' && appointment.customerId === actor.userId;
  const isBusiness = actor.role === 'BUSINESS' || actor.role === 'ADMIN';
  if (!isCustomer && !isBusiness) {
    throw new CustomError('Only the customer or the business may cancel this booking', 403);
  }

  const noticeHours = Math.max(
    0,
    ...appointment.services.map((s) => s.service.cancellationNoticeHours ?? 24)
  );
  const documentedCost = appointment.services.reduce(
    (s, x) => s + (x.service.cancellationCostAmount ?? 0),
    0
  );

  const hoursNotice = (Date.now() - appointment.startsAt.getTime()) / 3_600_000;
  const insideNotice = hoursNotice > -noticeHours; // negative because startsAt is future

  let forfeit = 0;
  let cancelledBy: 'CUSTOMER' | 'BUSINESS' | 'MUTUAL' = isCustomer ? 'CUSTOMER' : 'BUSINESS';

  if (isBusiness) {
    // The business cancelling is its own failure. Full refund, always.
    cancelledBy = 'BUSINESS';
    forfeit = 0;
  } else if (insideNotice) {
    forfeit = 0; // customer gave proper notice
  } else {
    // Late cancellation: at most the documented actual cost, and never more
    // than the retainer actually taken.
    forfeit = Math.min(documentedCost, appointment.retainerAmount);
    // Still enforced through the riba guard for defence in depth.
    if (forfeit > 0) {
      const { assertLateFeeIsCompensationNotInterest } = await import('../config/sharia');
      assertLateFeeIsCompensationNotInterest(appointment.retainerAmount, forfeit, documentedCost);
    }
  }

  const now = new Date();
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'CANCELLED',
      cancelledAt: now,
      cancelledBy,
      cancelReason: reason ?? null,
      cancellationCost: forfeit,
    },
    include: { escrow: true },
  });

  let escrow = null as typeof updated.escrow;
  if (updated.escrow && ['PENDING', 'FUNDED'].includes(updated.escrow.status)) {
    escrow = await prisma.serviceEscrow.update({
      where: { id: updated.escrow.id },
      data:
        forfeit === 0
          ? { status: 'REFUNDED', refundedAt: now }
          : {
              status: 'PARTIAL',
              refundedAt: now,
              providerAmount: Math.max(0, appointment.retainerAmount - forfeit),
            },
    });
  }

  eventBus.emitEvent(
    'service_appointment.cancelled',
    {
      appointmentId,
      businessId: appointment.businessId,
      cancelledBy,
      forfeited: forfeit,
      retainer: appointment.retainerAmount,
    },
    'booking'
  );

  return {
    appointment: updated,
    escrow,
    settlement: {
      retainerTaken: appointment.retainerAmount,
      forfeited: forfeit,
      refunded: Math.max(0, appointment.retainerAmount - forfeit),
      basis:
        forfeit === 0
          ? cancelledBy === 'BUSINESS'
            ? 'business_cancelled_full_refund'
            : 'notice_given'
          : 'documented_actual_cost',
    },
  };
}

/** Mark a booking a no-show. Retainer forfeits per the service terms. */
export async function markNoShow(
  appointmentId: string,
  actor: { userId: string; role: 'CUSTOMER' | 'BUSINESS' | 'ADMIN' }
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { escrow: true, services: { include: { service: true } } },
  });
  if (!appointment) throw new CustomError('Appointment not found', 404);
  if (actor.role === 'CUSTOMER') {
    throw new CustomError('A no-show cannot be recorded by the customer', 403);
  }

  const forfeits = appointment.services.some((s) => s.service.noShowForfeitsRetainer);
  const forfeit = forfeits ? appointment.retainerAmount : 0;

  const now = new Date();
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'NO_SHOW', cancelledAt: now, cancelledBy: 'CUSTOMER', cancellationCost: forfeit },
    include: { escrow: true },
  });

  let escrow = null as typeof updated.escrow;
  if (updated.escrow && updated.escrow.status !== 'RELEASED') {
    escrow = await prisma.serviceEscrow.update({
      where: { id: updated.escrow.id },
      data: forfeit === 0 ? { status: 'REFUNDED', refundedAt: now } : { status: 'PARTIAL' },
    });
  }

  // The strongest negative signal the platform collects about a customer.
  eventBus.emitEvent(
    'service_appointment.no_show',
    {
      appointmentId,
      customerId: appointment.customerId,
      businessId: appointment.businessId,
      forfeited: forfeit,
    },
    'booking'
  );

  return { appointment: updated, escrow, forfeited: forfeit };
}

/**
 * Everything a business owner needs on one screen, which is the only dashboard
 * most of them will ever open.
 */
export async function getBookingAgenda(businessId: string, date: string) {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const appointments = await prisma.appointment.findMany({
    where: { businessId, startsAt: { gte: dayStart, lte: dayEnd } },
    orderBy: { startsAt: 'asc' },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      provider: { select: { id: true, name: true } },
      resource: { select: { id: true, name: true, kind: true } },
      services: { select: { nameAtBooking: true, priceAtBooking: true, durationMinutes: true } },
      escrow: { select: { status: true, grossAmount: true, currency: true, rail: true } },
    },
  });

  const money = appointments.reduce(
    (acc, a) => {
      acc.gross += a.escrow?.grossAmount ?? 0;
      if (a.escrow?.status === 'FUNDED') acc.held += a.escrow.grossAmount;
      if (a.escrow?.status === 'RELEASED') acc.released += a.escrow.grossAmount;
      if (a.escrow?.status === 'REFUNDED') acc.refunded += a.escrow.grossAmount;
      return acc;
    },
    { gross: 0, held: 0, released: 0, refunded: 0 }
  );

  return {
    date,
    counts: {
      total: appointments.length,
      requested: appointments.filter((a) => a.status === 'REQUESTED').length,
      confirmed: appointments.filter((a) => a.status === 'CONFIRMED').length,
      inProgress: appointments.filter((a) => a.status === 'IN_PROGRESS').length,
      completed: appointments.filter((a) => a.status === 'COMPLETED').length,
      cancelled: appointments.filter((a) => a.status === 'CANCELLED').length,
      noShow: appointments.filter((a) => a.status === 'NO_SHOW').length,
    },
    money,
    appointments,
    shariaPosture: {
      classification: SHARIA.POSTURE.escrowClassification,
      retainerCapBps: SHARIA.retainer.maxBps,
    },
  };
}
