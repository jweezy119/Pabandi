"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const auth_middleware_1 = require("../middleware/auth.middleware");
const crm_controller_1 = require("../controllers/crm.controller");
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
// ── Trust-Aware Revenue Engine ──────────────────────────────────────────────
// GET /api/v1/crm/alerts — Get active trust & revenue alerts
router.get('/alerts', revenue_controller_1.getAlertsHandler);
// POST /api/v1/crm/alerts/:id/dismiss — Dismiss an alert
router.post('/alerts/:id/dismiss', revenue_controller_1.dismissAlertHandler);
// GET /api/v1/crm/clients/:id/stage — Get client lifecycle stage
router.get('/clients/:id/stage', revenue_controller_1.getClientStageHandler);
exports.default = router;
//# sourceMappingURL=crm.routes.js.map