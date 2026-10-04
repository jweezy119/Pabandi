import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Business reports.
 *
 * WHY THIS FILE WAS REWRITTEN
 * ---------------------------
 * Two separate defects, one of them a security hole.
 *
 * 1. CROSS-TENANT READ (the important one). Every method took a bare `businessId` string,
 *    and reports.routes.ts passed `String(req.query.businessId)` straight through. The
 *    router had `authenticate` but no ownership check, so ANY logged-in user could request
 *    ANY other business's revenue, expenses, pipeline, client list and activity feed by
 *    putting their id in the query string. Authentication proves who you are; it says
 *    nothing about which tenant you may read. That is the whole point of a tenant resolver.
 *
 * 2. ONE PARAMETER, TWO ID SPACES. That single `businessId` was then handed to five models
 *    that do not agree on what it means:
 *
 *      Invoice.businessId     -> platform Business.id
 *      CrmDeal.businessId     -> legacy CrmBusiness.id
 *      CrmExpense.businessId  -> legacy CrmBusiness.id
 *      CrmClient.businessId   -> legacy CrmBusiness.id
 *      CrmActivity.businessId -> legacy CrmBusiness.id
 *
 *    No single value can satisfy all five. A platform Business id makes the four CRM
 *    reports empty; a CrmBusiness id makes revenue empty. That is why /contact/reports
 *    looked blank: the client sent the platform id and the CRM tables never matched.
 *
 * The fix is not a cleverer query. It is to stop trusting a caller-supplied id, resolve the
 * tenant server-side, and scope each model on the anchor it actually owns. `CrmDeal` and
 * `CrmActivity` gained `serviceBusinessId` for exactly this; see sql/crm-deal-tenant.sql.
 *
 * 3. getTrustInsights returned CONSTANTS. A hardcoded score distribution
 *    ({'80-100': 15, '60-79': 8, ...}) and a hardcoded event list with `escalations: 2`.
 *    Nothing consulted the database. A dashboard rendering those numbers is showing a
 *    business fabricated financials, and no test could have caught it because the values
 *    were never derived from anything. It is now computed from real rows.
 */

const prisma = new PrismaClient();

/** The resolved tenant. Never a request-supplied id. */
export interface ReportsContext {
  /** CrmServiceBusiness.id — anchors every CRM table. Always present. */
  serviceBusinessId: string;
  /** Platform Business.id — the only anchor Invoice has. Null when not enrolled. */
  businessId: string | null;
}

/**
 * Tenant scope for the legacy CRM tables.
 *
 * Deliberately NOT the shared crmScope(): that ORs in `{ businessId }`, which on these
 * tables is a foreign key to the legacy CrmBusiness table, whereas ReportsContext.businessId
 * is the platform Business id. Including it would add a clause that can never match and
 * reads as if it were doing something.
 */
function crmScope(ctx: ReportsContext) {
  return { serviceBusinessId: ctx.serviceBusinessId };
}

/**
 * Platform-business scope, for tables that only know about Business.
 *
 * When there is no platform business the tenant owns no invoices, so this returns an
 * impossible predicate rather than an empty filter. An empty filter would be a match-all,
 * and a match-all on a revenue report is the worst possible failure direction.
 */
function platformScope(ctx: ReportsContext): Prisma.InvoiceWhereInput {
  if (!ctx.businessId) return { businessId: '__no_platform_business__' };
  return { businessId: ctx.businessId };
}

/**
 * Apply a date range to `where[field]`, and reject an inverted one.
 *
 * The cast lives here rather than at each call site: Prisma's generated WhereInput types
 * differ per model (`createdAt` vs `date`), and pushing the cast into five call sites meant
 * five chances to cast the wrong shape.
 *
 * Only applies when BOTH bounds are present, which is what the previous code did too —
 * a single bound is ignored rather than half-applied, so an open-ended range is not silently
 * turned into a closed one.
 */
function inRange(where: object, field: string, startDate?: Date, endDate?: Date) {
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    throw Object.assign(new Error('startDate must not be after endDate'), { statusCode: 400 });
  }
  if (startDate && endDate) {
    (where as Record<string, unknown>)[field] = { gte: startDate, lte: endDate };
  }
}

export class ReportsService {
  /** Pipeline value and count grouped by stage. */
  static async getPipeline(ctx: ReportsContext, startDate?: Date, endDate?: Date) {
    const where: Prisma.CrmDealWhereInput = { ...crmScope(ctx) };
    inRange(where, 'createdAt', startDate, endDate);

    const deals = await prisma.crmDeal.groupBy({
      by: ['stage'],
      where,
      _count: { id: true },
      _sum: { value: true },
    });

    return deals.map((d) => ({
      stage: d.stage,
      count: d._count.id,
      value: d._sum.value || 0,
    }));
  }

  /**
   * Billed / collected / outstanding.
   *
   * `paidAt` is the authoritative signal: it is what the payment path sets, and it survives
   * a status string that was never updated. Status alone is the weaker signal, so both are
   * accepted.
   *
   * Both CASINGS of the status are compared. Every current Invoice write is lowercase
   * ('draft', 'sent', 'paid'), so this is defence in depth rather than a live bug — but
   * UPPERCASE 'PAID' is the convention on the sibling payment models in this codebase
   * (Booking, PropertyLease, and the Stripe/PayLio webhooks), so an invoice that reaches
   * this table through one of those paths would otherwise read as outstanding forever.
   *
   * (An earlier version of this comment claimed invoice.service writes UPPERCASE statuses.
   * It does not — that was wrong, and the reasoning above is the honest version.)
   */
  static async getRevenue(ctx: ReportsContext, startDate?: Date, endDate?: Date) {
    const where: Prisma.InvoiceWhereInput = { ...platformScope(ctx) };
    inRange(where, 'createdAt', startDate, endDate);

    const invoices = await prisma.invoice.findMany({
      where,
      select: { subtotal: true, status: true, paidAt: true },
    });

    let billed = 0;
    let collected = 0;
    let outstanding = 0;

    for (const inv of invoices) {
      billed += inv.subtotal;
      const settled =
        inv.paidAt !== null || inv.status === 'paid' || inv.status === 'PAID';
      if (settled) collected += inv.subtotal;
      else outstanding += inv.subtotal;
    }

    return { billed, collected, outstanding };
  }

  static async getExpenses(ctx: ReportsContext, startDate?: Date, endDate?: Date) {
    const where: Prisma.CrmExpenseWhereInput = { ...crmScope(ctx) };
    inRange(where, 'date', startDate, endDate);

    const expenses = await prisma.crmExpense.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
    });

    return expenses.map((e) => ({
      category: e.category,
      amount: e._sum.amount || 0,
    }));
  }

  static async getClientHealth(ctx: ReportsContext, startDate?: Date, endDate?: Date) {
    const where: Prisma.CrmClientWhereInput = { ...crmScope(ctx) };
    inRange(where, 'createdAt', startDate, endDate);

    const clients = await prisma.crmClient.findMany({
      where,
      select: { id: true, name: true, status: true, createdAt: true },
    });

    return {
      atRisk: clients.filter((c) => c.status === 'AT_RISK'),
      // Previously `clients.filter(c => startDate && ...)`, which evaluated `startDate` for
      // truthiness and returned EVERY client whenever no range was given — labelled
      // "newClients" on the dashboard. With no range there is no notion of new, so it is
      // empty, and the caller can say "no period selected" instead of showing a total.
      newClients: startDate ? clients.filter((c) => c.createdAt >= startDate) : [],
      vipClients: clients.filter((c) => c.status === 'VIP'),
    };
  }

  /**
   * Trust insights, computed from real rows.
   *
   * The previous version returned a literal object and consulted nothing, so every business
   * saw identical numbers. These are derived:
   *
   *   - scoreDistribution: quartiles of the tenant's OWN client reliability scores. Buckets
   *     are built from the observed min/max rather than fixed 0-100 boundaries, because
   *     reliabilityScore defaults to 750 and nothing in the codebase establishes a scale —
   *     hardcoding "80-100" would bucket a 750 into the top quartile by accident.
   *   - events: real CrmActivity counts by type.
   *   - escalations: clients flagged AT_RISK.
   *
   * With no clients the distribution is empty rather than four fabricated buckets.
   */
  static async getTrustInsights(ctx: ReportsContext, startDate?: Date, endDate?: Date) {
    const clients = await prisma.crmClient.findMany({
      where: crmScope(ctx),
      select: { reliabilityScore: true, status: true },
    });

    const activityWhere: Prisma.CrmActivityWhereInput = { ...crmScope(ctx) };
    inRange(activityWhere, 'createdAt', startDate, endDate);
    const byType = await prisma.crmActivity.groupBy({
      by: ['type'],
      where: activityWhere,
      _count: { id: true },
    });

    const scores = clients.map((c) => c.reliabilityScore);
    let scoreDistribution: Record<string, number> = {};
    if (scores.length) {
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const width = (max - min) / 4 || 1;
      const buckets = [0, 0, 0, 0];
      for (const s of scores) {
        const idx = Math.min(3, Math.floor((s - min) / width));
        buckets[idx] += 1;
      }
      // Labelled by observed range, so the axis means something without inventing a scale.
      const fmt = (n: number) => Math.round(n).toString();
      scoreDistribution = {
        [`${fmt(min)}-${fmt(min + width)}`]: buckets[0],
        [`${fmt(min + width)}-${fmt(min + width * 2)}`]: buckets[1],
        [`${fmt(min + width * 2)}-${fmt(min + width * 3)}`]: buckets[2],
        [`${fmt(min + width * 3)}-${fmt(max)}`]: buckets[3],
      };
    }

    return {
      scoreDistribution,
      events: byType.map((e) => ({ type: e.type, count: e._count.id })),
      escalations: clients.filter((c) => c.status === 'AT_RISK').length,
    };
  }

  static async getActivityMetrics(ctx: ReportsContext, startDate?: Date, endDate?: Date) {
    const where: Prisma.CrmActivityWhereInput = { ...crmScope(ctx) };
    inRange(where, 'createdAt', startDate, endDate);

    const activities = await prisma.crmActivity.findMany({
      where,
      select: { type: true, completed: true, createdAt: true },
    });

    const total = activities.length;
    const totalTasks = activities.filter((a) => a.type === 'TASK').length;
    const completedTasks = activities.filter((a) => a.type === 'TASK' && a.completed).length;
    const completionRate = totalTasks ? (completedTasks / totalTasks) * 100 : 0;

    const byDay: Record<string, number> = {};
    for (const a of activities) {
      const day = new Date(a.createdAt).toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
    }

    const timeline = Object.keys(byDay)
      .sort()
      .map((date) => ({ date, count: byDay[date] }));

    return { total, completionRate: Math.round(completionRate), timeline };
  }
}
