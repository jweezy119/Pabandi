import { Router, type Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import {
  enrollBusinessHandler,
  addEmployeeHandler,
  getEmployeesHandler,
  addClientHandler,
  getClientsHandler,
  createJobHandler,
  assignEmployeeHandler,
  updateJobStatusHandler,
  getJobsHandler,
  recordPayrollHandler,
  getPayrollHistoryHandler,
  recordExpenseHandler,
  getExpensesHandler,
  getDashboardStatsHandler,
} from '../controllers/crm.controller';
import {
  getAlertsHandler,
  dismissAlertHandler,
  getClientStageHandler,
} from '../controllers/revenue.controller';
import { invoiceTrustService } from '../services/invoice-trust.service';
import * as crmService from '../services/crm.service';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { tierGuard } from '../middleware/tierGuard.middleware';

const router = Router();

// All routes require authentication
function getBusinessId(req: AuthRequest): string {
  const fromRequest = (req.body?.businessId || req.query?.businessId) as string | undefined;
  const fromToken = (req.user?.businessId || req.user?.activeBusinessId) as string | undefined;

  if (fromRequest && fromToken && fromRequest !== fromToken) {
    console.warn(
      `[CrmRoutes] businessId mismatch for user ${req.user?.id}: request=${fromRequest} token=${fromToken}. Refusing.`,
    );
  }

  const businessId = fromRequest || fromToken;
  if (!businessId) {
    throw new CustomError('No business is associated with this account', 403);
  }

  // A request-supplied id that disagrees with the token is refused, not
  // preferred. Otherwise any authenticated user could pass another tenant's
  // businessId and read or write their clients, deals, jobs, invoices,
  // payroll and expenses. The same rule lives in controllers/crm.controller.ts.
  if (fromRequest && fromToken && fromRequest !== fromToken) {
    throw new CustomError('Not allowed for this business', 403);
  }

  return businessId;
}

router.use(authenticate);

// POST /api/v1/crm/enroll — Enroll a new service business
// Declared before the context resolver: enrollment is precisely the request
// that creates the context every other route depends on.
router.post('/enroll', enrollBusinessHandler);

// Resolve the caller's business once, here, rather than re-deriving a businessId
// from query/body in every handler. Everything below reads `req.crm`.
router.use(resolveCrmBusiness);

// ── Employee Management ──────────────────────────────────────────────────────

// POST /api/v1/crm/employees — Add employee/worker
router.post('/employees', addEmployeeHandler);

// PUT /api/v1/crm/employees/:id — Update employee
router.put('/employees/:id', async (req, res) => {
  try {
    const { name, email, phone, role, payRate, payType, isActive } = req.body;
    const employee = await prisma.crmEmployee.update({
      where: { id: req.params.id },
      data: { name, email, phone, role, payRate: payRate ? Number(payRate) : undefined, payType, isActive },
    });
    res.json({ success: true, data: employee });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/crm/employees/:id — Delete employee
router.delete('/employees/:id', async (req, res) => {
  try {
    await prisma.crmEmployee.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Employee deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/crm/employees — List employees
router.get('/employees', getEmployeesHandler);

// ── Client Management ───────────────────────────────────────────────────────

// POST /api/v1/crm/clients — Add client/customer
router.post('/clients', tierGuard({ resource: 'clients' }), addClientHandler);

// GET /api/v1/crm/clients — List clients
router.get('/clients', getClientsHandler);

// ── Job Management ──────────────────────────────────────────────────────────

// POST /api/v1/crm/jobs — Create a service job
router.post('/jobs', tierGuard({ resource: 'jobs' }), createJobHandler);

// GET /api/v1/crm/jobs — List jobs with filters
router.get('/jobs', getJobsHandler);

// PATCH /api/v1/crm/jobs/:id/status — Update job status
router.patch('/jobs/:id/status', updateJobStatusHandler);

// POST /api/v1/crm/jobs/:id/assign — Assign worker to job
router.post('/jobs/:id/assign', assignEmployeeHandler);

// ── Payroll Management ──────────────────────────────────────────────────────

// POST /api/v1/crm/payroll — Record payroll entry
router.post('/payroll', recordPayrollHandler);

// GET /api/v1/crm/payroll — Get payroll records
router.get('/payroll', getPayrollHistoryHandler);

// ── Expense Management ──────────────────────────────────────────────────────

// POST /api/v1/crm/expenses — Record business expense
router.post('/expenses', recordExpenseHandler);

// GET /api/v1/crm/expenses — List expenses
router.get('/expenses', getExpensesHandler);

// ── Invoices ──────────────────────────────────────────────────────────────────
//
// Invoices are keyed by the *platform* `Business` id rather than the CRM
// service-business id, because invoice trust events resolve a passport through
// client → serviceBusiness → Business → owner. Same business, two keys.

router.get('/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireCrmContext(req).businessId;
    if (!businessId) return res.status(400).json({ success: false, error: 'Business is not linked to a platform business yet' });
    const { status } = req.query;
    const invoices = await prisma.invoice.findMany({
      where: { businessId, ...(status && { status: status as string }) },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: invoices });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/invoices/:id', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireCrmContext(req).businessId;
    if (!businessId) return res.status(400).json({ success: false, error: 'Business is not linked to a platform business yet' });
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, businessId },
      include: { client: true },
    });
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/invoices', tierGuard({ resource: 'invoices' }), async (req: AuthRequest, res: Response) => {
  try {
    const { businessId, serviceBusinessId } = requireCrmContext(req);
    if (!businessId) return res.status(400).json({ success: false, error: 'Business is not linked to a platform business yet' });

    const { clientId, dateDue, lineItems, subtotal, notes } = req.body;
    if (!clientId || !dateDue) return res.status(400).json({ success: false, error: 'clientId and dateDue are required' });

    // Reject clients from another business before spending a number on them.
    const client = await prisma.crmClient.findFirst({
      where: { id: clientId, serviceBusinessId },
      select: { id: true },
    });
    if (!client) return res.status(400).json({ success: false, error: 'clientId does not belong to this business' });

    // Number scoped to the business, not global. A count+1 sequence races under
    // concurrent creates, so the unique index is the real guard: a collision
    // retries with the next candidate rather than 500ing.
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    let number = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const count = await prisma.invoice.count({
        where: { businessId, number: { startsWith: prefix } },
      });
      number = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const clash = await prisma.invoice.findUnique({ where: { number }, select: { id: true } });
      if (!clash) break;
    }

    const invoice = await prisma.invoice.create({
      data: {
        number,
        businessId,
        clientId,
        dateDue: new Date(dateDue),
        status: 'draft',
        lineItems: lineItems ?? [],
        subtotal: subtotal || 0,
        notes: notes || null,
      },
      include: { client: true },
    });
    res.status(201).json({ success: true, data: invoice });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/invoices/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireCrmContext(req).businessId;
    if (!businessId) return res.status(400).json({ success: false, error: 'Business is not linked to a platform business yet' });
    const { status } = req.body;
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, businessId } });
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    
    const oldStatus = invoice.status;
    const updateData: any = { status };
    if (status === 'sent' && !invoice.sentAt) updateData.sentAt = new Date();
    if (status === 'paid' && !invoice.paidAt) updateData.paidAt = new Date();

    // Determine flags for paymentScore update
    const now = new Date();
    const isPaidOnTime = invoice.dateDue ? now <= new Date(invoice.dateDue) : true;
    const isOverdue = status === 'overdue';
    const isDefaulted = status === 'defaulted';

    // Update invoice
    const updated = await prisma.invoice.update({ where: { id: req.params.id }, data: updateData });

    // Process via invoice trust service (emit events, update paymentScore)
    await invoiceTrustService.processInvoiceStatusChange(
      updated.id,
      updated.clientId,
      oldStatus,
      updated.status,
      now,
      isPaidOnTime,
      isOverdue,
      isDefaulted
    );

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Job Lifecycle Management ──────────────────────────────────────────────

// POST /api/v1/crm/jobs/:id/checkin — Check in for a job
router.post('/jobs/:id/checkin', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId, userId } = requireCrmContext(req);
    const job = await crmService.checkInJob(req.params.id, userId, req.body.latitude, req.body.longitude, serviceBusinessId);
    res.json({ success: true, data: job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/crm/jobs/:id/checkout — Check out from a job
router.post('/jobs/:id/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId, userId } = requireCrmContext(req);
    const result = await crmService.checkOutJob(req.params.id, userId, serviceBusinessId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/crm/jobs/:id/noshow — Handle no-show (called by cron)
router.post('/jobs/:id/noshow', async (req: AuthRequest, res: Response) => {
  try {
    const { id: jobId } = req.params;
    await crmService.handleNoShow(jobId);
    res.json({ success: true, message: 'No-show processed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/invoices/:id', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = getBusinessId(req);

    const draft = await prisma.invoice.findFirst({
      where: { id: req.params.id, businessId },
      select: { id: true, number: true, status: true },
    });
    if (!draft) return res.status(404).json({ success: false, error: 'Invoice not found' });

    if (draft.status.toLowerCase() !== 'draft') {
      return res.status(400).json({ success: false, error: 'Only draft invoices can be deleted' });
    }

    // Re-check inside the write, so an invoice sent between the check above and
    // this call is not deleted.
    const deleted = await prisma.invoice.deleteMany({
      where: { id: req.params.id, businessId, status: draft.status },
    });
    if (deleted.count === 0) {
      return res.status(409).json({ success: false, error: 'This invoice was changed. Reload and try again.' });
    }

    logger.info(`[CrmRoutes] Deleted draft invoice ${draft.number} (${draft.id})`);
    res.json({ success: true, message: 'Invoice deleted' });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/crm/clients/:id/invoices — Get invoices for a client
router.get('/clients/:id/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireCrmContext(req).businessId;
    if (!businessId) return res.status(400).json({ success: false, error: 'Business is not linked to a platform business yet' });
    const invoices = await prisma.invoice.findMany({
      where: { clientId: req.params.id, businessId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: invoices });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Dashboard ───────────────────────────────────────────────────────────────

// GET /api/v1/crm/dashboard — Get dashboard statistics
router.get('/dashboard', getDashboardStatsHandler);

// ── Trust-Aware Revenue Engine ──────────────────────────────────────────────

// GET /api/v1/crm/alerts — Get active trust & revenue alerts
router.get('/alerts', getAlertsHandler);

// POST /api/v1/crm/alerts/:id/dismiss — Dismiss an alert
router.post('/alerts/:id/dismiss', dismissAlertHandler);

// GET /api/v1/crm/clients/:id/stage — Get client lifecycle stage
router.get('/clients/:id/stage', getClientStageHandler);

export default router;
