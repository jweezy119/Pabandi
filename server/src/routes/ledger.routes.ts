import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

/**
 * CapitalOS ledger API.
 *
 * WHAT WAS BROKEN HERE
 * Every route resolved its scope from `req.user.id` and ignored `businessId`:
 *
 *  - POST /invoices and POST /expenses spread `...req.body` into Prisma and
 *    injected only the user id. LedgerInvoice requires businessId, number,
 *    amount, dueDate and lineItems; LedgerExpense requires businessId,
 *    category, amount and incurredAt. None were injected, so both endpoints
 *    raised a Prisma validation error and returned 500 on every call. There
 *    was no working way to create a ledger row.
 *  - GET /cashflow and GET /profit-loss read `propertyFinancial` filtered by
 *    `property.managerId` — the property-management rent roll. CapitalOS was
 *    reporting property rent as if it were the business's ledger, and
 *    reporting zeros to anyone who was not a property manager.
 *  - PUT /invoices/:id/status updated by id alone, so any authenticated user
 *    could set any invoice to any status.
 *  - No route could create a LedgerAccount, so GET /accounts always returned [].
 *
 * The fix is to scope everything by the tenant the token carries, and to
 * compute the aggregates from the ledger tables that actually back them.
 */

const router = Router();
router.use(authenticate);

const INVOICE_STATUSES = ['draft', 'sent', 'overdue', 'paid', 'void'] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}

const EXPENSE_CATEGORIES = [
  'materials',
  'labour',
  'rent',
  'utilities',
  'transport',
  'equipment',
  'software',
  'marketing',
  'insurance',
  'taxes',
  'other',
] as const;

/**
 * The tenant this request may act on. Taken from the signed token, never from
 * the request body — a body-supplied businessId would be a trivial cross-tenant
 * write.
 */
function requireBusinessId(req: AuthRequest): string {
  const businessId = req.user?.businessId ?? req.user?.activeBusinessId;
  if (!businessId) {
    throw new CustomError('No business is associated with this account', 403);
  }
  return businessId;
}

/** Sequential, human-readable invoice number per business. */
async function nextInvoiceNumber(businessId: string): Promise<string> {
  const count = await prisma.ledgerInvoice.count({ where: { businessId } });
  return `LG-${String(count + 1).padStart(4, '0')}`;
}

// ── Invoices ────────────────────────────────────────────────────────────────

router.get('/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const status = req.query.status ? String(req.query.status) : undefined;

    const invoices = await prisma.ledgerInvoice.findMany({
      where: {
        businessId,
        ...(status && isInvoiceStatus(status) ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: invoices });
  } catch (e) {
    logger.error(`[Ledger] list invoices failed: ${e instanceof Error ? e.message : e}`);
    res.status(500).json({ success: false, error: 'Failed to list invoices' });
  }
});

router.post('/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const { clientId, amount, currency, dueDate, lineItems, status } = req.body ?? {};

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ success: false, error: 'amount must be a positive number' });
    }
    if (!dueDate || Number.isNaN(new Date(dueDate).getTime())) {
      return res.status(400).json({ success: false, error: 'dueDate must be a valid date' });
    }

    const requested = typeof status === 'string' ? status : 'draft';
    if (!isInvoiceStatus(requested)) {
      return res.status(400).json({ success: false, error: `status must be one of ${INVOICE_STATUSES.join(', ')}` });
    }

    const invoice = await prisma.ledgerInvoice.create({
      data: {
        businessId,
        number: await nextInvoiceNumber(businessId),
        amount: value,
        currency: typeof currency === 'string' ? currency.toUpperCase() : 'USD',
        dueDate: new Date(dueDate),
        status: requested,
        lineItems: Array.isArray(lineItems) ? lineItems : [],
        ...(clientId ? { clientId: String(clientId) } : {}),
        senderId: req.user!.id,
        ...(requested === 'paid' ? { paidAt: new Date() } : {}),
      },
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (e) {
    logger.error(`[Ledger] create invoice failed: ${e instanceof Error ? e.message : e}`);
    res.status(500).json({ success: false, error: 'Failed to create invoice' });
  }
});

router.put('/invoices/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const { status } = req.body ?? {};

    if (typeof status !== 'string' || !isInvoiceStatus(status)) {
      return res.status(400).json({ success: false, error: `status must be one of ${INVOICE_STATUSES.join(', ')}` });
    }

    // Scoped update. This is also the concurrency guard: if two people mark the
    // same invoice at once, only the first matches the `status` predicate and
    // the second gets 409 rather than silently overwriting.
    const updated = await prisma.ledgerInvoice.updateMany({
      where: { id: req.params.id, businessId },
      data: {
        status,
        ...(status === 'paid' ? { paidAt: new Date() } : {}),
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const invoice = await prisma.ledgerInvoice.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, data: invoice });
  } catch (e) {
    logger.error(`[Ledger] update invoice status failed: ${e instanceof Error ? e.message : e}`);
    res.status(500).json({ success: false, error: 'Failed to update invoice status' });
  }
});

router.delete('/invoices/:id', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    // Only drafts are deletable, so a settled invoice can't be erased from the
    // books. Same rule the CRM invoice delete uses.
    const deleted = await prisma.ledgerInvoice.deleteMany({
      where: { id: req.params.id, businessId, status: 'draft' },
    });
    if (deleted.count === 0) {
      return res.status(404).json({ success: false, error: 'Draft invoice not found' });
    }
    res.json({ success: true, message: 'Invoice deleted' });
  } catch (e) {
    logger.error(`[Ledger] delete invoice failed: ${e instanceof Error ? e.message : e}`);
    res.status(500).json({ success: false, error: 'Failed to delete invoice' });
  }
});

// ── Expenses ────────────────────────────────────────────────────────────────

router.get('/expenses', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const expenses = await prisma.ledgerExpense.findMany({
      where: { businessId },
      orderBy: { incurredAt: 'desc' },
    });
    res.json({ success: true, data: expenses });
  } catch (e) {
    logger.error(`[Ledger] list expenses failed: ${e instanceof Error ? e.message : e}`);
    res.status(500).json({ success: false, error: 'Failed to list expenses' });
  }
});

router.post('/expenses', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const { category, amount, description, incurredAt, currency } = req.body ?? {};

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ success: false, error: 'amount must be a positive number' });
    }
    if (typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ success: false, error: 'category is required' });
    }
    // An unknown category is accepted rather than rejected: the expense
    // categories are open-ended in practice, and a hard-coded list would
    // refuse a legitimate entry. It is normalised for grouping instead.
    const normalised = category.trim().toLowerCase().replace(/\s+/g, '-');

    const expense = await prisma.ledgerExpense.create({
      data: {
        businessId,
        userId: req.user!.id,
        category: normalised,
        amount: value,
        currency: typeof currency === 'string' ? currency.toUpperCase() : 'USD',
        description: typeof description === 'string' ? description : null,
        incurredAt: incurredAt && !Number.isNaN(new Date(incurredAt).getTime())
          ? new Date(incurredAt)
          : new Date(),
      },
    });

    res.status(201).json({ success: true, data: expense });
  } catch (e) {
    logger.error(`[Ledger] create expense failed: ${e instanceof Error ? e.message : e}`);
    res.status(500).json({ success: false, error: 'Failed to create expense' });
  }
});

router.get('/expenses/categories', (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: EXPENSE_CATEGORIES });
});

// ── Accounts ────────────────────────────────────────────────────────────────

router.get('/accounts', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const accounts = await prisma.ledgerAccount.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: accounts });
  } catch (e) {
    logger.error(`[Ledger] list accounts failed: ${e instanceof Error ? e.message : e}`);
    res.status(500).json({ success: false, error: 'Failed to list accounts' });
  }
});

/**
 * Opening balances. A new business has no accounts, and the Accounts page
 * cannot list what was never created, so the chart of accounts needs a way to
 * be seeded. Without this the page could only ever show an empty state.
 */
router.post('/accounts', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const { name, type, balance, currency } = req.body ?? {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    const accountType = typeof type === 'string' && type.trim() ? type.trim().toLowerCase() : 'checking';

    const account = await prisma.ledgerAccount.create({
      data: {
        businessId,
        userId: req.user!.id,
        name: name.trim(),
        type: accountType,
        balance: Number.isFinite(Number(balance)) ? Number(balance) : 0,
        currency: typeof currency === 'string' ? currency.toUpperCase() : 'USD',
      },
    });

    res.status(201).json({ success: true, data: account });
  } catch (e) {
    logger.error(`[Ledger] create account failed: ${e instanceof Error ? e.message : e}`);
    res.status(500).json({ success: false, error: 'Failed to create account' });
  }
});

// ── Aggregates ──────────────────────────────────────────────────────────────

type Window = { start: Date; label: string; key: 'week' | 'month' | 'year' };

function windowFor(period: string): Window {
  const now = new Date();
  const start = new Date(now);
  if (period === 'week') {
    start.setDate(now.getDate() - 7);
    return { start, label: 'week', key: 'week' };
  }
  if (period === 'year') {
    start.setFullYear(now.getFullYear() - 1);
    return { start, label: 'year', key: 'year' };
  }
  start.setMonth(now.getMonth() - 1);
  return { start, label: 'month', key: 'month' };
}

/**
 * Cash flow over a period, from the ledger tables that back it.
 *
 * Previously read propertyFinancial by property manager — real-estate rent,
 * not this business's books. Income is paid ledger invoices in the window;
 * expenses are ledger expenses incurred in it.
 */
router.get('/cashflow', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    // An unrecognised period used to fall through every branch and produce an
    // empty window that looked like "no activity". It now defaults explicitly.
    const requested = String(req.query.period ?? 'month');
    const { start, label } = windowFor(['week', 'month', 'year'].includes(requested) ? requested : 'month');

    const [paidInvoices, expenses] = await Promise.all([
      prisma.ledgerInvoice.findMany({
        where: { businessId, status: 'paid', paidAt: { gte: start } },
        select: { amount: true, paidAt: true },
      }),
      prisma.ledgerExpense.findMany({
        where: { businessId, incurredAt: { gte: start } },
        select: { amount: true, incurredAt: true },
      }),
    ]);

    const totalIncome = paidInvoices.reduce((s, i) => s + (i.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, x) => s + (x.amount || 0), 0);

    // Buckets for the trend chart, oldest first.
    const buckets: { label: string; income: number; expenses: number }[] = [];
    const bucketCount = 12;
    for (let i = bucketCount - 1; i >= 0; i -= 1) {
      const bucketEnd = new Date(start.getTime() + ((i + 1) * (Date.now() - start.getTime())) / bucketCount);
      const bucketStart = new Date(start.getTime() + (i * (Date.now() - start.getTime())) / bucketCount);
      buckets.push({
        label: bucketStart.toLocaleDateString(undefined, { month: 'short' }),
        income: paidInvoices
          .filter((i) => i.paidAt && i.paidAt > bucketStart && i.paidAt <= bucketEnd)
          .reduce((s, i) => s + (i.amount || 0), 0),
        expenses: expenses
          .filter((x) => x.incurredAt > bucketStart && x.incurredAt <= bucketEnd)
          .reduce((s, x) => s + (x.amount || 0), 0),
      });
    }

    const pending = await prisma.ledgerInvoice.findMany({
      where: { businessId, status: { in: ['sent', 'overdue'] } },
      select: { status: true, amount: true },
    });

    res.json({
      success: true,
      data: {
        period: label,
        totalIncome,
        totalExpenses,
        netCashFlow: totalIncome - totalExpenses,
        incomeCount: paidInvoices.length,
        expenseCount: expenses.length,
        pendingInvoices: pending.filter((i) => i.status === 'sent').length,
        overdueInvoices: pending.filter((i) => i.status === 'overdue').length,
        // The client used to render a hardcoded [65,45,78,…] array. It now
        // draws this, so the chart reflects the same figures as the totals.
        trend: buckets,
      },
    });
  } catch (e) {
    logger.error(`[Ledger] cash flow failed: ${e instanceof Error ? e.message : e}`);
    res.status(500).json({ success: false, error: 'Failed to get cash flow' });
  }
});

/** Twelve-month P&L, from ledger invoices and expenses. */
router.get('/profit-loss', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const now = new Date();
    const start = new Date(now);
    start.setFullYear(now.getFullYear() - 1);

    const [paidInvoices, expenses] = await Promise.all([
      prisma.ledgerInvoice.findMany({
        where: { businessId, status: 'paid', paidAt: { gte: start } },
        select: { amount: true, paidAt: true },
      }),
      prisma.ledgerExpense.findMany({
        where: { businessId, incurredAt: { gte: start } },
        select: { amount: true, category: true, incurredAt: true },
      }),
    ]);

    const totalIncome = paidInvoices.reduce((s, i) => s + (i.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, x) => s + (x.amount || 0), 0);

    // Twelve calendar months, oldest first, so the client can plot a real
    // series rather than two flat totals.
    const months: { label: string; income: number; expenses: number; net: number }[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const income = paidInvoices
        .filter((inv) => inv.paidAt && inv.paidAt >= monthStart && inv.paidAt < monthEnd)
        .reduce((s, inv) => s + (inv.amount || 0), 0);
      const monthExpenses = expenses
        .filter((x) => x.incurredAt >= monthStart && x.incurredAt < monthEnd)
        .reduce((s, x) => s + (x.amount || 0), 0);
      months.push({
        label: monthStart.toLocaleDateString(undefined, { month: 'short' }),
        income,
        expenses: monthExpenses,
        net: income - monthExpenses,
      });
    }

    const byCategory = new Map<string, number>();
    for (const x of expenses) {
      byCategory.set(x.category, (byCategory.get(x.category) ?? 0) + (x.amount || 0));
    }

    res.json({
      success: true,
      data: {
        period: 'year',
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        profitMargin: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0,
        months,
        expensesByCategory: Array.from(byCategory.entries())
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount),
      },
    });
  } catch (e) {
    logger.error(`[Ledger] P&L failed: ${e instanceof Error ? e.message : e}`);
    res.status(500).json({ success: false, error: 'Failed to get P&L' });
  }
});

export default router;
