"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollBusinessHandler = enrollBusinessHandler;
exports.addEmployeeHandler = addEmployeeHandler;
exports.getEmployeesHandler = getEmployeesHandler;
exports.addClientHandler = addClientHandler;
exports.getClientsHandler = getClientsHandler;
exports.createJobHandler = createJobHandler;
exports.assignEmployeeHandler = assignEmployeeHandler;
exports.updateJobStatusHandler = updateJobStatusHandler;
exports.getJobsHandler = getJobsHandler;
exports.recordPayrollHandler = recordPayrollHandler;
exports.getPayrollHistoryHandler = getPayrollHistoryHandler;
exports.recordExpenseHandler = recordExpenseHandler;
exports.getExpensesHandler = getExpensesHandler;
exports.getDashboardStatsHandler = getDashboardStatsHandler;
const errorHandler_1 = require("../middleware/errorHandler");
const database_1 = require("../utils/database");
const crm_service_1 = require("../services/crm.service");
// Helper to extract businessId from request (query or body)
function getBusinessId(req) {
    const businessId = req.body?.businessId || req.query?.businessId;
    if (!businessId) {
        throw new errorHandler_1.CustomError('businessId is required', 400);
    }
    return businessId;
}
async function getServiceBusinessId(businessId) {
    const crmBusiness = await database_1.prisma.crmServiceBusiness.findUnique({ where: { businessId } });
    if (!crmBusiness) {
        throw new errorHandler_1.CustomError('CRM business not found for this business', 404);
    }
    return crmBusiness.id;
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
        const { name, email, phone, address, notes } = req.body;
        const client = await (0, crm_service_1.addClient)(businessId, { name, email, phone, address, notes });
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
//# sourceMappingURL=crm.controller.js.map