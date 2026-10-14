import { Router, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { createInvoice, updateInvoice } from '../services/invoice.service';
import { parsePagination, withTotal } from '../utils/pagination';
import { SettingsService } from '../services/settings.service';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
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
  getDealsHandler,
  importDealsHandler,
  importClientsHandler,
  createDealHandler,
  updateDealHandler,
  deleteDealHandler,
} from '../controllers/crm.controller';
import {
  getAlertsHandler,
  dismissAlertHandler,
  getClientStageHandler,
} from '../controllers/revenue.controller';
import { invoiceTrustService } from '../services/invoice-trust.service';
import { getClientIntelligence } from '../services/crm-intelligence.service';
import { searchCrm, MIN_SEARCH_LENGTH, type SearchResult } from '../services/crmSearch.service';
import {
  buildTermsRecommendation,
  recordTermsDecision,
} from '../services/terms-recommendation.service';
import { collectClientSignals, explainScore } from '../services/trust-core.service';
import * as crmService from '../services/crm.service';
import { crmScope } from '../services/crm.service';
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
// Scoped by tenant, not by id alone.
//
// These two handlers updated and deleted `crmEmployee` by primary key with no tenant
// predicate, so ANY authenticated caller could rewrite or delete ANY CRM employee on the
// platform — including changing someone's `payRate`. Changing a colleague's pay rate is
// about as consequential as a cross-tenant write gets, and it needed nothing more than an
// employee id.
//
// crm.service.ts documents this exact bug class at length for payroll and fixes it there;
// these two inline handlers were written afterwards and missed it.
//
// 404 rather than 403 when the row is not theirs, so a caller cannot probe for the
// existence of another tenant's employee ids.
router.put('/employees/:id', async (req, res) => {
  try {
    const { serviceBusinessId, businessId } = requireCrmContext(req);
    const { name, email, phone, role, payRate, payType, isActive } = req.body;

    const existing = await prisma.crmEmployee.findFirst({
      where: { id: req.params.id, ...crmScope(serviceBusinessId, businessId) },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const employee = await prisma.crmEmployee.update({
      where: { id: existing.id },
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
    const { serviceBusinessId, businessId } = requireCrmContext(req);

    const existing = await prisma.crmEmployee.findFirst({
      where: { id: req.params.id, ...crmScope(serviceBusinessId, businessId) },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    await prisma.crmEmployee.delete({ where: { id: existing.id } });
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

// The three below are what the client detail page and the inline editor have been
// calling all along. None of them existed: every edit 404'd, and the detail page
// fetched a client it could not receive.
//
// No tierGuard here, matching /deals: reading one client you already have in your
// list, and correcting a typo in it, are not metered units. Guarding them would
// block editing for a customer who had reached their create quota.
router.get('/clients/:id', getClientHandler);
router.put('/clients/:id', updateClientHandler);
router.delete('/clients/:id', deleteClientHandler);

// ── Deal Pipeline ───────────────────────────────────────────────────────────
// authenticate and resolveCrmBusiness are registered router-wide above, so every route
// here is authenticated AND tenant-resolved. There is no tierGuard on deals: tierGuard
// meters clients/invoices/jobs against a plan quota, and a pipeline stage is not a
// metered unit — adding a limit here would gate a core sales surface for no revenue reason.

// GET /api/v1/crm/deals — List the pipeline
router.get('/deals', getDealsHandler);

// POST /api/v1/crm/deals — Create a deal
router.post('/deals', createDealHandler);

// PATCH /api/v1/crm/deals/:id — Update stage, value, probability
router.patch('/deals/:id', updateDealHandler);

// POST /api/v1/crm/import/deals — Bulk import deals from CSV.
//
// No tierGuard: tierGuard meters clients/invoices/jobs against a plan quota, and an import
// is not a metered unit. The bounds that matter here are in CSV_IMPORT_LIMITS (bytes, rows,
// columns) and the all-or-nothing transaction, which is what stops one request from turning
// into fifty thousand inserts.
router.post('/import/deals', importDealsHandler);

// POST /api/v1/crm/import/clients — Bulk import clients from CSV.
//
// ContactClientsPage has called this since the CSV importer existed; only the deals side was
// ever written, so the button 404'd while the neighbouring page's identical button worked.
// Same caps, same all-or-nothing rule, same error format as the deals import.
router.post('/import/clients', importClientsHandler);

// DELETE /api/v1/crm/deals/:id
router.delete('/deals/:id', deleteDealHandler);

// ── Job Management ──────────────────────────────────────────────────────────

// POST /api/v1/crm/jobs — Create a service job
router.post('/jobs', tierGuard({ resource: 'jobs' }), createJobHandler);

// GET /api/v1/crm/jobs — List jobs with filters
router.get('/jobs', getJobsHandler);

/**
 * GET /api/v1/crm/jobs/:id — One job, for the detail page.
 *
 * This route did not exist. ContactJobDetailPage fetches `/crm/jobs/${id}` on mount
 * and only `/jobs` and the three lifecycle verbs were registered, so the request 404'd
 * and the page rendered its shell against an undefined job — no client, no address,
 * no price, and every button acting on `undefined`. The page had never worked.
 *
 * Scoped through `crmScope`, so a job id from another tenant is a 404 rather than a
 * read.
 *
 * The select is explicit because this is the one screen where the verification data
 * belongs: check-in coordinates, the distance from the venue, whether the geofence
 * passed, the escrow state and the reminder timestamp are all recorded by
 * `checkin.routes` and `reminderCron` and were displayed nowhere in the product. A
 * business that disputes a no-show needs to see whether the person was actually
 * there, and that evidence was being collected and discarded on the way to the screen.
 */
router.get('/jobs/:id', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const job = await prisma.crmJob.findFirst({
      where: { id: req.params.id, ...crmScope(crm.serviceBusinessId, crm.businessId) },
      include: {
        client: true,
        assignments: { include: { employee: true } },
      },
    });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, data: job });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      ...(status >= 500 ? { error: 'Could not load job' } : { error: err.message }),
    });
  }
});

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

/**
 * GET /api/v1/crm/invoices
 *
 * `search` is honoured here. The list page has always sent `?search=` on every
 * keystroke, and this handler destructured `{ status }` and ignored everything
 * else — the client then rendered the unfiltered array it had been given, with no
 * filter of its own. Typing a client's name into the search box returned exactly
 * the same rows as typing nothing, which reads as "search is broken" rather than
 * as a missing feature.
 *
 * Case-insensitive, and matches on the fields a person would recognise: the
 * invoice number, and the client's name or email. An invoice row carries no free
 * text of its own beyond the number, so those three are the whole search surface.
 */
router.get('/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireCrmContext(req).businessId;
    if (!businessId) return res.status(400).json({ success: false, error: 'Business is not linked to a platform business yet' });
    const { status, search } = req.query;

    const term = typeof search === 'string' ? search.trim() : '';
    const where: Prisma.InvoiceWhereInput = { businessId, ...(status && { status: status as string }) };
    if (term) {
      // `contains` without `mode` is case-sensitive on Postgres, so an exact-case
      // invoice number would match and a lowercase one would not.
      where.OR = [
        { number: { contains: term, mode: 'insensitive' } },
        { client: { is: { name: { contains: term, mode: 'insensitive' } } } },
        { client: { is: { email: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    // Paged on the same opt-in terms as the clients list. The client detail page asks
    // for one client's invoices and expects all of them, so an implicit default would
    // truncate that list with nothing to indicate it.
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { client: true },
        orderBy: { createdAt: 'desc' },
        ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
      }),
      pagination ? prisma.invoice.count({ where }) : 0,
    ]);

    res.json({
      success: true,
      data: invoices,
      pagination: pagination ? withTotal(pagination, total) : null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/crm/invoices/:id/terms-recommendation
 *
 * What terms this client's payment history argues for, plus the rail that would carry
 * them.
 *
 * `buildTermsRecommendation` has existed and had no caller. It reads the trust data
 * that is already on every passport, and the create form has always set `dateDue` to
 * the end of the current month for everyone — so a client who has paid on time twenty
 * times is quoted the same terms as one who has defaulted twice.
 *
 * Advice, never policy. Nothing is applied by reading this.
 */
router.get('/invoices/:id/terms-recommendation', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId;
    if (!businessId) return res.status(400).json({ success: false, error: 'Business is not linked to a platform business yet' });

    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, businessId },
      select: { id: true, clientId: true, subtotal: true, currency: true, status: true },
    });
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const view = await buildTermsRecommendation(businessId, invoice.clientId, {
      amount: invoice.subtotal,
      currency: invoice.currency,
    });
    if (!view) return res.status(404).json({ success: false, error: 'Client not found' });

    res.json({ success: true, data: { ...view, invoiceStatus: invoice.status } });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      ...(status >= 500 ? { error: 'Could not build a recommendation' } : { error: err.message }),
    });
  }
});

/**
 * POST /api/v1/crm/invoices/:id/terms
 *
 * Accept the recommended terms, or override them with a reason.
 *
 * WHAT "TERMS" IS, ON THIS INVOICE
 *
 * `dateDue`. There is no terms label, no escrow flag and no override column on
 * Invoice, and this deliberately does not add them. The recommendation has exactly two
 * actionable parts — how many days, and whether escrow is advisable — and the first
 * maps onto `dateDue` precisely. Inventing columns for the other two would be schema
 * for its own sake.
 *
 * Escrow is the honest gap. `requireEscrow` is real advice and escrow is a *job*
 * concept (`CrmJob.escrowStatus`), so an invoice cannot enforce it. It is recorded in
 * the decision and returned to the caller, and nothing claims it was applied.
 *
 * OVERRIDE REQUIRES A REASON
 *
 * A reason is required and validated, not optional. "Why did this client get net-60"
 * has to be answerable months later, which is the entire purpose of
 * `recordTermsDecision` — it writes both a SystemAuditLog row and a readable entry on
 * the client's timeline. An override with no reason makes that permanently unanswerable.
 *
 * Applying terms moves `dateDue`, so this is refused on a settled invoice. Nothing
 * else guards it: nothing can be recovered from re-dating a paid or cancelled
 * invoice, and the audit would be recording a change nobody can act on.
 */
router.post('/invoices/:id/terms', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId;
    if (!businessId) return res.status(400).json({ success: false, error: 'Business is not linked to a platform business yet' });

    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, businessId },
      select: { id: true, clientId: true, number: true, status: true },
    });
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const SETTLED = ['paid', 'void', 'cancelled', 'refunded'];
    if (SETTLED.includes(invoice.status)) {
      return res.status(409).json({
        success: false,
        error: `Cannot change terms on a ${invoice.status} invoice.`,
      });
    }

    const { action, dueInDays, overrideReason } = req.body ?? {};
    if (action !== 'accept' && action !== 'override') {
      return res.status(400).json({ success: false, error: 'action must be "accept" or "override"' });
    }

    const view = await buildTermsRecommendation(businessId, invoice.clientId);
    if (!view) return res.status(404).json({ success: false, error: 'Client not found' });

    let chosenDueInDays: number;
    let reason: string | null = null;

    if (action === 'accept') {
      chosenDueInDays = view.recommendation.dueInDays;
    } else {
      const days = Number(dueInDays);
      if (!Number.isFinite(days) || days < 0 || days > 365) {
        return res.status(400).json({ success: false, error: 'dueInDays must be between 0 and 365' });
      }
      if (typeof overrideReason !== 'string' || !overrideReason.trim()) {
        return res.status(400).json({
          success: false,
          error: 'An override needs a reason — it is recorded so the decision can be explained later.',
        });
      }
      chosenDueInDays = days;
      reason = overrideReason.trim();
    }

    const newDue = new Date();
    newDue.setDate(newDue.getDate() + chosenDueInDays);

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { dateDue: newDue },
    });

    // The audit and the readable timeline entry. Both failures are swallowed inside
    // recordTermsDecision: an invoice that has been re-dated must not be un-dated
    // because the audit write failed.
    await recordTermsDecision({
      businessId,
      serviceBusinessId: crm.serviceBusinessId,
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      actorId: crm.userId,
      decision: {
        terms: chosenDueInDays === 0 ? 'Due on receipt' : `Net ${chosenDueInDays}`,
        dueInDays: chosenDueInDays,
        requireEscrow: view.recommendation.requireEscrow,
        overrideReason: reason,
        recommended: view.recommendation,
      },
    });

    res.json({
      success: true,
      data: {
        invoice: updated,
        dueInDays: chosenDueInDays,
        overrode: action === 'override',
        // Said plainly rather than left implied: escrow lives on the job, so nothing
        // here has set it.
        escrowRecommended: view.recommendation.requireEscrow,
        escrowApplied: false,
      },
    });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      ...(status >= 500 ? { error: 'Could not set terms' } : { error: err.message }),
    });
  }
});

/**
 * GET /api/v1/crm/invoices/:id
 */
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

// POST /api/v1/crm/invoices — Create an invoice.
//
// Delegates to invoice.service.createInvoice. This used to be a second, hand-rolled insert
// living in the route, and the two had drifted apart:
//
//   number        route: INV-YYYY-NNNN, business-scoped, collision retry
//                 service: INV-<random 6 digits>, unscoped, no retry (500 on a P2002)
//   client check  route: verifies serviceBusinessId
//                 service: NONE — any tenant's clientId was accepted
//   tenant source route: resolveCrmBusiness (server-derived)
//                 service: req.user.businessId (a JWT claim that goes stale)
//
// One code path, so the better behaviour is the only behaviour. tierGuard stays here: it
// meters invoice creation against the plan quota, which is a CRM-plan concern and not part
// of creating a document.
router.post('/invoices', tierGuard({ resource: 'invoices' }), async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = requireCrmContext(req);
    const invoice = await createInvoice(businessId as string, req.body ?? {});
    res.status(201).json({ success: true, data: invoice });
  } catch (err: any) {
    // Previously a bare 500 with err.message, so a 400 from the service (no title, unknown
    // client, missing dateDue) came back as a server error with no usable status.
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      ...(status >= 500 ? { error: 'Failed to create invoice' } : { error: err.message }),
    });
  }
});

/**
 * PATCH /api/v1/crm/invoices/:id
 *
 * The invoice detail page has an edit mode for due date and notes, and PATCHes
 * `/crm/invoices/${id}`. Only `/invoices/:id/status` was registered, so the save
 * 404'd and `handleSaveEdit` console.error'd it — which nobody sees, so the edit
 * mode looked like it worked and silently did not.
 *
 * Delegates to the service, which already had this: tenant-scoped by businessId,
 * draft-only, and careful to re-wrap `notes` in the {text, metadata} envelope that
 * invoicePublic.routes and money-flow.service both JSON.parse. Writing notes
 * straight into the column from a route would break both readers.
 */
router.patch('/invoices/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = requireCrmContext(req);
    if (!businessId) return res.status(400).json({ success: false, error: 'Business is not linked to a platform business yet' });
    const invoice = await updateInvoice(businessId as string, req.params.id, req.body ?? {});
    res.json({ success: true, data: invoice });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      ...(status >= 500 ? { error: 'Could not update invoice' } : { error: err.message }),
    });
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

    // CrmClient.totalSpent is what the clients table renders as LTV, and nothing else
    // writes it. Recomputed on BOTH edges of the paid transition, not just on the way
    // in: an invoice reopened or refunded has to stop counting, or a correction made
    // in the UI silently keeps earning its old value forever.
    if (oldStatus === 'paid' || updated.status === 'paid') {
      await crmService.refreshClientTotals(updated.clientId);
    }

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

/**
 * GET /api/v1/crm/setup-progress
 *
 * Real counts, for the first-run checklist.
 *
 * Deliberately a single endpoint rather than the checklist fetching five lists. It
 * needs counts, and fetching whole collections to read `.length` would pull every
 * client, job, deal and invoice into the browser to answer a yes/no question — on
 * the page most likely to be loaded by someone on a phone.
 *
 * Each count is a `count`, not a `findMany`, so the database returns one integer per
 * table.
 */
router.get('/setup-progress', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const scope = crmScope(crm.serviceBusinessId, crm.businessId);

    const [clients, jobs, deals, tasks, invoices] = await Promise.all([
      prisma.crmClient.count({ where: scope }),
      prisma.crmJob.count({ where: scope }),
      prisma.crmDeal.count({ where: scope }),
      // Only outstanding work. A pile of completed tasks is not evidence that the
      // person set their workspace up, so counting them would tick the box for someone
      // who finished their list a year ago and never came back.
      prisma.crmActivity.count({
        where: { AND: [scope, { type: 'TASK', status: { not: 'DONE' } }] },
      }),
      prisma.invoice.count({
        // Invoices are keyed by the platform Business. An impossible predicate rather
        // than an empty one: an empty filter here is a match-all on the money table,
        // and while a count cannot leak rows, it would report a wildly wrong number
        // and tick the box off nothing.
        where: {
          businessId: crm.businessId ?? '__no_platform_business__',
          status: { not: 'draft' },
        },
      }),
    ]);

    res.json({ success: true, data: { clients, jobs, deals, openTasks: tasks, sentInvoices: invoices } });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      ...(status >= 500 ? { error: 'Could not load setup progress' } : { error: err.message }),
    });
  }
});

/**
 * GET /api/v1/crm/search?q=
 *
 * One search across clients, deals, jobs, invoices and activities.
 *
 * The platform had no cross-entity search before this. Every list page carried its own
 * private box, which meant you could only search the page you were already on, and
 * the clients box matched name, email and company but not phone or notes — so typing
 * a phone number found nothing, silently, in a box that looked like it was working.
 *
 * `type` may be repeated or comma-separated to narrow the search; omitting it
 * searches everything. Each result carries an `href`, so choosing one goes to the
 * record rather than to a list that has to be searched again.
 */
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const q = typeof req.query.q === 'string' ? req.query.q : '';

    if (q.trim().length < MIN_SEARCH_LENGTH) {
      // An explicit "nothing searched yet", so the caller can tell this apart from
      // "we searched and found nothing".
      return res.json({ success: true, data: { results: [], query: q, tooShort: true } });
    }

    const requested = req.query.type;
    const types = (Array.isArray(requested) ? requested : requested ? [requested] : [])
      .flatMap((t) => String(t).split(','))
      .map((t) => t.trim().toLowerCase())
      .filter((t): t is SearchResult['type'] =>
        ['client', 'deal', 'job', 'invoice', 'activity'].includes(t),
      );

    const results = await searchCrm(
      crm.serviceBusinessId,
      crm.businessId,
      q,
      types.length ? { types } : {},
    );

    res.json({ success: true, data: { results, query: q, tooShort: false } });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      ...(status >= 500 ? { error: 'Search failed' } : { error: err.message }),
    });
  }
});

// POST /api/v1/crm/jobs/:id/checkin — Check in for a job
router.post('/jobs/:id/checkin', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId, businessId, userId } = requireCrmContext(req);
    const job = await crmService.checkInJob(req.params.id, userId, req.body.latitude, req.body.longitude, serviceBusinessId, businessId);
    res.json({ success: true, data: job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/crm/jobs/:id/checkout — Check out from a job
router.post('/jobs/:id/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId, businessId, userId } = requireCrmContext(req);
    const result = await crmService.checkOutJob(req.params.id, userId, serviceBusinessId, businessId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/crm/jobs/:id/noshow — Handle no-show (called by cron)
router.post('/jobs/:id/noshow', async (req: AuthRequest, res: Response) => {
  try {
    const { id: jobId } = req.params;
    const crm = requireCrmContext(req);
    await crmService.handleNoShow(jobId, crm.serviceBusinessId, crm.businessId);
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

// ── CRM settings and client files ───────────────────────────────────────────
//
// Two endpoints the CRM has called since they were first written, neither of which existed.
// Both are read-only, and that is a deliberate scoping decision rather than an omission.
//
// `/settings`
// ContactClientsPage reads this expecting `{ customFields: { client: [...] } }` — a
// CRM-shaped view. The only writer of custom fields is CustomFieldsPage, which PUTs to
// `/settings/config` and nests them under `enabledFeatures.customFields`. So one piece of
// data has two locations and two shapes.
//
// Rather than introduce a third store, this reads BOTH existing BusinessSettings columns and
// prefers the dedicated `customFields` one — `enabledFeatures` is where the writer puts it
// today, and `customFields` is the column the name implies. Reading both means the endpoint
// answers correctly whichever one a given row happens to use.
//
// `/files`
// `CrmFile` has NO `serviceBusinessId` — it is anchored to the legacy `CrmBusiness` table,
// the same id-space trap that made deals and reports invisible until they were fixed. Rather
// than add a nullable column to a table with a fragile migration story, for a feature with one
// consumer and no write path yet, the tenant check goes through the relation instead: every
// file has a required `clientId`, and `CrmClient.serviceBusinessId` resolves. That is provable
// ownership with no schema change.
//
// WHEN WRITES ARE ADDED, `CrmFile` needs `serviceBusinessId`. Writing through
// `client.serviceBusinessId` is not enough, because a row created with only the legacy
// `businessId` could never be listed by a query that filters the new column.
//
// Neither route reads a businessId from the query or body — that is how reports leaked revenue
// and jobs leaked client addresses.

/** Read a JSON column that may legitimately be null, without trusting its shape. */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

router.get('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = requireCrmContext(req);
    // No platform business means no BusinessSettings row. An empty object is the honest
    // answer; a match-all here would report another business's configuration.
    if (!businessId) return res.json({ success: true, data: { customFields: {} } });

    const customFields = await SettingsService.getCustomFields(businessId);

    // ONE home. The dedicated column is canonical; `enabledFeatures` is a feature-flag bag
    // and no longer carries field definitions.
    //
    // This previously merged the two, which made the writer/reader disagreement harmless
    // rather than fixed — two places to look, and the next change would have had to guess
    // which one a given row meant. The disagreement is now resolved at the write path
    // (SettingsService.updateSettings normalises to this column) and at boot
    // (sql/customfields-canonical.sql moves anything already in the bag), so this can read
    // one column and mean it.
    res.json({ success: true, data: { customFields } });
  } catch (err: any) {
    res.status(Number(err?.statusCode) || 500).json({ success: false, error: 'Could not load settings' });
  }
});

/**
 * GET /api/v1/crm/files
 *
 * Optional `?clientId=`, applied ON TOP OF the tenant scope rather than instead of it, so
 * another business's client id returns an empty list rather than their files. Bounded,
 * because a client detail page wants the recent handful, not the complete archive.
 */
router.get('/files', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;

    const files = await prisma.crmFile.findMany({
      where: {
        // New rows carry the tenant themselves. Rows written before CrmFile had the column
        // only have the legacy `businessId`, so they are matched through the client relation
        // instead -- that keeps them visible without leaving a second id space in play.
        OR: [{ serviceBusinessId }, { client: { serviceBusinessId } }],
        ...(clientId ? { clientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, clientId: true, fileName: true, fileUrl: true,
        fileSize: true, fileType: true, createdAt: true,
      },
    });

    res.json({ success: true, data: files });
  } catch (err: any) {
    res.status(Number(err?.statusCode) || 500).json({ success: false, error: 'Could not list files' });
  }
});

/**
 * POST /api/v1/crm/files — register a stored file against a client.
 *
 * THIS REGISTERS A FILE THAT IS ALREADY STORED. It does not accept bytes.
 *
 * There is no blob-storage integration on this platform and no upload UI, so "accept a
 * multipart upload" would mean inventing both. What this does instead is the half that can be
 * correct today: the caller uploads to storage by whatever means it has, then records the
 * resulting URL here. That makes the table writable, which it was not, and gives the client
 * detail page something real to list.
 *
 * The URL is validated as an absolute http(s) URL. A `javascript:` or `data:` value here
 * would render as a link on a page an operator is looking at, so this is the boundary that
 * matters — not the file extension.
 *
 * The client must belong to the caller's tenant, proved by lookup rather than trusted from
 * the body: otherwise a file could be attached to another business's client and surface on
 * their record.
 */
router.post('/files', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const { clientId, fileName, fileUrl, fileSize, fileType } = req.body ?? {};

    const name = typeof fileName === 'string' ? fileName.trim() : '';
    if (!name) return res.status(400).json({ success: false, error: 'fileName is required' });
    if (name.length > 255) {
      return res.status(400).json({ success: false, error: 'fileName is too long' });
    }

    const url = typeof fileUrl === 'string' ? fileUrl.trim() : '';
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: 'fileUrl must be an absolute URL' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ success: false, error: 'fileUrl must be http or https' });
    }

    if (!clientId) return res.status(400).json({ success: false, error: 'clientId is required' });
    const client = await prisma.crmClient.findFirst({
      where: { id: String(clientId), serviceBusinessId },
      select: { id: true },
    });
    // 404 not 403: whether the client id exists is not this endpoint's business to reveal.
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

    const size = fileSize === undefined || fileSize === null || fileSize === ''
      ? null
      : Number(fileSize);
    if (size !== null && (!Number.isFinite(size) || size < 0)) {
      return res.status(400).json({ success: false, error: 'fileSize must be a number' });
    }

    const file = await prisma.crmFile.create({
      data: {
        serviceBusinessId,
        // The legacy anchor is deliberately null: nothing creates a CrmBusiness, and writing a
        // fabricated id here would either violate the FK or point at someone else's.
        businessId: null,
        clientId: client.id,
        fileName: name,
        fileUrl: url,
        fileSize: size === null ? null : String(size),
        fileType:
          typeof fileType === 'string' && fileType.trim() ? fileType.trim().slice(0, 120) : null,
      },
      select: {
        id: true, clientId: true, fileName: true, fileUrl: true,
        fileSize: true, fileType: true, createdAt: true,
      },
    });

    res.status(201).json({ success: true, data: file });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      error: status >= 500 ? 'Could not register the file' : err?.message ?? 'Invalid request',
    });
  }
});

/** DELETE /api/v1/crm/files/:id — tenant-scoped, 404 rather than 403. */
router.delete('/files/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const existing = await prisma.crmFile.findFirst({
      where: {
        id: req.params.id,
        OR: [{ serviceBusinessId }, { client: { serviceBusinessId } }],
      },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'File not found' });
    await prisma.crmFile.delete({ where: { id: existing.id } });
    res.json({ success: true, data: { id: existing.id } });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      error: status >= 500 ? 'Could not delete the file' : err?.message ?? 'Invalid request',
    });
  }
});

/** GET /api/v1/crm/files/:id — 404 rather than 403, so the response cannot confirm an id exists. */
router.get('/files/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const file = await prisma.crmFile.findFirst({
      where: {
        id: req.params.id,
        OR: [{ serviceBusinessId }, { client: { serviceBusinessId } }],
      },
      select: {
        id: true, clientId: true, fileName: true, fileUrl: true,
        fileSize: true, fileType: true, createdAt: true,
      },
    });
    if (!file) return res.status(404).json({ success: false, error: 'File not found' });
    res.json({ success: true, data: file });
  } catch (err: any) {
    res.status(Number(err?.statusCode) || 500).json({ success: false, error: 'Could not load file' });
  }
});

// GET /api/v1/crm/dashboard — Get dashboard statistics
router.get('/dashboard', getDashboardStatsHandler);

// ── Trust-Aware Revenue Engine ──────────────────────────────────────────────

// GET /api/v1/crm/alerts — Get active trust & revenue alerts
router.get('/alerts', getAlertsHandler);

// POST /api/v1/crm/alerts/:id/dismiss — Dismiss an alert
router.post('/alerts/:id/dismiss', dismissAlertHandler);

/**
 * GET /api/v1/crm/clients/:id/intelligence
 *
 * What the model makes of this client: segment, predicted lifetime value, churn
 * probability and a next action.
 *
 * Two things make this honest rather than decorative. It reads the client's real CRM
 * rows rather than the nightlife `Reservation` table the model was originally written
 * against, and it refuses to answer at all below three completed jobs — see
 * `crm-intelligence.service` for why confidence was not enough to gate on.
 *
 * The response always carries `facts`, which are counts read straight from the
 * database. A client with no verdict still tells you what is true about them; only
 * the prediction is withheld.
 *
 * Tenant-scoped via `crmScope`, so a client id from another business is a 404.
 */
router.get('/clients/:id/intelligence', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const client = await prisma.crmClient.findFirst({
      where: { id: req.params.id, ...crmScope(crm.serviceBusinessId, crm.businessId) },
      select: { id: true },
    });
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

    const intelligence = await getClientIntelligence(
      req.params.id,
      crm.serviceBusinessId,
      crm.businessId,
    );
    res.json({ success: true, data: intelligence });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      ...(status >= 500 ? { error: 'Could not work this out' } : { error: err.message }),
    });
  }
});

/**
 * GET /api/v1/crm/clients/:id/explain-score
 *
 * `trust-core.explainScore()` itemises a reliability score into its four weighted
 * inputs with each one's arithmetic shown. It is pure, tested, and had no caller
 * anywhere in the codebase — the platform's one piece of genuine explainability,
 * unreachable.
 *
 * It is exposed here because a score nobody can interrogate is a score nobody can
 * argue with when it is wrong. The client panel shows the same four rows.
 */
router.get('/clients/:id/explain-score', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const client = await prisma.crmClient.findFirst({
      where: { id: req.params.id, ...crmScope(crm.serviceBusinessId, crm.businessId) },
      select: { id: true, reliabilityScore: true },
    });
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

    const { signals, sampleSize } = await collectClientSignals(req.params.id);
    res.json({
      success: true,
      data: {
        score: client.reliabilityScore,
        sampleSize,
        breakdown: signals ? explainScore(signals) : null,
        reason: signals
          ? null
          : 'No completed jobs or settled invoices yet, so there is nothing to break the score down against.',
      },
    });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      ...(status >= 500 ? { error: 'Could not load the breakdown' } : { error: err.message }),
    });
  }
});

// GET /api/v1/crm/clients/:id/stage — Get client lifecycle stage
router.get('/clients/:id/stage', getClientStageHandler);

export default router;
