"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const auth_middleware_1 = require("../middleware/auth.middleware");
const crm_controller_1 = require("../controllers/crm.controller");
const crmService = __importStar(require("../services/crm.service"));
const revenue_controller_1 = require("../controllers/revenue.controller");
const invoice_trust_service_1 = require("../services/invoice-trust.service");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// Helper to extract businessId from request (query or body)
function getBusinessId(req) {
    const businessId = req.body?.businessId || req.query?.businessId;
    if (!businessId) {
        throw new Error('businessId is required');
    }
    return businessId;
}
// ── Business Enrollment ──────────────────────────────────────────────────────
// POST /api/v1/crm/enroll — Enroll a new service business
router.post('/enroll', crm_controller_1.enrollBusinessHandler);
// ── Employee Management ──────────────────────────────────────────────────────
// POST /api/v1/crm/employees — Add employee/worker
router.post('/employees', crm_controller_1.addEmployeeHandler);
// PUT /api/v1/crm/employees/:id — Update employee
router.put('/employees/:id', async (req, res) => {
    try {
        const { name, email, phone, role, payRate, payType, isActive } = req.body;
        const employee = await database_1.prisma.crmEmployee.update({
            where: { id: req.params.id },
            data: { name, email, phone, role, payRate: payRate ? Number(payRate) : undefined, payType, isActive },
        });
        res.json({ success: true, data: employee });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// DELETE /api/v1/crm/employees/:id — Delete employee
router.delete('/employees/:id', async (req, res) => {
    try {
        await database_1.prisma.crmEmployee.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Employee deleted' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/v1/crm/employees — List employees
router.get('/employees', crm_controller_1.getEmployeesHandler);
// ── Client Management ───────────────────────────────────────────────────────
// POST /api/v1/crm/clients — Add client/customer
router.post('/clients', crm_controller_1.addClientHandler);
// GET /api/v1/crm/clients — List clients
router.get('/clients', crm_controller_1.getClientsHandler);
// GET /api/v1/crm/clients/:id — Get client details
router.get('/clients/:id', crm_controller_1.getClientHandler);
// PATCH /api/v1/crm/clients/:id — Update client details
router.patch('/clients/:id', crm_controller_1.updateClientHandler);
// DELETE /api/v1/crm/clients/:id — Delete a client
router.delete('/clients/:id', crm_controller_1.deleteClientHandler);
// ── Deal Management ─────────────────────────────────────────────────────────
router.post('/deals', crm_controller_1.createDealHandler);
router.get('/deals', crm_controller_1.getDealsHandler);
router.get('/deals/:id', crm_controller_1.getDealHandler);
router.patch('/deals/:id', crm_controller_1.updateDealHandler);
router.delete('/deals/:id', crm_controller_1.deleteDealHandler);
// ── Activity Management ──────────────────────────────────────────────────────
router.post('/activities', crm_controller_1.createActivityHandler);
router.get('/activities', crm_controller_1.getActivitiesHandler);
router.patch('/activities/:id', crm_controller_1.updateActivityHandler);
router.delete('/activities/:id', crm_controller_1.deleteActivityHandler);
// ── File Management ──────────────────────────────────────────────────────────
router.post('/files', crm_controller_1.addFileHandler);
router.get('/files', crm_controller_1.getFilesHandler);
router.delete('/files/:id', crm_controller_1.deleteFileHandler);
// ── Job Management ──────────────────────────────────────────────────────────
// POST /api/v1/crm/jobs — Create a service job
router.post('/jobs', crm_controller_1.createJobHandler);
// GET /api/v1/crm/jobs — List jobs with filters
router.get('/jobs', crm_controller_1.getJobsHandler);
// PATCH /api/v1/crm/jobs/:id/status — Update job status
router.patch('/jobs/:id/status', crm_controller_1.updateJobStatusHandler);
// POST /api/v1/crm/jobs/:id/assign — Assign worker to job
router.post('/jobs/:id/assign', crm_controller_1.assignEmployeeHandler);
// ── Payroll Management ──────────────────────────────────────────────────────
// POST /api/v1/crm/payroll — Record payroll entry
router.post('/payroll', crm_controller_1.recordPayrollHandler);
// GET /api/v1/crm/payroll — Get payroll records
router.get('/payroll', crm_controller_1.getPayrollHistoryHandler);
// ── Expense Management ──────────────────────────────────────────────────────
// POST /api/v1/crm/expenses — Record business expense
router.post('/expenses', crm_controller_1.recordExpenseHandler);
// GET /api/v1/crm/expenses — List expenses
router.get('/expenses', crm_controller_1.getExpensesHandler);
// ── Invoices ──────────────────────────────────────────────────────────────────
router.get('/invoices', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const { status } = req.query;
        const invoices = await database_1.prisma.invoice.findMany({
            where: { businessId, ...(status && { status: status }) },
            include: { client: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: invoices });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/invoices/:id', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const invoice = await database_1.prisma.invoice.findFirst({
            where: { id: req.params.id, businessId },
            include: { client: true },
        });
        if (!invoice)
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        res.json({ success: true, data: invoice });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.post('/invoices', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const { clientId, dateDue, lineItems, subtotal, notes } = req.body;
        if (!clientId || !dateDue)
            return res.status(400).json({ success: false, error: 'clientId and dateDue are required' });
        // Auto-generate invoice number
        const count = await database_1.prisma.invoice.count({ where: { businessId } });
        const number = `INV-${String(count + 1).padStart(4, '0')}`;
        const invoice = await database_1.prisma.invoice.create({
            data: {
                number,
                businessId,
                clientId,
                dateDue: new Date(dateDue),
                status: 'draft',
                lineItems: JSON.stringify(lineItems || []),
                subtotal: subtotal || 0,
                notes: notes || null,
            },
            include: { client: true },
        });
        res.status(201).json({ success: true, data: invoice });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.patch('/invoices/:id/status', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const { status } = req.body;
        const invoice = await database_1.prisma.invoice.findFirst({ where: { id: req.params.id, businessId } });
        if (!invoice)
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        const oldStatus = invoice.status;
        const updateData = { status };
        if (status === 'sent' && !invoice.sentAt)
            updateData.sentAt = new Date();
        if (status === 'paid' && !invoice.paidAt)
            updateData.paidAt = new Date();
        // Determine flags for paymentScore update
        const now = new Date();
        const isPaidOnTime = invoice.dateDue ? now <= new Date(invoice.dateDue) : true;
        const isOverdue = status === 'overdue';
        const isDefaulted = status === 'defaulted';
        // Update invoice
        const updated = await database_1.prisma.invoice.update({ where: { id: req.params.id }, data: updateData });
        // Process via invoice trust service (emit events, update paymentScore)
        await invoice_trust_service_1.invoiceTrustService.processInvoiceStatusChange(updated.id, updated.clientId, oldStatus, updated.status, now, isPaidOnTime, isOverdue, isDefaulted);
        res.json({ success: true, data: updated });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── Job Lifecycle Management ──────────────────────────────────────────────
// POST /api/v1/crm/jobs/:id/checkin — Check in for a job
router.post('/jobs/:id/checkin', async (req, res) => {
    try {
        const { id: jobId } = req.params;
        const { latitude, longitude } = req.body;
        if (!req.user)
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        const job = await crmService.checkInJob(jobId, req.user.id, latitude, longitude);
        res.json({ success: true, data: job });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/crm/jobs/:id/checkout — Check out from a job
router.post('/jobs/:id/checkout', async (req, res) => {
    try {
        const { id: jobId } = req.params;
        if (!req.user)
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        const result = await crmService.checkOutJob(jobId, req.user.id);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/crm/jobs/:id/noshow — Handle no-show (called by cron)
router.post('/jobs/:id/noshow', async (req, res) => {
    try {
        const { id: jobId } = req.params;
        await crmService.handleNoShow(jobId);
        res.json({ success: true, message: 'No-show processed' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.delete('/invoices/:id', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const invoice = await database_1.prisma.invoice.findFirst({ where: { id: req.params.id, businessId } });
        if (!invoice)
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        if (invoice.status !== 'draft')
            return res.status(400).json({ success: false, error: 'Can only delete draft invoices' });
        await database_1.prisma.invoice.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Invoice deleted' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/v1/crm/clients/:id/invoices — Get invoices for a client
router.get('/clients/:id/invoices', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const invoices = await database_1.prisma.invoice.findMany({
            where: { clientId: req.params.id, businessId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: invoices });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── Dashboard ───────────────────────────────────────────────────────────────
// GET /api/v1/crm/dashboard — Get dashboard statistics
router.get('/dashboard', crm_controller_1.getDashboardStatsHandler);
// GET /api/v1/crm/dashboard/:businessId/calendar — Get calendar data for dashboard
router.get('/dashboard/:businessId/calendar', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { businessId } = req.params;
        const { range = 'week' } = req.query;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let startDate;
        let endDate;
        if (range === 'week') {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - today.getDay());
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
        }
        else if (range === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }
        else {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
            endDate = new Date(today);
            endDate.setDate(today.getDate() + 7);
        }
        const jobs = await database_1.prisma.crmJob.findMany({
            where: {
                businessId,
                scheduledDate: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                client: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                scheduledDate: 'asc',
            },
        });
        const days = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayJobs = jobs.filter(job => {
                const jobDate = new Date(job.scheduledDate);
                return jobDate.toISOString().split('T')[0] === dateStr;
            });
            days.push({
                date: dateStr,
                day: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
                bookings: dayJobs.map(job => ({
                    id: job.id,
                    customerName: job.client?.name || 'Unknown',
                    time: job.scheduledTime || 'TBD',
                    status: job.status,
                    serviceType: job.serviceType,
                })),
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return res.json({
            success: true,
            data: days,
        });
    }
    catch (error) {
        console.error('[CRM] Calendar error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});
// ── Trust-Aware Revenue Engine ──────────────────────────────────────────────
// GET /api/v1/crm/alerts — Get active trust & revenue alerts
router.get('/alerts', revenue_controller_1.getAlertsHandler);
// POST /api/v1/crm/alerts/:id/dismiss — Dismiss an alert
router.post('/alerts/:id/dismiss', revenue_controller_1.dismissAlertHandler);
// GET /api/v1/crm/clients/:id/stage — Get client lifecycle stage
router.get('/clients/:id/stage', revenue_controller_1.getClientStageHandler);
// POST /api/v1/crm/import/clients — Bulk import clients from CSV
router.post('/import/clients', crm_controller_1.importClientsHandler);
// POST /api/v1/crm/import/deals — Bulk import deals from CSV
router.post('/import/deals', crm_controller_1.importDealsHandler);
exports.default = router;
//# sourceMappingURL=crm.routes.js.map