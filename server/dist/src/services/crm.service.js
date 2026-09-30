"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollBusiness = enrollBusiness;
exports.addEmployee = addEmployee;
exports.getEmployees = getEmployees;
exports.addClient = addClient;
exports.findOrCreateClient = findOrCreateClient;
exports.getClients = getClients;
exports.getClient = getClient;
exports.updateClient = updateClient;
exports.deleteClient = deleteClient;
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
exports.createDeal = createDeal;
exports.getDeals = getDeals;
exports.getDeal = getDeal;
exports.updateDeal = updateDeal;
exports.deleteDeal = deleteDeal;
exports.createActivity = createActivity;
exports.getActivities = getActivities;
exports.updateActivity = updateActivity;
exports.deleteActivity = deleteActivity;
exports.addFile = addFile;
exports.getFiles = getFiles;
exports.deleteFile = deleteFile;
exports.createInvoice = createInvoice;
exports.getInvoices = getInvoices;
exports.markInvoicePaid = markInvoicePaid;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const event_bus_service_1 = require("./event-bus.service");
const reliability_service_1 = require("./reliability.service");
const trust_core_1 = require("../trust/trust-core");
const email_service_1 = require("./email.service");
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
    // Check if user already has a business (idempotent enroll)
    const existingBusiness = await database_1.prisma.business.findFirst({ where: { ownerId: user.id } });
    if (existingBusiness) {
        const existingCrm = await database_1.prisma.crmBusiness.findFirst({ where: { ownerEmail: user.email } });
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
    const crmBusiness = await database_1.prisma.crmBusiness.create({
        data: {
            businessName: business.name,
            ownerEmail: user.email,
            ownerName: user.firstName,
            serviceType,
        },
    });
    return { business, crmBusiness };
}
// ─── Employee Management ─────────────────────────────────────────────────────
async function addEmployee(businessId, data) {
    const { name, email, phone, role, payRate = 0, payType = 'HOURLY' } = data;
    if (!name || !role) {
        throw new errorHandler_1.CustomError('name and role are required', 400);
    }
    const employee = await database_1.prisma.crmEmployee.create({
        data: { businessId, name, email: email || null, phone: phone || null, role, payRate, payType },
    });
    return employee;
}
async function getEmployees(businessId) {
    return database_1.prisma.crmEmployee.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
    });
}
// ─── Client Management ───────────────────────────────────────────────────────
async function addClient(businessId, data) {
    const { name, email, phone, address, notes } = data;
    if (!name) {
        throw new errorHandler_1.CustomError('name is required', 400);
    }
    const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
    const passport = await database_1.prisma.trustPassport.create({
        data: {
            handle,
            displayName: name,
        }
    });
    const client = await database_1.prisma.crmClient.create({
        data: {
            businessId,
            name,
            email: email || null,
            phone: phone || null,
            address: address || null,
            notes: notes || null,
            customData: data.customData ?? {},
            passportId: passport.id
        },
    });
    if (client.passportId) {
        await trust_core_1.trustCore.emit('client.created', { passportId: client.passportId, clientId: client.id });
    }
    if (client.email) {
        try {
            await email_service_1.emailService.sendWelcome({ email: client.email, name: client.name });
        }
        catch { }
    }
    return client;
}
async function findOrCreateClient(businessId, data) {
    if (!data.email) {
        return addClient(businessId, data);
    }
    const existing = await database_1.prisma.crmClient.findFirst({
        where: { businessId, email: data.email },
    });
    if (existing)
        return existing;
    return addClient(businessId, data);
}
async function getClients(businessId) {
    const clients = await database_1.prisma.crmClient.findMany({
        where: { businessId },
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
async function getClient(businessId, clientId) {
    const client = await database_1.prisma.crmClient.findFirst({
        where: { id: clientId, businessId },
        include: {
            jobs: true,
            invoices: true,
        }
    });
    if (!client)
        throw new errorHandler_1.CustomError('Client not found', 404);
    return {
        ...client,
        stage: (0, reliability_service_1.getClientStage)(client, client.jobs),
    };
}
async function updateClient(businessId, clientId, data) {
    const client = await database_1.prisma.crmClient.findFirst({ where: { id: clientId, businessId } });
    if (!client)
        throw new errorHandler_1.CustomError('Client not found', 404);
    const updated = await database_1.prisma.crmClient.update({
        where: { id: clientId },
        data,
    });
    if (updated.passportId) {
        await trust_core_1.trustCore.emit('client.updated', { passportId: updated.passportId, clientId: updated.id });
    }
    return updated;
}
async function deleteClient(businessId, clientId) {
    const client = await database_1.prisma.crmClient.findFirst({ where: { id: clientId, businessId } });
    if (!client)
        throw new errorHandler_1.CustomError('Client not found', 404);
    return database_1.prisma.crmClient.update({
        where: { id: clientId },
        data: { isActive: false },
    });
}
// ─── Job Management ──────────────────────────────────────────────────────────
async function createJob(businessId, data) {
    const { clientId, clientName, serviceType, scheduledDate, scheduledTime, durationMinutes = 60, address, notes, price, employeeId } = data;
    if (!serviceType || !scheduledDate || !scheduledTime) {
        throw new errorHandler_1.CustomError('serviceType, scheduledDate, and scheduledTime are required', 400);
    }
    const jobData = {
        businessId,
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
        await database_1.prisma.crmJob.update({
            where: { id: job.id },
            data: { employeeId },
        });
    }
    return job;
}
async function assignEmployee(jobId, employeeId) {
    return database_1.prisma.crmJob.update({
        where: { id: jobId },
        data: { employeeId },
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
async function getJobs(businessId, filters) {
    const where = { businessId };
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
            employee: true,
        },
        orderBy: { scheduledDate: 'asc' },
    });
}
// ─── Payroll Management ──────────────────────────────────────────────────────
async function recordPayroll(businessId, data) {
    const { employeeId, periodStart, periodEnd, hoursWorked = 0, jobsCompleted = 0, grossPay, deductions = 0, netPay } = data;
    return database_1.prisma.crmPayroll.create({
        data: {
            businessId,
            employeeId,
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
            hoursWorked,
            jobsCompleted,
            grossPay,
            deductions,
            netPay,
        },
        include: { employee: true },
    });
}
async function getPayrollHistory(businessId, employeeId) {
    const where = { businessId };
    if (employeeId)
        where.employeeId = employeeId;
    return database_1.prisma.crmPayroll.findMany({
        where,
        include: { employee: true },
        orderBy: { createdAt: 'desc' },
    });
}
// ─── Expense Management ──────────────────────────────────────────────────────
async function recordExpense(businessId, data) {
    const { category, amount, description, vendor, date } = data;
    if (!category || !amount || !description) {
        throw new errorHandler_1.CustomError('category, amount, and description are required', 400);
    }
    return database_1.prisma.crmExpense.create({
        data: {
            businessId,
            category,
            amount,
            description,
            vendor: vendor || null,
            date: date ? new Date(date) : new Date(),
        },
    });
}
async function getExpenses(businessId, filters) {
    const where = { businessId };
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
async function getDashboardStats(businessId) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const totalJobs = await database_1.prisma.crmJob.count({ where: { businessId } });
    const completedJobs = await database_1.prisma.crmJob.count({
        where: { businessId, status: 'COMPLETED' },
    });
    const activeClients = await database_1.prisma.crmClient.count({ where: { businessId } });
    const completedJobsThisMonth = await database_1.prisma.crmJob.findMany({
        where: {
            businessId,
            status: 'COMPLETED',
            scheduledDate: { gte: firstDayOfMonth, lte: lastDayOfMonth },
        },
        select: { price: true },
    });
    const monthlyRevenue = completedJobsThisMonth.reduce((sum, job) => sum + job.price, 0);
    const monthlyExpensesData = await database_1.prisma.crmExpense.findMany({
        where: {
            businessId,
            date: { gte: firstDayOfMonth, lte: lastDayOfMonth },
        },
        select: { amount: true },
    });
    const monthlyExpenses = monthlyExpensesData.reduce((sum, exp) => sum + exp.amount, 0);
    const payrollCostsData = await database_1.prisma.crmPayroll.findMany({
        where: {
            businessId,
            periodStart: { gte: firstDayOfMonth },
            periodEnd: { lte: lastDayOfMonth },
        },
        select: { netPay: true },
    });
    const payrollCosts = payrollCostsData.reduce((sum, p) => sum + p.netPay, 0);
    const employees = await database_1.prisma.crmEmployee.findMany({
        where: { businessId, isActive: true },
        // orderBy: { jobsCompleted: 'desc' },
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
    logger_1.logger.info(`[JobLifecycle] Job ${jobId} checked in`);
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
    const durationMinutes = Math.max(0, (now.getTime() - checkedInAt.getTime()) / (1000 * 60));
    const scheduledDurationMinutes = job.durationMinutes || 0;
    const isLate = durationMinutes > scheduledDurationMinutes + 15; // More than 15 min over scheduled time
    // Update job with check-out timestamp, status, and actual duration
    const updatedJob = await database_1.prisma.crmJob.update({
        where: { id: jobId },
        data: {
            status: 'COMPLETE',
            checkedOutAt: new Date(),
            durationMinutes: Math.round(durationMinutes)
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
        durationMinutes,
        scheduledDurationMinutes,
        timestamp: new Date()
    });
    // Update worker's deliveryScore (this would typically update the worker's TrustPassport)
    // In a real implementation, this would call a trust score update service
    logger_1.logger.info(`[JobLifecycle] Updating deliveryScore for worker ${userId} by ${deliveryDelta} points`);
    logger_1.logger.info(`[JobLifecycle] Job ${jobId} checked out${isLate ? ' (late)' : ''}`);
    // Note: Auto-generating invoice and releasing deposit would be handled by separate services
    // that listen to the trust events or are called explicitly after check-out
    return { updatedJob, isLate, durationMinutes };
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
        logger_1.logger.info(`[JobLifecycle] Job ${jobId} marked as MISSED (${minutesLate.toFixed(1)} minutes late)`);
    }
}
// ─── Deal Management ─────────────────────────────────────────────────────────
async function createDeal(businessId, data) {
    if (!data.title)
        throw new errorHandler_1.CustomError('Deal title is required', 400);
    return database_1.prisma.crmDeal.create({
        data: {
            businessId,
            title: data.title,
            value: data.value || 0,
            currency: data.currency || 'USD',
            stage: data.stage || 'LEAD',
            probability: data.probability ?? 10,
            clientId: data.clientId || null,
            expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
            notes: data.notes || null,
            ownerName: data.ownerName || null,
        },
        include: { client: true },
    });
}
async function getDeals(businessId, filters) {
    const where = { businessId };
    if (filters?.stage)
        where.stage = filters.stage;
    if (filters?.clientId)
        where.clientId = filters.clientId;
    return database_1.prisma.crmDeal.findMany({
        where,
        include: { client: true, activities: true },
        orderBy: { createdAt: 'desc' },
    });
}
async function getDeal(businessId, dealId) {
    const deal = await database_1.prisma.crmDeal.findFirst({
        where: { id: dealId, businessId },
        include: { client: true, activities: true },
    });
    if (!deal)
        throw new errorHandler_1.CustomError('Deal not found', 404);
    return deal;
}
async function updateDeal(businessId, dealId, data) {
    const deal = await database_1.prisma.crmDeal.findFirst({ where: { id: dealId, businessId } });
    if (!deal)
        throw new errorHandler_1.CustomError('Deal not found', 404);
    const updateData = { ...data };
    if (data.expectedCloseDate)
        updateData.expectedCloseDate = new Date(data.expectedCloseDate);
    if (data.stage === 'WON' || data.stage === 'LOST') {
        updateData.closedAt = new Date();
    }
    const updatedDeal = await database_1.prisma.crmDeal.update({
        where: { id: dealId },
        data: updateData,
        include: { client: true, activities: true },
    });
    if (updatedDeal.client && updatedDeal.client.passportId) {
        if (data.stage === 'WON') {
            await trust_core_1.trustCore.emit('deal.won', {
                dealId: updatedDeal.id,
                clientPassportId: updatedDeal.client.passportId,
                amount: updatedDeal.value,
            });
        }
        else if (data.stage === 'LOST') {
            await trust_core_1.trustCore.emit('deal.lost', {
                dealId: updatedDeal.id,
                clientPassportId: updatedDeal.client.passportId,
                reason: data.lostReason,
            });
        }
    }
    return updatedDeal;
}
async function deleteDeal(businessId, dealId) {
    const deal = await database_1.prisma.crmDeal.findFirst({ where: { id: dealId, businessId } });
    if (!deal)
        throw new errorHandler_1.CustomError('Deal not found', 404);
    return database_1.prisma.crmDeal.delete({ where: { id: dealId } });
}
// ─── Activity Management ──────────────────────────────────────────────────────
async function createActivity(businessId, data) {
    if (!data.title)
        throw new errorHandler_1.CustomError('Activity title is required', 400);
    return database_1.prisma.crmActivity.create({
        data: {
            businessId,
            type: data.type || 'NOTE',
            title: data.title,
            description: data.description || null,
            clientId: data.clientId || null,
            dealId: data.dealId || null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            authorName: data.authorName || 'System',
        },
        include: { client: true, deal: true },
    });
}
async function getActivities(businessId, filters) {
    const where = { businessId };
    if (filters?.clientId)
        where.clientId = filters.clientId;
    if (filters?.dealId)
        where.dealId = filters.dealId;
    if (filters?.type)
        where.type = filters.type;
    return database_1.prisma.crmActivity.findMany({
        where,
        include: { client: true, deal: true },
        orderBy: { createdAt: 'desc' },
    });
}
async function updateActivity(businessId, activityId, data) {
    const act = await database_1.prisma.crmActivity.findFirst({ where: { id: activityId, businessId } });
    if (!act)
        throw new errorHandler_1.CustomError('Activity not found', 404);
    return database_1.prisma.crmActivity.update({
        where: { id: activityId },
        data,
    });
}
async function deleteActivity(businessId, activityId) {
    const act = await database_1.prisma.crmActivity.findFirst({ where: { id: activityId, businessId } });
    if (!act)
        throw new errorHandler_1.CustomError('Activity not found', 404);
    return database_1.prisma.crmActivity.delete({ where: { id: activityId } });
}
// ─── File Management ──────────────────────────────────────────────────────────
async function addFile(businessId, clientId, data) {
    return database_1.prisma.crmFile.create({
        data: {
            businessId,
            clientId,
            fileName: data.fileName,
            fileUrl: data.fileUrl,
            fileSize: data.fileSize || 'N/A',
            fileType: data.fileType || 'PDF',
        },
    });
}
async function getFiles(businessId, clientId) {
    return database_1.prisma.crmFile.findMany({
        where: { businessId, clientId },
        orderBy: { createdAt: 'desc' },
    });
}
async function deleteFile(businessId, fileId) {
    return database_1.prisma.crmFile.deleteMany({
        where: { id: fileId, businessId },
    });
}
// ─── Invoice & Payment Management ────────────────────────────────────────────
async function createInvoice(businessId, data) {
    if (!data.clientId)
        throw new errorHandler_1.CustomError('clientId is required', 400);
    const subtotal = (data.lineItems || []).reduce((acc, item) => acc + (item.amount * (item.quantity || 1)), 0);
    const number = `INV-${Date.now().toString().slice(-6)}`;
    const invoice = await database_1.prisma.invoice.create({
        data: {
            businessId: businessId,
            clientId: data.clientId,
            number,
            dateDue: new Date(data.dateDue),
            lineItems: data.lineItems || [],
            subtotal,
            notes: data.notes || null,
            status: 'sent',
            sentAt: new Date(),
        },
        include: { client: true },
    });
    return invoice;
}
async function getInvoices(businessId, filters) {
    const where = { businessId: businessId };
    if (filters?.clientId)
        where.clientId = filters.clientId;
    if (filters?.status)
        where.status = filters.status;
    return database_1.prisma.invoice.findMany({
        where,
        include: { client: true, trustEvents: true },
        orderBy: { createdAt: 'desc' },
    });
}
async function markInvoicePaid(businessId, invoiceId) {
    const invoice = await database_1.prisma.invoice.findFirst({
        where: { id: invoiceId, businessId: businessId },
        include: { client: true },
    });
    if (!invoice)
        throw new errorHandler_1.CustomError('Invoice not found', 404);
    const updatedInvoice = await database_1.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'paid', paidAt: new Date() },
        include: { client: true },
    });
    // Calculate reliability boost: paying on time increases client reliability score
    if (invoice.client && invoice.client.passportId) {
        try {
            await database_1.prisma.trustPassport.update({
                where: { id: invoice.client.passportId },
                data: { paymentScore: { increment: 15 }, },
            });
        }
        catch (e) {
            // Passport non-critical error swallow
        }
    }
    return updatedInvoice;
}
//# sourceMappingURL=crm.service.js.map