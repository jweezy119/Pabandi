import { Router, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate } from '../middleware/auth.middleware';
import {
  enrollBusinessHandler,
  addEmployeeHandler,
  getEmployeesHandler,
  addClientHandler,
  getClientsHandler,
  getClientHandler,
  updateClientHandler,
  deleteClientHandler,
  createJobHandler,
  assignEmployeeHandler,
  updateJobStatusHandler,
  getJobsHandler,
  recordPayrollHandler,
  getPayrollHistoryHandler,
  recordExpenseHandler,
  getExpensesHandler,
  getDashboardStatsHandler,
  createDealHandler,
  getDealsHandler,
  getDealHandler,
  updateDealHandler,
  deleteDealHandler,
  createActivityHandler,
  getActivitiesHandler,
  updateActivityHandler,
  deleteActivityHandler,
  addFileHandler,
  getFilesHandler,
  deleteFileHandler,
  createInvoiceHandler,
  getInvoicesHandler,
  markInvoicePaidHandler,
  importClientsHandler,
  importDealsHandler,
} from '../controllers/crm.controller';
import * as crmService from '../services/crm.service';
import {
  getAlertsHandler,
  dismissAlertHandler,
  getClientStageHandler,
} from '../controllers/revenue.controller';
import { invoiceTrustService } from '../services/invoice-trust.service';
import { selectRail, RailSelection } from '../services/rail-router.service';
import { buildTermsRecommendation, recordTermsDecision } from '../services/terms-recommendation.service';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Helper to extract businessId from request (query or body)
function getBusinessId(req: AuthRequest): string {
  const businessId = req.body?.businessId || req.query?.businessId;
  if (!businessId) {
    throw new Error('businessId is required');
  }
  return businessId as string;
}

// ── Business Enrollment ──────────────────────────────────────────────────────

// POST /api/v1/crm/enroll — Enroll a new service business
router.post('/enroll', enrollBusinessHandler);

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
router.post('/clients', addClientHandler);

// GET /api/v1/crm/clients — List clients
router.get('/clients', getClientsHandler);

// GET /api/v1/crm/clients/:id — Get client details
router.get('/clients/:id', getClientHandler);

// PATCH /api/v1/crm/clients/:id — Update client details
router.patch('/clients/:id', updateClientHandler);

// DELETE /api/v1/crm/clients/:id — Delete a client
router.delete('/clients/:id', deleteClientHandler);

// ── Deal Management ─────────────────────────────────────────────────────────

router.post('/deals', createDealHandler);
router.get('/deals', getDealsHandler);
router.get('/deals/:id', getDealHandler);
router.patch('/deals/:id', updateDealHandler);
router.delete('/deals/:id', deleteDealHandler);

// ── Activity Management ──────────────────────────────────────────────────────

router.post('/activities', createActivityHandler);
router.get('/activities', getActivitiesHandler);
router.patch('/activities/:id', updateActivityHandler);
router.delete('/activities/:id', deleteActivityHandler);

// ── File Management ──────────────────────────────────────────────────────────

router.post('/files', addFileHandler);
router.get('/files', getFilesHandler);
router.delete('/files/:id', deleteFileHandler);

// ── Job Management ──────────────────────────────────────────────────────────

// POST /api/v1/crm/jobs — Create a service job
router.post('/jobs', createJobHandler);

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

router.get('/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = getBusinessId(req);
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
    const businessId = getBusinessId(req);
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, businessId },
      include: { client: { include: { passport: { select: { paymentScore: true } } } } },
    });
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });

    // Explain the rail choice so the business sees why this payment method
    // was picked for this client. Non-fatal: the invoice renders without it.
    let routing: RailSelection | null = null;
    try {
      const [methods, biz] = await Promise.all([
        prisma.businessPaymentMethod.findMany({ where: { businessId } }),
        prisma.business.findUnique({ where: { id: businessId }, select: { address: true, currency: true } }),
      ]);
      if (methods.length > 0) {
        routing = selectRail(invoice, invoice.client, methods, {
          businessAddress: biz?.address,
          passport: invoice.client.passport,
          currency: biz?.currency,
        });
      }
    } catch (routeErr) {
      console.error('[CrmRoutes] rail routing failed:', routeErr);
    }

    res.json({ success: true, data: invoice, routing });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/crm/invoices/terms-recommendation
 * The terms we would suggest for this client, so the create form can show it
 * before the invoice exists. Read-only: it never writes an invoice or an
 * audit row, because nothing has been decided yet.
 */
router.get('/invoices/terms-recommendation', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = getBusinessId(req);
    const clientId = String(req.query.clientId ?? '');
    if (!clientId) return res.status(400).json({ success: false, error: 'clientId is required' });

    const view = await buildTermsRecommendation(businessId, clientId, {
      amount: req.query.amount != null ? Number(req.query.amount) : undefined,
      currency: req.query.currency != null ? String(req.query.currency) : undefined,
    });
    if (!view) return res.status(404).json({ success: false, error: 'Client not found' });

    res.json({ success: true, data: view });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = getBusinessId(req);
    const { clientId, dateDue, lineItems, subtotal, notes, requireEscrow, terms, overrideReason } = req.body;
    if (!clientId || !dateDue) return res.status(400).json({ success: false, error: 'clientId and dateDue are required' });
    
    // Auto-generate invoice number
    const count = await prisma.invoice.count({ where: { businessId } });
    const number = `INV-${String(count + 1).padStart(4, '0')}`;

    // Terms metadata rides along in the notes envelope, the same way
    // requireEscrow and transactionHash already do — Invoice has no columns
    // for any of them.
    const notesText = typeof notes === 'string' ? notes : '';
    let parsedNotes: { text: string; metadata: Record<string, unknown> } = { text: notesText, metadata: {} };
    try {
      const parsed = JSON.parse(notes);
      if (parsed && typeof parsed === 'object' && 'metadata' in parsed) {
        parsedNotes = { text: String(parsed.text ?? ''), metadata: (parsed.metadata ?? {}) as Record<string, unknown> };
      }
    } catch { /* notes was plain text, not the JSON envelope */ }
    parsedNotes.metadata.requireEscrow = !!requireEscrow;

    const invoice = await prisma.invoice.create({
      data: {
        number,
        businessId,
        clientId,
        dateDue: new Date(dateDue),
        status: 'draft',
        lineItems: JSON.stringify(lineItems || []),
        subtotal: subtotal || 0,
        notes: JSON.stringify(parsedNotes),
      },
      include: { client: true },
    });

    // Audit the terms decision when the caller sent one. An override never
    // blocks creation — the business has already committed to billing this
    // client, and the audit line is recoverable if it fails.
    if (terms) {
      const view = await buildTermsRecommendation(businessId, clientId, { amount: subtotal || 0 });
      if (view) {
        const accepted =
          terms.tier === view.recommendation.tier &&
          Number(terms.dueInDays ?? view.recommendation.dueInDays) === view.recommendation.dueInDays;

        await recordTermsDecision({
          businessId,
          invoiceId: invoice.id,
          clientId,
          actorId: req.user?.id,
          actorName: [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ') || undefined,
          decision: {
            terms: String(terms.label ?? view.recommendation.label),
            dueInDays: Number(terms.dueInDays ?? view.recommendation.dueInDays),
            requireEscrow: Boolean(requireEscrow),
            overrideReason: accepted ? null : String(overrideReason ?? '').trim() || 'No reason given',
            recommended: view.recommendation,
          },
        });
      }
    }

    res.status(201).json({ success: true, data: invoice });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/invoices/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = getBusinessId(req);
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
    const { id: jobId } = req.params;
    const { latitude, longitude } = req.body;
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const job = await crmService.checkInJob(jobId, req.user.id, latitude, longitude);
    res.json({ success: true, data: job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/crm/jobs/:id/checkout — Check out from a job
router.post('/jobs/:id/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const { id: jobId } = req.params;
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const result = await crmService.checkOutJob(jobId, req.user.id);
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
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, businessId } });
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    if (invoice.status !== 'draft') return res.status(400).json({ success: false, error: 'Can only delete draft invoices' });
    
    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Invoice deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/crm/clients/:id/invoices — Get invoices for a client
router.get('/clients/:id/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = getBusinessId(req);
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

// GET /api/v1/crm/dashboard/:businessId/calendar — Get calendar data for dashboard
router.get('/dashboard/:businessId/calendar', authenticate, async (req: any, res: Response) => {
  try {
    const { businessId } = req.params;
    const { range = 'week' } = req.query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate: Date;
    let endDate: Date;

    if (range === 'week') {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - today.getDay());
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else if (range === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      endDate = new Date(today);
      endDate.setDate(today.getDate() + 7);
    }

    const jobs = await prisma.crmJob.findMany({
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

    const days: any[] = [];
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
  } catch (error: any) {
    console.error('[CRM] Calendar error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Trust-Aware Revenue Engine ──────────────────────────────────────────────

// GET /api/v1/crm/alerts — Get active trust & revenue alerts
router.get('/alerts', getAlertsHandler);

// POST /api/v1/crm/alerts/:id/dismiss — Dismiss an alert
router.post('/alerts/:id/dismiss', dismissAlertHandler);

// GET /api/v1/crm/clients/:id/stage — Get client lifecycle stage
router.get('/clients/:id/stage', getClientStageHandler);

// POST /api/v1/crm/import/clients — Bulk import clients from CSV
router.post('/import/clients', importClientsHandler);

// POST /api/v1/crm/import/deals — Bulk import deals from CSV
router.post('/import/deals', importDealsHandler);

export default router;
