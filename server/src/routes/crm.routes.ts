import { Router, Response } from 'express';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import { authenticate } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';
import { updateInvoice, sendInvoice } from '../services/invoice.service';
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
//
// WHY THE FALLBACK CHAIN EXISTS
// Clients resolve the tenant two different ways — the auth store and
// localStorage — and some call sites append `?businessId=` while others do not.
// Before this chain, any call that omitted the param threw a bare Error, which
// the route-level catch turned into a 500. So "forgot a query param" surfaced
// to the user as a server fault. The token is the authoritative source; an
// explicit param is still honoured so an admin tool can pass a tenant it
// legitimately owns, and the mismatch is logged rather than silently ignored.
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

// ── Business Enrollment ──────────────────────────────────────────────────────

// POST /api/v1/crm/enroll — Enroll a new service business
router.post('/enroll', enrollBusinessHandler);

// ── Employee Management ──────────────────────────────────────────────────────

// POST /api/v1/crm/employees — Add employee/worker
router.post('/employees', addEmployeeHandler);

// PUT /api/v1/crm/employees/:id — Update employee
//
// Scoped by businessId. These two routes previously updated and deleted by id
// alone: any authenticated user could rename or hard-delete an employee in any
// tenant, and neither request even needed a businessId. `updateMany`/`deleteMany`
// with the tenant predicate is both the authorisation check and a 404 for
// rows that belong to someone else.
router.put('/employees/:id', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = getBusinessId(req);
    const { name, email, phone, role, payRate, payType, isActive } = req.body ?? {};

    // `payRate ? Number(payRate) : undefined` silently dropped a legitimate 0,
    // so setting a rate to zero was impossible. Checked on presence instead.
    const updated = await prisma.crmEmployee.updateMany({
      where: { id: req.params.id, businessId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(payRate !== undefined && payRate !== null && payRate !== ''
          ? { payRate: Number(payRate) }
          : {}),
        ...(payType !== undefined ? { payType } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const employee = await prisma.crmEmployee.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, data: employee });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/crm/employees/:id — Delete employee
router.delete('/employees/:id', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = getBusinessId(req);
    const deleted = await prisma.crmEmployee.deleteMany({ where: { id: req.params.id, businessId } });
    if (deleted.count === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    res.json({ success: true, message: 'Employee deleted' });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
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

    // Invoice number. The previous `count() + 1` raced: two concurrent creates
    // both computed the same number, and Invoice.number is @unique, so the
    // loser got a P2002 and a 500 after doing all the work. Retry on collision
    // instead — the count is re-read each attempt, so the window shrinks rather
    // than being papered over.
    let invoice: Awaited<ReturnType<typeof prisma.invoice.create>> | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const count = await prisma.invoice.count({ where: { businessId } });
      const number = `INV-${String(count + 1 + attempt).padStart(4, '0')}`;
      try {
        invoice = await prisma.invoice.create({
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
        break;
      } catch (err) {
        lastError = err;
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      }
    }
    if (!invoice) throw lastError;

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

/**
 * PATCH /api/v1/crm/invoices/:id — edit a draft invoice.
 *
 * The invoice detail page has always called this. Only the /status variant
 * existed, so "Save Changes" was a silent 404 while the button looked live.
 */
router.patch('/invoices/:id', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = getBusinessId(req);
    const updated = await updateInvoice(businessId, req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/crm/invoices/:id/send — send a draft to the client.
 *
 * Routes the invoice through the rail router and emails the client. The detail
 * page's "Send Invoice" button has always called this path.
 */
router.post('/invoices/:id/send', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = getBusinessId(req);
    const sent = await sendInvoice(businessId, req.params.id);
    res.json({ success: true, data: sent });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
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
//
// Scoped by businessId. This previously called handleNoShow(jobId) with no
// tenant check and no user check, so any authenticated user could mark any
// job in any tenant as a no-show — which also moves a client's trust score.
router.post('/jobs/:id/noshow', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = getBusinessId(req);
    const job = await prisma.crmJob.findFirst({
      where: { id: req.params.id, businessId },
      select: { id: true },
    });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    await crmService.handleNoShow(job.id);
    res.json({ success: true, message: 'No-show processed' });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/crm/invoices/:id — Delete a draft invoice
//
// Scoped delete with the draft predicate inside the same statement. Doing a
// read, checking the status, then deleting leaves a window where a draft sent
// in between would still be deleted; deleteMany closes it, and its count is
// also how the caller learns the outcome.
//
// The status comparison is case-insensitive because this codebase is not
// consistent: invoice.service writes 'draft', invoiceGeneration.service wrote
// 'SENT', and the public route wrote 'payment_claimed'. A literal
// `status !== 'draft'` would make an uppercase draft undeletable.
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
//
// The tenant here comes from the path, not the query string, so the router-wide
// `authenticate` was never enough on its own: the path was never compared with
// the token. It is now, so this cannot be used to read another tenant's job
// schedule and customer names.
router.get('/dashboard/:businessId/calendar', async (req: AuthRequest, res: Response) => {
  try {
    const requested = String(req.params.businessId);
    const tokenBusinessId = req.user?.businessId ?? req.user?.activeBusinessId;
    if (tokenBusinessId && requested !== tokenBusinessId) {
      return res.status(403).json({ success: false, error: 'Not allowed for this business' });
    }
    const businessId = requested;
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
