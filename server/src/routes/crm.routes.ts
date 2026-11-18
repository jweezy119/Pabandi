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

// ── Deals ───────────────────────────────────────────────────────────────────

router.get('/deals', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const where: any = { OR: [{ businessId }, { serviceBusinessId: businessId }] };
    const stage = req.query.stage ? String(req.query.stage) : undefined;
    if (stage) where.stage = stage;
    const search = String(req.query.search ?? '').trim();
    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }
    const deals = await prisma.crmDeal.findMany({
      where,
      orderBy: [{ stage: 'asc' }, { createdAt: 'desc' }],
    });
    ok(res, deals);
  } catch (e) {
    next(e);
  }
});

router.post('/deals', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { title, value, stage, probability, expectedCloseDate, notes, clientId, ownerName, lostReason } = req.body ?? {};
    if (!title || !String(title).trim()) throw new CustomError('title is required', 400);
    const deal = await prisma.crmDeal.create({
      data: {
        title: String(title).trim(),
        value: Number(value ?? 0),
        stage: stage ? String(stage) : 'LEAD',
        probability: Number(probability ?? 10),
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        notes: notes ? String(notes) : null,
        clientId: clientId ? String(clientId) : null,
        ownerName: ownerName ? String(ownerName) : null,
        lostReason: lostReason ? String(lostReason) : null,
        serviceBusinessId: businessId,
        ...(stage === 'WON' || stage === 'LOST' ? { closedAt: new Date() } : {}),
      },
    });
    ok(res, deal);
  } catch (e) {
    next(e);
  }
});

router.get('/deals/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const deal = await prisma.crmDeal.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
    });
    if (!deal) throw new CustomError('Deal not found', 404);
    ok(res, deal);
  } catch (e) {
    next(e);
  }
});

router.patch('/deals/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmDeal.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Deal not found', 404);
    const { title, value, stage, probability, expectedCloseDate, notes, clientId, ownerName, lostReason } = req.body ?? {};
    const patch: any = {};
    if (title !== undefined) patch.title = String(title).trim();
    if (value !== undefined) patch.value = Number(value);
    if (stage !== undefined) {
      patch.stage = String(stage);
      if (stage === 'WON' || stage === 'LOST') patch.closedAt = new Date();
    }
    if (probability !== undefined) patch.probability = Number(probability);
    if (expectedCloseDate !== undefined) patch.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
    if (notes !== undefined) patch.notes = notes ? String(notes) : null;
    if (clientId !== undefined) patch.clientId = clientId ? String(clientId) : null;
    if (ownerName !== undefined) patch.ownerName = ownerName ? String(ownerName) : null;
    if (lostReason !== undefined) patch.lostReason = lostReason ? String(lostReason) : null;
    const deal = await prisma.crmDeal.update({ where: { id: existing.id }, data: patch });
    ok(res, deal);
  } catch (e) {
    next(e);
  }
});

router.delete('/deals/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmDeal.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Deal not found', 404);
    await prisma.crmDeal.delete({ where: { id: existing.id } });
    ok(res, { id: existing.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

router.post('/import/deals', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const csvData = String(req.body?.csvData ?? '');
    if (!csvData.trim()) throw new CustomError('csvData is required', 400);
    const rows = csvData.split(/\r?\n/).map((line) => line.split(','));
    if (rows.length < 2) throw new CustomError('CSV needs a header row and at least one data row', 400);
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const titleIdx = header.indexOf('title');
    if (titleIdx === -1) throw new CustomError('CSV must have a "title" column', 400);
    const imported: any[] = [];
    for (const row of rows.slice(1)) {
      const title = (row[titleIdx] ?? '').trim();
      if (!title) continue;
      const cell = (name: string) => {
        const i = header.indexOf(name);
        return i === -1 ? '' : (row[i] ?? '').trim();
      };
      imported.push(
        await prisma.crmDeal.create({
          data: {
            title,
            value: Number(cell('value') || 0),
            stage: cell('stage') || 'LEAD',
            probability: Number(cell('probability') || 10),
            expectedCloseDate: cell('expectedclosedate') ? new Date(cell('expectedclosedate')) : null,
            notes: cell('notes') || null,
            serviceBusinessId: businessId,
          },
        }),
      );
    }
    ok(res, { imported: imported.length, skipped: 0, errors: [] });
  } catch (e) {
    next(e);
  }
});

// ── Tasks ───────────────────────────────────────────────────────────────────

router.get('/tasks', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const where: any = { OR: [{ businessId }, { serviceBusinessId: businessId }] };
    const status = req.query.status ? String(req.query.status) : undefined;
    if (status) where.status = status;
    const priority = req.query.priority ? String(req.query.priority) : undefined;
    if (priority) where.priority = priority;
    const tasks = await prisma.crmTask.findMany({ where, orderBy: { createdAt: 'desc' } });
    ok(res, tasks);
  } catch (e) {
    next(e);
  }
});

router.post('/tasks', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { title, description, status, priority, dueDate, clientId, dealId, assignedTo } = req.body ?? {};
    if (!title || !String(title).trim()) throw new CustomError('title is required', 400);
    const task = await prisma.crmTask.create({
      data: {
        title: String(title).trim(),
        description: description ? String(description) : null,
        status: status ? String(status) : 'TODO',
        priority: priority ? String(priority) : 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        clientId: clientId ? String(clientId) : null,
        dealId: dealId ? String(dealId) : null,
        assignedTo: assignedTo ? String(assignedTo) : null,
        serviceBusinessId: businessId,
      },
    });
    ok(res, task);
  } catch (e) {
    next(e);
  }
});

router.get('/tasks/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const task = await prisma.crmTask.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
    });
    if (!task) throw new CustomError('Task not found', 404);
    ok(res, task);
  } catch (e) {
    next(e);
  }
});

router.patch('/tasks/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmTask.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Task not found', 404);
    const { title, description, status, priority, dueDate, clientId, dealId, assignedTo } = req.body ?? {};
    const patch: any = {};
    if (title !== undefined) patch.title = String(title).trim();
    if (description !== undefined) patch.description = description ? String(description) : null;
    if (status !== undefined) patch.status = String(status);
    if (priority !== undefined) patch.priority = String(priority);
    if (dueDate !== undefined) patch.dueDate = dueDate ? new Date(dueDate) : null;
    if (clientId !== undefined) patch.clientId = clientId ? String(clientId) : null;
    if (dealId !== undefined) patch.dealId = dealId ? String(dealId) : null;
    if (assignedTo !== undefined) patch.assignedTo = assignedTo ? String(assignedTo) : null;
    const task = await prisma.crmTask.update({ where: { id: existing.id }, data: patch });
    ok(res, task);
  } catch (e) {
    next(e);
  }
});

router.delete('/tasks/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmTask.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Task not found', 404);
    await prisma.crmTask.delete({ where: { id: existing.id } });
    ok(res, { id: existing.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// ── Activities ──────────────────────────────────────────────────────────────

router.get('/activities', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const where: any = { OR: [{ businessId }, { serviceBusinessId: businessId }] };
    const type = req.query.type ? String(req.query.type) : undefined;
    if (type && type !== 'ALL') where.type = type;
    const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
    if (clientId) where.clientId = clientId;
    const activities = await prisma.crmActivity.findMany({ where, orderBy: { createdAt: 'desc' } });
    ok(res, activities);
  } catch (e) {
    next(e);
  }
});

router.post('/activities', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { type, description, clientId, dealId } = req.body ?? {};
    const activity = await prisma.crmActivity.create({
      data: {
        type: type ? String(type) : 'NOTE',
        description: description ? String(description) : null,
        clientId: clientId ? String(clientId) : null,
        dealId: dealId ? String(dealId) : null,
        serviceBusinessId: businessId,
      },
    });
    ok(res, activity);
  } catch (e) {
    next(e);
  }
});

router.get('/activities/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const activity = await prisma.crmActivity.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
    });
    if (!activity) throw new CustomError('Activity not found', 404);
    ok(res, activity);
  } catch (e) {
    next(e);
  }
});

router.delete('/activities/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmActivity.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Activity not found', 404);
    await prisma.crmActivity.delete({ where: { id: existing.id } });
    ok(res, { id: existing.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// ── Files ───────────────────────────────────────────────────────────────────

router.get('/files', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const where: any = { OR: [{ businessId }, { serviceBusinessId: businessId }] };
    const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
    if (clientId) where.clientId = clientId;
    const files = await prisma.crmFile.findMany({ where, orderBy: { createdAt: 'desc' } });
    ok(res, files);
  } catch (e) {
    next(e);
  }
});

router.post('/files', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { name, url, clientId } = req.body ?? {};
    if (!name || !url) throw new CustomError('name and url are required', 400);
    const file = await prisma.crmFile.create({
      data: {
        name: String(name),
        url: String(url),
        clientId: clientId ? String(clientId) : null,
        serviceBusinessId: businessId,
      },
    });
    ok(res, file);
  } catch (e) {
    next(e);
  }
});

router.get('/files/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const file = await prisma.crmFile.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
    });
    if (!file) throw new CustomError('File not found', 404);
    ok(res, file);
  } catch (e) {
    next(e);
  }
});

router.delete('/files/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmFile.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
      select: { id: true },
    });
    if (!existing) throw new CustomError('File not found', 404);
    await prisma.crmFile.delete({ where: { id: existing.id } });
    ok(res, { id: existing.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// ── Employees ───────────────────────────────────────────────────────────────

router.get('/employees', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const employees = await prisma.crmEmployee.findMany({
      where: { OR: [{ businessId }, { serviceBusinessId: businessId }] },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, employees);
  } catch (e) {
    next(e);
  }
});

router.post('/employees', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { name, email, phone, role, payRate, payType } = req.body ?? {};
    if (!name || !role) throw new CustomError('name and role are required', 400);
    const employee = await prisma.crmEmployee.create({
      data: {
        name: String(name),
        email: email ? String(email) : null,
        phone: phone ? String(phone) : null,
        role: String(role),
        payRate: Number(payRate ?? 0),
        payType: payType ? String(payType) : 'HOURLY',
        businessId,
        serviceBusinessId: businessId,
      },
    });
    ok(res, employee);
  } catch (e) {
    next(e);
  }
});

router.put('/employees/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmEmployee.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Employee not found', 404);
    const { name, email, phone, role, payRate, payType, isActive } = req.body ?? {};
    const patch: any = {};
    if (name !== undefined) patch.name = String(name);
    if (email !== undefined) patch.email = email ? String(email) : null;
    if (phone !== undefined) patch.phone = phone ? String(phone) : null;
    if (role !== undefined) patch.role = String(role);
    if (payRate !== undefined) patch.payRate = Number(payRate);
    if (payType !== undefined) patch.payType = String(payType);
    if (isActive !== undefined) patch.isActive = Boolean(isActive);
    const employee = await prisma.crmEmployee.update({ where: { id: existing.id }, data: patch });
    ok(res, employee);
  } catch (e) {
    next(e);
  }
});

router.delete('/employees/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmEmployee.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Employee not found', 404);
    await prisma.crmEmployee.delete({ where: { id: existing.id } });
    ok(res, { id: existing.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// ── Payroll ─────────────────────────────────────────────────────────────────

router.get('/payroll', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const where: any = { OR: [{ businessId }, { serviceBusinessId: businessId }] };
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;
    if (employeeId) where.employeeId = employeeId;
    const payroll = await prisma.crmPayroll.findMany({ where, orderBy: { createdAt: 'desc' } });
    ok(res, payroll);
  } catch (e) {
    next(e);
  }
});

router.post('/payroll', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { employeeId, periodStart, periodEnd, hoursWorked, jobsCompleted, grossPay, deductions, netPay } = req.body ?? {};
    if (!employeeId || !periodStart || !periodEnd || grossPay == null || netPay == null) {
      throw new CustomError('employeeId, periodStart, periodEnd, grossPay, and netPay are required', 400);
    }
    const payroll = await prisma.crmPayroll.create({
      data: {
        employeeId: String(employeeId),
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        hoursWorked: Number(hoursWorked ?? 0),
        jobsCompleted: Number(jobsCompleted ?? 0),
        grossPay: Number(grossPay),
        deductions: Number(deductions ?? 0),
        netPay: Number(netPay),
        businessId,
        serviceBusinessId: businessId,
      },
    });
    ok(res, payroll);
  } catch (e) {
    next(e);
  }
});

router.patch('/payroll/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmPayroll.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Payroll not found', 404);
    const { status, paidAt } = req.body ?? {};
    const patch: any = {};
    if (status !== undefined) patch.status = String(status);
    if (paidAt !== undefined) patch.paidAt = paidAt ? new Date(paidAt) : null;
    const payroll = await prisma.crmPayroll.update({ where: { id: existing.id }, data: patch });
    ok(res, payroll);
  } catch (e) {
    next(e);
  }
});

router.delete('/payroll/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmPayroll.findFirst({
      where: { id: req.params.id, OR: [{ businessId }, { serviceBusinessId: businessId }] },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Payroll not found', 404);
    await prisma.crmPayroll.delete({ where: { id: existing.id } });
    ok(res, { id: existing.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// ── Alerts ──────────────────────────────────────────────────────────────────

router.get('/alerts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const alerts = await prisma.crmAlert.findMany({
      where: { serviceBusinessId: businessId, dismissed: false },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, alerts);
  } catch (e) {
    next(e);
  }
});

router.post('/alerts/:id/dismiss', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const existing = await prisma.crmAlert.findFirst({
      where: { id: req.params.id, serviceBusinessId: businessId },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Alert not found', 404);
    await prisma.crmAlert.update({ where: { id: existing.id }, data: { dismissed: true, dismissedAt: new Date() } });
    ok(res, { dismissed: true });
  } catch (e) {
    next(e);
  }
});

// ── Quotes (stub — no table yet) ────────────────────────────────────────────

router.get('/quotes', (_req: AuthRequest, res: Response) => ok(res, []));
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
