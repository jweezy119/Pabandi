import { Router, type Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { createInvoice } from '../services/invoice.service';
import { SettingsService } from '../services/settings.service';
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
        client: { serviceBusinessId },
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

/** GET /api/v1/crm/files/:id — 404 rather than 403, so the response cannot confirm an id exists. */
router.get('/files/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const file = await prisma.crmFile.findFirst({
      where: { id: req.params.id, client: { serviceBusinessId } },
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

// GET /api/v1/crm/clients/:id/stage — Get client lifecycle stage
router.get('/clients/:id/stage', getClientStageHandler);

export default router;
