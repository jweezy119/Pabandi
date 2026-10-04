import { prisma } from '../utils/database';
import { trustCore } from '../trust/trust-core';
import { invoiceGenerationService } from './invoiceGeneration.service';
import { CustomError } from '../middleware/errorHandler';
import { assertNoConflict } from './crm.service';

type JobCreateData = {
  clientId?: string;
  serviceType: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes?: number;
  price?: number;
  address?: string;
  notes?: string;
  employeeId?: string;
};

/**
 * Job reads and writes, scoped to the CURRENT tenant.
 *
 * WHY THE SIGNATURE CHANGED
 * Every function here used to take a bare `businessId` that the ROUTE read from
 * `req.body.businessId || req.query.businessId`. With only `authenticate` on the router,
 * that meant any logged-in user could read any business's job schedule — client names,
 * service addresses and appointment times — and create jobs in it. Jobs carry physical
 * addresses, so this is a materially worse leak than the financials one.
 *
 * It also used the WRONG id space: `CrmJob.businessId` is a foreign key to the legacy
 * CrmBusiness table, while the id a caller has is the platform Business id, so these reads
 * matched nothing for a correctly enrolled business.
 *
 * The tenant now comes from the resolved CRM context, and every query filters on
 * `serviceBusinessId`. `checkInJob`, `checkOutJob` and `handleNoShow` took NO tenant at all
 * — `findUnique({ where: { id: jobId } })` — so any user could check in, complete (which
 * also generates an invoice) or mark missed any job in the platform. They now fail closed.
 */
export async function createJob(serviceBusinessId: string, data: JobCreateData) {
  const { clientId, serviceType, scheduledDate, scheduledTime, durationMinutes, address, notes, price, employeeId } = data;
  if (!serviceType || !scheduledDate || !scheduledTime || !clientId) throw new CustomError('clientId, serviceType, scheduledDate, and scheduledTime are required', 400);

  // Neither the client nor the employee was checked against the tenant. Booking work against
  // another business's client, or scheduling one of their employees, was both possible.
  const client = await prisma.crmClient.findFirst({
    where: { id: clientId, serviceBusinessId },
    select: { id: true, name: true },
  });
  if (!client) throw new CustomError('Client not found for this business', 404);

  if (employeeId) {
    const employee = await prisma.crmEmployee.findFirst({
      where: { id: employeeId, serviceBusinessId },
      select: { id: true },
    });
    if (!employee) throw new CustomError('Employee not found for this business', 404);
    await assertNoConflict(
      serviceBusinessId,
      employeeId,
      new Date(scheduledDate),
      scheduledTime,
      durationMinutes ?? 60,
      { allowConflict: (data as { allowConflict?: boolean }).allowConflict === true },
    );
  }

  const job = await prisma.crmJob.create({
    data: {
      // businessId is the LEGACY CrmBusiness anchor and is deliberately null: the id a
      // caller holds is the platform Business id, and the two do not belong in the same
      // column. serviceBusinessId is the anchor every read uses.
      businessId: null,
      clientId,
      serviceType,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      durationMinutes: durationMinutes || 60,
      price: price || 0,
      address: address || null,
      notes: notes || null,
      status: 'SCHEDULED',
      employeeId: employeeId || null,
      serviceBusinessId,
      // Required column, and a denormalized snapshot on purpose: a later client rename must
      // not rewrite the name on historical jobs and invoices.
      clientName: client.name,
    },
    include: { client: true, employee: true, assignments: { include: { employee: true } } },
  });

  return job;
}

type JobFilter = {
  status?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function getJobs(serviceBusinessId: string, filters?: JobFilter) {
  const where: Record<string, unknown> = { serviceBusinessId };
  if (filters?.status) where.status = filters.status;
  if (filters?.clientId) where.clientId = filters.clientId;
  if (filters?.dateFrom) where.scheduledDate = { ...(where.scheduledDate as any), gte: new Date(filters.dateFrom) };
  if (filters?.dateTo) where.scheduledDate = { ...(where.scheduledDate as any), lte: new Date(filters.dateTo) };

  return prisma.crmJob.findMany({
    where,
    include: { client: true, employee: true, assignments: { include: { employee: true } } },
    orderBy: { scheduledDate: 'asc' },
  });
}

export async function getJob(serviceBusinessId: string, jobId: string) {
  const job = await prisma.crmJob.findFirst({
    where: { id: jobId, serviceBusinessId },
    include: { client: true, employee: true, assignments: { include: { employee: true } } },
  });
  if (!job) throw new CustomError('Job not found', 404);
  return job;
}

export async function updateJob(serviceBusinessId: string, jobId: string, data: Partial<JobCreateData>) {
  const job = await prisma.crmJob.findFirst({
    where: { id: jobId, serviceBusinessId },
    include: { assignments: true },
  });
  if (!job) throw new CustomError('Job not found', 404);

  const updateData: Record<string, unknown> = { ...data };
  if (data.scheduledDate) updateData.scheduledDate = new Date(data.scheduledDate);

  // A reschedule is a new time window for whoever is assigned, so it needs the same
  // clash check as a create. Skipping it made the create-time check cosmetic: book cleanly,
  // then move the job on top of another one.
  // Runs whenever the window or the assignee can have moved — not only when scheduledDate is
  // present. Gating on the date meant the commonest edit of all, changing the TIME, skipped
  // the check entirely, so a job could be dragged on top of another one with a single field.
  const scheduleChanged =
    data.scheduledDate !== undefined || data.scheduledTime !== undefined || data.employeeId !== undefined;
  // The assignee has to be resolved from BOTH places it can live. A job booked through
  // crm.service records the employee in CrmJobAssignment and leaves CrmJob.employeeId
  // null, so reading only the column found nobody and skipped the clash check — the
  // reschedule guard silently did nothing for every CRM-created job.
  const nextEmployeeId =
    (data.employeeId as string | undefined) ??
    job.employeeId ??
    job.assignments[0]?.employeeId ??
    null;
  if (nextEmployeeId && scheduleChanged) {
    await assertNoConflict(
      serviceBusinessId,
      nextEmployeeId,
      updateData.scheduledDate ? new Date(updateData.scheduledDate as string) : job.scheduledDate,
      (data.scheduledTime as string | undefined) ?? job.scheduledTime,
      (data.durationMinutes as number | undefined) ?? job.durationMinutes ?? job.duration ?? 60,
      { excludeJobId: jobId, allowConflict: (data as { allowConflict?: boolean }).allowConflict === true },
    );
  }

  return prisma.crmJob.update({
    where: { id: jobId },
    data: updateData,
    include: { client: true },
  });
}

export async function checkInJob(serviceBusinessId: string, jobId: string, userId: string) {
  const job = await prisma.crmJob.findFirst({
    where: { id: jobId, serviceBusinessId },
    include: { client: true },
  });
  if (!job || job.status !== 'SCHEDULED') throw new CustomError('Job not found or not SCHEDULED', 400);

  const updatedJob = await prisma.crmJob.update({
    where: { id: jobId },
    data: { status: 'IN_PROGRESS', checkedInAt: new Date() },
    include: { client: true }
  });

  if (job.client?.passportId) {
    await trustCore.emit('delivery.checked_in', {
      jobId,
      clientPassportId: job.client.passportId,
      timestamp: updatedJob.checkedInAt,
    });
  }
  return updatedJob;
}

export async function checkOutJob(serviceBusinessId: string, jobId: string, userId: string) {
  const job = await prisma.crmJob.findFirst({
    where: { id: jobId, serviceBusinessId },
    include: { client: true },
  });
  if (!job || job.status !== 'IN_PROGRESS') throw new CustomError('Job not found or not IN_PROGRESS', 400);

  const now = new Date();
  const checkedInAt = job.checkedInAt || now;
  const durationMinutes = Math.max(0, (now.getTime() - checkedInAt.getTime()) / 60000);
  const isLate = durationMinutes > (job.durationMinutes || 0) + 15;

  const updatedJob = await prisma.crmJob.update({
    where: { id: jobId },
    data: { status: 'COMPLETED', checkedOutAt: now, durationMinutes: Math.round(durationMinutes) },
    include: { client: true }
  });

  if (job.client?.passportId) {
    const eventType = isLate ? 'delivery.late' : 'delivery.on_time';
    await trustCore.emit(eventType, {
      jobId,
      clientPassportId: job.client.passportId,
      workerId: userId,
      durationMinutes,
      timestamp: now,
    });
  }

  // Auto-generate invoice
  await invoiceGenerationService.generateInvoiceFromJob(jobId);

  return updatedJob;
}

export async function handleNoShow(serviceBusinessId: string, jobId: string) {
  const job = await prisma.crmJob.findFirst({
    where: { id: jobId, serviceBusinessId },
    include: { client: true },
  });
  if (!job || job.status !== 'SCHEDULED') return;

  const scheduledTime = new Date(`${job.scheduledDate.toISOString().split('T')[0]}T${job.scheduledTime}`);
  const minutesLate = (new Date().getTime() - scheduledTime.getTime()) / 60000;

  if (minutesLate > 30) {
    await prisma.crmJob.update({ where: { id: jobId }, data: { status: 'MISSED' } });
    if (job.client?.passportId) {
      await trustCore.emit('delivery.missed', {
        jobId,
        clientPassportId: job.client.passportId,
        minutesLate,
      });
    }
  }
}
