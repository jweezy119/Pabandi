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

export async function getEmployees(serviceBusinessId: string) {
  return prisma.crmEmployee.findMany({
    where: { serviceBusinessId },
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

export async function getClients(serviceBusinessId: string) {
  const clients = await prisma.crmClient.findMany({
    where: { serviceBusinessId },
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
  }
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
    where: { id: clientId, serviceBusinessId },
    select: { id: true, name: true },
  });
  if (!client) {
    throw new CustomError('Client not found for this business', 404);
  }

  if (employeeId) {
    const employee = await prisma.crmEmployee.findFirst({
      where: { id: employeeId, serviceBusinessId },
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

export async function assignEmployee(jobId: string, employeeId: string, serviceBusinessId?: string) {
  // Both sides must belong to the same business as the job, otherwise an
  // assignment could bridge two businesses' workforces.
  const job = await prisma.crmJob.findFirst({
    where: { id: jobId, ...(serviceBusinessId && { serviceBusinessId }) },
    select: { id: true },
  });
  if (!job) throw new CustomError('Job not found', 404);

  const employee = await prisma.crmEmployee.findFirst({
    where: { id: employeeId, ...(serviceBusinessId && { serviceBusinessId }) },
    select: { id: true },
  });
  if (!employee) throw new CustomError('Employee not found', 404);

  await prisma.crmJobAssignment.deleteMany({ where: { jobId } });
  return prisma.crmJobAssignment.create({
    data: { jobId, employeeId },
  });
}

export async function updateJobStatus(jobId: string, status: string, serviceBusinessId?: string) {
  if (!['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
    throw new CustomError('Invalid status', 400);
  }

  // Scoped update: an unscoped `update` by id would let any authenticated caller
  // rewrite the status of any job on the platform.
  const existing = await prisma.crmJob.findFirst({
    where: { id: jobId, ...(serviceBusinessId && { serviceBusinessId }) },
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
  filters?: { status?: string; employeeId?: string; clientId?: string; dateFrom?: string; dateTo?: string }
) {
  const where: any = { serviceBusinessId };

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
  }
) {
  const { employeeId, periodStart, periodEnd, hoursWorked = 0, jobsCompleted = 0, grossPay, deductions = 0, netPay } = data;

  return prisma.crmPayroll.create({
    data: {
      serviceBusinessId,
      employeeId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
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

export async function getPayrollHistory(serviceBusinessId: string, employeeId?: string) {
  const where: any = { serviceBusinessId };
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

export async function getExpenses(serviceBusinessId: string, filters?: { category?: string; dateFrom?: string; dateTo?: string }) {
  const where: any = { serviceBusinessId };
  if (filters?.category) where.category = filters.category;
  if (filters?.dateFrom) where.date = { ...where.date, gte: new Date(filters.dateFrom) };
  if (filters?.dateTo) where.date = { ...where.date, lte: new Date(filters.dateTo) };

  return prisma.crmExpense.findMany({
    where,
    orderBy: { date: 'desc' },
  });
}

// ─── Dashboard Statistics ───────────────────────────────────────────────────

export async function getDashboardStats(serviceBusinessId: string) {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const totalJobs = await prisma.crmJob.count({ where: { serviceBusinessId } });
  const completedJobs = await prisma.crmJob.count({
    where: { serviceBusinessId, status: 'COMPLETED' },
  });
  const activeClients = await prisma.crmClient.count({ where: { serviceBusinessId } });

  const completedJobsThisMonth = await prisma.crmJob.findMany({
    where: {
      serviceBusinessId,
      status: 'COMPLETED',
      scheduledDate: { gte: firstDayOfMonth, lte: lastDayOfMonth },
    },
    select: { price: true },
  });
  const monthlyRevenue = completedJobsThisMonth.reduce((sum, job) => sum + job.price, 0);

  const monthlyExpensesData = await prisma.crmExpense.findMany({
    where: {
      serviceBusinessId,
      date: { gte: firstDayOfMonth, lte: lastDayOfMonth },
    },
    select: { amount: true },
  });
  const monthlyExpenses = monthlyExpensesData.reduce((sum, exp) => sum + exp.amount, 0);

  const payrollCostsData = await prisma.crmPayroll.findMany({
    where: {
      serviceBusinessId,
      periodStart: { gte: firstDayOfMonth },
      periodEnd: { lte: lastDayOfMonth },
    },
    select: { netPay: true },
  });
  const payrollCosts = payrollCostsData.reduce((sum, p) => sum + p.netPay, 0);

  const employees = await prisma.crmEmployee.findMany({
    where: { serviceBusinessId, isActive: true },
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
  serviceBusinessId?: string
) {
  // Scoped lookup: without serviceBusinessId a caller could check in any job on
  // the platform just by guessing an id.
  const job = await prisma.crmJob.findFirst({
    where: { id: jobId, ...(serviceBusinessId && { serviceBusinessId }) },
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
  serviceBusinessId?: string
) {
  const job = await prisma.crmJob.findFirst({
    where: { id: jobId, ...(serviceBusinessId && { serviceBusinessId }) },
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

export async function handleNoShow(jobId: string) {
  const job = await prisma.crmJob.findUnique({
    where: { id: jobId },
    include: { client: true }
  });

  if (!job) {
    return;
  }

  if (job.status !== 'SCHEDULED') {
    return; // Already processed
  }

  const now = new Date();
  const scheduledTime = new Date(`${job.scheduledDate}T${job.scheduledTime}`);

  // Check if it's been more than 30 minutes since scheduled time
  const minutesLate = (now.getTime() - scheduledTime.getTime()) / (1000 * 60);
  if (minutesLate > 30) {
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
