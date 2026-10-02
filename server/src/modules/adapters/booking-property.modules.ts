import { prisma } from '../../utils/database';
import { moduleRegistry } from '../contract';
import type {
  ModuleFacts,
  ModuleHealth,
  ModuleResult,
  ModuleScope,
  ModuleTimelineEntry,
  PabandiModule,
} from '../contract';

/**
 * Booking module (Sitara)
 *
 * Reads the reservation ledger: covers, deposits, check-ins and no-shows. This is
 * the module that most directly feeds the trust protocol, because a no-show is
 * the strongest negative signal the platform collects.
 */
export const bookingModule: PabandiModule = {
  id: 'booking',
  key: 'booking',
  label: 'Bookings',
  blurb: 'Reservations, deposits, check-ins and no-shows',
  installable: true,
  requires: [],
  emits: ['booking.created', 'booking.checked_in', 'booking.no_show', 'booking.completed'],

  async facts(scope: ModuleScope): Promise<ModuleResult<ModuleFacts>> {
    const { businessId, range } = scope;
    const reservations = await prisma.reservation.findMany({
      where: { businessId, reservationDate: { gte: range.from, lte: range.to } },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        depositAmount: true,
        depositPaid: true,
        depositStatus: true,
        numberOfGuests: true,
        noShowProbability: true,
        riskScore: true,
        reservationDate: true,
      },
    });

    if (reservations.length === 0) {
      return { status: 'empty', reason: 'No reservations in this period' };
    }

    // Only settled statuses count as revenue; a PENDING booking is demand, not money.
    const settled = new Set(['CONFIRMED', 'CHECKED_IN', 'COMPLETED']);
    const byStatus = (s: string) => reservations.filter((r) => r.status === s).length;

    const gross = reservations
      .filter((r) => settled.has(r.status))
      .reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);

    const depositsHeld = reservations
      .filter((r) => r.depositPaid && settled.has(r.status))
      .reduce((sum, r) => sum + (r.depositAmount ?? 0), 0);

    const outstanding = reservations
      .filter((r) => r.status === 'PENDING' || (r.status === 'CONFIRMED' && !r.depositPaid))
      .reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);

    const noShows = byStatus('NO_SHOW');

    return {
      status: 'ok',
      data: {
        counts: {
          reservations: reservations.length,
          confirmed: byStatus('CONFIRMED'),
          checkedIn: byStatus('CHECKED_IN'),
          completed: byStatus('COMPLETED'),
          cancelled: byStatus('CANCELLED'),
          noShow: noShows,
          guests: reservations.reduce((s, r) => s + (r.numberOfGuests ?? 0), 0),
        },
        money: {
          revenue: { gross, net: gross, outstanding, currency: 'USD' },
        },
        series: [
          {
            key: 'reservations_by_day',
            points: dailySeries(reservations.map((r) => ({ t: r.reservationDate, v: 1 })), range),
          },
        ],
      },
    };
  },

  async timeline(scope: ModuleScope): Promise<ModuleResult<ModuleTimelineEntry[]>> {
    const reservations = await prisma.reservation.findMany({
      where: { businessId: scope.businessId, reservationDate: { gte: scope.range.from, lte: scope.range.to } },
      select: {
        id: true,
        status: true,
        reservationDate: true,
        totalAmount: true,
        customerName: true,
        depositPaid: true,
      },
      orderBy: { reservationDate: 'desc' },
      take: 100,
    });

    return {
      status: 'ok',
      data: reservations.map((r) => ({
        at: r.reservationDate,
        moduleId: 'booking',
        kind: `booking.${r.status.toLowerCase()}`,
        subject: { id: r.id, label: r.customerName || 'Guest' },
        summary: `${r.status.toLowerCase().replace('_', ' ')} reservation`,
        impact: r.status === 'NO_SHOW' ? { trustDelta: -40 } : undefined,
      })),
    };
  },

  async health(): Promise<ModuleHealth> {
    const started = Date.now();
    await prisma.reservation.count();
    return { ok: true, latencyMs: Date.now() - started };
  },
};

/**
 * Property module (Haq OS)
 *
 * The join is indirect: Haq OS scopes by manager, and a manager is enrolled
 * against the *owner's user id*, not the business id. Resolving that hop here is
 * exactly the kind of adapter boundary that keeps each layer free to key off
 * whatever it likes internally.
 */
export const propertyModule: PabandiModule = {
  id: 'property',
  key: 'property',
  label: 'Property',
  blurb: 'Rent roll, tenant risk, leases and maintenance',
  installable: true,
  requires: [],
  emits: ['property.rent_collected', 'property.rent_late', 'lease.expiring', 'maintenance.resolved'],

  async facts(scope: ModuleScope): Promise<ModuleResult<ModuleFacts>> {
    const managerId = await resolveManagerId(scope.businessId);
    if (!managerId) {
      return { status: 'unavailable', reason: 'No property manager enrolled for this business' };
    }

    const [properties, tenants, leases, maintenance, financials] = await Promise.all([
      prisma.propertyManagerProperty.count({ where: { managerId } }),
      prisma.propertyTenant.findMany({
        where: { managerId },
        select: { id: true, status: true, riskBand: true, depositHeld: true, totalDisputes: true },
      }),
      prisma.propertyLease.findMany({
        where: { managerId, status: 'ACTIVE' },
        select: { id: true, endDate: true, rentAmount: true },
      }),
      prisma.propertyMaintenance.findMany({
        where: { managerId },
        select: { id: true, status: true, cost: true, priority: true },
      }),
      prisma.propertyFinancial.findMany({
        where: {
          property: { managerId },
          date: { gte: scope.range.from, lte: scope.range.to },
        },
        select: { type: true, amount: true, category: true },
      }),
    ]);

    if (properties === 0) {
      return { status: 'empty', reason: 'No properties in the portfolio' };
    }

    const income = financials
      .filter((f) => f.type === 'INCOME')
      .reduce((s, f) => s + f.amount, 0);
    const expense = financials
      .filter((f) => f.type === 'EXPENSE')
      .reduce((s, f) => s + f.amount, 0);

    const rentDue = leases.reduce((s, l) => s + (l.rentAmount ?? 0), 0);

    return {
      status: 'ok',
      data: {
        counts: {
          properties,
          tenants: tenants.length,
          activeTenants: tenants.filter((t) => t.status === 'ACTIVE').length,
          activeLeases: leases.length,
          openMaintenance: maintenance.filter((m) => m.status === 'OPEN').length,
          highRiskTenants: tenants.filter((t) => t.riskBand === 'HIGH').length,
          disputes: tenants.reduce((s, t) => s + t.totalDisputes, 0),
        },
        money: {
          revenue: { gross: income, net: income, outstanding: rentDue, currency: 'USD' },
          cost: {
            gross: expense,
            net: expense,
            outstanding: maintenance
              .filter((m) => m.status !== 'COMPLETED' && m.cost)
              .reduce((s, m) => s + (m.cost ?? 0), 0),
            currency: 'USD',
          },
        },
      },
    };
  },

  async timeline(scope: ModuleScope): Promise<ModuleResult<ModuleTimelineEntry[]>> {
    const managerId = await resolveManagerId(scope.businessId);
    if (!managerId) {
      return { status: 'unavailable', reason: 'No property manager enrolled for this business' };
    }

    const [rentPayments, maintenance] = await Promise.all([
      prisma.rentPayment.findMany({
        where: {
          property: { managerId },
          dueDate: { gte: scope.range.from, lte: scope.range.to },
        },
        select: { id: true, status: true, dueDate: true, amount: true, tenantEmail: true },
        orderBy: { dueDate: 'desc' },
        take: 60,
      }),
      prisma.propertyMaintenance.findMany({
        where: {
          managerId,
          createdAt: { gte: scope.range.from, lte: scope.range.to },
        },
        select: { id: true, title: true, status: true, createdAt: true, resolvedAt: true, cost: true },
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
    ]);

    const entries: ModuleTimelineEntry[] = [
      ...rentPayments.map((p) => ({
        at: p.dueDate,
        moduleId: 'property' as const,
        kind: `property.rent_${p.status.toLowerCase()}`,
        subject: { id: p.id, label: p.tenantEmail },
        summary: `Rent ${p.status.toLowerCase()}`,
        impact: {
          amount: p.amount,
          currency: 'USD',
          trustDelta: p.status === 'LATE' ? -15 : p.status === 'PAID' ? 5 : undefined,
        },
      })),
      ...maintenance.map((m) => ({
        at: m.resolvedAt ?? m.createdAt,
        moduleId: 'property' as const,
        kind: 'maintenance.updated',
        subject: { id: m.id, label: m.title },
        summary: `Maintenance ${m.status.toLowerCase().replace('_', ' ')}`,
        impact: m.cost ? { amount: m.cost, currency: 'USD' } : undefined,
      })),
    ];

    entries.sort((a, b) => b.at.getTime() - a.at.getTime());
    return { status: 'ok', data: entries };
  },

  async health(): Promise<ModuleHealth> {
    const started = Date.now();
    await prisma.propertyManagerProperty.count();
    return { ok: true, latencyMs: Date.now() - started };
  },
};

/**
 * Haq OS enrolls properties against the enrolling user's id. Walk
 * Business → ownerId → the property row to get back to a layer-scoped id.
 */
async function resolveManagerId(businessId: string): Promise<string | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true },
  });
  if (!business?.ownerId) return null;

  const profile = await prisma.propertyManagerProperty.findUnique({
    where: { userId: business.ownerId },
    select: { managerId: true },
  });
  return profile?.managerId ?? null;
}

/** Bucket dated points into one-per-day counts across the scope. */
function dailySeries(
  points: { t: Date; v: number }[],
  range: { from: Date; to: Date }
): { t: string; v: number }[] {
  const buckets = new Map<string, number>();
  for (const p of points) {
    const key = p.t.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + p.v);
  }
  // Always emit the full range so a chart never has to infer missing days as zero
  // when they are merely outside the data.
  const out: { t: string; v: number }[] = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ t: key, v: buckets.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * Salon / service-booking module.
 *
 * Separate from `booking` (Sitara, table and room reservations) because the two
 * have different money: a restaurant reservation has no retainer and no provider
 * commission, while a service booking does. Keeping them apart means a salon
 * owner's retainer settlement can never be summed into a restaurant's revenue.
 */
export const serviceBookingModule: PabandiModule = {
  id: 'serviceBooking',
  key: 'service-booking',
  label: 'Salon & Service',
  blurb: 'Providers, chairs, booking retainer in escrow, delivery trust',
  installable: true,
  requires: [],
  emits: [
    'service_escrow.funded',
    'service_appointment.completed',
    'service_appointment.cancelled',
    'service_appointment.no_show',
  ],

  async facts(scope: ModuleScope): Promise<ModuleResult<ModuleFacts>> {
    const { businessId, range } = scope;
    const appts = await prisma.appointment.findMany({
      where: { businessId, startsAt: { gte: range.from, lte: range.to } },
      include: { escrow: true, provider: true, services: true },
    });
    if (appts.length === 0) {
      return { status: 'empty', reason: 'No bookings in this period' };
    }

    const escrows = appts.map((a) => a.escrow).filter(Boolean) as NonNullable<
      (typeof appts)[number]['escrow']
    >[];

    const completed = appts.filter((a) => a.status === 'COMPLETED');
    const noShows = appts.filter((a) => a.status === 'NO_SHOW');
    const cancelled = appts.filter((a) => a.status === 'CANCELLED');
    const businessCancelled = cancelled.filter((a) => a.cancelledBy === 'BUSINESS');

    // Only what the provider actually earns is revenue. The retainer is held
    // money, and the quote is what the service would fetch once delivered.
    const revenue = completed.reduce((s, a) => s + a.quotedPrice, 0);
    const held = escrows.filter((e) => e.status === 'FUNDED').reduce((s, e) => s + e.grossAmount, 0);
    const forfeited = appts.reduce((s, a) => s + a.cancellationCost, 0);
    const refunded = escrows.filter((e) => e.status === 'REFUNDED').reduce((s, e) => s + e.grossAmount, 0);
    const providers = await prisma.businessProvider.count({ where: { businessId, isActive: true } });

    return {
      status: 'ok',
      data: {
        counts: {
          bookings: appts.length,
          completed: completed.length,
          noShows: noShows.length,
          cancellations: cancelled.length,
          businessCancelled: businessCancelled.length,
          providers,
          chairs: await prisma.businessResource.count({ where: { businessId, isActive: true } }),
          // The number a salon owner actually judges themselves on.
          noShowRate: appts.length ? Math.round((noShows.length / appts.length) * 1000) / 10 : 0,
        },
        money: {
          revenue: { gross: revenue, net: revenue, outstanding: held, currency: 'PKR' },
          cash: {
            gross: escrows.reduce((s, e) => s + e.grossAmount, 0),
            net: escrows.filter((e) => e.status === 'RELEASED').reduce((s, e) => s + e.providerAmount, 0),
            outstanding: held,
            currency: 'PKR',
          },
        },
        series: [
          {
            key: 'bookings_by_day',
            points: dailySeries(appts.map((a) => ({ t: a.startsAt, v: 1 })), range),
          },
        ],
      },
    };
  },

  async timeline(scope: ModuleScope): Promise<ModuleResult<ModuleTimelineEntry[]>> {
    const appts = await prisma.appointment.findMany({
      where: { businessId: scope.businessId, startsAt: { gte: scope.range.from, lte: scope.range.to } },
      select: {
        id: true, status: true, startsAt: true, completedAt: true, cancelledBy: true,
        quotedPrice: true, cancellationCost: true,
        provider: { select: { name: true } },
        services: { select: { nameAtBooking: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startsAt: 'desc' },
      take: 100,
    });

    const entries = appts.map((a) => ({
      at: a.completedAt ?? a.startsAt,
      moduleId: 'serviceBooking' as const,
      kind: `service.${a.status.toLowerCase()}`,
      subject: { id: a.id, label: a.services.map((s) => s.nameAtBooking).join(' + ') },
      summary: `${a.status.toLowerCase()} — ${a.provider?.name ?? 'unassigned'} · ${a.services.map((x) => x.nameAtBooking).join(', ')}`,
      impact: {
        amount: a.status === 'COMPLETED' ? a.quotedPrice : a.cancellationCost || undefined,
        currency: 'PKR',
        trustDelta:
          a.status === 'COMPLETED' ? 10 : a.status === 'NO_SHOW' ? -40 : a.cancelledBy === 'BUSINESS' ? -15 : undefined,
      },
    }));

    return { status: 'ok', data: entries };
  },

  async health(): Promise<ModuleHealth> {
    const started = Date.now();
    await prisma.appointment.count();
    return { ok: true, latencyMs: Date.now() - started };
  },
};

moduleRegistry.register(bookingModule);
moduleRegistry.register(propertyModule);
moduleRegistry.register(serviceBookingModule);

export { dailySeries };