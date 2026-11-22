import { prisma } from '../utils/database';
import { trustCore } from '../trust/trust-core';
import { invoiceGenerationService } from './invoiceGeneration.service';
import { CustomError } from '../middleware/errorHandler';
import { assertNoConflict, checkAvailabilityWindow, composeJobStart } from './crm.service';
import { connectionService } from './connection.service';
import { logger } from '../utils/logger';

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
  allowConflict?: boolean;
};

/**
 * Job reads and writes, scoped to the CURRENT tenant.
 *
 * WHY THE SIGNATURE IS WHAT IT IS
 * Every function here used to take a bare `businessId` that the ROUTE read from
 * `req.body.businessId || req.query.businessId`. With only `authenticate` on the
 * router, that meant any logged-in user could read any business's job schedule —
 * client names, service ADDRESSES and appointment times — and create jobs in it.
 * Jobs carry physical addresses, so this is a materially worse leak than the
 * financials one.
 *
 * The tenant now comes from the resolved CRM context, and every query filters on
 * it. `checkInJob`, `checkOutJob` and `handleNoShow` took NO tenant at all —
 * `findUnique({ where: { id: jobId } })` — so any user could check in,
 * complete (which also generates an invoice) or mark missed any job in the
 * platform. They now fail closed.
 *
 * JOBS ARE BOOKINGS
 * `CrmJob` and `CrmJobAssignment` no longer exist; the schema purge replaced them
 * with the platform's Booking rows. So `scheduledDate`+`scheduledTime` map to
 * `slotStart`, the duration to `slotEnd - slotStart`, `address` to
 * `clientAddress`, `price` to `depositAmount`, and the assignee is
 * `Booking.employeeId`. Conflict detection reads the same column, so there is no
 * second path that can bypass it.
 */
export async function createJob(serviceBusinessId: string, data: JobCreateData) {
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
  } = data;
  if (!serviceType || !scheduledDate || !scheduledTime || !clientId) {
    throw new CustomError(
      'clientId, serviceType, scheduledDate, and scheduledTime are required',
      400,
    );
  }

  // Neither the client nor the employee was checked against the tenant. Booking
  // work against another business's client, or scheduling one of their employees,
  // was both possible.
  const client = await prisma.crmClient.findFirst({
    where: { id: clientId, serviceBusinessId },
    select: { id: true, name: true },
  });
  if (!client) throw new CustomError('Client not found for this business', 404);

  const start = composeJobStart(scheduledDate, scheduledTime);
  if (!start) {
    throw new CustomError('scheduledDate and scheduledTime must be valid', 400);
  }
  const span = durationMinutes && durationMinutes > 0 ? durationMinutes : 60;
  const end = new Date(start.getTime() + span * 60000);

  if (employeeId) {
    const employee = await prisma.crmEmployee.findFirst({
      where: { id: employeeId, serviceBusinessId },
      select: { id: true },
    });
    if (!employee) throw new CustomError('Employee not found for this business', 404);
    await assertNoConflict(serviceBusinessId, employeeId, start, scheduledTime, span, {
      allowConflict: data.allowConflict === true,
    });
  }

  // Opening hours apply whether or not an employee is named.
  if (data.allowConflict !== true) {
    const hours = await checkAvailabilityWindow(
      serviceBusinessId,
      start,
      scheduledTime,
      span,
    );
    if (!hours.ok) {
      throw Object.assign(new CustomError(`Outside opening hours: ${hours.reason}`, 409), {
        availability: hours.windows ?? [],
      });
    }
  }

  return prisma.booking.create({
    data: {
      businessId: serviceBusinessId,
      clientId,
      serviceType: String(serviceType),
      slotStart: start,
      slotEnd: end,
      clientAddress: address || null,
      depositAmount: Number(price ?? 0),
      status: 'SCHEDULED',
      employeeId: employeeId || null,
      metadata: notes ? { notes: String(notes) } : undefined,
    },
    include: { client: true },
  });
}

type JobFilter = {
  status?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function getJobs(serviceBusinessId: string, filters?: JobFilter) {
  const where: Record<string, unknown> = { businessId: serviceBusinessId };
  if (filters?.status) where.status = filters.status;
  if (filters?.clientId) where.clientId = filters.clientId;
  if (filters?.dateFrom) where.slotStart = { gte: new Date(filters.dateFrom) };
  if (filters?.dateTo) {
    where.slotStart = {
      ...(where.slotStart as object | undefined),
      lte: new Date(filters.dateTo),
    };
  }

  return prisma.booking.findMany({
    where,
    include: { client: true },
    orderBy: { slotStart: 'asc' },
  });
}

export async function getJob(serviceBusinessId: string, jobId: string) {
  const job = await prisma.booking.findFirst({
    where: { id: jobId, businessId: serviceBusinessId },
    include: { client: true },
  });
  if (!job) throw new CustomError('Job not found', 404);
  return job;
}

export async function updateJob(
  serviceBusinessId: string,
  jobId: string,
  data: Partial<JobCreateData>,
) {
  const job = await prisma.booking.findFirst({
    where: { id: jobId, businessId: serviceBusinessId },
  });
  if (!job) throw new CustomError('Job not found', 404);

  const updateData: Record<string, unknown> = {};
  if (data.address !== undefined) updateData.clientAddress = String(data.address);
  if (data.notes !== undefined) {
    updateData.metadata = { ...((job.metadata as object) ?? {}), notes: String(data.notes) };
  }
  if (data.serviceType !== undefined) updateData.serviceType = String(data.serviceType);
  if (data.price !== undefined) updateData.depositAmount = Number(data.price);

  // A reschedule is a new time window for whoever is assigned, so it needs the
  // same clash check as a create. Skipping it made the create-time check
  // cosmetic: book cleanly, then move the job on top of another one.
  const scheduleChanged =
    data.scheduledDate !== undefined ||
    data.scheduledTime !== undefined ||
    data.durationMinutes !== undefined ||
    data.employeeId !== undefined;

  if (data.scheduledDate !== undefined || data.scheduledTime !== undefined) {
    const start = composeJobStart(
      data.scheduledDate ?? job.slotStart,
      data.scheduledTime ?? `${String(job.slotStart.getUTCHours()).padStart(2, '0')}:${String(
        job.slotStart.getUTCMinutes(),
      ).padStart(2, '0')}`,
    );
    if (!start) throw new CustomError('scheduledDate and scheduledTime must be valid', 400);
    const span =
      data.durationMinutes && data.durationMinutes > 0
        ? data.durationMinutes
        : Math.max(
            0,
            Math.round((job.slotEnd.getTime() - job.slotStart.getTime()) / 60000),
          ) || 60;
    updateData.slotStart = start;
    updateData.slotEnd = new Date(start.getTime() + span * 60000);
  } else if (data.durationMinutes !== undefined && data.durationMinutes > 0) {
    updateData.slotEnd = new Date(
      job.slotStart.getTime() + data.durationMinutes * 60000,
    );
  }

  if (data.employeeId !== undefined) updateData.employeeId = data.employeeId || null;

  const nextEmployeeId = (data.employeeId as string | undefined) ?? job.employeeId ?? null;
  if (nextEmployeeId && scheduleChanged) {
    await assertNoConflict(
      serviceBusinessId,
      nextEmployeeId,
      (updateData.slotStart as Date) ?? job.slotStart,
      data.scheduledTime,
      Math.max(
        0,
        Math.round(
          (((updateData.slotEnd as Date) ?? job.slotEnd).getTime() -
            ((updateData.slotStart as Date) ?? job.slotStart).getTime()) /
            60000,
        ),
      ) || 60,
      {
        excludeJobId: jobId,
        allowConflict: data.allowConflict === true,
      },
    );
  }

  return prisma.booking.update({
    where: { id: jobId },
    data: updateData,
    include: { client: true },
  });
}

/**
 * Assign or reassign a job.
 *
 * Reassignment is the easiest way to create a double-booking after the fact, so
 * it carries the same clash check as a create — with the job itself excluded,
 * or re-assigning to the employee it is already on would self-conflict.
 */
export async function assignJob(
  serviceBusinessId: string,
  jobId: string,
  employeeId: string,
  opts: { allowConflict?: boolean } = {},
) {
  const job = await prisma.booking.findFirst({
    where: { id: jobId, businessId: serviceBusinessId },
  });
  if (!job) throw new CustomError('Job not found', 404);

  const employee = await prisma.crmEmployee.findFirst({
    where: { id: employeeId, serviceBusinessId },
    select: { id: true },
  });
  if (!employee) throw new CustomError('Employee not found for this business', 404);

  const span =
    Math.max(0, Math.round((job.slotEnd.getTime() - job.slotStart.getTime()) / 60000)) || 60;
  const hh = String(job.slotStart.getUTCHours()).padStart(2, '0');
  const mm = String(job.slotStart.getUTCMinutes()).padStart(2, '0');
  await assertNoConflict(serviceBusinessId, employeeId, job.slotStart, `${hh}:${mm}`, span, {
    excludeJobId: jobId,
    allowConflict: opts.allowConflict === true,
  });

  return prisma.booking.update({
    where: { id: jobId },
    data: { employeeId },
    include: { client: true },
  });
}

export async function checkInJob(serviceBusinessId: string, jobId: string, userId: string) {
  const job = await prisma.booking.findFirst({
    where: { id: jobId, businessId: serviceBusinessId },
    include: { client: true },
  });
  if (!job || job.status !== 'SCHEDULED') {
    throw new CustomError('Job not found or not SCHEDULED', 400);
  }

  const updatedJob = await prisma.booking.update({
    where: { id: jobId },
    data: { status: 'IN_PROGRESS', checkedInAt: new Date() },
    include: { client: true },
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
  const job = await prisma.booking.findFirst({
    where: { id: jobId, businessId: serviceBusinessId },
    include: { client: true },
  });
  if (!job || job.status !== 'IN_PROGRESS') {
    throw new CustomError('Job not found or not IN_PROGRESS', 400);
  }

  const now = new Date();
  const checkedInAt = job.checkedInAt || now;
  const durationMinutes = Math.max(0, (now.getTime() - checkedInAt.getTime()) / 60000);
  const scheduled = job.slotEnd.getTime() - job.slotStart.getTime();
  const isLate = durationMinutes > scheduled / 60000 + 15;

  const updatedJob = await prisma.booking.update({
    where: { id: jobId },
    data: { status: 'COMPLETED', checkedOutAt: now },
    include: { client: true },
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

  // Upsert connection
  if (job.client?.email) {
    const serviceBusiness = await prisma.business.findUnique({ where: { id: serviceBusinessId } });
    if (serviceBusiness?.ownerId) {
      const clientUser = await prisma.user.findFirst({ where: { email: job.client.email } });
      if (clientUser && clientUser.id !== serviceBusiness.ownerId) {
        await connectionService
          .upsertConnection(
            serviceBusiness.ownerId,
            clientUser.id,
            serviceBusiness.id,
            'crm_job_completed',
          )
          .catch((err) =>
            logger.error(`[JobService] Failed to upsert connection: ${err.message}`),
          );
      }
    }
  }

  return updatedJob;
}

export async function handleNoShow(serviceBusinessId: string, jobId: string) {
  const job = await prisma.booking.findFirst({
    where: { id: jobId, businessId: serviceBusinessId },
    include: { client: true },
  });
  if (!job || job.status !== 'SCHEDULED') return;

  const minutesLate = (new Date().getTime() - job.slotStart.getTime()) / 60000;

  if (minutesLate > 30) {
    await prisma.booking.update({ where: { id: jobId }, data: { status: 'MISSED' } });
    if (job.client?.passportId) {
      await trustCore.emit('delivery.missed', {
        jobId,
        clientPassportId: job.client.passportId,
        minutesLate,
      });
    }
  }
}
