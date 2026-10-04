import { prisma } from '../utils/database';
import { invoiceGenerationService } from './invoiceGeneration.service';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { eventBus } from './event-bus.service';
import { getClientStage } from './crm-reliability.service';
import type { BusinessCategory } from '@prisma/client';

// ─── Enroll Business ─────────────────────────────────────────────────────────

/** Maps a free-form service type onto the platform's BusinessCategory. */
const SERVICE_TYPE_TO_CATEGORY: Record<string, BusinessCategory> = {
  CLEANING: 'CLEANING',
  PLUMBING: 'OTHER',
  ELECTRICIAN: 'OTHER',
  HVAC: 'OTHER',
  LANDSCAPING: 'OTHER',
  PAINTING: 'OTHER',
  CARPENTRY: 'OTHER',
  PEST_CONTROL: 'OTHER',
  MOVING: 'OTHER',
  HANDYMAN: 'OTHER',
  FREELANCE: 'FREELANCE',
  PROPERTY_RENTAL: 'PROPERTY_RENTAL',
};

function resolveCategory(serviceType: string): BusinessCategory {
  return SERVICE_TYPE_TO_CATEGORY[serviceType.toUpperCase()] ?? 'OTHER';
}

/**
 * Enroll a service business into the CRM.
 *
 * Enrollment links an *existing* authenticated user to a platform `Business`,
 * which is what lets booking, capital and property layers join to the same
 * business record. It deliberately does not create users: silently minting an
 * account with a placeholder password would hand every enrollee a credential
 * they never chose.
 */
/**
 * The predicate that decides which CRM rows belong to the caller.
 *
 * WHY THIS EXISTS — the defect it fixes
 * ------------------------------------
 * Two independent CRMs write the same tables against two different keys:
 *
 *   Writers                            Column set
 *   bookings.routes.ts:401,425         businessId        (the booking flow)
 *   job.service.ts:24                  businessId
 *   team.service.ts:29                 businessId
 *   crm.service.ts:129,254,386,432     serviceBusinessId (Contact OS)
 *
 * Every read filtered on `serviceBusinessId` alone. So a business taking ordinary
 * bookings — which writes `businessId` — saw an EMPTY dashboard: zero jobs, zero
 * clients, zero revenue. The product looked broken for anyone using it the normal
 * way, and no test existed to say otherwise.
 *
 * The merge made both FKs optional so neither writer would fail. That fixed writes
 * and created this read gap. Same shape as the invoice-delete regression: a
 * constraint satisfied at the boundary but not carried through.
 *
 * WHY A SHARED PREDICATE RATHER THAN FIXING EACH QUERY
 * ---------------------------------------------------
 * Seven reads had this bug. Fixing them one at a time means the eighth gets missed,
 * and a missed one is invisible: it returns empty rather than erroring. One
 * predicate used by all of them makes the correct thing the default.
 *
 * THE TENANT-ISOLATION PROPERTY
 * ----------------------------
 * Spanning two columns is only safe because this is a disjunction bounded by the
 * caller's OWN two ids. A row is included only if its serviceBusinessId equals the
 * caller's service business OR its businessId equals the caller's platform
 * business. A third tenant's row matches neither branch. `crm-read-scope.test.ts`
 * asserts that explicitly, because a scope matching too much would be worse than
 * the bug it replaces.
 *
 * With no service business (a business that has not enrolled in Contact OS), the
 * platform business alone is the scope. It must not become "match everything" —
 * that would leak another tenant's P&L.
 */
/**
 * Grace period before a scheduled job counts as a no-show.
 *
 * Matches the cron's own value. They were separate literals and had to stay
 * consistent: a route that marked a job missed at 20 minutes while the cron waited
 * until 30 would penalise a worker twice, once per path.
 */
export const NO_SHOW_GRACE_MINUTES = 30;

/**
 * Compose a job's scheduled start from its date column and its time string.
 *
 * WHY THIS EXISTS
 * ---------------
 * `CrmJob.scheduledDate` is a `DateTime` column and `scheduledTime` is a separate
 * string. Interpolating them — `new Date(`${date}T${time}`)` — yields
 * "Sat Oct 20 2026 00:00:00 GMT+0000 (Coordinated Universal Time)T10:00", which is
 * Invalid Date. Every comparison against it is NaN, so the branch never runs.
 *
 * That is not hypothetical: it is why this route never marked a job missed, while
 * jobCronService (which had its own correct helper) kept doing it. Two code paths,
 * one of them silently inert.
 *
 * Returns null when the time is absent or unparseable rather than guessing, and
 * null-safety is load-bearing: `scheduledTime` is optional on the schema, so a job
 * can legitimately have no time.
 */
export function composeJobStart(
  scheduledDate: Date | string | null | undefined,
  scheduledTime: string | null | undefined,
): Date | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((scheduledTime || '').trim());
  if (!match) return null;

  const base = scheduledDate ? new Date(scheduledDate) : null;
  if (!base || Number.isNaN(base.getTime())) return null;

  // setUTCHours, not setHours: stored times are UTC and the cron's helper already
  // made this choice. Using local time here would mark jobs missed an hour early
  // or late depending on the server's timezone.
  base.setUTCHours(Number(match[1]), Number(match[2]), 0, 0);
  return Number.isNaN(base.getTime()) ? null : base;
}

export function crmScope(
  serviceBusinessId?: string | null,
  businessId?: string | null,
): { OR: Array<Record<string, unknown>> } {
  const clauses: Array<Record<string, unknown>> = [];
  if (serviceBusinessId) clauses.push({ serviceBusinessId });
  if (businessId) clauses.push({ businessId });
  // Neither identity resolved: an impossible predicate rather than a match-all. A
  // caller with no tenant gets nothing, which is correct — there is nothing to
  // attribute their rows to.
  if (clauses.length === 0) return { OR: [{ __noTenant: null }] };
  return { OR: clauses };
}

export async function enrollBusiness(data: {
  ownerId: string;
  businessName: string;
  ownerEmail: string;
  ownerName: string;
  serviceType: string;
  phone?: string;
  address?: string;
}) {
  const { ownerId, businessName, ownerEmail, ownerName, serviceType, phone, address } = data;

  if (!businessName || !ownerEmail || !ownerName || !serviceType) {
    throw new CustomError('businessName, ownerEmail, ownerName, and serviceType are required', 400);
  }
  if (!ownerId) {
    throw new CustomError('Authentication required to enroll a business', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!user) {
    throw new CustomError('Authenticated user no longer exists', 401);
  }
  if (user.email && user.email.toLowerCase() !== ownerEmail.toLowerCase()) {
    throw new CustomError(
      `ownerEmail does not match the signed-in account (${user.email})`,
      403
    );
  }

  // Idempotent: re-enrolling returns the existing pairing rather than forking a
  // second Business, which would split the cross-layer join.
  const existingCrm = await prisma.crmServiceBusiness.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'asc' },
    include: { business: true },
  });
  if (existingCrm) {
    return { business: existingCrm.business, crmBusiness: existingCrm };
  }

  // Reuse an existing owned Business (e.g. one created via the booking flow)
  // instead of creating a duplicate that would fragment revenue reporting.
  let business = await prisma.business.findFirst({ where: { ownerId: user.id } });
  if (!business) {
    business = await prisma.business.create({
      data: {
        name: businessName,
        email: ownerEmail,
        phone: phone || null,
        address: address || '',
        category: resolveCategory(serviceType),
        ownerId: user.id,
        isActive: true,
      },
    });
  }

  const crmBusiness = await prisma.crmServiceBusiness.create({
    data: {
      businessId: business.id,
      ownerId: user.id,
      serviceType,
    },
  });

  return { business, crmBusiness };
}

// ─── Employee Management ─────────────────────────────────────────────────────

export async function addEmployee(
  serviceBusinessId: string,
  data: {
    name: string;
    email?: string;
    phone?: string;
    role: string;
    payRate?: number;
    payType?: 'HOURLY' | 'SALARY' | 'PER_JOB';
  }
) {
  const { name, email, phone, role, payRate = 0, payType = 'HOURLY' } = data;

  if (!name || !role) {
    throw new CustomError('name and role are required', 400);
  }

  const employee = await prisma.crmEmployee.create({
    data: {
      serviceBusinessId,
      name,
      email: email || '',
      phone: phone || '',
      role,
      payRate,
      payType,
    },
  });

  return employee;
}

export async function getEmployees(serviceBusinessId: string, businessId?: string | null) {
  return prisma.crmEmployee.findMany({
    where: crmScope(serviceBusinessId, businessId),
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Client Management ───────────────────────────────────────────────────────

export async function addClient(
  serviceBusinessId: string,
  data: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
  }
) {
  const { name, email, phone, address, notes } = data;

  if (!name) {
    throw new CustomError('name is required', 400);
  }

  const client = await prisma.crmClient.create({
    data: {
      serviceBusinessId,
      name,
      email: email || '',
      phone: phone || '',
      address: address || '',
      notes: notes || null,
    },
  });

  return client;
}

export async function getClients(serviceBusinessId: string, businessId?: string | null) {
  const clients = await prisma.crmClient.findMany({
    where: crmScope(serviceBusinessId, businessId),
    orderBy: { createdAt: 'desc' },
  });

  // Attach lifecycle stage for each client
  const clientsWithStage = await Promise.all(
    clients.map(async (client) => {
      const jobs = await prisma.crmJob.findMany({
        where: { clientId: client.id },
      });
      return {
        ...client,
        stage: getClientStage(client, jobs),
      };
    })
  );

  return clientsWithStage;
}

// ─── Job Management ──────────────────────────────────────────────────────────

export async function createJob(
  serviceBusinessId: string,
  data: {
    clientId?: string;
    clientName?: string;
    serviceType: string;
    scheduledDate: string;
    scheduledTime: string;
    durationMinutes?: number;
    address?: string;
    notes?: string;
    price: number;
    employeeId?: string;
  },
  businessId?: string | null,
) {
  const { clientId, clientName, serviceType, scheduledDate, scheduledTime, durationMinutes = 60, address, notes, price, employeeId } = data;

  if (!serviceType || !scheduledDate || !scheduledTime) {
    throw new CustomError('serviceType, scheduledDate, and scheduledTime are required', 400);
  }
  if (!clientId) {
    throw new CustomError('clientId is required', 400);
  }
  if (!address) {
    throw new CustomError('address is required', 400);
  }

  // Resolve the client within this business. Without the scope check a caller
  // could book work against another business's client by id.
  const client = await prisma.crmClient.findFirst({
    where: { AND: [{ id: clientId }, crmScope(serviceBusinessId, businessId)] },
    select: { id: true, name: true },
  });
  if (!client) {
    throw new CustomError('Client not found for this business', 404);
  }

  if (employeeId) {
    const employee = await prisma.crmEmployee.findFirst({
      where: { AND: [{ id: employeeId }, crmScope(serviceBusinessId, businessId)] },
      select: { id: true },
    });
    if (!employee) {
      throw new CustomError('Employee not found for this business', 404);
    }
  }

  const job = await prisma.crmJob.create({
    data: {
      serviceBusinessId,
      clientId: client.id,
      // Denormalized snapshot so a later client rename cannot rewrite history.
      clientName: clientName || client.name,
      serviceType,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      durationMinutes,
      address,
      notes: notes || null,
      price: price || 0,
      status: 'SCHEDULED',
    },
    include: {
      client: true,
    },
  });

  if (employeeId) {
    await prisma.crmJobAssignment.create({
      data: { jobId: job.id, employeeId },
    });
  }

  return job;
}

export async function assignEmployee(jobId: string, employeeId: string, serviceBusinessId?: string, businessId?: string | null) {
  // Both sides must belong to the same business as the job, otherwise an
  // assignment could bridge two businesses' workforces.
  const job = await prisma.crmJob.findFirst({
    where: { AND: [{ id: jobId }, crmScope(serviceBusinessId, businessId)] },
    select: { id: true },
  });
  if (!job) throw new CustomError('Job not found', 404);

  const employee = await prisma.crmEmployee.findFirst({
    where: { AND: [{ id: employeeId }, crmScope(serviceBusinessId, businessId)] },
    select: { id: true },
  });
  if (!employee) throw new CustomError('Employee not found', 404);

  await prisma.crmJobAssignment.deleteMany({ where: { jobId } });
  return prisma.crmJobAssignment.create({
    data: { jobId, employeeId },
  });
}

export async function updateJobStatus(jobId: string, status: string, serviceBusinessId?: string, businessId?: string | null) {
  if (!['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
    throw new CustomError('Invalid status', 400);
  }

  // Scoped update: an unscoped `update` by id would let any authenticated caller
  // rewrite the status of any job on the platform.
  const existing = await prisma.crmJob.findFirst({
    where: { AND: [{ id: jobId }, crmScope(serviceBusinessId, businessId)] },
    select: { id: true },
  });
  if (!existing) {
    throw new CustomError('Job not found', 404);
  }

  const data: any = { status };
  if (status === 'COMPLETED') {
    data.completedAt = new Date();
  }

  const job = await prisma.crmJob.update({
    where: { id: jobId },
    data,
    include: { client: true },
  });

  // Emit events
  if (status === 'COMPLETED') {
    await eventBus.publish({
      type: 'checkin.verified',
      jobId,
      clientId: job.clientId || undefined,
      // serviceBusinessId is nullable on the merged schema because two CRMs write
      // this table; `businessId` on the event is optional but not null-able.
      businessId: job.serviceBusinessId ?? undefined,
      layer: 'crm',
      data: { job, completedAt: job.completedAt },
      timestamp: new Date(),
    });
  }

  return job;
}

export async function getJobs(
  serviceBusinessId: string,
  filters?: { status?: string; employeeId?: string; clientId?: string; dateFrom?: string; dateTo?: string },
  businessId?: string | null,
) {
  const where: any = crmScope(serviceBusinessId, businessId);

  if (filters?.status) where.status = filters.status;
  if (filters?.clientId) where.clientId = filters.clientId;
  if (filters?.dateFrom) where.scheduledDate = { ...where.scheduledDate, gte: new Date(filters.dateFrom) };
  if (filters?.dateTo) where.scheduledDate = { ...where.scheduledDate, lte: new Date(filters.dateTo) };

  return prisma.crmJob.findMany({
    where,
    include: {
      client: true,
      assignments: { include: { employee: true } },
    },
    orderBy: { scheduledDate: 'asc' },
  });
}

// ─── Payroll Management ──────────────────────────────────────────────────────

export async function recordPayroll(
  serviceBusinessId: string,
  data: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    hoursWorked?: number;
    jobsCompleted?: number;
    grossPay: number;
    deductions?: number;
    netPay: number;
  },
  businessId?: string | null,
) {
  const { employeeId, periodStart, periodEnd, hoursWorked = 0, jobsCompleted = 0, grossPay, deductions = 0, netPay } = data;

  // Validate the employee belongs to THIS business, and the money is coherent.
  //
  // Neither was checked. employeeId is a real FK with onDelete: Cascade and the
  // route is authenticated, so any business could POST /crm/payroll naming another
  // tenant's employee and produce a cross-tenant payroll row: their employee under
  // our serviceBusinessId. That row then appears in their employee history via the
  // relation, and the amount is attacker-chosen. Same class as the unscoped
  // invoice delete — the write looked fine because nothing forced it to check.
  if (!employeeId) {
    throw new CustomError('employeeId is required', 400);
  }
  if (!Number.isFinite(grossPay) || !Number.isFinite(netPay)) {
    throw new CustomError('grossPay and netPay must be numbers', 400);
  }
  // netPay is what the employee actually receives; a value above gross is not a
  // rounding artefact, it is a payroll error or an attempt to inflate the record.
  if (netPay < 0 || grossPay < 0) {
    throw new CustomError('Payroll amounts cannot be negative', 400);
  }
  if (netPay > grossPay) {
    throw new CustomError('netPay cannot exceed grossPay', 400);
  }

  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new CustomError('periodStart and periodEnd must be valid dates', 400);
  }
  if (end.getTime() < start.getTime()) {
    throw new CustomError('periodEnd cannot be before periodStart', 400);
  }

  const employee = await prisma.crmEmployee.findFirst({
    where: { AND: [{ id: employeeId }, crmScope(serviceBusinessId, businessId)] },
    select: { id: true },
  });
  if (!employee) {
    throw new CustomError('Employee not found for this business', 404);
  }

  return prisma.crmPayroll.create({
    data: {
      serviceBusinessId,
      employeeId,
      periodStart: start,
      periodEnd: end,
      hoursWorked,
      jobsCompleted,
      grossPay,
      deductions,
      netPay,
      status: 'PENDING',
    },
    include: { employee: true },
  });
}

export async function getPayrollHistory(serviceBusinessId: string, employeeId?: string, businessId?: string | null) {
  const where: any = { ...crmScope(serviceBusinessId, businessId) };
  if (employeeId) where.employeeId = employeeId;

  return prisma.crmPayroll.findMany({
    where,
    include: { employee: true },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Expense Management ──────────────────────────────────────────────────────

export async function recordExpense(
  serviceBusinessId: string,
  data: {
    category: string;
    amount: number;
    description: string;
    vendor?: string;
    date?: string;
  }
) {
  const { category, amount, description, vendor, date } = data;

  if (!category || !amount || !description) {
    throw new CustomError('category, amount, and description are required', 400);
  }

  // `!amount` above already rejects 0, but not a negative number, and a negative
  // expense is subtracted from monthlyExpenses in the dashboard — which turns a
  // typo into an inflated profit figure. Expenses only add.
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new CustomError('Expense amount must be a positive number', 400);
  }

  // An unparseable date silently becomes Invalid Date and Prisma rejects it with
  // an opaque error, so it is caught here with a message a merchant can act on.
  if (date != null && Number.isNaN(new Date(date).getTime())) {
    throw new CustomError('Expense date must be a valid date', 400);
  }

  return prisma.crmExpense.create({
    data: {
      serviceBusinessId,
      category,
      amount,
      description,
      vendor: vendor || null,
      date: date ? new Date(date) : new Date(),
    },
  });
}

export async function getExpenses(serviceBusinessId: string, filters?: { category?: string; dateFrom?: string; dateTo?: string }, businessId?: string | null) {
  const where: any = { ...crmScope(serviceBusinessId, businessId) };
  if (filters?.category) where.category = filters.category;
  if (filters?.dateFrom) where.date = { ...where.date, gte: new Date(filters.dateFrom) };
  if (filters?.dateTo) where.date = { ...where.date, lte: new Date(filters.dateTo) };

  return prisma.crmExpense.findMany({
    where,
    orderBy: { date: 'desc' },
  });
}

// ─── Dashboard Statistics ───────────────────────────────────────────────────

export async function getDashboardStats(serviceBusinessId: string, businessId?: string | null) {
  const scope = crmScope(serviceBusinessId, businessId);
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const totalJobs = await prisma.crmJob.count({ where: scope });
  const completedJobs = await prisma.crmJob.count({
    where: { AND: [scope, { status: 'COMPLETED' }] },
  });
  const activeClients = await prisma.crmClient.count({ where: scope });

  const completedJobsThisMonth = await prisma.crmJob.findMany({
    where: {
      AND: [
        scope,
        { status: 'COMPLETED', scheduledDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } },
      ],
    },
    select: { price: true },
  });
  const monthlyRevenue = completedJobsThisMonth.reduce((sum, job) => sum + job.price, 0);

  const monthlyExpensesData = await prisma.crmExpense.findMany({
    where: {
      AND: [scope, { date: { gte: firstDayOfMonth, lte: lastDayOfMonth } }],
    },
    select: { amount: true },
  });
  const monthlyExpenses = monthlyExpensesData.reduce((sum, exp) => sum + exp.amount, 0);

  const payrollCostsData = await prisma.crmPayroll.findMany({
    where: {
      AND: [
        scope,
        { periodStart: { gte: firstDayOfMonth }, periodEnd: { lte: lastDayOfMonth } },
      ],
    },
    select: { netPay: true },
  });
  const payrollCosts = payrollCostsData.reduce((sum, p) => sum + p.netPay, 0);

  const employees = await prisma.crmEmployee.findMany({
    where: { AND: [scope, { isActive: true }] },
    orderBy: { jobsCompleted: 'desc' },
    take: 5,
  });

  return {
    totalJobs,
    completedJobs,
    activeClients,
    monthlyRevenue,
    monthlyExpenses,
    payrollCosts,
    topEmployees: employees,
  };
}


// ─── Job Lifecycle Management ──────────────────────────────────────────────

export async function checkInJob(
  jobId: string,
  userId: string,
  latitude?: number,
  longitude?: number,
  serviceBusinessId?: string,
  businessId?: string | null,
) {
  // Scoped lookup: without serviceBusinessId a caller could check in any job on
  // the platform just by guessing an id.
  const job = await prisma.crmJob.findFirst({
    where: { AND: [{ id: jobId }, crmScope(serviceBusinessId, businessId)] },
    include: { client: true },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status !== 'SCHEDULED') {
    throw new Error(`Job is not in SCHEDULED status. Current status: ${job.status}`);
  }

  // Update job with check-in timestamp and status
  const updatedJob = await prisma.crmJob.update({
    where: { id: jobId },
    data: {
      status: 'IN_PROGRESS',
      checkedInAt: new Date(),
      // Captured so a later location check can verify the check-in actually
      // happened at the job site — the basis for delivery reliability.
      ...(latitude !== undefined && { checkinLat: latitude }),
      ...(longitude !== undefined && { checkinLng: longitude }),
    }
  });

  // Fire trust event: delivery.checked_in
  eventBus.emitEvent('delivery.checked_in', {
    jobId,
    clientId: job.clientId,
    timestamp: new Date(),
    latitude,
    longitude,
  }, 'crm');

  // Audit log entry would be handled by the trust-core service or similar
  // For now, we'll rely on the event bus to trigger appropriate updates

  logger.info(`[JobLifecycle] Job ${jobId} checked in`);

  return updatedJob;
}

export async function checkOutJob(
  jobId: string,
  userId: string,
  serviceBusinessId?: string,
  businessId?: string | null,
) {
  const job = await prisma.crmJob.findFirst({
    where: { AND: [{ id: jobId }, crmScope(serviceBusinessId, businessId)] },
    include: { client: true }
  });

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status !== 'IN_PROGRESS') {
    throw new Error(`Job is not in IN_PROGRESS status. Current status: ${job.status}`);
  }

  const now = new Date();
  const checkedInAt = job.checkedInAt || new Date(); // Fallback to now if not set
  const actualDurationMinutes = Math.max(0, (now.getTime() - checkedInAt.getTime()) / (1000 * 60));
  const scheduledDurationMinutes = job.durationMinutes || 0;
  const isLate = actualDurationMinutes > scheduledDurationMinutes + 15; // More than 15 min over scheduled time

  // Update job with check-out timestamp, status, and actual duration
  const updatedJob = await prisma.crmJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      checkedOutAt: new Date(),
      actualDurationMinutes: Math.round(actualDurationMinutes)
    }
  });

  // Determine if job was on time or late based on scheduled vs actual time
  const deliveryEventType = isLate ? 'delivery.late' : 'delivery.on_time';
  const deliveryDelta = isLate ? -10 : 5; // Example deltas - would be configured based on trust system

  // Fire trust event: delivery.on_time OR delivery.late
  eventBus.emitEvent(deliveryEventType, {
    jobId,
    clientId: job.clientId,
    workerId: userId,
    actualDurationMinutes,
    scheduledDurationMinutes,
    timestamp: new Date(),
  }, 'crm');

  // Update worker's deliveryScore (this would typically update the worker's TrustPassport)
  // In a real implementation, this would call a trust score update service
  logger.info(`[JobLifecycle] Updating deliveryScore for worker ${userId} by ${deliveryDelta} points`);

  logger.info(`[JobLifecycle] Job ${jobId} checked out${isLate ? ' (late)' : ''}`);

  // Note: Auto-generating invoice and releasing deposit would be handled by separate services
  // that listen to the trust events or are called explicitly after check-out

  return { updatedJob, isLate, actualDurationMinutes };
}

export async function handleNoShow(jobId: string, serviceBusinessId?: string | null, businessId?: string | null) {
  // Was findUnique by id alone — no tenant check at all. Routed at
  // POST /crm/jobs/:id/noshow, so any caller could mark ANY job on the platform as
  // a no-show and trigger its score penalty. Now scoped like every other read.
  const job = await prisma.crmJob.findFirst({
    where: { AND: [{ id: jobId }, crmScope(serviceBusinessId, businessId)] },
    include: { client: true }
  });

  if (!job) {
    return;
  }

  if (job.status !== 'SCHEDULED') {
    return; // Already processed
  }

  const now = new Date();
  const scheduledTime = composeJobStart(job.scheduledDate as Date, job.scheduledTime as string | null);

  // A job with no usable start time cannot be judged late. Previously this was
  // `new Date(`${job.scheduledDate}T${job.scheduledTime}`)`, and scheduledDate is a
  // DateTime column — so interpolating it produced the string
  // "Sat Oct 20 2026 ...T10:00", which is Invalid Date. minutesLate was therefore
  // always NaN, `NaN > 30` was always false, and this route NEVER marked a job
  // missed. The no-show penalty existed only via the cron, which had its own
  // (correct) helper.
  if (!scheduledTime) {
    logger.warn(
      `[CRM] Job ${jobId} has no usable scheduled start; not eligible for a no-show.`,
    );
    return;
  }

  // Check if it's been more than 30 minutes since scheduled time
  const minutesLate = (now.getTime() - scheduledTime.getTime()) / (1000 * 60);
  if (minutesLate > NO_SHOW_GRACE_MINUTES) {
    // Update job status to missed
    await prisma.crmJob.update({
      where: { id: jobId },
      data: {
        status: 'MISSED'
      }
    });

    // Fire event: delivery.missed (affects the business owner's deliveryScore, not the client)
    eventBus.emitEvent('delivery.missed', {
      jobId,
      clientId: job.clientId,
      timestamp: now,
      minutesLate,
    }, 'crm');

    logger.info(`[JobLifecycle] Job ${jobId} marked as MISSED (${minutesLate.toFixed(1)} minutes late)`);
  }
}

/**
 * Find or create a client for a business, scoped by email when there is one.
 *
 * Present on main and imported by bookings.routes.ts. Kept when the Contact OS
 * version of this file landed: that version dropped the export, so removing the
 * main version silently broke the booking flow's import. Scoped to businessId so
 * one business can never resolve to another's client — an unscoped lookup by
 * email would leak clients across tenants.
 */
export async function findOrCreateClient(
  businessId: string,
  data: { name: string; email?: string; phone?: string; address?: string },
) {
  if (data.email) {
    const existing = await prisma.crmClient.findFirst({
      where: { businessId, email: data.email },
    });
    if (existing) return existing;
  }
  return prisma.crmClient.create({
    data: {
      businessId,
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
    },
  });
}

// ── Deal Pipeline ───────────────────────────────────────────────────────────

/**
 * The six pipeline stages, in order, with the probability the UI assumes for each.
 *
 * `probability` is stored on the row rather than derived, because a sales team will
 * override it — "this proposal is 90% likely" is judgement, not arithmetic. But a stage
 * change with no explicit probability still moves it to the stage default, so the kanban
 * forecast and the probability column cannot drift apart.
 */
export const DEAL_STAGES = [
  'LEAD',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

const STAGE_PROBABILITY: Record<string, number> = {
  LEAD: 10,
  QUALIFIED: 30,
  PROPOSAL: 60,
  NEGOTIATION: 80,
  WON: 100,
  LOST: 0,
};

function isDealStage(value: unknown): value is DealStage {
  return typeof value === 'string' && (DEAL_STAGES as readonly string[]).includes(value);
}

/**
 * Coerce a caller-supplied stage to a real one.
 *
 * Rejects rather than defaults: silently storing "won" (lowercase) or "WONNING" would put
 * a deal in a column the kanban does not render, and it would look like data loss to the
 * user. A 400 naming the valid stages is recoverable; a deal stuck off the board is not.
 */
export function parseStage(value: unknown, fallback: DealStage = 'LEAD'): DealStage {
  if (value === undefined || value === null || value === '') return fallback;
  if (!isDealStage(value)) {
    throw new CustomError(
      `Invalid stage. Expected one of: ${DEAL_STAGES.join(', ')}`,
      400,
    );
  }
  return value;
}

export function parseProbability(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new CustomError('probability must be a number between 0 and 100', 400);
  }
  return Math.round(n);
}

/**
 * Parse an optional date, returning null for absent input.
 *
 * An unparseable string is a 400 rather than a silent null: "2026-13-45" almost always
 * means the client sent a malformed date, and dropping it would file the deal with no close
 * date and no warning, which then reads as "no deadline set" in the forecast.
 */
export function parseOptionalDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) {
    throw new CustomError('expectedCloseDate must be a valid date', 400);
  }
  return d;
}

export function parseValue(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new CustomError('value must be a number', 400);
  // A negative deal value is not a discount, it is a data-entry error, and it would quietly
  // deflate every pipeline forecast that sums the column.
  if (n < 0) throw new CustomError('value cannot be negative', 400);
  return n;
}

/**
 * Tenant scope for deals.
 *
 * NOT crmScope(). That helper ORs `{ serviceBusinessId }` with `{ businessId }`, which is
 * right for CrmClient — but on CrmDeal the `businessId` column is a foreign key to the
 * legacy CrmBusiness table, while the `businessId` on the resolved context is the PLATFORM
 * Business id. Different id spaces: passing it produced
 * `CrmDeal_businessId_fkey (index)` violations on every create.
 *
 * CrmBusiness cannot be mapped to a tenant at all — it has no businessId and no ownerId,
 * only an ownerEmail. So there is no sound way to resolve a CrmBusiness id for the caller,
 * and guessing one would either violate the FK or, worse, match someone else's.
 *
 * Therefore: anchor on serviceBusinessId alone. The `businessId` column stays on the model
 * for rows written before this change, but no scoped read may filter on it, because an id
 * from that column cannot be attributed to a tenant.
 */
function dealScope(serviceBusinessId: string) {
  return { serviceBusinessId };
}

const DEAL_SELECT = {
  id: true,
  title: true,
  value: true,
  currency: true,
  stage: true,
  probability: true,
  expectedCloseDate: true,
  closedAt: true,
  lostReason: true,
  notes: true,
  clientId: true,
  ownerName: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, email: true } },
} as const;

export async function getDeals(serviceBusinessId: string, businessId?: string | null) {
  return prisma.crmDeal.findMany({
    where: dealScope(serviceBusinessId),
    orderBy: [{ stage: 'asc' }, { createdAt: 'desc' }],
    select: DEAL_SELECT,
  });
}

/**
 * Create a deal for the resolved tenant.
 *
 * The tenant ids come from the arguments (the server-resolved context), never from the
 * body. A body-supplied `serviceBusinessId` would let a caller file a deal into another
 * business's pipeline, so it is dropped even if present.
 */
export async function createDeal(
  serviceBusinessId: string,
  businessId: string | undefined | null,
  data: Record<string, unknown>,
) {
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!title) throw new CustomError('title is required', 400);

  const stage = parseStage(data.stage);
  const clientId = typeof data.clientId === 'string' && data.clientId ? data.clientId : null;

  // A deal must belong to the same tenant as the client it points at, otherwise the kanban
  // would leak the client's name into another business. Checked here rather than trusted.
  if (clientId) {
    const client = await prisma.crmClient.findFirst({
      where: { id: clientId, ...dealScope(serviceBusinessId) },
      select: { id: true },
    });
    if (!client) throw new CustomError('client not found', 404);
  }

  return prisma.crmDeal.create({
    data: {
      title,
      value: parseValue(data.value),
      stage,
      probability: parseProbability(data.probability, STAGE_PROBABILITY[stage]),
      expectedCloseDate: parseOptionalDate(data.expectedCloseDate),
      notes: typeof data.notes === 'string' && data.notes ? data.notes : null,
      lostReason: typeof data.lostReason === 'string' && data.lostReason ? data.lostReason : null,
      ownerName: typeof data.ownerName === 'string' && data.ownerName ? data.ownerName : null,
      clientId,
      // businessId is deliberately null: it is the legacy CrmBusiness anchor, which has no
      // tenant mapping (see dealScope). serviceBusinessId is the anchor every scoped read
      // uses, and resolveCrmBusiness guarantees it.
      businessId: null,
      serviceBusinessId,
      ...(stage === 'WON' || stage === 'LOST' ? { closedAt: new Date() } : {}),
    },
    select: DEAL_SELECT,
  });
}

/**
 * Fetch a deal the caller is allowed to see, or return null.
 *
 * Filtering in the query rather than fetching-then-checking keeps it to one round trip and
 * makes "not yours" indistinguishable from "does not exist", so the endpoint cannot be used
 * to probe which deal ids are real.
 */
async function ownDeal(serviceBusinessId: string, businessId: string | undefined | null, dealId: string) {
  return prisma.crmDeal.findFirst({
    where: { id: dealId, ...dealScope(serviceBusinessId) },
    select: DEAL_SELECT,
  });
}

export async function updateDeal(
  serviceBusinessId: string,
  businessId: string | undefined | null,
  dealId: string,
  data: Record<string, unknown>,
) {
  const existing = await ownDeal(serviceBusinessId, businessId, dealId);
  if (!existing) throw new CustomError('Deal not found', 404);

  const stage = data.stage === undefined ? (existing.stage as DealStage) : parseStage(data.stage, existing.stage as DealStage);

  // closedAt is derived from the stage transition, not taken from the body: a client that
  // sends closedAt for an open deal would otherwise show a closed date on an open column.
  const closedAt =
    stage === 'WON' || stage === 'LOST'
      ? existing.closedAt ?? new Date()
      : null;

  return prisma.crmDeal.update({
    where: { id: dealId },
    data: {
      ...(data.title !== undefined && { title: String(data.title).trim() || existing.title }),
      ...(data.value !== undefined && { value: parseValue(data.value) }),
      ...(stage !== existing.stage && { stage }),
      // Probability follows the stage unless the caller states one explicitly.
      ...(data.probability !== undefined
        ? { probability: parseProbability(data.probability, existing.probability) }
        : stage !== existing.stage
          ? { probability: STAGE_PROBABILITY[stage] }
          : {}),
      ...(data.expectedCloseDate !== undefined && {
        expectedCloseDate: parseOptionalDate(data.expectedCloseDate),
      }),
      ...(data.notes !== undefined && { notes: data.notes ? String(data.notes) : null }),
      ...(data.lostReason !== undefined && {
        lostReason: data.lostReason ? String(data.lostReason) : null,
      }),
      ...(data.ownerName !== undefined && {
        ownerName: data.ownerName ? String(data.ownerName) : null,
      }),
      ...(closedAt !== existing.closedAt && { closedAt }),
    },
    select: DEAL_SELECT,
  });
}

export async function deleteDeal(
  serviceBusinessId: string,
  businessId: string | undefined | null,
  dealId: string,
) {
  const existing = await ownDeal(serviceBusinessId, businessId, dealId);
  if (!existing) throw new CustomError('Deal not found', 404);
  await prisma.crmDeal.delete({ where: { id: dealId } });
  return { id: dealId };
}

// ── CSV import ──────────────────────────────────────────────────────────────

/**
 * Limits for CSV import.
 *
 * Not decoration. A CSV import is an unbounded write: the request body is caller-supplied,
 * so without a byte cap a single request can allocate whatever the body limit allows, and
 * without a row cap 50,000 well-formed rows turn one request into 50,000 inserts inside
 * one transaction — a long lock on CrmDeal and a timeout that leaves the caller unsure
 * whether it landed.
 */
export const CSV_IMPORT_LIMITS = {
  maxBytes: 1_000_000,
  maxRows: 1_000,
  maxColumns: 50,
  /** Returned per-row errors are capped; a 1000-row bad file must not produce a huge response. */
  maxReportedErrors: 20,
} as const;

/**
 * Parse RFC 4180 CSV.
 *
 * Written out rather than pulled in as a dependency, and modelled on the parser the deals
 * modal already uses for its preview, because the two have to agree on quoting rules.
 *
 * The server MUST parse this itself even though the client already parsed it for the
 * preview: the client's row count and preview are untrusted input, and a parser is exactly
 * where trusting the client would let a crafted file describe rows that were never in it.
 * Handles quoted fields, escaped quotes (""), embedded newlines and CRLF. Rejects rather
 * than truncates on the limits, so a truncated import never looks like a complete one.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      current.push(field);
      field = '';
      if (current.length > CSV_IMPORT_LIMITS.maxColumns) {
        throw new CustomError(
          `Too many columns (limit ${CSV_IMPORT_LIMITS.maxColumns})`,
          400,
        );
      }
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      current.push(field);
      field = '';
      // Blank lines are skipped rather than imported as empty deals, which would otherwise
      // be reported as hundreds of validation failures the user cannot act on.
      if (current.some((c) => c.trim() !== '')) rows.push(current);
      current = [];
      // +1 for the header row, which is not a data row. Compared on the data-row count so
      // the message matches the limit the caller is told about.
      if (rows.length - 1 > CSV_IMPORT_LIMITS.maxRows) {
        throw new CustomError(
          `Too many rows (limit ${CSV_IMPORT_LIMITS.maxRows} data rows)`,
          400,
        );
      }
    } else {
      field += char;
    }
  }

  current.push(field);
  if (current.some((c) => c.trim() !== '')) rows.push(current);

  if (inQuotes) {
    throw new CustomError('Unbalanced quote: a quoted field is never closed', 400);
  }
  return rows;
}

export interface ImportDealsResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Import deals from CSV.
 *
 * ALL-OR-NOTHING. The file is fully validated first, and nothing is written unless every
 * row passes. A partial import is the wrong trade here: a pipeline's value column feeds the
 * forecast, so 400 of 500 rows landing silently produces a forecast that is wrong by 20% and
 * looks entirely plausible. Refusing the file with a row-by-row list is recoverable in a way
 * a half-written pipeline is not.
 *
 * Every row goes through the SAME validators as the single-create path, so CSV cannot be a
 * way around the rules the form enforces — an import that accepted a stage the UI rejects
 * would leave deals stranded in a column the kanban does not render.
 *
 * `client` is resolved by name (or email) WITHIN the caller's tenant only. A name that does
 * not resolve, or that is ambiguous, is a row error rather than a guessed match: silently
 * attaching a deal to the wrong client is worse than refusing the row.
 */
export async function importDeals(
  serviceBusinessId: string,
  csvText: string,
): Promise<ImportDealsResult> {
  if (typeof csvText !== 'string' || csvText.trim() === '') {
    throw new CustomError('csvData is required', 400);
  }
  // Byte length, not string length: a multi-byte character is more than one byte on the
  // wire, and the limit is about memory, not characters.
  const bytes = Buffer.byteLength(csvText, 'utf8');
  if (bytes > CSV_IMPORT_LIMITS.maxBytes) {
    throw new CustomError(
      `CSV is too large (${bytes} bytes, limit ${CSV_IMPORT_LIMITS.maxBytes})`,
      413,
    );
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new CustomError(
      'CSV needs a header row and at least one data row',
      400,
    );
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  if (!header.includes('title')) {
    throw new CustomError(
      `CSV must have a "title" column. Found: ${header.join(', ') || '(none)'}`,
      400,
    );
  }
  const col = (name: string) => header.indexOf(name);

  // The row cap is enforced by parseCsv, which throws as soon as it passes the limit. An
  // earlier version also checked it here — dead code, because the parser always tripped
  // first — and it made the cap impossible to mutation-test: removing this copy left the
  // suite green, so the limit looked covered while nothing actually guarded it.
  const dataRows = rows.slice(1);

  // Resolve candidate clients once, for this tenant only, rather than a query per row.
  const clients = await prisma.crmClient.findMany({
    where: { serviceBusinessId },
    select: { id: true, name: true, email: true },
  });
  const byLowerName = new Map<string, { id: string; ambiguous: boolean }>();
  const byLowerEmail = new Map<string, string>();
  for (const c of clients) {
    const key = c.name.trim().toLowerCase();
    const existing = byLowerName.get(key);
    if (existing) existing.ambiguous = true;
    else byLowerName.set(key, { id: c.id, ambiguous: false });
    if (c.email) byLowerEmail.set(c.email.trim().toLowerCase(), c.id);
  }

  const errors: string[] = [];
  const pushError = (line: number, message: string) => {
    if (errors.length < CSV_IMPORT_LIMITS.maxReportedErrors) {
      // 1-based and counting the header, so the number matches what the user sees in a
      // spreadsheet or a text editor.
      errors.push(`Row ${line}: ${message}`);
    }
  };

  const prepared: Array<{
    title: string;
    value: number;
    stage: DealStage;
    probability: number;
    expectedCloseDate: Date | null;
    notes: string | null;
    clientId: string | null;
  }> = [];

  dataRows.forEach((row, index) => {
    const line = index + 2;
    const cell = (name: string) => {
      const i = col(name);
      return i === -1 ? '' : (row[i] ?? '').trim();
    };

    // Validate the whole row before mutating anything, so one bad row cannot leave a
    // half-populated prepared list that later rows would append to.
    try {
      const title = cell('title');
      if (!title) throw new CustomError('title is required', 400);

      const stage = parseStage(cell('stage'));
      const value = parseValue(cell('value'));
      const probability = parseProbability(cell('probability'), STAGE_PROBABILITY[stage]);
      const expectedCloseDate = parseOptionalDate(cell('expectedCloseDate'));

      let clientId: string | null = null;
      const clientRef = cell('client');
      if (clientRef) {
        const byEmail = byLowerEmail.get(clientRef.toLowerCase());
        const byName = byLowerName.get(clientRef.toLowerCase());
        if (byEmail) {
          clientId = byEmail;
        } else if (!byName) {
          // Checked against this tenant's clients only, so a name from another business
          // cannot attach — it fails to resolve, which is the correct and safe outcome.
          throw new CustomError(`client "${clientRef}" not found in this business`, 400);
        } else if (byName.ambiguous) {
          throw new CustomError(
            `client "${clientRef}" matches more than one client — use their email instead`,
            400,
          );
        } else {
          clientId = byName.id;
        }
      }

      prepared.push({
        title,
        value,
        stage,
        probability,
        expectedCloseDate,
        notes: cell('notes') || null,
        clientId,
      });
    } catch (err: any) {
      pushError(line, err?.message ?? 'Invalid row');
    }
  });

  if (errors.length) {
    return {
      imported: 0,
      skipped: dataRows.length,
      errors:
        errors.length >= CSV_IMPORT_LIMITS.maxReportedErrors
          ? [
              ...errors,
              `…and more. Fix the listed rows and re-upload; nothing was imported.`,
            ]
          : [...errors, 'Nothing was imported — fix these rows and re-upload.'],
    };
  }

  // businessId is null for the same reason as createDeal: it is the legacy CrmBusiness
  // anchor with no tenant mapping. serviceBusinessId is the anchor every read uses.
  await prisma.crmDeal.createMany({
    data: prepared.map((d) => ({
      ...d,
      businessId: null,
      serviceBusinessId,
      ...(d.stage === 'WON' || d.stage === 'LOST' ? { closedAt: new Date() } : {}),
    })),
  });

  return { imported: prepared.length, skipped: 0, errors: [] };
}
