"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollBusinessHandler = enrollBusinessHandler;
exports.addEmployeeHandler = addEmployeeHandler;
exports.getEmployeesHandler = getEmployeesHandler;
exports.addClientHandler = addClientHandler;
exports.getClientsHandler = getClientsHandler;
exports.getClientHandler = getClientHandler;
exports.updateClientHandler = updateClientHandler;
exports.deleteClientHandler = deleteClientHandler;
exports.createJobHandler = createJobHandler;
exports.assignEmployeeHandler = assignEmployeeHandler;
exports.updateJobStatusHandler = updateJobStatusHandler;
exports.getJobsHandler = getJobsHandler;
exports.recordPayrollHandler = recordPayrollHandler;
exports.getPayrollHistoryHandler = getPayrollHistoryHandler;
exports.recordExpenseHandler = recordExpenseHandler;
exports.getExpensesHandler = getExpensesHandler;
exports.getDashboardStatsHandler = getDashboardStatsHandler;
exports.createDealHandler = createDealHandler;
exports.getDealsHandler = getDealsHandler;
exports.getDealHandler = getDealHandler;
exports.updateDealHandler = updateDealHandler;
exports.deleteDealHandler = deleteDealHandler;
exports.createActivityHandler = createActivityHandler;
exports.getActivitiesHandler = getActivitiesHandler;
exports.updateActivityHandler = updateActivityHandler;
exports.deleteActivityHandler = deleteActivityHandler;
exports.addFileHandler = addFileHandler;
exports.getFilesHandler = getFilesHandler;
exports.deleteFileHandler = deleteFileHandler;
exports.createInvoiceHandler = createInvoiceHandler;
exports.getInvoicesHandler = getInvoicesHandler;
exports.markInvoicePaidHandler = markInvoicePaidHandler;
exports.importClientsHandler = importClientsHandler;
exports.importDealsHandler = importDealsHandler;
const errorHandler_1 = require("../middleware/errorHandler");
const database_1 = require("../utils/database");
const crm_service_1 = require("../services/crm.service");
// Helper to extract businessId from request (query, body, or JWT)
function getBusinessId(req) {
    const businessId = req.body?.businessId || req.query?.businessId || req.user?.businessId;
    if (!businessId) {
        throw new errorHandler_1.CustomError('businessId is required', 400);
    }
    return businessId;
}
// ─── Enroll Business ─────────────────────────────────────────────────────────
async function enrollBusinessHandler(req, res, next) {
    try {
        const { businessName, ownerEmail, ownerName, serviceType, phone, address } = req.body;
        const business = await (0, crm_service_1.enrollBusiness)({ businessName, ownerEmail, ownerName, serviceType, phone, address });
        res.status(201).json({ success: true, data: business });
    }
    catch (error) {
        next(error);
    }
}
// ─── Employee Management ─────────────────────────────────────────────────────
async function addEmployeeHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { name, email, phone, role, payRate, payType } = req.body;
        const employee = await (0, crm_service_1.addEmployee)(businessId, { name, email, phone, role, payRate, payType });
        res.status(201).json({ success: true, data: employee });
    }
    catch (error) {
        next(error);
    }
}
async function getEmployeesHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const employees = await (0, crm_service_1.getEmployees)(businessId);
        res.json({ success: true, data: employees });
    }
    catch (error) {
        next(error);
    }
}
// ─── Client Management ───────────────────────────────────────────────────────
async function addClientHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { name, email, phone, address, notes, customData } = req.body;
        const client = await (0, crm_service_1.addClient)(businessId, { name, email, phone, address, notes, customData });
        res.status(201).json({ success: true, data: client });
    }
    catch (error) {
        next(error);
    }
}
async function getClientsHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const clients = await (0, crm_service_1.getClients)(businessId);
        res.json({ success: true, data: clients });
    }
    catch (error) {
        next(error);
    }
}
async function getClientHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { id } = req.params;
        const client = await (0, crm_service_1.getClient)(businessId, id);
        res.json({ success: true, data: client });
    }
    catch (error) {
        next(error);
    }
}
async function updateClientHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { id } = req.params;
        const { name, email, phone, address, notes, customData } = req.body;
        const client = await (0, crm_service_1.updateClient)(businessId, id, { name, email, phone, address, notes, customData });
        res.json({ success: true, data: client });
    }
    catch (error) {
        next(error);
    }
}
async function deleteClientHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { id } = req.params;
        await (0, crm_service_1.deleteClient)(businessId, id);
        res.json({ success: true, message: 'Client deleted successfully' });
    }
    catch (error) {
        next(error);
    }
}
// ─── Job Management ──────────────────────────────────────────────────────────
async function createJobHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { clientId, serviceType, scheduledDate, scheduledTime, duration, address, notes, price } = req.body;
        const job = await (0, crm_service_1.createJob)(businessId, {
            clientId,
            serviceType,
            scheduledDate,
            scheduledTime,
            durationMinutes: duration ? +duration : 60,
            address,
            notes,
            price,
        });
        res.status(201).json({ success: true, data: job });
    }
    catch (error) {
        next(error);
    }
}
async function assignEmployeeHandler(req, res, next) {
    try {
        const { id: jobId } = req.params;
        const { employeeId } = req.body;
        if (!employeeId) {
            throw new errorHandler_1.CustomError('employeeId is required', 400);
        }
        const job = await (0, crm_service_1.assignEmployee)(jobId, employeeId);
        res.json({ success: true, data: job });
    }
    catch (error) {
        next(error);
    }
}
async function updateJobStatusHandler(req, res, next) {
    try {
        const { id: jobId } = req.params;
        const { status } = req.body;
        if (!status) {
            throw new errorHandler_1.CustomError('status is required', 400);
        }
        const job = await (0, crm_service_1.updateJobStatus)(jobId, status);
        res.json({ success: true, data: job });
    }
    catch (error) {
        next(error);
    }
}
async function getJobsHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { dateFrom, dateTo, status, employeeId, clientId } = req.query;
        const jobs = await (0, crm_service_1.getJobs)(businessId, {
            dateFrom: dateFrom,
            dateTo: dateTo,
            status: status,
            employeeId: employeeId,
            clientId: clientId,
        });
        res.json({ success: true, data: jobs });
    }
    catch (error) {
        next(error);
    }
}
// ─── Payroll Management ──────────────────────────────────────────────────────
async function recordPayrollHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { employeeId, periodStart, periodEnd, hoursWorked, jobsCompleted, grossPay, deductions, netPay } = req.body;
        const payroll = await (0, crm_service_1.recordPayroll)(businessId, {
            employeeId,
            periodStart,
            periodEnd,
            hoursWorked,
            jobsCompleted,
            grossPay,
            deductions,
            netPay,
        });
        res.status(201).json({ success: true, data: payroll });
    }
    catch (error) {
        next(error);
    }
}
async function getPayrollHistoryHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { employeeId } = req.query;
        const payrolls = await (0, crm_service_1.getPayrollHistory)(businessId, employeeId);
        res.json({ success: true, data: payrolls });
    }
    catch (error) {
        next(error);
    }
}
// ─── Expense Management ──────────────────────────────────────────────────────
async function recordExpenseHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { category, amount, description, date, vendor } = req.body;
        const expense = await (0, crm_service_1.recordExpense)(businessId, { category, amount, description, date, vendor });
        res.status(201).json({ success: true, data: expense });
    }
    catch (error) {
        next(error);
    }
}
async function getExpensesHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { category, dateFrom, dateTo } = req.query;
        const expenses = await (0, crm_service_1.getExpenses)(businessId, {
            category: category,
            dateFrom: dateFrom,
            dateTo: dateTo,
        });
        res.json({ success: true, data: expenses });
    }
    catch (error) {
        next(error);
    }
}
// ─── Dashboard Stats ─────────────────────────────────────────────────────────
async function getDashboardStatsHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const stats = await (0, crm_service_1.getDashboardStats)(businessId);
        res.json({ success: true, data: stats });
    }
    catch (error) {
        next(error);
    }
}
// ─── Deal Handlers ───────────────────────────────────────────────────────────
async function createDealHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const deal = await (0, crm_service_1.createDeal)(businessId, req.body);
        res.status(201).json({ success: true, data: deal });
    }
    catch (error) {
        next(error);
    }
}
async function getDealsHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { stage, clientId } = req.query;
        const deals = await (0, crm_service_1.getDeals)(businessId, {
            stage: stage,
            clientId: clientId,
        });
        res.json({ success: true, data: deals });
    }
    catch (error) {
        next(error);
    }
}
async function getDealHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const deal = await (0, crm_service_1.getDeal)(businessId, req.params.id);
        res.json({ success: true, data: deal });
    }
    catch (error) {
        next(error);
    }
}
async function updateDealHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const deal = await (0, crm_service_1.updateDeal)(businessId, req.params.id, req.body);
        res.json({ success: true, data: deal });
    }
    catch (error) {
        next(error);
    }
}
async function deleteDealHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        await (0, crm_service_1.deleteDeal)(businessId, req.params.id);
        res.json({ success: true, message: 'Deal deleted' });
    }
    catch (error) {
        next(error);
    }
}
// ─── Activity Handlers ─────────────────────────────────────────────────────────
async function createActivityHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const activity = await (0, crm_service_1.createActivity)(businessId, req.body);
        res.status(201).json({ success: true, data: activity });
    }
    catch (error) {
        next(error);
    }
}
async function getActivitiesHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { clientId, dealId, type } = req.query;
        const activities = await (0, crm_service_1.getActivities)(businessId, {
            clientId: clientId,
            dealId: dealId,
            type: type,
        });
        res.json({ success: true, data: activities });
    }
    catch (error) {
        next(error);
    }
}
async function updateActivityHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const activity = await (0, crm_service_1.updateActivity)(businessId, req.params.id, req.body);
        res.json({ success: true, data: activity });
    }
    catch (error) {
        next(error);
    }
}
async function deleteActivityHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        await (0, crm_service_1.deleteActivity)(businessId, req.params.id);
        res.json({ success: true, message: 'Activity deleted' });
    }
    catch (error) {
        next(error);
    }
}
// ─── File Handlers ─────────────────────────────────────────────────────────────
async function addFileHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { clientId, fileName, fileUrl, fileSize, fileType } = req.body;
        const file = await (0, crm_service_1.addFile)(businessId, clientId, { fileName, fileUrl, fileSize, fileType });
        res.status(201).json({ success: true, data: file });
    }
    catch (error) {
        next(error);
    }
}
async function getFilesHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { clientId } = req.query;
        const files = await (0, crm_service_1.getFiles)(businessId, clientId);
        res.json({ success: true, data: files });
    }
    catch (error) {
        next(error);
    }
}
async function deleteFileHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        await (0, crm_service_1.deleteFile)(businessId, req.params.id);
        res.json({ success: true, message: 'File deleted' });
    }
    catch (error) {
        next(error);
    }
}
// ─── Invoice Handlers ──────────────────────────────────────────────────────────
async function createInvoiceHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const invoice = await (0, crm_service_1.createInvoice)(businessId, req.body);
        res.status(201).json({ success: true, data: invoice });
    }
    catch (error) {
        next(error);
    }
}
async function getInvoicesHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const { clientId, status } = req.query;
        const invoices = await (0, crm_service_1.getInvoices)(businessId, {
            clientId: clientId,
            status: status,
        });
        res.json({ success: true, data: invoices });
    }
    catch (error) {
        next(error);
    }
}
async function markInvoicePaidHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const invoice = await (0, crm_service_1.markInvoicePaid)(businessId, req.params.id);
        res.json({ success: true, data: invoice });
    }
    catch (error) {
        next(error);
    }
}
function parseCSV(text) {
    const rows = [];
    let current = [];
    let inQuotes = false;
    let field = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                }
                else {
                    inQuotes = false;
                }
            }
            else {
                field += char;
            }
        }
        else {
            if (char === '"') {
                inQuotes = true;
            }
            else if (char === ',') {
                current.push(field);
                field = '';
            }
            else if (char === '\n' || char === '\r') {
                if (char === '\r' && text[i + 1] === '\n')
                    i++;
                current.push(field);
                field = '';
                if (current.some(c => c.trim() !== ''))
                    rows.push(current);
                current = [];
            }
            else {
                field += char;
            }
        }
    }
    current.push(field);
    if (current.some(c => c.trim() !== ''))
        rows.push(current);
    return rows;
}
const CLIENT_FIELD_MAP = {
    name: 'name', fullname: 'name', 'full name': 'name', contact: 'name',
    email: 'email', 'email address': 'email', e_mail: 'email',
    phone: 'phone', 'phone number': 'phone', mobile: 'phone', cell: 'phone',
    company: 'company', organization: 'company', business: 'company',
    address: 'address', street: 'address',
    notes: 'notes', note: 'notes', comments: 'notes',
    status: 'status', 'client status': 'status',
    city: 'city', state: 'state', zip: 'zip', 'zip code': 'zip',
    country: 'country', source: 'source', 'lead source': 'source',
    tag: 'tags', tags: 'tags',
};
const DEAL_FIELD_MAP = {
    title: 'title', name: 'title', deal: 'title', 'deal name': 'title',
    value: 'value', amount: 'value', price: 'value', dealvalue: 'value',
    stage: 'stage', status: 'stage', 'deal stage': 'stage',
    probability: 'probability', prob: 'probability',
    'expected close date': 'expectedCloseDate', closedate: 'expectedCloseDate', 'close date': 'expectedCloseDate',
    client: 'clientId', 'client name': 'clientId', contact: 'clientId',
    notes: 'notes', description: 'notes', 'deal notes': 'notes',
    currency: 'currency',
};
async function importClientsHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const csvText = req.body.csvData;
        if (!csvText)
            throw new errorHandler_1.CustomError('No CSV data provided', 400);
        const rows = parseCSV(csvText);
        if (rows.length < 2)
            throw new errorHandler_1.CustomError('CSV must have a header row and at least one data row', 400);
        const headers = rows[0].map(h => h.toLowerCase().trim());
        const dataRows = rows.slice(1);
        const results = { imported: 0, skipped: 0, errors: [] };
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const record = {};
            for (let j = 0; j < headers.length; j++) {
                const field = CLIENT_FIELD_MAP[headers[j]];
                if (field)
                    record[field] = row[j]?.trim() || '';
            }
            if (!record.name) {
                results.skipped++;
                results.errors.push(`Row ${i + 2}: missing name`);
                continue;
            }
            if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
                results.skipped++;
                results.errors.push(`Row ${i + 2}: invalid email`);
                continue;
            }
            const existing = await database_1.prisma.crmClient.findFirst({ where: { businessId, name: record.name } });
            if (existing) {
                results.skipped++;
                results.errors.push(`Row ${i + 2}: duplicate name "${record.name}"`);
                continue;
            }
            await database_1.prisma.crmClient.create({
                data: {
                    businessId,
                    name: record.name,
                    email: record.email || null,
                    phone: record.phone || null,
                    address: record.address || null,
                    notes: record.notes || null,
                    status: 'ACTIVE',
                    isActive: true,
                },
            });
            results.imported++;
        }
        res.json({ success: true, data: results });
    }
    catch (error) {
        next(error);
    }
}
async function importDealsHandler(req, res, next) {
    try {
        const businessId = getBusinessId(req);
        const csvText = req.body.csvData;
        if (!csvText)
            throw new errorHandler_1.CustomError('No CSV data provided', 400);
        const rows = parseCSV(csvText);
        if (rows.length < 2)
            throw new errorHandler_1.CustomError('CSV must have a header row and at least one data row', 400);
        const headers = rows[0].map(h => h.toLowerCase().trim());
        const dataRows = rows.slice(1);
        const clients = await database_1.prisma.crmClient.findMany({ where: { businessId }, select: { id: true, name: true } });
        const clientMap = new Map(clients.map(c => [c.name.toLowerCase(), c.id]));
        const results = { imported: 0, skipped: 0, errors: [] };
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const record = {};
            for (let j = 0; j < headers.length; j++) {
                const field = DEAL_FIELD_MAP[headers[j]];
                if (field)
                    record[field] = row[j]?.trim() || '';
            }
            if (!record.title) {
                results.skipped++;
                results.errors.push(`Row ${i + 2}: missing title`);
                continue;
            }
            let clientId = null;
            if (record.clientId) {
                clientId = clientMap.get(record.clientId.toLowerCase()) || null;
            }
            const stage = (record.stage || 'LEAD').toUpperCase();
            const validStages = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
            await database_1.prisma.crmDeal.create({
                data: {
                    businessId,
                    title: record.title,
                    value: parseFloat(record.value) || 0,
                    currency: record.currency || 'USD',
                    stage: validStages.includes(stage) ? stage : 'LEAD',
                    probability: parseInt(record.probability) || 20,
                    expectedCloseDate: record.expectedCloseDate ? new Date(record.expectedCloseDate) : null,
                    notes: record.notes || null,
                    clientId,
                    ownerName: req.user?.firstName || 'Unknown',
                },
            });
            results.imported++;
        }
        res.json({ success: true, data: results });
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=crm.controller.js.map