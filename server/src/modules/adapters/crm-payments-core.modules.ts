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
 * CRM module
 *
 * The layer the business operates day to day: jobs, clients, team, payroll and
 * expenses. It is the only module that reads through `serviceBusinessId` rather
 * than `businessId`, so it is also the one that carries the unlinking cost of
 * the two-key design.
 */
export const crmModule: PabandiModule = {
  id: 'crm',
  key: 'crm',
  label: 'CRM',
  blurb: 'Clients, jobs, team, payroll and expenses',
  installable: false,
  requires: [],
  emits: ['crm.client_added', 'crm.job_completed', 'crm.no_show', 'crm.invoice_paid'],

  async facts(scope: ModuleScope): Promise<ModuleResult<ModuleFacts>> {
    if (!scope.serviceBusinessId) {
      return { status: 'unavailable', reason: 'Business is not enrolled in the CRM' };
    }
    const sid = scope.serviceBusinessId;
    const { from, to } = scope.range;

    const [jobs, clients, employees, expenses, payroll] = await Promise.all([
      prisma.crmJob.findMany({
        where: { serviceBusinessId: sid, scheduledDate: { gte: from, lte: to } },
        select: {
          id: true,
          status: true,
          price: true,
          scheduledDate: true,
          escrowStatus: true,
          completedAt: true,
          clientId: true,
        },
      }),
      prisma.crmClient.findMany({
        where: { serviceBusinessId: sid },
        select: { id: true, stage: true, reliabilityScore: true, totalSpent: true, phoneVerified: true },
      }),
      prisma.crmEmployee.findMany({
        where: { serviceBusinessId: sid, isActive: true },
        select: { id: true, rating: true, jobsCompleted: true, lastBookingAt: true },
      }),
      prisma.crmExpense.findMany({
        where: { serviceBusinessId: sid, date: { gte: from, lte: to } },
        select: { amount: true, category: true, date: true },
      }),
      prisma.crmPayroll.findMany({
        where: { serviceBusinessId: sid, periodEnd: { gte: from, lte: to } },
        select: { grossPay: true, netPay: true, status: true },
      }),
    ]);

    if (jobs.length === 0 && clients.length === 0) {
      return { status: 'empty', reason: 'No CRM activity for this business yet' };
    }

    const completed = jobs.filter((j) => j.status === 'COMPLETED');
    const earned = completed.reduce((s, j) => s + (j.price ?? 0), 0);

    // A job cancelled after the fact, or one the client never showed up for, is
    // revenue the business cannot book. Net reflects that rather than counting
    // gross bookings.
    const lost = jobs
      .filter((j) => j.status === 'CANCELLED' || j.status === 'MISSED')
      .reduce((s, j) => s + (j.price ?? 0), 0);

    const scheduledValue = jobs
      .filter((j) => j.status === 'SCHEDULED' || j.status === 'IN_PROGRESS')
      .reduce((s, j) => s + (j.price ?? 0), 0);

    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const payrollTotal = payroll.reduce((s, p) => s + p.grossPay, 0);
    const unpaidPayroll = payroll
      .filter((p) => p.status !== 'PAID')
      .reduce((s, p) => s + p.grossPay, 0);

    return {
      status: 'ok',
      data: {
        counts: {
          jobs: jobs.length,
          completedJobs: completed.length,
          scheduledJobs: jobs.filter((j) => j.status === 'SCHEDULED').length,
          noShows: jobs.filter((j) => j.status === 'MISSED').length,
          clients: clients.length,
          vipClients: clients.filter((c) => c.stage === 'vip').length,
          atRiskClients: clients.filter((c) => c.stage === 'at_risk').length,
          verifiedClients: clients.filter((c) => c.phoneVerified).length,
          team: employees.length,
          idleProviders: employees.filter((e) => !e.lastBookingAt).length,
        },
        money: {
          revenue: {
            gross: earned + lost,
            net: earned,
            outstanding: scheduledValue,
            currency: 'USD',
          },
          cost: {
            gross: expenseTotal + payrollTotal,
            net: expenseTotal + payrollTotal,
            outstanding: unpaidPayroll,
            currency: 'USD',
          },
        },
      },
    };
  },

  async timeline(scope: ModuleScope): Promise<ModuleResult<ModuleTimelineEntry[]>> {
    if (!scope.serviceBusinessId) {
      return { status: 'unavailable', reason: 'Business is not enrolled in the CRM' };
    }

    const jobs = await prisma.crmJob.findMany({
      where: {
        serviceBusinessId: scope.serviceBusinessId,
        scheduledDate: { gte: scope.range.from, lte: scope.range.to },
      },
      select: {
        id: true,
        clientName: true,
        serviceType: true,
        status: true,
        price: true,
        scheduledDate: true,
        completedAt: true,
        rating: true,
      },
      orderBy: { scheduledDate: 'desc' },
      take: 100,
    });

    return {
      status: 'ok',
      data: jobs.map((j) => ({
        at: j.completedAt ?? j.scheduledDate,
        moduleId: 'crm',
        kind: `crm.job_${j.status.toLowerCase()}`,
        subject: { id: j.id, label: `${j.serviceType} for ${j.clientName}` },
        summary:
          j.status === 'COMPLETED'
            ? `Completed ${j.serviceType} (rated ${j.rating ?? '—'}/5)`
            : `Job ${j.status.toLowerCase().replace('_', ' ')}`,
        impact: {
          amount: j.price,
          currency: 'USD',
          trustDelta:
            j.status === 'COMPLETED' ? 10 : j.status === 'MISSED' ? -40 : undefined,
        },
      })),
    };
  },

  async health(): Promise<ModuleHealth> {
    const started = Date.now();
    try {
      await prisma.crmServiceBusiness.count();
      return { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

/**
 * Payments module
 *
 * Every money movement that is not a booking, a job or a capital event: card and
 * wallet payments, Raast/fiat settlements, on-chain escrow and property rent.
 *
 * The important behaviour here is *not double counting*. Rent collected is
 * already reported as revenue by the property module, so it is counted here as
 * settlement volume only and the `counts`/`money` split keeps it out of any
 * revenue total the pulse layer might sum.
 */
export const paymentsModule: PabandiModule = {
  id: 'payments',
  key: 'payments',
  label: 'Payments',
  blurb: 'Card, wallet, Raast and on-chain settlement',
  installable: false,
  requires: [],
  emits: ['payment.captured', 'payment.refunded', 'escrow.funded', 'escrow.released'],

  async facts(scope: ModuleScope): Promise<ModuleResult<ModuleFacts>> {
    const { businessId } = scope;
    const { from, to } = scope.range;

    const [payments, fiat, escrows] = await Promise.all([
      prisma.payment.findMany({
        where: { businessId, createdAt: { gte: from, lte: to } },
        select: { amount: true, status: true, refunded: true, currency: true },
      }),
      prisma.fiatPayment.findMany({
        where: { businessId, createdAt: { gte: from, lte: to } },
        select: { amount: true, status: true, currency: true, method: true },
      }),
      prisma.solanaEscrow.findMany({
        where: { businessId, createdAt: { gte: from, lte: to } },
        select: { amount: true, status: true },
      }),
    ]);

    const settledPayments = payments.filter((p) => p.status === 'COMPLETED');
    const settledFiat = fiat.filter((p) => p.status === 'COMPLETED');

    if (settledPayments.length === 0 && settledFiat.length === 0 && escrows.length === 0) {
      return { status: 'empty', reason: 'No payment settlements in this period' };
    }

    const captured = settledPayments.reduce((s, p) => s + p.amount, 0);
    const refunded = settledPayments
      .filter((p) => p.refunded)
      .reduce((s, p) => s + p.amount, 0);
    const fiatSettled = settledFiat.reduce((s, p) => s + p.amount, 0);
    const escrowFunded = escrows
      .filter((e) => e.status !== 'CREATED')
      .reduce((s, e) => s + e.amount, 0);
    const escrowDisputed = escrows.filter((e) => e.status === 'DISPUTED').length;

    return {
      status: 'ok',
      data: {
        counts: {
          captured: settledPayments.length,
          fiatSettled: settledFiat.length,
          refunds: settledPayments.filter((p) => p.refunded).length,
          escrows: escrows.length,
          disputedEscrows: escrowDisputed,
        },
        money: {
          // Settlement volume, not incremental revenue: these amounts are already
          // counted as revenue by whichever module originated the sale.
          cash: {
            gross: captured + fiatSettled,
            net: captured - refunded + fiatSettled,
            outstanding: escrowFunded,
            currency: 'USD',
          },
        },
      },
    };
  },

  async timeline(scope: ModuleScope): Promise<ModuleResult<ModuleTimelineEntry[]>> {
    const payments = await prisma.payment.findMany({
      where: { businessId: scope.businessId, createdAt: { gte: scope.range.from, lte: scope.range.to } },
      select: { id: true, amount: true, status: true, refunded: true, createdAt: true, currency: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      status: 'ok',
      data: payments.map((p) => ({
        at: p.createdAt,
        moduleId: 'payments',
        kind: p.refunded ? 'payment.refunded' : 'payment.captured',
        summary: `${p.status.toLowerCase()} ${p.amount} ${p.currency}`,
        impact: { amount: p.amount, currency: p.currency, trustDelta: p.refunded ? -25 : 5 },
      })),
    };
  },

  async health(): Promise<ModuleHealth> {
    const started = Date.now();
    await prisma.payment.count();
    return { ok: true, latencyMs: Date.now() - started };
  },
};

/**
 * Core module
 *
 * The business record itself, plus the platform-wide reputation figures that
 * other layers already write to. Always installed — this is the anchor every
 * other module is resolved against.
 */
export const coreModule: PabandiModule = {
  id: 'core',
  key: 'core',
  label: 'Business',
  blurb: 'Identity, reputation and platform standing',
  installable: false,
  requires: [],
  emits: [],

  async facts(scope: ModuleScope): Promise<ModuleResult<ModuleFacts>> {
    const business = await prisma.business.findUnique({
      where: { id: scope.businessId },
      select: {
        id: true,
        name: true,
        category: true,
        city: true,
        currency: true,
        rating: true,
        reviewCount: true,
        reliabilityScore: true,
        karmaScore: true,
        trustScore: true,
        businessTier: true,
        isVerified: true,
        isPremium: true,
        isActive: true,
        bookingAdvanceDays: true,
        cancellationHours: true,
        requireDeposit: true,
        depositPercentage: true,
      },
    });

    if (!business) {
      return { status: 'unavailable', reason: 'Business record not found' };
    }

    return {
      status: 'ok',
      data: {
        counts: {
          rating: business.rating,
          reviews: business.reviewCount,
          reliabilityScore: business.reliabilityScore,
          karmaScore: business.karmaScore,
          trustScore: business.trustScore,
          verified: business.isVerified ? 1 : 0,
          premium: business.isPremium ? 1 : 0,
        },
        money: {},
      },
    };
  },

  async timeline(): Promise<ModuleResult<ModuleTimelineEntry[]>> {
    // The business record has no event stream of its own; its history lives in
    // the reviews table, which the booking layer renders.
    return { status: 'empty', reason: 'Core module has no independent timeline' };
  },

  async health(): Promise<ModuleHealth> {
    const started = Date.now();
    await prisma.business.count();
    return { ok: true, latencyMs: Date.now() - started };
  },
};

moduleRegistry.register(crmModule);
moduleRegistry.register(paymentsModule);
moduleRegistry.register(coreModule);