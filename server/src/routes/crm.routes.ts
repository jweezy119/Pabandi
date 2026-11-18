import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * Contact OS CRM API.
 *
 * The CRM tables this platform actually has are `crm_clients` (CrmClient) and
 * `crm_expenses` (CrmExpense). Jobs are the platform's Booking rows; invoices
 * are the platform's Invoice rows. Endpoints for tables that do not exist yet
 * (deals, tasks, activities, files, alerts, employees, payroll) return empty
 * collections or explicit stubs so the client renders instead of 404ing.
 *
 * Tenant scoping: every read is bounded by the caller's platform business id.
 * A row from another business matches neither branch.
 */
const router = Router();

router.use(authenticate, resolveCrmBusiness);

const ok = (res: Response, data: unknown, extra: Record<string, unknown> = {}) =>
  res.json({ success: true, data, ...extra });

// ── Clients ─────────────────────────────────────────────────────────────────

router.get('/clients', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
    const search = String(req.query.search ?? '').trim();
    const status = req.query.status ? String(req.query.status) : undefined;
    const sortBy = String(req.query.sortBy ?? 'createdAt');
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const where: any = {
      OR: [{ businessId }, { serviceBusinessId: businessId }],
    };
    if (status) where.status = status;
    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const sortColumn = ['name', 'company', 'createdAt', 'totalSpent', 'status', 'lastJobAt'].includes(sortBy)
      ? sortBy
      : 'createdAt';

    const [clients, total] = await Promise.all([
      prisma.crmClient.findMany({
        where,
        orderBy: { [sortColumn]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.crmClient.count({ where }),
    ]);

    ok(res, clients, { pagination: { page, limit, total } });
  } catch (e) {
    next(e);
  }
});

router.post('/clients', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { name, email, phone, address, company, notes, status } = req.body ?? {};
    if (!name || !String(name).trim()) throw new CustomError('name is required', 400);

    const client = await prisma.crmClient.create({
      data: {
        businessId,
        serviceBusinessId: businessId,
        name: String(name).trim(),
        email: email ? String(email).trim().toLowerCase() : '',
        phone: phone ? String(phone) : '',
        address: address ? String(address) : '',
        company: company ? String(company) : null,
        notes: notes ? String(notes) : null,
        status: status ? String(status) : 'ACTIVE',
      },
    });
    ok(res, client);
  } catch (e) {
    next(e);
  }
});

router.get('/clients/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const client = await prisma.crmClient.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
    });
    if (!client) throw new CustomError('Client not found', 404);
    ok(res, client);
  } catch (e) {
    next(e);
  }
});

router.put('/clients/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmClient.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Client not found', 404);

    const patch: any = {};
    const { name, email, phone, address, company, notes, status } = req.body ?? {};
    if (name !== undefined) patch.name = String(name).trim();
    if (email !== undefined) patch.email = email ? String(email).trim().toLowerCase() : '';
    if (phone !== undefined) patch.phone = phone ? String(phone) : '';
    if (address !== undefined) patch.address = address ? String(address) : '';
    if (company !== undefined) patch.company = company ? String(company) : null;
    if (notes !== undefined) patch.notes = notes ? String(notes) : null;
    if (status !== undefined) patch.status = String(status);

    const client = await prisma.crmClient.update({ where: { id: existing.id }, data: patch });
    ok(res, client);
  } catch (e) {
    next(e);
  }
});

router.delete('/clients/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmClient.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Client not found', 404);
    await prisma.crmClient.delete({ where: { id: existing.id } });
    ok(res, { id: existing.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

router.get('/clients/:id/invoices', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const invoices = await prisma.invoice.findMany({
      where: { clientId: req.params.id, businessId },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, invoices);
  } catch (e) {
    next(e);
  }
});

// Stubs for AI client intelligence. The AI router can fill these later.
router.get('/clients/:id/intelligence', (_req: AuthRequest, res: Response) => {
  ok(res, { summary: null, signals: [], recommendations: [] });
});
router.get('/clients/:id/terms-recommendation', (_req: AuthRequest, res: Response) => {
  ok(res, { terms: null, reason: null });
});
router.get('/clients/:id/explain-score', (_req: AuthRequest, res: Response) => {
  ok(res, { score: null, factors: [] });
});

router.post('/import/clients', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    let imported = 0;
    for (const row of rows.slice(0, 500)) {
      const name = row?.name ? String(row.name).trim() : '';
      if (!name) continue;
      await prisma.crmClient.create({
        data: {
          businessId,
          serviceBusinessId: businessId,
          name,
          email: row.email ? String(row.email).trim().toLowerCase() : '',
          phone: row.phone ? String(row.phone) : '',
          company: row.company ? String(row.company) : null,
        },
      });
      imported += 1;
    }
    ok(res, { imported, skipped: rows.length - imported, errors: [] });
  } catch (e) {
    next(e);
  }
});

// ── Settings & setup progress ───────────────────────────────────────────────

router.get('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const settings = await prisma.businessSettings.findUnique({ where: { businessId } });
    ok(res, settings ?? { businessId, customFields: {}, enabledModules: [], enabledFeatures: {} });
  } catch (e) {
    next(e);
  }
});

router.put('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { customFields, enabledModules, enabledFeatures, dashboardLayout, dashboardTheme, vertical } = req.body ?? {};
    const settings = await prisma.businessSettings.upsert({
      where: { businessId },
      create: {
        businessId,
        customFields: customFields ?? undefined,
        enabledModules: enabledModules ?? undefined,
        enabledFeatures: enabledFeatures ?? undefined,
        dashboardLayout: dashboardLayout ?? undefined,
        dashboardTheme: dashboardTheme ?? undefined,
        vertical: vertical ?? undefined,
      },
      update: {
        ...(customFields !== undefined && { customFields }),
        ...(enabledModules !== undefined && { enabledModules }),
        ...(enabledFeatures !== undefined && { enabledFeatures }),
        ...(dashboardLayout !== undefined && { dashboardLayout }),
        ...(dashboardTheme !== undefined && { dashboardTheme }),
        ...(vertical !== undefined && { vertical }),
      },
    });
    ok(res, settings);
  } catch (e) {
    next(e);
  }
});

router.get('/setup-progress', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const [clients, jobs, sentInvoices] = await Promise.all([
      prisma.crmClient.count({ where: { OR: [{ businessId }, { serviceBusinessId: businessId }] } }),
      prisma.booking.count({ where: { businessId } }),
      prisma.invoice.count({ where: { businessId, status: { not: 'draft' } } }),
    ]);
    ok(res, { clients, jobs, deals: 0, openTasks: 0, sentInvoices });
  } catch (e) {
    next(e);
  }
});

// ── Jobs (Booking rows) ─────────────────────────────────────────────────────

router.get('/jobs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const where: any = { businessId };
    const status = req.query.status ? String(req.query.status) : undefined;
    if (status) where.status = status;
    const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
    if (clientId) where.clientId = clientId;
    const gte = req.query.scheduledDate_gte ? new Date(String(req.query.scheduledDate_gte)) : undefined;
    const lte = req.query.scheduledDate_lte ? new Date(String(req.query.scheduledDate_lte)) : undefined;
    if (gte || lte) where.slotStart = { ...(gte && { gte }), ...(lte && { lte }) };
    const search = String(req.query.search ?? '').trim();
    if (search) {
      where.OR = [
        { serviceType: { contains: search, mode: 'insensitive' } },
        { client: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    const sortBy = String(req.query.sortBy ?? 'slotStart');
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));

    const [jobs, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { client: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    const shaped = jobs.map((job) => ({
      id: job.id,
      clientId: job.clientId,
      clientName: job.client?.name ?? 'Guest',
      serviceType: job.serviceType,
      scheduledDate: job.slotStart,
      scheduledTime: job.slotStart.toISOString().slice(11, 16),
      endTime: job.slotEnd.toISOString().slice(11, 16),
      durationMinutes: Math.max(0, Math.round((job.slotEnd.getTime() - job.slotStart.getTime()) / 60000)),
      address: job.clientAddress ?? '',
      price: job.depositAmount ?? 0,
      status: job.status,
      createdAt: job.createdAt,
    }));
    ok(res, shaped, { pagination: { page, limit, total } });
  } catch (e) {
    next(e);
  }
});

router.post('/jobs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { clientId, serviceType, scheduledDate, scheduledTime, durationMinutes, address, notes, price } = req.body ?? {};
    if (!serviceType || !scheduledDate) throw new CustomError('serviceType and scheduledDate are required', 400);

    const start = new Date(scheduledDate);
    if (Number.isNaN(start.getTime())) throw new CustomError('scheduledDate must be a valid date', 400);
    const duration = Number(durationMinutes ?? 60);
    const end = new Date(start.getTime() + (Number.isFinite(duration) ? duration : 60) * 60000);

    const job = await prisma.booking.create({
      data: {
        businessId,
        clientId: clientId ?? null,
        serviceType: String(serviceType),
        slotStart: start,
        slotEnd: end,
        clientAddress: address ? String(address) : null,
        depositAmount: Number(price ?? 0),
        status: 'pending',
        metadata: notes ? { notes: String(notes) } : undefined,
      },
      include: { client: true },
    });
    ok(res, job);
  } catch (e) {
    next(e);
  }
});

router.get('/jobs/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const job = await prisma.booking.findFirst({ where: { id: req.params.id, businessId }, include: { client: true } });
    if (!job) throw new CustomError('Job not found', 404);
    ok(res, job);
  } catch (e) {
    next(e);
  }
});

router.patch('/jobs/:id/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { status } = req.body ?? {};
    if (!status) throw new CustomError('status is required', 400);
    const job = await prisma.booking.findFirst({ where: { id: req.params.id, businessId }, select: { id: true } });
    if (!job) throw new CustomError('Job not found', 404);
    const updated = await prisma.booking.update({ where: { id: job.id }, data: { status: String(status) } });
    ok(res, updated);
  } catch (e) {
    next(e);
  }
});

router.post('/jobs/:id/checkin', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const job = await prisma.booking.findFirst({ where: { id: req.params.id, businessId }, select: { id: true } });
    if (!job) throw new CustomError('Job not found', 404);
    const updated = await prisma.booking.update({ where: { id: job.id }, data: { status: 'confirmed' } });
    ok(res, updated);
  } catch (e) {
    next(e);
  }
});

router.post('/jobs/:id/checkout', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const job = await prisma.booking.findFirst({ where: { id: req.params.id, businessId }, select: { id: true } });
    if (!job) throw new CustomError('Job not found', 404);
    const updated = await prisma.booking.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    ok(res, updated);
  } catch (e) {
    next(e);
  }
});

router.post('/jobs/:id/noshow', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const job = await prisma.booking.findFirst({ where: { id: req.params.id, businessId }, select: { id: true } });
    if (!job) throw new CustomError('Job not found', 404);
    const updated = await prisma.booking.update({ where: { id: job.id }, data: { status: 'cancelled' } });
    ok(res, updated);
  } catch (e) {
    next(e);
  }
});

router.post('/jobs/:id/assign', (_req: AuthRequest, res: Response) => {
  ok(res, { assigned: false, reason: 'employees are not available in this deployment' });
});

router.delete('/jobs/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const job = await prisma.booking.findFirst({ where: { id: req.params.id, businessId }, select: { id: true } });
    if (!job) throw new CustomError('Job not found', 404);
    await prisma.booking.delete({ where: { id: job.id } });
    ok(res, { id: job.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// ── Invoices ────────────────────────────────────────────────────────────────

router.get('/invoices', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const where: any = { businessId };
    const status = req.query.status ? String(req.query.status) : undefined;
    if (status) where.status = status;
    const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
    if (clientId) where.clientId = clientId;
    const invoices = await prisma.invoice.findMany({ where, orderBy: { createdAt: 'desc' } });
    ok(res, invoices);
  } catch (e) {
    next(e);
  }
});

router.get('/invoices/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, businessId } });
    if (!invoice) throw new CustomError('Invoice not found', 404);
    ok(res, invoice);
  } catch (e) {
    next(e);
  }
});

router.post('/invoices', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { clientId, number, dateDue, lineItems, subtotal, notes } = req.body ?? {};
    if (!clientId) throw new CustomError('clientId is required', 400);
    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        clientId: String(clientId),
        number: String(number ?? `INV-${Date.now()}`),
        dateDue: dateDue ? new Date(dateDue) : new Date(),
        lineItems: lineItems ?? [],
        subtotal: Number(subtotal ?? 0),
        notes: notes ? String(notes) : null,
        status: 'draft',
      },
    });
    ok(res, invoice);
  } catch (e) {
    next(e);
  }
});

router.patch('/invoices/:id/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { status } = req.body ?? {};
    if (!status) throw new CustomError('status is required', 400);
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, businessId }, select: { id: true } });
    if (!invoice) throw new CustomError('Invoice not found', 404);
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: String(status),
        ...(status === 'paid' || status === 'PAID' ? { paidAt: new Date() } : {}),
      },
    });
    ok(res, updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/invoices/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, businessId }, select: { id: true } });
    if (!invoice) throw new CustomError('Invoice not found', 404);
    await prisma.invoice.delete({ where: { id: invoice.id } });
    ok(res, { id: invoice.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// ── Expenses (real table) ───────────────────────────────────────────────────

router.get('/expenses', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const expenses = await prisma.crmExpense.findMany({
      where: { OR: [{ businessId }, { serviceBusinessId: businessId }] },
      orderBy: { date: 'desc' },
    });
    ok(res, expenses);
  } catch (e) {
    next(e);
  }
});

router.post('/expenses', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { category, amount, description, vendor, date } = req.body ?? {};
    if (!category || !amount || !description) throw new CustomError('category, amount, and description are required', 400);
    const expense = await prisma.crmExpense.create({
      data: {
        businessId,
        serviceBusinessId: businessId,
        category: String(category),
        amount: Number(amount),
        description: String(description),
        vendor: vendor ? String(vendor) : null,
        date: date ? new Date(date) : new Date(),
      },
    });
    ok(res, expense);
  } catch (e) {
    next(e);
  }
});

// ── Search ──────────────────────────────────────────────────────────────────

router.get('/search', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const q = String(req.query.q ?? '').trim();
    if (!q) return ok(res, []);
    const clients = await prisma.crmClient.findMany({
      where: {
        OR: [{ businessId }, { serviceBusinessId: businessId }],
        AND: [
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      take: 20,
    });
    ok(res, clients);
  } catch (e) {
    next(e);
  }
});

// ── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const [clients, jobs, invoices, expenses] = await Promise.all([
      prisma.crmClient.count({ where: { OR: [{ businessId }, { serviceBusinessId: businessId }] } }),
      prisma.booking.count({ where: { businessId } }),
      prisma.invoice.count({ where: { businessId, status: 'paid' } }),
      prisma.crmExpense.aggregate({ where: { OR: [{ businessId }, { serviceBusinessId: businessId }] }, _sum: { amount: true } }),
    ]);
    ok(res, {
      activeClients: clients,
      totalJobs: jobs,
      paidInvoices: invoices,
      monthlyExpenses: expenses._sum.amount ?? 0,
    });
  } catch (e) {
    next(e);
  }
});

// ── Stubs for tables that do not exist in this deployment ───────────────────

const empty = (_req: AuthRequest, res: Response) => ok(res, []);

router.get('/deals', empty);
router.post('/deals', (_req: AuthRequest, res: Response) => ok(res, { id: null, stub: true }));
router.get('/deals/:id', (_req: AuthRequest, res: Response) => {
  throw new CustomError('Deal not found', 404);
});
router.patch('/deals/:id', (_req: AuthRequest, res: Response) => ok(res, { id: null, stub: true }));
router.delete('/deals/:id', (_req: AuthRequest, res: Response) => ok(res, { deleted: true }));

router.get('/activities', empty);
router.post('/activities', (_req: AuthRequest, res: Response) => ok(res, { id: null, stub: true }));

router.get('/tasks', empty);
router.post('/tasks', (_req: AuthRequest, res: Response) => ok(res, { id: null, stub: true }));

router.get('/files', empty);

router.get('/alerts', empty);
router.post('/alerts/:id/dismiss', (_req: AuthRequest, res: Response) => ok(res, { dismissed: true }));

router.get('/employees', empty);
router.post('/employees', (_req: AuthRequest, res: Response) => ok(res, { id: null, stub: true }));
router.put('/employees/:id', (_req: AuthRequest, res: Response) => ok(res, { id: null, stub: true }));
router.delete('/employees/:id', (_req: AuthRequest, res: Response) => ok(res, { deleted: true }));

router.get('/payroll', empty);
router.post('/payroll', (_req: AuthRequest, res: Response) => ok(res, { id: null, stub: true }));

router.get('/quotes', empty);
router.post('/quotes', (_req: AuthRequest, res: Response) => ok(res, { id: null, stub: true }));

router.post('/enroll', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    ok(res, { enrolled: true, businessId: crm.businessId });
  } catch (e) {
    next(e);
  }
});

export default router;
