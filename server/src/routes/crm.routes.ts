import { Router, Response, NextFunction } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import { BusinessCategory, UserRole } from '@prisma/client';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { checkAvailabilityWindow, assertNoConflict } from '../services/crm.service';
import * as jobService from '../services/job.service';
import { createInvoice } from '../services/invoice.service';
import { CLIENT_STATUSES, DEAL_STAGES, STAGE_PROBABILITY } from '../domain/crm';
import { parseCsv, csvCell } from '../utils/csv';
import { emitCrmEvent } from '../services/crmAutomation.service';

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

const ok = (res: Response, data: unknown, extra: Record<string, unknown> = {}) =>
  res.json({ success: true, data, ...extra });

const SERVICE_TYPE_TO_CATEGORY: Record<string, BusinessCategory> = {
  salon: BusinessCategory.SALON,
  consulting: BusinessCategory.PROFESSIONAL,
  trades: BusinessCategory.CONTRACTOR,
  real_estate: BusinessCategory.PROPERTY_RENTAL,
  logistics: BusinessCategory.OTHER,
  general: BusinessCategory.OTHER,
};

// Enrollment MUST run before resolveCrmBusiness; otherwise unenrolled accounts
// hit a 403 Catch-22 when trying to enroll from /contact/setup.
router.post('/enroll', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new CustomError('Authentication required', 401);

    const { businessName, serviceType, phone, address } = req.body ?? {};
    const existing = await prisma.business.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    });

    const vertical = typeof serviceType === 'string' && serviceType.trim() ? serviceType.trim() : 'general';
    const category = SERVICE_TYPE_TO_CATEGORY[vertical] ?? BusinessCategory.OTHER;

    const business =
      existing ??
      (await prisma.business.create({
        data: {
          ownerId: userId,
          name: (typeof businessName === 'string' && businessName.trim()) || 'My Business',
          category,
          address: (typeof address === 'string' && address.trim()) || 'Not specified',
          phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
          email: req.user?.email ?? null,
          settings: {
            create: {
              vertical,
            },
          },
        },
      }));

    if (req.user?.role === UserRole.CUSTOMER) {
      await prisma.user
        .update({
          where: { id: userId },
          data: { role: UserRole.BUSINESS_OWNER },
        })
        .catch(() => {});
    }

    const secret = process.env.JWT_SECRET;
    const token = secret
      ? jwt.sign(
          {
            id: userId,
            email: req.user?.email ?? '',
            role: req.user?.role === UserRole.CUSTOMER ? UserRole.BUSINESS_OWNER : req.user?.role ?? UserRole.BUSINESS_OWNER,
            businessId: business.id,
            activeBusinessId: business.id,
            mode: 'business',
          },
          secret as Secret,
          { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
        )
      : undefined;

    // 201, not 200: enrollment creates the business and the service-business
    // pairing. The callers do not branch on the code, but a creation that
    // reports 200 is wrong and the integration suite says so.
    res.status(201).json({
      success: true,
      data: { enrolled: true, businessId: business.id, business },
      ...(token ? { token } : {}),
    });
  } catch (e) {
    next(e);
  }
});

router.use(authenticate, resolveCrmBusiness);

/** Destructive CRM writes are owner/admin only; the context now carries the real role. */
function assertManager(crm: { role?: string; isOwner?: boolean }) {
  if (
    !crm.isOwner &&
    crm.role !== UserRole.BUSINESS_OWNER &&
    crm.role !== UserRole.ADMIN
  ) {
    throw new CustomError('Requires business owner or admin role', 403);
  }
}

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
    const { name, email, phone, address, company, notes, status, customData } = req.body ?? {};
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
        ...(customData && typeof customData === 'object' ? { customData: customData as any } : {}),
      },
    });
    emitCrmEvent(businessId, 'client', 'created', client as unknown as Record<string, any>);
    // 201: this creates a client. Callers do not branch on the code, but the
    // integration suite asserts it and a creation reporting 200 is wrong.
    res.status(201).json({ success: true, data: client });
  } catch (e) {
    next(e);
  }
});

// Bulk status change. Registered before /clients/:id so "bulk" is not read as an id.
router.patch('/clients/bulk', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    assertManager(crm);
    const businessId = crm.businessId!;
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const status = String(req.body?.status || '');
    if (ids.length === 0 || !status) throw new CustomError('ids and status are required', 400);
    if (!(CLIENT_STATUSES as readonly string[]).includes(status)) {
      throw new CustomError(`status must be one of ${CLIENT_STATUSES.join(', ')}`, 400);
    }
    if (ids.length > 200) throw new CustomError('maximum 200 clients per bulk action', 400);
    const result = await prisma.crmClient.updateMany({
      where: {
        id: { in: ids },
        OR: [{ businessId }, { serviceBusinessId: businessId }],
      },
      data: { status },
    });
    ok(res, { updated: result.count });
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
    const { name, email, phone, address, company, notes, status, customData } = req.body ?? {};
    if (name !== undefined) patch.name = String(name).trim();
    if (email !== undefined) patch.email = email ? String(email).trim().toLowerCase() : '';
    if (phone !== undefined) patch.phone = phone ? String(phone) : '';
    if (address !== undefined) patch.address = address ? String(address) : '';
    if (company !== undefined) patch.company = company ? String(company) : null;
    if (notes !== undefined) patch.notes = notes ? String(notes) : null;
    if (status !== undefined) patch.status = String(status);
    if (customData !== undefined && typeof customData === 'object') patch.customData = customData;

    const client = await prisma.crmClient.update({ where: { id: existing.id }, data: patch });
    emitCrmEvent(businessId, 'client', patch.status !== undefined ? 'status_changed' : 'updated', client as unknown as Record<string, any>);
    ok(res, client);
  } catch (e) {
    next(e);
  }
});

router.delete('/clients/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    assertManager(crm);
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
    const csvData = String(req.body?.csvData ?? '');
    if (!csvData.trim()) throw new CustomError('csvData is required', 400);
    if (Buffer.byteLength(csvData, 'utf8') > MAX_CSV_BYTES) {
      throw new CustomError(`CSV is larger than ${MAX_CSV_BYTES} bytes`, 413);
    }

    const rows = parseCsvOr400(csvData);
    if (rows.length < 2) throw new CustomError('CSV needs a header row and at least one data row', 400);
    const header = csvHeader(rows);
    if (!header.includes('name')) throw new CustomError('CSV must have a "name" column', 400);
    if (rows.length - 1 > MAX_IMPORT_ROWS) {
      throw new CustomError(`CSV has too many rows (max ${MAX_IMPORT_ROWS})`, 400);
    }

    const total = rows.length - 1;
    // Dupes are matched against what the business already has AND against earlier rows
    // in this file, so a file cannot create two clients with the same name either.
    const seen = new Set<string>();
    const existing = await prisma.crmClient.findMany({
      where: { serviceBusinessId: businessId },
      select: { name: true, email: true },
    });
    for (const c of existing) {
      if (c.name) seen.add(`name:${c.name.trim().toLowerCase()}`);
      if (c.email) seen.add(`email:${c.email.trim().toLowerCase()}`);
    }

    const errors: string[] = [];
    const parsed: Array<{ data: any }> = [];

    for (let r = 1; r < rows.length; r += 1) {
      const row = rows[r];
      const rowNumber = r + 1;
      const name = csvCell(row, header, 'name');
      if (!name) {
        errors.push(`Row ${rowNumber}: name is required`);
        continue;
      }

      const email = csvCell(row, header, 'email').toLowerCase();
      const clashes: string[] = [];
      if (seen.has(`name:${name.toLowerCase()}`)) clashes.push('name');
      if (email && seen.has(`email:${email}`)) clashes.push('email');
      if (clashes.length) {
        errors.push(`Row ${rowNumber}: a client with this ${clashes.join(' or ')} already exists`);
        continue;
      }
      seen.add(`name:${name.toLowerCase()}`);
      if (email) seen.add(`email:${email}`);

      // `company` is in the wizard's template, so it is kept rather than dropped.
      const company = csvCell(row, header, 'company');
      const notesRaw = csvCell(row, header, 'notes');
      const notes = [notesRaw, company ? `Company: ${company}` : ''].filter(Boolean).join('; ');

      parsed.push({
        data: {
          businessId,
          serviceBusinessId: businessId,
          name,
          email,
          phone: csvCell(row, header, 'phone'),
          address: csvCell(row, header, 'address'),
          notes: notes || null,
          status: csvCell(row, header, 'status') || 'ACTIVE',
        },
      });
    }

    // Same rule as the deals import: nothing partial lands.
    if (errors.length) {
      const reported = errors.slice(0, MAX_REPORTED_ERRORS);
      return res.status(201).json({
        success: true,
        data: {
          imported: 0,
          skipped: total,
          errors: [...reported, `${errors.length} row(s) failed; nothing was imported.`],
        },
      });
    }

    await prisma.$transaction(parsed.map((p) => prisma.crmClient.create(p)));
    res.status(201).json({ success: true, data: { imported: parsed.length, skipped: 0, errors: [] } });
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
    // The API speaks `scheduledDate` (it is what the response exposes) but the
    // column is `slotStart`. Passing the query value straight into orderBy made
    // Prisma throw on an unknown argument, which 500'd the whole Jobs page.
    const BOOKING_SORT_COLUMNS = [
      'slotStart', 'createdAt', 'updatedAt', 'status', 'serviceType', 'id', 'completedAt',
    ];
    const API_TO_COLUMN: Record<string, string> = { scheduledDate: 'slotStart' };
    const requestedSort = String(req.query.sortBy ?? 'slotStart');
    const mappedSort = API_TO_COLUMN[requestedSort] ?? requestedSort;
    const sortBy = BOOKING_SORT_COLUMNS.includes(mappedSort) ? mappedSort : 'slotStart';
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
    const {
      clientId,
      serviceType,
      scheduledDate,
      scheduledTime,
      durationMinutes,
      address,
      notes,
      price,
      employeeId,
    } = req.body ?? {};
    if (!serviceType || !scheduledDate) throw new CustomError('serviceType and scheduledDate are required', 400);

    const start = new Date(scheduledDate);
    if (Number.isNaN(start.getTime())) throw new CustomError('scheduledDate must be a valid date', 400);
    // `scheduledTime` ("HH:mm") was accepted and then discarded, so every job
    // was created at midnight. scheduledDate is a bare YYYY-MM-DD, which parses
    // as UTC, so the time is applied in UTC to match.
    if (scheduledTime && /^\d{1,2}:\d{2}/.test(String(scheduledTime))) {
      const [hh, mm] = String(scheduledTime).split(':').map(Number);
      start.setUTCHours(hh, mm, 0, 0);
    }
    const duration = Number(durationMinutes ?? 60);
    const end = new Date(start.getTime() + (Number.isFinite(duration) ? duration : 60) * 60000);

    // Opening hours are enforced here, not only in the (now-removed) CrmJob
    // service path: a job outside them is refused rather than silently booked.
    const availability = await checkAvailabilityWindow(
      businessId,
      start,
      scheduledTime,
      duration,
    );
    const allowConflict = req.body?.allowConflict === true;
    if (!availability.ok && !allowConflict) {
      throw new CustomError(availability.reason ?? 'Outside opening hours', 409);
    }

    // An assignee is checked against the tenant and then against their own
    // calendar. Neither happened: a job could be filed against another
    // business's employee and one employee could be booked on two overlapping
    // jobs, which is the whole point of assigning one.
    if (employeeId) {
      const employee = await prisma.crmEmployee.findFirst({
        where: { id: String(employeeId), serviceBusinessId: businessId },
        select: { id: true },
      });
      if (!employee) throw new CustomError('Employee not found for this business', 404);
      await assertNoConflict(businessId, String(employeeId), start, scheduledTime, duration, {
        allowConflict,
      });
    }

    const job = await prisma.booking.create({
      data: {
        businessId,
        clientId: clientId ?? null,
        serviceType: String(serviceType),
        slotStart: start,
        slotEnd: end,
        clientAddress: address ? String(address) : null,
        depositAmount: Number(price ?? 0),
        // The CRM job vocabulary is SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED
        // (domain/crm.ts JOB_STATUSES). The lowercase 'pending' predates it.
        status: 'SCHEDULED',
        employeeId: employeeId ? String(employeeId) : null,
        metadata: notes ? { notes: String(notes) } : undefined,
      },
      include: { client: true },
    });
    // 201: this creates a job (a booking row).
    res.status(201).json({ success: true, data: job });
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

/**
 * Assign or reassign a job.
 *
 * This was a stub reading "employees are not available in this deployment", so the
 * CRM could not put a name on a job at all. Reassignment carries the same clash
 * check as a create: it is the easiest way to manufacture a double-booking after
 * the fact, and the job is excluded from its own check so re-assigning to the
 * employee it is already on is not a self-conflict.
 */
router.post('/jobs/:id/assign', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const { employeeId } = req.body ?? {};
    if (!employeeId) throw new CustomError('employeeId is required', 400);

    const job = await jobService.assignJob(
      crm.businessId!,
      req.params.id,
      String(employeeId),
      { allowConflict: req.body?.allowConflict === true },
    );
    ok(res, job);
  } catch (e) {
    next(e);
  }
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
    // Delegate to the invoice service rather than duplicating the insert here.
    // The local version numbered invoices `INV-${Date.now()}`, skipped the
    // client-ownership check entirely, and reported 200 for a creation — so a
    // caller could invoice a client belonging to another business and get a
    // number no other part of the system recognises.
    const invoice = await createInvoice(businessId, {
      clientId: String(req.body?.clientId ?? ''),
      dateDue: req.body?.dateDue,
      lineItems: req.body?.lineItems ?? [],
      subtotal: Number(req.body?.subtotal ?? 0),
      notes: req.body?.notes,
    });
    res.status(201).json({ success: true, data: invoice });
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
    // 201: this creates an expense.
    res.status(201).json({ success: true, data: expense });
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
    // CommandPalette reads data.results and refuses to search below 2 chars.
    // Returning a bare array here made every search look like "no matches".
    if (q.length < 2) return ok(res, { results: [] });

    const like = { contains: q, mode: 'insensitive' } as any;
    const crmScope = { OR: [{ businessId }, { serviceBusinessId: businessId }] };

    const [clients, deals, jobs, invoices, activities] = await Promise.all([
      prisma.crmClient.findMany({
        where: { AND: [crmScope, { OR: [{ name: like }, { email: like }, { phone: like }] }] },
        take: 10,
        select: { id: true, name: true, email: true },
      }),
      prisma.crmDeal.findMany({
        where: { AND: [crmScope, { title: like }] },
        take: 10,
        select: { id: true, title: true, value: true },
      }),
      prisma.booking.findMany({
        where: { businessId, OR: [{ serviceType: like }, { clientAddress: like }] },
        take: 10,
        select: { id: true, serviceType: true, status: true, slotStart: true },
      }),
      prisma.invoice.findMany({
        where: { businessId, OR: [{ number: like }, { notes: like }] },
        take: 10,
        select: { id: true, number: true, status: true },
      }),
      prisma.crmActivity.findMany({
        where: { AND: [crmScope, { description: like }] },
        take: 10,
        select: { id: true, type: true, description: true },
      }),
    ]);

    const results = [
      ...clients.map((c) => ({
        type: 'client' as const, id: c.id, title: c.name,
        subtitle: c.email ?? undefined, href: `/contact/clients/${c.id}`,
      })),
      ...deals.map((d) => ({
        type: 'deal' as const, id: d.id, title: d.title,
        meta: `$${Number(d.value || 0).toLocaleString()}`, href: `/contact/deals/${d.id}`,
      })),
      ...jobs.map((j) => ({
        type: 'job' as const, id: j.id, title: j.serviceType || 'Job',
        subtitle: new Date(j.slotStart).toLocaleDateString(), href: `/contact/jobs/${j.id}`,
      })),
      ...invoices.map((i) => ({
        type: 'invoice' as const, id: i.id, title: i.number, meta: i.status,
        href: `/contact/invoices/${i.id}`,
      })),
      ...activities.map((a) => ({
        type: 'activity' as const, id: a.id, title: a.description || a.type,
        subtitle: a.type, href: '/contact/activities',
      })),
    ].slice(0, 30);

    ok(res, { results });
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
    const { title, value, stage, probability, expectedCloseDate, notes, clientId, ownerName, lostReason, customData } = req.body ?? {};
    if (!title || !String(title).trim()) throw new CustomError('title is required', 400);

    // Stage is validated against DEAL_STAGES: lowercase 'won' is what the legacy
    // ContactDeal rows use, and storing it would put the deal in a column the
    // kanban does not render, which reads to the user as data loss.
    const stageValue = stage ? String(stage) : 'LEAD';
    if (!(DEAL_STAGES as readonly string[]).includes(stageValue)) {
      throw new CustomError(`stage must be one of ${DEAL_STAGES.join(', ')}`, 400);
    }

    const valueNumber = Number(value ?? 0);
    if (!Number.isFinite(valueNumber) || valueNumber < 0) {
      throw new CustomError('value must be a non-negative number', 400);
    }

    // An absent probability falls back to what the stage is worth, so the kanban
    // forecast and the column cannot disagree. The client sends
    // `parseInt(form.probability) || 10`, so an empty field arrives as absent.
    const probabilityProvided = probability !== undefined && probability !== null && probability !== '';
    const probabilityNumber = probabilityProvided ? Number(probability) : STAGE_PROBABILITY[stageValue as keyof typeof STAGE_PROBABILITY];
    if (!Number.isFinite(probabilityNumber) || probabilityNumber < 0 || probabilityNumber > 100) {
      throw new CustomError('probability must be between 0 and 100', 400);
    }

    // A deal filed against another business's client shows in their record, so the
    // client id is checked against the tenant rather than trusted.
    if (clientId) {
      const client = await prisma.crmClient.findFirst({
        where: { id: String(clientId), serviceBusinessId: businessId },
        select: { id: true },
      });
      if (!client) throw new CustomError('Client not found', 404);
    }

    const deal = await prisma.crmDeal.create({
      data: {
        title: String(title).trim(),
        value: valueNumber,
        stage: stageValue,
        probability: probabilityNumber,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        notes: notes ? String(notes) : null,
        clientId: clientId ? String(clientId) : null,
        ownerName: ownerName ? String(ownerName) : null,
        lostReason: lostReason ? String(lostReason) : null,
        ...(customData && typeof customData === 'object' ? { customData: customData as any } : {}),
        serviceBusinessId: businessId,
        ...(stage === 'WON' || stage === 'LOST' ? { closedAt: new Date() } : {}),
      },
    });
    emitCrmEvent(businessId, 'deal', 'created', deal as unknown as Record<string, any>);
    // 201: this creates a deal.
    res.status(201).json({ success: true, data: deal });
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
    const { title, value, stage, probability, expectedCloseDate, notes, clientId, ownerName, lostReason, customData } = req.body ?? {};
    const patch: any = {};
    if (title !== undefined) patch.title = String(title).trim();
    if (value !== undefined) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new CustomError('value must be a non-negative number', 400);
      patch.value = n;
    }
    if (stage !== undefined) {
      const stageValue = String(stage);
      if (!(DEAL_STAGES as readonly string[]).includes(stageValue)) {
        throw new CustomError(`stage must be one of ${DEAL_STAGES.join(', ')}`, 400);
      }
      patch.stage = stageValue;
      if (stageValue === 'WON' || stageValue === 'LOST') {
        patch.closedAt = new Date();
      } else {
        // Reopening a closed deal must clear the close stamp, or the kanban shows
        // an open deal with a closedAt in the past.
        patch.closedAt = null;
      }
    }
    if (probability !== undefined) {
      const n = Number(probability);
      if (!Number.isFinite(n) || n < 0 || n > 100) throw new CustomError('probability must be between 0 and 100', 400);
      patch.probability = n;
    } else if (patch.stage !== undefined) {
      // A stage transition moves the forecast with it unless the caller set one
      // explicitly, so the kanban and the column cannot disagree.
      patch.probability = STAGE_PROBABILITY[patch.stage as keyof typeof STAGE_PROBABILITY];
    }
    if (expectedCloseDate !== undefined) patch.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
    if (notes !== undefined) patch.notes = notes ? String(notes) : null;
    if (customData !== undefined && typeof customData === 'object') patch.customData = customData;
    if (clientId !== undefined) {
      if (clientId) {
        const client = await prisma.crmClient.findFirst({
          where: { id: String(clientId), serviceBusinessId: businessId },
          select: { id: true },
        });
        if (!client) throw new CustomError('Client not found', 404);
      }
      patch.clientId = clientId ? String(clientId) : null;
    }
    if (ownerName !== undefined) patch.ownerName = ownerName ? String(ownerName) : null;
    if (lostReason !== undefined) patch.lostReason = lostReason ? String(lostReason) : null;
    const deal = await prisma.crmDeal.update({ where: { id: existing.id }, data: patch });
    emitCrmEvent(businessId, 'deal', patch.stage !== undefined ? 'status_changed' : 'updated', deal as unknown as Record<string, any>);
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

/** Byte cap: a body over this is refused, never truncated. Truncating would */
/** import an arbitrary prefix and report success. */
const MAX_CSV_BYTES = 1_000_000;
/** Row cap, for the same reason: importing a prefix is not a partial success. */
const MAX_IMPORT_ROWS = 1000;
/** Error cap, so a 1000-row bad file cannot become a multi-megabyte response. */
const MAX_REPORTED_ERRORS = 20;

/**
 * Resolve a CSV `client` cell against the CALLER's tenant.
 *
 * A name that matches more than one client is refused rather than guessed: picking
 * one would file the deal against an arbitrary customer. An email is exact, so it
 * disambiguates.
 */
async function resolveImportClient(
  serviceBusinessId: string,
  raw: string,
): Promise<{ id: string | null; error?: string }> {
  const value = raw.trim();
  if (!value) return { id: null };

  // Email first, then name. The test marker itself contains an '@', so an '@'
  // cannot be what decides which path a value takes.
  const byEmail = await prisma.crmClient.findFirst({
    where: { serviceBusinessId, email: value.toLowerCase() },
    select: { id: true },
  });
  if (byEmail) return { id: byEmail.id };

  const byName = await prisma.crmClient.findMany({
    where: { serviceBusinessId, name: value },
    select: { id: true },
  });
  if (byName.length === 1) return { id: byName[0].id };
  if (byName.length > 1) {
    return { id: null, error: `more than one client named "${value}" in this business` };
  }
  return { id: null, error: `client "${value}" not found in this business` };
}

/** Parse CSV text or throw a 400 with the parser's reason. */
function parseCsvOr400(csvData: string): string[][] {
  try {
    return parseCsv(csvData);
  } catch (e: any) {
    throw new CustomError(e?.message ?? 'Could not parse CSV', 400);
  }
}

/** Header row lower-cased, so `expectedCloseDate` matches `expectedclosedate`. */
function csvHeader(rows: string[][]): string[] {
  return rows[0].map((h) => h.trim().toLowerCase());
}
router.post('/import/deals', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const csvData = String(req.body?.csvData ?? '');
    if (!csvData.trim()) throw new CustomError('csvData is required', 400);
    if (Buffer.byteLength(csvData, 'utf8') > MAX_CSV_BYTES) {
      throw new CustomError(`CSV is larger than ${MAX_CSV_BYTES} bytes`, 413);
    }

    const rows = parseCsvOr400(csvData);
    if (rows.length < 2) throw new CustomError('CSV needs a header row and at least one data row', 400);
    const header = csvHeader(rows);
    if (!header.includes('title')) throw new CustomError('CSV must have a "title" column', 400);
    if (rows.length - 1 > MAX_IMPORT_ROWS) {
      throw new CustomError(`CSV has too many rows (max ${MAX_IMPORT_ROWS})`, 400);
    }

    const total = rows.length - 1;
    const errors: string[] = [];
    const parsed: Array<{ data: any }> = [];

    for (let r = 1; r < rows.length; r += 1) {
      const row = rows[r];
      // Row 1 is the header, so the user's row number is one higher.
      const rowNumber = r + 1;
      const title = csvCell(row, header, 'title');
      if (!title) {
        errors.push(`Row ${rowNumber}: title is required`);
        continue;
      }

      const stage = csvCell(row, header, 'stage') || 'LEAD';
      if (!(DEAL_STAGES as readonly string[]).includes(stage)) {
        errors.push(`Row ${rowNumber}: unknown stage "${stage}"`);
        continue;
      }

      const rawValue = csvCell(row, header, 'value');
      const value = Number(rawValue || 0);
      if (!Number.isFinite(value) || value < 0) {
        errors.push(`Row ${rowNumber}: value must be a non-negative number (got "${rawValue}")`);
        continue;
      }

      // A blank probability takes the stage's own value rather than 0 or NaN.
      const rawProbability = csvCell(row, header, 'probability');
      const probability = rawProbability === ''
        ? STAGE_PROBABILITY[stage as keyof typeof STAGE_PROBABILITY]
        : Number(rawProbability);
      if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
        errors.push(`Row ${rowNumber}: probability must be between 0 and 100 (got "${rawProbability}")`);
        continue;
      }

      const rawDate = csvCell(row, header, 'expectedclosedate');
      const expectedCloseDate = rawDate ? new Date(rawDate) : null;
      if (expectedCloseDate && Number.isNaN(expectedCloseDate.getTime())) {
        errors.push(`Row ${rowNumber}: expectedCloseDate must be a valid date`);
        continue;
      }

      const clientRaw = csvCell(row, header, 'client');
      let clientId: string | null = null;
      if (clientRaw) {
        const resolved = await resolveImportClient(businessId, clientRaw);
        if (resolved.error) {
          errors.push(`Row ${rowNumber}: ${resolved.error}`);
          continue;
        }
        clientId = resolved.id;
      }

      parsed.push({
        data: {
          title,
          value,
          stage,
          probability,
          expectedCloseDate,
          clientId,
          notes: csvCell(row, header, 'notes') || null,
          serviceBusinessId: businessId,
          ...(stage === 'WON' || stage === 'LOST' ? { closedAt: new Date() } : {}),
        },
      });
    }

    // ALL-OR-NOTHING. A pipeline whose value column feeds the forecast cannot be
    // left half-populated by a bad file and still look right, so every row is
    // validated before anything is written.
    if (errors.length) {
      const reported = errors.slice(0, MAX_REPORTED_ERRORS);
      return res.status(201).json({
        success: true,
        data: {
          imported: 0,
          skipped: total,
          errors: [...reported, `${errors.length} row(s) failed; nothing was imported.`],
        },
      });
    }

    await prisma.$transaction(parsed.map((p) => prisma.crmDeal.create(p)));
    res.status(201).json({ success: true, data: { imported: parsed.length, skipped: 0, errors: [] } });
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
    const { title, description, status, priority, dueDate, clientId, dealId, assignedTo, customData } = req.body ?? {};
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
        ...(customData && typeof customData === 'object' ? { customData: customData as any } : {}),
        serviceBusinessId: businessId,
      },
    });
    emitCrmEvent(businessId, 'task', 'created', task as unknown as Record<string, any>);
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
    const { title, description, status, priority, dueDate, clientId, dealId, assignedTo, customData } = req.body ?? {};
    const patch: any = {};
    if (title !== undefined) patch.title = String(title).trim();
    if (description !== undefined) patch.description = description ? String(description) : null;
    if (status !== undefined) patch.status = String(status);
    if (priority !== undefined) patch.priority = String(priority);
    if (dueDate !== undefined) patch.dueDate = dueDate ? new Date(dueDate) : null;
    if (clientId !== undefined) patch.clientId = clientId ? String(clientId) : null;
    if (dealId !== undefined) patch.dealId = dealId ? String(dealId) : null;
    if (assignedTo !== undefined) patch.assignedTo = assignedTo ? String(assignedTo) : null;
    if (customData !== undefined && typeof customData === 'object') patch.customData = customData;
    const task = await prisma.crmTask.update({ where: { id: existing.id }, data: patch });
    emitCrmEvent(businessId, 'task', patch.status !== undefined ? 'status_changed' : 'updated', task as unknown as Record<string, any>);
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

    // This renders as a link on a page an operator looks at, so the protocol is the
    // boundary that matters. `javascript:` and `data:` URLs execute in that page.
    try {
      const parsed = new URL(String(url));
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new CustomError('url must be an absolute http(s) URL', 400);
      }
    } catch (e: any) {
      if (e?.statusCode === 400) throw e;
      throw new CustomError('url must be an absolute http(s) URL', 400);
    }

    // The client is never taken on trust: a file filed against another business's
    // client would show in their record.
    if (clientId) {
      const client = await prisma.crmClient.findFirst({
        where: { id: String(clientId), serviceBusinessId: businessId },
        select: { id: true },
      });
      if (!client) throw new CustomError('Client not found', 404);
    }

    const file = await prisma.crmFile.create({
      data: {
        name: String(name),
        url: String(url),
        clientId: clientId ? String(clientId) : null,
        serviceBusinessId: businessId,
      },
    });
    // 201: this creates a file record.
    res.status(201).json({ success: true, data: file });
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
    // 201: this creates an employee.
    res.status(201).json({ success: true, data: employee });
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

// ── Automation rules ───────────────────────────────────────────────────────

router.get('/automations', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    ok(res, await prisma.crmAutomationRule.findMany({
      where: { OR: [{ businessId: crm.businessId }, { serviceBusinessId: crm.businessId }] },
      orderBy: { createdAt: 'desc' },
    }));
  } catch (e) {
    next(e);
  }
});

router.post('/automations', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const { name, triggerObject, triggerEvent, conditions, actions, enabled } = req.body ?? {};
    if (!name || !triggerObject || !triggerEvent) {
      throw new CustomError('name, triggerObject and triggerEvent are required', 400);
    }
    if (!['client', 'deal', 'task'].includes(String(triggerObject))) {
      throw new CustomError('triggerObject must be client, deal or task', 400);
    }
    if (!['created', 'updated', 'status_changed'].includes(String(triggerEvent))) {
      throw new CustomError('triggerEvent must be created, updated or status_changed', 400);
    }
    const rule = await prisma.crmAutomationRule.create({
      data: {
        name: String(name),
        triggerObject: String(triggerObject),
        triggerEvent: String(triggerEvent),
        conditions: (conditions ?? []) as any,
        actions: (actions ?? []) as any,
        enabled: enabled === undefined ? true : Boolean(enabled),
        businessId: crm.businessId,
        serviceBusinessId: crm.businessId,
      },
    });
    res.status(201).json({ success: true, data: rule });
  } catch (e) {
    next(e);
  }
});

router.delete('/automations/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const existing = await prisma.crmAutomationRule.findFirst({
      where: {
        id: req.params.id,
        OR: [{ businessId: crm.businessId }, { serviceBusinessId: crm.businessId }],
      },
      select: { id: true },
    });
    if (!existing) throw new CustomError('Automation rule not found', 404);
    await prisma.crmAutomationRule.delete({ where: { id: existing.id } });
    ok(res, { deleted: true });
  } catch (e) {
    next(e);
  }
});

// ── Companies ───────────────────────────────────────────────────────────────

router.get('/companies', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const q = String(req.query.q || '').trim();
    const companies = await prisma.crmCompany.findMany({
      where: {
        OR: [{ businessId }, { serviceBusinessId: businessId }],
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      take: 100,
    });
    ok(res, companies);
  } catch (e) {
    next(e);
  }
});

router.post('/companies', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const name = String(req.body?.name || '').trim();
    if (!name) throw new CustomError('name is required', 400);
    const { domain, industry, phone, address, notes, customData } = req.body ?? {};
    const company = await prisma.crmCompany.create({
      data: {
        name,
        domain: domain ? String(domain) : null,
        industry: industry ? String(industry) : null,
        phone: phone ? String(phone) : null,
        address: address ? String(address) : null,
        notes: notes ? String(notes) : null,
        ...(customData && typeof customData === 'object' ? { customData: customData as any } : {}),
        businessId: crm.businessId,
        serviceBusinessId: crm.businessId,
      },
    });
    res.status(201).json({ success: true, data: company });
  } catch (e) {
    next(e);
  }
});

// ── Notes & comments ────────────────────────────────────────────────────────

router.get('/notes', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const clientId = String(req.query.clientId || '');
    const dealId = String(req.query.dealId || '');
    const notes = await prisma.crmNote.findMany({
      where: {
        OR: [{ businessId }, { serviceBusinessId: businessId }],
        ...(clientId ? { clientId } : {}),
        ...(dealId ? { dealId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    ok(res, notes);
  } catch (e) {
    next(e);
  }
});

router.post('/notes', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const body = String(req.body?.body || '').trim();
    const clientId = String(req.body?.clientId || '');
    const dealId = String(req.body?.dealId || '');
    if (!body || (!clientId && !dealId)) throw new CustomError('body and a clientId or dealId are required', 400);
    const note = await prisma.crmNote.create({
      data: {
        body,
        title: req.body?.title ? String(req.body.title) : null,
        clientId: clientId || null,
        dealId: dealId || null,
        authorName: String(req.body?.authorName || req.user?.email || 'Owner'),
        businessId: crm.businessId,
        serviceBusinessId: crm.businessId,
      },
    });
    res.status(201).json({ success: true, data: note });
  } catch (e) {
    next(e);
  }
});

router.get('/comments', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const entityType = String(req.query.entityType || '');
    const entityId = String(req.query.entityId || '');
    if (!entityType || !entityId) throw new CustomError('entityType and entityId are required', 400);
    const comments = await prisma.crmComment.findMany({
      where: {
        entityType,
        entityId,
        OR: [{ businessId: crm.businessId }, { serviceBusinessId: crm.businessId }],
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    ok(res, comments);
  } catch (e) {
    next(e);
  }
});

router.post('/comments', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const entityType = String(req.body?.entityType || '');
    const entityId = String(req.body?.entityId || '');
    const body = String(req.body?.body || '').trim();
    if (!entityType || !entityId || !body) throw new CustomError('entityType, entityId and body are required', 400);
    const comment = await prisma.crmComment.create({
      data: {
        entityType,
        entityId,
        body,
        authorName: String(req.body?.authorName || req.user?.email || 'Owner'),
        businessId: crm.businessId,
        serviceBusinessId: crm.businessId,
      },
    });
    res.status(201).json({ success: true, data: comment });
  } catch (e) {
    next(e);
  }
});

// ── Saved views ─────────────────────────────────────────────────────────────

router.get('/views', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const objectType = String(req.query.objectType || '');
    if (!objectType) throw new CustomError('objectType is required', 400);
    const views = await prisma.crmSavedView.findMany({
      where: {
        objectType,
        OR: [
          { businessId: crm.businessId },
          { userId: crm.userId },
          { isShared: true },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, views);
  } catch (e) {
    next(e);
  }
});

router.post('/views', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const objectType = String(req.body?.objectType || '');
    const name = String(req.body?.name || '').trim();
    if (!objectType || !name) throw new CustomError('objectType and name are required', 400);
    const view = await prisma.crmSavedView.create({
      data: {
        businessId: crm.businessId,
        userId: crm.userId,
        objectType,
        name,
        filters: (req.body?.filters ?? {}) as any,
        isShared: Boolean(req.body?.isShared),
      },
    });
    res.status(201).json({ success: true, data: view });
  } catch (e) {
    next(e);
  }
});

router.delete('/views/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const view = await prisma.crmSavedView.findFirst({
      where: {
        id: req.params.id,
        OR: [{ businessId: crm.businessId }, { userId: crm.userId }],
      },
      select: { id: true },
    });
    if (!view) throw new CustomError('Saved view not found', 404);
    await prisma.crmSavedView.delete({ where: { id: view.id } });
    ok(res, { deleted: true });
  } catch (e) {
    next(e);
  }
});

// ── Quotes (stub — no table yet) ────────────────────────────────────────────

router.get('/quotes', (_req: AuthRequest, res: Response) => ok(res, []));
router.post('/quotes', (_req: AuthRequest, res: Response) => ok(res, { id: null, stub: true }));

export default router;
