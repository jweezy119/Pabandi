"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollBusiness = enrollBusiness;
exports.addEmployee = addEmployee;
exports.getEmployees = getEmployees;
exports.addClient = addClient;
exports.getClients = getClients;
exports.createJob = createJob;
exports.assignEmployee = assignEmployee;
exports.updateJobStatus = updateJobStatus;
exports.getJobs = getJobs;
exports.recordPayroll = recordPayroll;
exports.getPayrollHistory = getPayrollHistory;
exports.recordExpense = recordExpense;
exports.getExpenses = getExpenses;
exports.getDashboardStats = getDashboardStats;
exports.checkInJob = checkInJob;
exports.checkOutJob = checkOutJob;
exports.handleNoShow = handleNoShow;
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const event_bus_service_1 = require("./event-bus.service");
const reliability_service_1 = require("./reliability.service");
// ─── Enroll Business ─────────────────────────────────────────────────────────
async function enrollBusiness(data) {
    const { businessName, ownerEmail, ownerName, serviceType, phone, address } = data;
    if (!businessName || !ownerEmail || !ownerName || !serviceType) {
        throw new errorHandler_1.CustomError('businessName, ownerEmail, ownerName, and serviceType are required', 400);
    }
    let user = await database_1.prisma.user.findUnique({ where: { email: ownerEmail } });
    if (!user) {
        user = await database_1.prisma.user.create({
            data: { email: ownerEmail, firstName: ownerName, lastName: 'Owner', passwordHash: 'changeme' },
        });
    }
    // Check if user already has a business
    const existingBusiness = await database_1.prisma.business.findFirst({ where: { ownerId: user.id } });
    if (existingBusiness) {
        const existingCrm = await database_1.prisma.crmServiceBusiness.findFirst({ where: { businessId: existingBusiness.id } });
        if (existingCrm) {
            return { business: existingBusiness, crmBusiness: existingCrm };
        }
    }
    const business = await database_1.prisma.business.create({
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
    const crmBusiness = await database_1.prisma.crmServiceBusiness.create({
        data: {
            businessId: business.id,
            ownerId: user.id,
            serviceType,
        },
    });
    return { business, crmBusiness };
}
// ─── Employee Management ─────────────────────────────────────────────────────
async function addEmployee(serviceBusinessId, data) {
    const { name, email, phone, role, payRate = 0, payType = 'HOURLY' } = data;
    if (!name || !role) {
        throw new errorHandler_1.CustomError('name and role are required', 400);
    }
    const employee = await database_1.prisma.crmEmployee.create({
        data: { serviceBusinessId, name, email: email || null, phone: phone || null, role, payRate, payType },
    });
    return employee;
}
async function getEmployees(serviceBusinessId) {
    return database_1.prisma.crmEmployee.findMany({
        where: { serviceBusinessId },
        orderBy: { createdAt: 'desc' },
    });
}
// ─── Client Management ───────────────────────────────────────────────────────
async function addClient(serviceBusinessId, data) {
    const { name, email, phone, address, notes } = data;
    if (!name) {
        throw new errorHandler_1.CustomError('name is required', 400);
    }
    const client = await database_1.prisma.crmClient.create({
        data: { serviceBusinessId, name, email: email || null, phone: phone || null, address: address || null, notes: notes || null },
    });
    return client;
}
async function getClients(serviceBusinessId) {
    const clients = await database_1.prisma.crmClient.findMany({
        where: { serviceBusinessId },
        orderBy: { createdAt: 'desc' },
    });
    // Attach lifecycle stage for each client
    const clientsWithStage = await Promise.all(clients.map(async (client) => {
        const jobs = await database_1.prisma.crmJob.findMany({
            where: { clientId: client.id },
        });
        return {
            ...client,
            stage: (0, reliability_service_1.getClientStage)(client, jobs),
        };
    }));
    return clientsWithStage;
}
// ─── Job Management ──────────────────────────────────────────────────────────
async function createJob(serviceBusinessId, data) {
    const { clientId, clientName, serviceType, scheduledDate, scheduledTime, durationMinutes = 60, address, notes, price, employeeId } = data;
    if (!serviceType || !scheduledDate || !scheduledTime) {
        throw new errorHandler_1.CustomError('serviceType, scheduledDate, and scheduledTime are required', 400);
    }
    const jobData = {
        serviceBusinessId,
        clientName: clientName || 'Unknown',
        serviceType,
        scheduledDate: new Date(scheduledDate),
        scheduledTime,
        durationMinutes,
        price: price || 0,
        status: 'SCHEDULED',
    };
    if (clientId)
        jobData.clientId = clientId;
    if (address)
        jobData.address = address;
    if (notes)
        jobData.notes = notes;
    const job = await database_1.prisma.crmJob.create({
        data: jobData,
        include: {
            client: true,
        },
    });
    if (employeeId) {
        await database_1.prisma.crmJobAssignment.create({
            data: { jobId: job.id, employeeId },
        });
    }
    return job;
}
async function assignEmployee(jobId, employeeId) {
    await database_1.prisma.crmJobAssignment.deleteMany({ where: { jobId } });
    return database_1.prisma.crmJobAssignment.create({
        data: { jobId, employeeId },
    });
}
async function updateJobStatus(jobId, status) {
    if (!['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
        throw new errorHandler_1.CustomError('Invalid status', 400);
    }
    const data = { status };
    if (status === 'COMPLETED') {
        data.completedAt = new Date();
    }
    const job = await database_1.prisma.crmJob.update({
        where: { id: jobId },
        data,
        include: { client: true },
    });
    // Emit events
    if (status === 'COMPLETED') {
        event_bus_service_1.eventBus.publish({
            type: 'checkin.verified',
            jobId,
            clientId: job.clientId || undefined,
            data: { job, completedAt: job.completedAt },
            timestamp: new Date(),
        });
    }
    return job;
}
async function getJobs(serviceBusinessId, filters) {
    const where = { serviceBusinessId };
    if (filters?.status)
        where.status = filters.status;
    if (filters?.clientId)
        where.clientId = filters.clientId;
    if (filters?.dateFrom)
        where.scheduledDate = { ...where.scheduledDate, gte: new Date(filters.dateFrom) };
    if (filters?.dateTo)
        where.scheduledDate = { ...where.scheduledDate, lte: new Date(filters.dateTo) };
    return database_1.prisma.crmJob.findMany({
        where,
        include: {
            client: true,
            assignments: { include: { employee: true } },
        },
        orderBy: { scheduledDate: 'asc' },
    });
}
// ─── Payroll Management ──────────────────────────────────────────────────────
async function recordPayroll(serviceBusinessId, data) {
    const { employeeId, periodStart, periodEnd, hoursWorked = 0, jobsCompleted = 0, grossPay, deductions = 0, netPay } = data;
    return database_1.prisma.crmPayroll.create({
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
async function getPayrollHistory(serviceBusinessId, employeeId) {
    const where = { serviceBusinessId };
    if (employeeId)
        where.employeeId = employeeId;
    return database_1.prisma.crmPayroll.findMany({
        where,
        include: { employee: true },
        orderBy: { createdAt: 'desc' },
    });
}
// ─── Expense Management ──────────────────────────────────────────────────────
async function recordExpense(serviceBusinessId, data) {
    const { category, amount, description, vendor, date } = data;
    if (!category || !amount || !description) {
        throw new errorHandler_1.CustomError('category, amount, and description are required', 400);
    }
    return database_1.prisma.crmExpense.create({
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
async function getExpenses(serviceBusinessId, filters) {
    const where = { serviceBusinessId };
    if (filters?.category)
        where.category = filters.category;
    if (filters?.dateFrom)
        where.date = { ...where.date, gte: new Date(filters.dateFrom) };
    if (filters?.dateTo)
        where.date = { ...where.date, lte: new Date(filters.dateTo) };
    return database_1.prisma.crmExpense.findMany({
        where,
        orderBy: { date: 'desc' },
    });
}
// ─── Dashboard Statistics ───────────────────────────────────────────────────
async function getDashboardStats(serviceBusinessId) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const totalJobs = await database_1.prisma.crmJob.count({ where: { serviceBusinessId } });
    const completedJobs = await database_1.prisma.crmJob.count({
        where: { serviceBusinessId, status: 'COMPLETED' },
    });
    const activeClients = await database_1.prisma.crmClient.count({ where: { serviceBusinessId } });
    const completedJobsThisMonth = await database_1.prisma.crmJob.findMany({
        where: {
            serviceBusinessId,
            status: 'COMPLETED',
            scheduledDate: { gte: firstDayOfMonth, lte: lastDayOfMonth },
        },
        select: { price: true },
    });
    const monthlyRevenue = completedJobsThisMonth.reduce((sum, job) => sum + job.price, 0);
    const monthlyExpensesData = await database_1.prisma.crmExpense.findMany({
        where: {
            serviceBusinessId,
            date: { gte: firstDayOfMonth, lte: lastDayOfMonth },
        },
        select: { amount: true },
    });
    const monthlyExpenses = monthlyExpensesData.reduce((sum, exp) => sum + exp.amount, 0);
    const payrollCostsData = await database_1.prisma.crmPayroll.findMany({
        where: {
            serviceBusinessId,
            periodStart: { gte: firstDayOfMonth },
            periodEnd: { lte: lastDayOfMonth },
        },
        select: { netPay: true },
    });
    const payrollCosts = payrollCostsData.reduce((sum, p) => sum + p.netPay, 0);
    const employees = await database_1.prisma.crmEmployee.findMany({
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
async function checkInJob(jobId, userId, latitude, longitude) {
    const job = await database_1.prisma.crmJob.findUnique({
        where: { id: jobId },
        include: { client: true }
    });
    if (!job) {
        throw new Error('Job not found');
    }
    if (job.status !== 'SCHEDULED') {
        throw new Error(`Job is not in SCHEDULED status. Current status: ${job.status}`);
    }
    // Update job with check-in timestamp and status
    const updatedJob = await database_1.prisma.crmJob.update({
        where: { id: jobId },
        data: {
            status: 'IN_PROGRESS',
            checkedInAt: new Date(),
            // In a real app, we would also store latitude/longitude if provided
        }
    });
    // Fire trust event: delivery.checked_in
    event_bus_service_1.eventBus.emitEvent('delivery.checked_in', {
        jobId,
        clientId: job.clientId,
        timestamp: new Date(),
        latitude,
        longitude
    });
    // Audit log entry would be handled by the trust-core service or similar
    // For now, we'll rely on the event bus to trigger appropriate updates
    logger.info(`[JobLifecycle] Job ${jobId} checked in`);
    return updatedJob;
}
async function checkOutJob(jobId, userId) {
    const job = await database_1.prisma.crmJob.findUnique({
        where: { id: jobId },
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
    const updatedJob = await database_1.prisma.crmJob.update({
        where: { id: jobId },
        data: {
            status: 'COMPLETE',
            checkedOutAt: new Date(),
            actualDurationMinutes: Math.round(actualDurationMinutes)
        }
    });
    // Determine if job was on time or late based on scheduled vs actual time
    const deliveryEventType = isLate ? 'delivery.late' : 'delivery.on_time';
    const deliveryDelta = isLate ? -10 : 5; // Example deltas - would be configured based on trust system
    // Fire trust event: delivery.on_time OR delivery.late
    event_bus_service_1.eventBus.emitEvent(deliveryEventType, {
        jobId,
        clientId: job.clientId,
        workerId: userId,
        actualDurationMinutes,
        scheduledDurationMinutes,
        timestamp: new Date()
    });
    // Update worker's deliveryScore (this would typically update the worker's TrustPassport)
    // In a real implementation, this would call a trust score update service
    logger.info(`[JobLifecycle] Updating deliveryScore for worker ${userId} by ${deliveryDelta} points`);
    logger.info(`[JobLifecycle] Job ${jobId} checked out${isLate ? ' (late)' : ''}`);
    // Note: Auto-generating invoice and releasing deposit would be handled by separate services
    // that listen to the trust events or are called explicitly after check-out
    return { updatedJob, isLate, actualDurationMinutes };
}
async function handleNoShow(jobId) {
    const job = await database_1.prisma.crmJob.findUnique({
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
        await database_1.prisma.crmJob.update({
            where: { id: jobId },
            data: {
                status: 'MISSED'
            }
        });
        // Fire event: delivery.missed (affects the business owner's deliveryScore, not the client)
        event_bus_service_1.eventBus.emitEvent('delivery.missed', {
            jobId,
            clientId: job.clientId,
            timestamp: now,
            minutesLate
        });
        logger.info(`[JobLifecycle] Job ${jobId} marked as MISSED (${minutesLate.toFixed(1)} minutes late)`);
    }
}
//# sourceMappingURL=crm.service.js.map