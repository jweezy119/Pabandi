import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

/**
 * Business dashboard.
 *
 * WHY THIS FILE EXISTS NOW
 * `/dashboard` is the primary navigation target for a business owner — the logo in AppShell,
 * the breadcrumb root, the command palette and the avatar menu in Layout all point at it.
 * Every screen behind it was fetching `/api/v1/dashboard/:businessId/*`, and none of those
 * six endpoints existed. The registration was removed in an earlier pass (it pointed at
 * modules that were never on disk, so each request 500'd with "Route module failed to load"),
 * which correctly turned a mysterious 500 into a visible 404.
 *
 * A 404 on the main dashboard is not an acceptable resting state, so the APIs are written
 * here instead — against data that already exists.
 *
 * THE `:businessId` PATH PARAMETER IS IGNORED
 * Every route below is declared as `/:businessId/...` purely so the existing client URLs
 * resolve, and the parameter is never read. The tenant comes from `resolveCrmBusiness`,
 * which pairs a requested id with `ownerId: userId`.
 *
 * This is deliberate and it is the whole point: an earlier version of the platform read the
 * tenant straight out of a path/query `businessId` in the jobs and reports routers, and both
 * were cross-tenant leaks. Jobs leaked client addresses, reports leaked revenue. Honouring a
 * caller-supplied id here would reintroduce both, on the screen every business owner lands
 * on. The path segment is kept only as a shape the client already sends.
 *
 * All CRM reads filter on `serviceBusinessId`, which is the anchor that actually resolves.
 * `CrmClient.businessId` / `CrmJob.businessId` are foreign keys to the legacy CrmBusiness
 * table, which has no ownerId and no mapping to a platform Business, so they cannot be used
 * to prove ownership.
 */
const router = Router();
router.use(authenticate);
router.use(resolveCrmBusiness);

function fail(res: Response, err: any) {
  const status = Number(err?.statusCode) || 500;
  res.status(status).json({
    success: false,
    error: status >= 500 ? 'Dashboard request failed' : err?.message ?? 'Invalid request',
  });
}

/** Jobs for a UTC day, newest first, with the client joined. */
async function jobsOnDay(serviceBusinessId: string, from: Date, to: Date) {
  return prisma.crmJob.findMany({
    where: { serviceBusinessId, scheduledDate: { gte: from, lt: to } },
    include: { client: true },
    orderBy: { scheduledDate: 'asc' },
  });
}

/**
 * Flatten a job into the shape the dashboard's `Booking` type expects.
 *
 * `time` is the stored HH:mm string rather than a computed timestamp: the dashboard renders
 * it directly, and the column is already what the scheduler writes, so re-deriving it here
 * would risk the two disagreeing by a timezone.
 */
function toBooking(job: any) {
  return {
    id: job.id,
    customerName: job.client?.name ?? job.clientName ?? 'Unknown',
    customerPhone: job.client?.phone ?? '',
    customerEmail: job.client?.email ?? undefined,
    time: job.scheduledTime ?? '',
    status: job.status,
    notes: job.notes ?? undefined,
    depositAmount: 0,
    depositPaid: false,
    serviceType: job.serviceType,
    address: job.address ?? undefined,
  };
}

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// GET /api/v1/dashboard/:businessId/today
router.get('/:businessId/today', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const start = startOfUtcDay();
    const end = new Date(start.getTime() + 864e5);
    const jobs = await jobsOnDay(serviceBusinessId, start, end);
    res.json({ success: true, data: { bookings: jobs.map(toBooking) } });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/v1/dashboard/:businessId/calendar
//
// Optional ?start=&end= (ISO dates). Defaults to the current month. Bounded so a caller
// cannot ask for the whole table and turn a dashboard into a data export.
router.get('/:businessId/calendar', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const now = new Date();
    const start = req.query.start ? new Date(String(req.query.start)) : startOfUtcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    const end = req.query.end ? new Date(String(req.query.end)) : new Date(start.getTime() + 62 * 864e5);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: 'start and end must be valid dates' });
    }
    if (end.getTime() <= start.getTime()) {
      return res.status(400).json({ success: false, error: 'end must be after start' });
    }
    const cappedEnd = new Date(Math.min(end.getTime(), start.getTime() + 366 * 864e5));

    const jobs = await jobsOnDay(serviceBusinessId, start, cappedEnd);
    res.json({ success: true, data: jobs.map(toBooking) });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/v1/dashboard/:businessId/customers
router.get('/:businessId/customers', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const customers = await prisma.crmClient.findMany({
      where: { serviceBusinessId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ success: true, data: customers });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/v1/dashboard/:businessId/employees
router.get('/:businessId/employees', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const employees = await prisma.crmEmployee.findMany({
      where: { serviceBusinessId },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: employees });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/v1/dashboard/:businessId/money
router.get('/:businessId/money', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const now = new Date();

    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    // getUTCDay() is 0 on Sunday; the 4-day shift puts the week boundary on Monday, which is
    // what a business means by "this week".
    const weekStart = startOfUtcDay(new Date(now.getTime() - ((now.getUTCDay() + 6) % 7) * 864e5));

    // Revenue comes from Invoice, which is anchored to the PLATFORM business — the only
    // anchor it has. With no platform business the tenant owns no invoices, so the totals are
    // zero rather than a match-all over the whole platform.
    const revenueFor = async (from: Date) => {
      if (!crm.businessId) return 0;
      const rows = await prisma.invoice.findMany({
        where: {
          businessId: crm.businessId,
          createdAt: { gte: from },
        },
        select: { subtotal: true, status: true, paidAt: true },
      });
      let total = 0;
      for (const r of rows) {
        // paidAt is authoritative; the status comparison is a weaker fallback, and both
        // casings are accepted because sibling payment models write UPPERCASE 'PAID'.
        if (r.paidAt !== null || r.status === 'paid' || r.status === 'PAID') total += r.subtotal;
      }
      return total;
    };

    const [monthlyRevenue, weeklyRevenue, expenseAgg, recentExpenses] = await Promise.all([
      revenueFor(monthStart),
      revenueFor(weekStart),
      prisma.crmExpense.aggregate({
        where: { serviceBusinessId: crm.serviceBusinessId },
        _sum: { amount: true },
      }),
      prisma.crmExpense.findMany({
        where: { serviceBusinessId: crm.serviceBusinessId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const totalExpenses = expenseAgg._sum.amount ?? 0;

    // PayLio: only create-payment, payment-status and webhook endpoints exist. There is NO
    // balance endpoint, so there is nothing truthful to return here.
    //
    // The client renders this with .toFixed(2), so it must be a number -- but returning a
    // fabricated 0 would assert the business holds no money, when the truth is that we do
    // not know. Sent as 0 WITH paylioBalanceAvailable: false so the UI can say "not
    // connected" instead of "$0.00".
    const paylioBalanceAvailable = false;

    res.json({
      success: true,
      data: {
        monthlyRevenue,
        weeklyRevenue,
        totalExpenses,
        netProfit: monthlyRevenue - totalExpenses,
        paylioBalance: 0,
        paylioBalanceAvailable,
        recentExpenses,
      },
    });
  } catch (err) {
    logger.error(`[Dashboard] money failed: ${err instanceof Error ? err.message : String(err)}`);
    fail(res, err);
  }
});

// POST /api/v1/dashboard/:businessId/expense
router.post('/:businessId/expense', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const { category, amount, description, date } = req.body ?? {};

    if (!category || typeof category !== 'string') {
      return res.status(400).json({ success: false, error: 'category is required' });
    }
    // Validated as a number rather than coerced: `Number('abc')` is NaN, and a NaN that
    // reaches the SUM in /money silently poisons the net profit figure.
    const value = Number(amount);
    if (!Number.isFinite(value)) {
      return res.status(400).json({ success: false, error: 'amount must be a number' });
    }
    if (value <= 0) {
      // A negative expense is not a refund; it is an entry error, and it would understate
      // total spend on the same card the user is looking at.
      return res.status(400).json({ success: false, error: 'amount must be greater than zero' });
    }

    const expense = await prisma.crmExpense.create({
      data: {
        serviceBusinessId,
        category: category.trim(),
        amount: value,
        description: description ? String(description) : null,
        ...(date && !Number.isNaN(new Date(date).getTime()) ? { date: new Date(date) } : {}),
      },
    });

    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    fail(res, err);
  }
});

export default router;
