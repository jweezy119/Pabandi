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
    /** Set true to book over a clash deliberately. A 409 should not be a hard wall. */
    allowConflict?: boolean;
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

  // Before the insert, so a clashing booking is refused rather than created and reported.
  // Only checked when an employee is named: a job with nobody assigned cannot double-book
  // anyone, and refusing unassigned jobs over a phantom conflict would be noise.
  if (employeeId) {
    await assertNoConflict(
      serviceBusinessId,
      employeeId,
      new Date(scheduledDate),
      scheduledTime,
      durationMinutes,
      { allowConflict: data.allowConflict === true },
    );
  }

  // Opening hours, checked independently of any employee: a business can be closed and a job
  // still get created with nobody assigned. Refuses with the actual window so it is
  // actionable, and overridable for the same reason the clash check is.
  if (data.allowConflict !== true) {
    const hours = await checkAvailabilityWindow(
      serviceBusinessId,
      new Date(scheduledDate),
      scheduledTime,
      durationMinutes,
    );
    if (!hours.ok) {
      throw Object.assign(
        new CustomError(`Outside opening hours: ${hours.reason}`, 409),
        { availability: hours.windows ?? [] },
      );
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

export async function assignEmployee(
  jobId: string,
  employeeId: string,
  serviceBusinessId?: string,
  businessId?: string | null,
  allowConflict = false,
) {
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

  // Reassignment is the easiest way to create a double-booking after the fact, so the new
  // employee is checked against the job's own window. The job itself is excluded, otherwise
  // re-assigning the job to the employee it is already assigned to would always "conflict"
  // with itself.
  const full = await prisma.crmJob.findUnique({
    where: { id: jobId },
    select: {
      scheduledDate: true,
      scheduledTime: true,
      durationMinutes: true,
      duration: true,
    },
  });
  if (full) {
    await assertNoConflict(
      serviceBusinessId!,
      employeeId,
      full.scheduledDate,
      full.scheduledTime,
      jobDurationMinutes(full),
      { excludeJobId: jobId, allowConflict: allowConflict === true },
    );
  }

  await prisma.crmJobAssignment.deleteMany({ where: { jobId } });
  const assignment = await prisma.crmJobAssignment.create({
    data: { jobId, employeeId },
  });
  // CrmJob.employeeId is never written by crm.service, but job.service READS it as
  // `include: { employee: true }`. Leaving it null made every job look unassigned on the
  // /api/v1/jobs read path while looking assigned on /api/v1/crm/jobs. Kept in step here so
  // both surfaces agree.
  await prisma.crmJob.update({ where: { id: jobId }, data: { employeeId } });
  return assignment;
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

// ── Double-booking ──────────────────────────────────────────────────────────

/**
 * Default job length when a row carries neither duration column.
 *
 * CrmJob has BOTH `duration` and `durationMinutes`. Nothing keeps them in step, so a job
 * written through one path may have only one of them. Falling back to 60 rather than
 * treating a missing duration as zero matters: a zero-length job overlaps nothing, so
 * treating "unknown" as "instant" silently disables the whole check for those rows.
 */
const DEFAULT_JOB_MINUTES = 60;

function jobDurationMinutes(job: { durationMinutes?: number | null; duration?: number | null }): number {
  const raw = job.durationMinutes ?? job.duration ?? DEFAULT_JOB_MINUTES;
  // A negative or absurd duration would make the window invalid (end before start), which
  // turns every overlap test false. Clamp rather than trust the column.
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_JOB_MINUTES;
  return Math.min(raw, 24 * 60);
}

export interface ScheduleConflict {
  jobId: string;
  serviceType: string;
  scheduledDate: string;
  scheduledTime: string | null;
  startsAt: string;
  endsAt: string;
}

/**
 * Find jobs that would overlap this employee.
 *
 * WHY BOTH ASSIGNMENT SOURCES ARE CHECKED
 * Assignment is written to `CrmJobAssignment` by crm.service and to `CrmJob.employeeId` by
 * job.service — two parallel representations of the same fact, and neither writes the
 * other. Checking only one makes the guard trivially bypassable: create the clashing job
 * through the other endpoint and the check sees nothing. So both are matched.
 *
 * CANCELLED jobs are ignored: a cancelled booking does not occupy the employee. COMPLETED
 * ones are NOT ignored — a completed job still occupied that window, and letting it overlap
 * is how a "double-booked" diary happens.
 *
 * Only jobs assigned to THIS employee in THIS tenant are considered. The tenant check is
 * what stops a business learning that one of its employees is booked at another.
 *
 * Overlap is half-open, [start, end): a 09:00-10:00 job and a 10:00-11:00 job do not
 * conflict, because back-to-back appointments are the normal case. Treating the boundary
 * as shared would reject every schedule where someone works back to back.
 */
export async function findJobConflicts(
  serviceBusinessId: string,
  employeeId: string,
  scheduledDate: Date,
  scheduledTime: string | null | undefined,
  durationMinutes: number,
  excludeJobId?: string,
): Promise<ScheduleConflict[]> {
  const start = composeJobStart(scheduledDate, scheduledTime);
  if (!start) {
    // An unparseable start cannot be proven to conflict with anything. Refusing the write
    // instead would break jobs whose time is absent but which are otherwise fine, so this
    // is a no-op and the caller still gets a created job.
    return [];
  }
  const span = jobDurationMinutes({ durationMinutes });
  const end = new Date(start.getTime() + span * 60000);

  // A day of slack either side, because a job late in the evening can run past midnight and
  // a job starting just before dawn can belong to the previous calendar day.
  const windowStart = new Date(start.getTime() - 864e5);
  const windowEnd = new Date(end.getTime() + 864e5);

  const candidates = await prisma.crmJob.findMany({
    where: {
      serviceBusinessId,
      status: { not: 'CANCELLED' },
      scheduledDate: { gte: windowStart, lte: windowEnd },
      ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
      OR: [{ employeeId }, { assignments: { some: { employeeId } } }],
    },
    select: {
      id: true,
      serviceType: true,
      scheduledDate: true,
      scheduledTime: true,
      durationMinutes: true,
      duration: true,
      status: true,
    },
  });

  const conflicts: ScheduleConflict[] = [];
  for (const job of candidates) {
    const otherStart = composeJobStart(job.scheduledDate, job.scheduledTime);
    if (!otherStart) continue;
    const otherEnd = new Date(
      otherStart.getTime() + jobDurationMinutes(job) * 60000,
    );
    // Half-open overlap: touching endpoints are not a conflict.
    if (start < otherEnd && otherStart < end) {
      conflicts.push({
        jobId: job.id,
        serviceType: job.serviceType,
        scheduledDate: job.scheduledDate.toISOString(),
        scheduledTime: job.scheduledTime,
        startsAt: otherStart.toISOString(),
        endsAt: otherEnd.toISOString(),
      });
    }
  }
  return conflicts;
}

/**
 * Throw a 409 if this employee is already booked.
 *
 * 409 rather than 400: the request is well-formed and the resource does not exist yet, so
 * this is a conflict with current state. The response carries the clashing job so the UI can
 * show "already booked 09:00-10:00 on <job>" rather than a bare refusal the user cannot act
 * on. Overridable via `allowConflict` — a business may genuinely want to double-book, and
 * the decision belongs to them, not to a 409.
 */
export async function assertNoConflict(
  serviceBusinessId: string,
  employeeId: string,
  scheduledDate: Date,
  scheduledTime: string | null | undefined,
  durationMinutes: number,
  opts: { excludeJobId?: string; allowConflict?: boolean } = {},
): Promise<void> {
  if (opts.allowConflict) return;
  const conflicts = await findJobConflicts(
    serviceBusinessId,
    employeeId,
    scheduledDate,
    scheduledTime,
    durationMinutes,
    opts.excludeJobId,
  );
  if (conflicts.length) {
    const first = conflicts[0];
    throw Object.assign(
      new CustomError(
        `Employee is already booked (${conflicts.length} overlapping job${conflicts.length === 1 ? '' : 's'}). ` +
          `First clash: ${first.serviceType} on ${first.startsAt} for ${first.endsAt}.`,
        409,
      ),
      { conflicts },
    );
  }
}

// ── Availability ────────────────────────────────────────────────────────────

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes since midnight for an "HH:mm" string, or null if it is not one. */
export function minutesOfDay(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = HHMM.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const MINUTES_IN_DAY = 24 * 60;

/**
 * Replace a business's weekly hours in one shot.
 *
 * Delete-then-insert rather than a diff, so re-running onboarding cannot leave a stale day
 * behind: the wizard toggles days off, and an upsert keyed on (business, weekday) would keep
 * the removed window forever.
 */
export async function setAvailability(
  serviceBusinessId: string,
  availability: {
    days?: unknown;
    startTime?: unknown;
    endTime?: unknown;
    slotMinutes?: unknown;
    bufferMinutes?: unknown;
  },
) {
  const start = minutesOfDay(availability?.startTime);
  const end = minutesOfDay(availability?.endTime);
  if (start === null || end === null) {
    throw new CustomError('startTime and endTime must be HH:mm', 400);
  }
  // endTime before startTime is allowed ONLY as an overnight window (a 22:00-02:00 shift).
  // Treating it as invalid would reject legitimate late shifts; treating it as same-day would
  // produce an empty window that silently blocks every booking.
  const overnight = end <= start;

  const slotMinutes = Number(availability?.slotMinutes ?? 60);
  const bufferMinutes = Number(availability?.bufferMinutes ?? 15);
  if (!Number.isFinite(slotMinutes) || slotMinutes < 5 || slotMinutes > 24 * 60) {
    throw new CustomError('slotMinutes must be between 5 and 1440', 400);
  }
  if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 24 * 60) {
    throw new CustomError('bufferMinutes must be between 0 and 1440', 400);
  }

  const days = Array.isArray(availability?.days) ? availability.days : [];
  const parsed = days.map(Number);
  if (parsed.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new CustomError('days must be weekday numbers 0-6 (0 = Sunday)', 400);
  }
  // De-duplicate rather than trusting the caller: a repeated day would violate the unique
  // index and surface as a P2002 500 on their input.
  const uniqueDays = [...new Set(parsed)].sort((a, b) => a - b);

  await prisma.$transaction([
    prisma.crmAvailability.deleteMany({ where: { serviceBusinessId } }),
    ...uniqueDays.map((weekday) =>
      prisma.crmAvailability.create({
        data: {
          serviceBusinessId,
          weekday,
          startTime: String(availability.startTime).trim(),
          endTime: String(availability.endTime).trim(),
          slotMinutes,
          bufferMinutes,
        },
      }),
    ),
  ]);

  return prisma.crmAvailability.findMany({
    where: { serviceBusinessId },
    orderBy: { weekday: 'asc' },
  });
}

export async function getAvailability(serviceBusinessId: string) {
  return prisma.crmAvailability.findMany({
    where: { serviceBusinessId },
    orderBy: { weekday: 'asc' },
  });
}

/**
 * Whether a job's window sits inside the business's opening hours.
 *
 * A BUSINESS-LEVEL rule, not per-employee: the model records one weekly window, so this
 * answers "are we open then", not "is this person free then". Free-vs-busy is the separate
 * conflict check (findJobConflicts); conflating the two would make availability look like it
 * does double-booking detection and quietly stop doing so.
 *
 * NO HOURS RECORDED MEANS NO RESTRICTION. A business that has never set availability keeps
 * the behaviour it had before this table existed. Defaulting to "closed" would silently break
 * every existing tenant's scheduling the moment this shipped, which is a far worse failure
 * than a business that has not opted into hours.
 */
export async function checkAvailabilityWindow(
  serviceBusinessId: string,
  scheduledDate: Date,
  scheduledTime: string | null | undefined,
  durationMinutes: number,
): Promise<{ ok: boolean; reason?: string; windows?: unknown[] }> {
  const start = composeJobStart(scheduledDate, scheduledTime);
  if (!start) return { ok: true }; // unparseable start: not this check's business to judge

  const hours = await prisma.crmAvailability.findMany({
    where: { serviceBusinessId },
    orderBy: { weekday: 'asc' },
  });
  if (!hours.length) return { ok: true };

  const weekday = start.getUTCDay();
  const dayStart = start.getUTCHours() * 60 + start.getUTCMinutes();
  const span = durationMinutes > 0 ? durationMinutes : 60;
  // Compare on the shifted window so a job starting 17:30 with a 90-minute duration is
  // checked against the closing time, not against its start.
  const dayEnd = dayStart + span;

  const todays = hours.filter((h) => h.weekday === weekday);
  if (!todays.length) {
    return { ok: false, reason: `The business is not open on this day (weekday ${weekday})` };
  }

  for (const w of todays) {
    const opens = minutesOfDay(w.startTime);
    const closes = minutesOfDay(w.endTime);
    if (opens === null || closes === null) continue;
    const overnight = closes <= opens;
    const effectiveClose = overnight ? closes + MINUTES_IN_DAY : closes;
    // An overnight window that started yesterday still covers this morning, so a job at
    // 01:00 must be tested against yesterday's window too.
    const effectiveOpen = dayStart < closes && overnight ? opens - MINUTES_IN_DAY : opens;
    if (dayStart >= effectiveOpen && dayEnd <= effectiveClose) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    reason: `Outside opening hours (${todays[0].startTime}-${todays[0].endTime})`,
    windows: todays.map((w) => ({ weekday: w.weekday, startTime: w.startTime, endTime: w.endTime })),
  };
}

/** Slugify a business name into something URL-safe and unlikely to collide. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'business';
}

/**
 * Claim a unique slug, appending a numeric suffix on collision.
 *
 * Never trusts the caller's preferred slug beyond a sanitised form: a shared handle would
 * let one business appear at another business's public URL.
 */
export async function claimSlug(serviceBusinessId: string, preferred: string): Promise<string> {
  const base = slugify(preferred);
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await prisma.crmServiceBusiness.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash) {
      await prisma.crmServiceBusiness.update({
        where: { id: serviceBusinessId },
        data: { slug: candidate },
      });
      return candidate;
    }
    if (clash.id === serviceBusinessId) return candidate;
  }
  // 25 collisions on one stem means the stem is heavily taken; a random suffix is better than
  // failing the customer's onboarding.
  const candidate = `${base}-${Math.floor(Math.random() * 100000).toString(36)}`;
  await prisma.crmServiceBusiness.update({
    where: { id: serviceBusinessId },
    data: { slug: candidate },
  });
  return candidate;
}

// ── CSV import: clients ─────────────────────────────────────────────────────

export interface ImportClientsResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Import clients from CSV.
 *
 * Mirrors importDeals deliberately: the same byte/row/column caps, the same all-or-nothing
 * transaction, the same "row N" error numbering the user sees in their spreadsheet, and the
 * same capped error list. Two importers with different rules would mean a file accepted in one
 * place and rejected in the other, with no way for the user to predict which.
 *
 * ALL-OR-NOTHING here because a partially imported client list is worse than a refused file:
 * duplicates and half-created records are exactly what an import is meant to avoid, and a
 * customer who re-uploads a corrected file on top of a partial one gets duplicates.
 *
 * Email is deduplicated WITHIN the file and against the tenant's existing clients. Both matter:
 * an in-file duplicate creates two rows the user cannot tell apart, and an existing duplicate
 * turns a "restore my data" import into a second copy of everyone. Compared per row (case
 * -insensitively, since email local parts are conventionally case-insensitive) rather than
 * trusting the database, because CrmClient.email has no unique constraint.
 */
export async function importClients(
  serviceBusinessId: string,
  csvText: string,
): Promise<ImportClientsResult> {
  if (typeof csvText !== 'string' || csvText.trim() === '') {
    throw new CustomError('csvData is required', 400);
  }
  const bytes = Buffer.byteLength(csvText, 'utf8');
  if (bytes > CSV_IMPORT_LIMITS.maxBytes) {
    throw new CustomError(
      `CSV is too large (${bytes} bytes, limit ${CSV_IMPORT_LIMITS.maxBytes})`,
      413,
    );
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new CustomError('CSV needs a header row and at least one data row', 400);

  const header = rows[0].map((h) => h.trim().toLowerCase());
  if (!header.includes('name')) {
    throw new CustomError(
      `CSV must have a "name" column. Found: ${header.join(', ') || '(none)'}`,
      400,
    );
  }
  const col = (name: string) => header.indexOf(name);

  const dataRows = rows.slice(1);
  const errors: string[] = [];
  const pushError = (line: number, message: string) => {
    if (errors.length < CSV_IMPORT_LIMITS.maxReportedErrors) {
      errors.push(`Row ${line}: ${message}`);
    }
  };

  // Existing emails for THIS tenant only, so an address from another business is neither
  // matched nor reported as a duplicate -- it simply is not ours.
  const existing = await prisma.crmClient.findMany({
    where: { serviceBusinessId },
    select: { email: true },
  });
  const seenEmails = new Set(
    existing.map((c) => (c.email ?? '').trim().toLowerCase()).filter(Boolean),
  );
  // Also keyed by name, since a CSV may identify a person by name only.
  const existingNames = new Set(
    (await prisma.crmClient.findMany({
      where: { serviceBusinessId },
      select: { name: true },
    })).map((c) => c.name.trim().toLowerCase()),
  );

  const VALID_STATUS = new Set(['ACTIVE', 'AT_RISK', 'VIP', 'INACTIVE']);

  const prepared: Array<{
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    status: string;
    serviceBusinessId: string;
    businessId: null;
  }> = [];

  dataRows.forEach((row, index) => {
    const line = index + 2;
    const cell = (name: string) => {
      const i = col(name);
      return i === -1 ? '' : (row[i] ?? '').trim();
    };

    try {
      const name = cell('name');
      if (!name) throw new CustomError('name is required', 400);

      // A very small shape check rather than a full RFC 5322 validation: the goal is to catch
      // a column-shift (a name landing in the email column), not to adjudicate real addresses,
      // and a strict regex would reject legitimate ones.
      const email = cell('email').toLowerCase() || null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new CustomError(`"${email}" does not look like an email address`, 400);
      }

      const nameKey = name.toLowerCase();
      if (existingNames.has(nameKey)) {
        throw new CustomError(`a client named "${name}" already exists in this business`, 400);
      }
      if (email && seenEmails.has(email)) {
        throw new CustomError(`${email} already exists in this business`, 400);
      }

      const rawStatus = cell('status').toUpperCase();
      const status = rawStatus && VALID_STATUS.has(rawStatus) ? rawStatus : 'ACTIVE';

      // Register immediately so a duplicate LATER in the same file is caught too.
      existingNames.add(nameKey);
      if (email) seenEmails.add(email);

      prepared.push({
        name,
        email,
        phone: cell('phone') || null,
        // `company` is what the wizard's template advertises, so it is accepted and folded
        // into the notes rather than silently dropped -- the user typed it for a reason.
        address: cell('address') || null,
        notes: [cell('notes'), cell('company') && `Company: ${cell('company')}`]
          .filter(Boolean)
          .join('\n') || null,
        status,
        serviceBusinessId,
        businessId: null,
      });
    } catch (err: any) {
      pushError(line, err?.message ?? 'Invalid row');
    }
  });

  if (errors.length) {
    return {
      imported: 0,
      skipped: dataRows.length,
      errors: [
        ...errors,
        errors.length >= CSV_IMPORT_LIMITS.maxReportedErrors
          ? '…and more. Fix the listed rows and re-upload; nothing was imported.'
          : 'Nothing was imported — fix these rows and re-upload.',
      ],
    };
  }

  await prisma.crmClient.createMany({ data: prepared });
  return { imported: prepared.length, skipped: 0, errors: [] };
}
