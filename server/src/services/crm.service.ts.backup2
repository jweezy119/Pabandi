import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { eventBus } from './event-bus.service';
import { getClientStage } from './reliability.service';

// ─── Enroll Business ─────────────────────────────────────────────────────────

export async function enrollBusiness(data: {
  businessName: string;
  ownerEmail: string;
  ownerName: string;
  serviceType: string;
  phone?: string;
  address?: string;
}) {
  const { businessName, ownerEmail, ownerName, serviceType, phone, address } = data;

  if (!businessName || !ownerEmail || !ownerName || !serviceType) {
    throw new CustomError('businessName, ownerEmail, ownerName, and serviceType are required', 400);
  }

  let user = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: ownerEmail, firstName: ownerName, lastName: 'Owner', passwordHash: 'changeme' },
    });
  }

  const business = await prisma.business.create({
    data: {
      name: businessName,
      email: ownerEmail,
      phone: phone || null,
      address: address || '',
      category: 'CLEANING',
      ownerId: user.id,
      isActive: true,
    },
  });

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
    data: { serviceBusinessId, name, email: email || null, phone: phone || null, role, payRate, payType },
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
    data: { serviceBusinessId, name, email: email || null, phone: phone || null, address: address || null, notes: notes || null },
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

  const jobData: any = {
    serviceBusinessId,
    clientName: clientName || 'Unknown',
    serviceType,
    scheduledDate: new Date(scheduledDate),
    scheduledTime,
    durationMinutes,
    price: price || 0,
    status: 'SCHEDULED',
  };
  if (clientId) jobData.clientId = clientId;
  if (address) jobData.address = address;
  if (notes) jobData.notes = notes;

  const job = await prisma.crmJob.create({
    data: jobData,
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

export async function assignEmployee(jobId: string, employeeId: string) {
  await prisma.crmJobAssignment.deleteMany({ where: { jobId } });
  return prisma.crmJobAssignment.create({
    data: { jobId, employeeId },
  });
}

export async function updateJobStatus(jobId: string, status: string) {
  if (!['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
    throw new CustomError('Invalid status', 400);
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
    eventBus.publish({
      type: 'checkin.verified',
      jobId,
      clientId: job.clientId || undefined,
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
