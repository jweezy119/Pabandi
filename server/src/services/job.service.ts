import { prisma } from '../utils/database';
import { trustCore } from '../trust/trust-core';
import { invoiceGenerationService } from './invoiceGeneration.service';
import { CustomError } from '../middleware/errorHandler';

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

export async function createJob(businessId: string, data: JobCreateData) {
  const { clientId, serviceType, scheduledDate, scheduledTime, durationMinutes, address, notes, price, employeeId } = data;
  if (!serviceType || !scheduledDate || !scheduledTime) throw new CustomError('serviceType, scheduledDate, and scheduledTime are required', 400);

  const job = await prisma.crmJob.create({
    data: {
      businessId,
      clientId: clientId || null,
      serviceType,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      durationMinutes: durationMinutes || 60,
      price: price || 0,
      address: address || null,
      notes: notes || null,
      status: 'SCHEDULED',
    },
    include: { client: true },
  });

  if (employeeId) {
    await prisma.crmJobAssignment.create({
      data: { jobId: job.id, employeeId },
    });
  }

  return job;
}

type JobFilter = {
  status?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function getJobs(businessId: string, filters?: JobFilter) {
  const where: Record<string, unknown> = { businessId };
  if (filters?.status) where.status = filters.status;
  if (filters?.clientId) where.clientId = filters.clientId;
  if (filters?.dateFrom) where.scheduledDate = { ...where.scheduledDate, gte: new Date(filters.dateFrom) };
  if (filters?.dateTo) where.scheduledDate = { ...where.scheduledDate, lte: new Date(filters.dateTo) };

  return prisma.crmJob.findMany({
    where,
    include: { client: true, assignments: { include: { employee: true } } },
    orderBy: { scheduledDate: 'asc' },
  });
}

export async function getJob(businessId: string, jobId: string) {
  const job = await prisma.crmJob.findFirst({
    where: { id: jobId, businessId },
    include: { client: true, assignments: { include: { employee: true } } },
  });
  if (!job) throw new CustomError('Job not found', 404);
  return job;
}

export async function updateJob(businessId: string, jobId: string, data: Partial<JobCreateData>) {
  const job = await prisma.crmJob.findFirst({ where: { id: jobId, businessId } });
  if (!job) throw new CustomError('Job not found', 404);

  const updateData: Record<string, unknown> = { ...data };
  if (data.scheduledDate) updateData.scheduledDate = new Date(data.scheduledDate);

  return prisma.crmJob.update({
    where: { id: jobId },
    data: updateData,
    include: { client: true },
  });
}

export async function checkInJob(jobId: string, userId: string) {
  const job = await prisma.crmJob.findUnique({ where: { id: jobId }, include: { client: true } });
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

export async function checkOutJob(jobId: string, userId: string) {
  const job = await prisma.crmJob.findUnique({ where: { id: jobId }, include: { client: true } });
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

export async function handleNoShow(jobId: string) {
  const job = await prisma.crmJob.findUnique({ where: { id: jobId }, include: { client: true } });
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
