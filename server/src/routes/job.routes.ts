import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { CustomError } from '../middleware/errorHandler';
import * as jobService from '../services/job.service';

/**
 * Jobs.
 *
 * THE HOLE THIS CLOSES
 * This router read its tenant like this:
 *
 *     const businessId = req.body?.businessId || req.query?.businessId;
 *
 * with only `authenticate` on the router. So any logged-in user could put another
 * business's id in the query string and read its job schedule — client names, service
 * ADDRESSES and appointment times — or create jobs in it. Jobs carry physical addresses, so
 * this leaks more sensitive material than the financials leak did.
 *
 * The tenant now comes from `resolveCrmBusiness`, which pairs a requested id with
 * `ownerId: userId`, and the id is taken from the resolved context rather than the request.
 *
 * `resolveCrmBusiness` 403s when the account has no service business enrolled, which would
 * be a confusing failure for a caller who only ever used this router, so the message names
 * the cause.
 */
const router = Router();
router.use(authenticate);
router.use(resolveCrmBusiness);

/** The resolved tenant. Never a request-supplied id. */
function tenantOf(req: AuthRequest): string {
  const crm = requireCrmContext(req);
  return crm.serviceBusinessId;
}

/**
 * Preserve the error status.
 *
 * Every handler here caught with `res.status(500)`, so a 404 "Job not found" or a 409
 * double-booking refusal reached the client as a server error — indistinguishable from a
 * genuine crash, and with no way for the UI to tell the user what to do.
 */
function fail(res: Response, err: any) {
  const status = Number(err?.statusCode) || 500;
  res.status(status).json({
    success: false,
    error: status >= 500 ? 'Job request failed' : err?.message ?? 'Invalid request',
    ...(status < 500 && err?.conflicts ? { conflicts: err.conflicts } : {}),
  });
}

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const job = await jobService.createJob(tenantOf(req), req.body);
    res.status(201).json({ success: true, data: job });
  } catch (err: any) {
    fail(res, err);
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const jobs = await jobService.getJobs(tenantOf(req), req.query);
    res.json({ success: true, data: jobs });
  } catch (err: any) {
    fail(res, err);
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const job = await jobService.getJob(tenantOf(req), req.params.id);
    res.json({ success: true, data: job });
  } catch (err: any) {
    fail(res, err);
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const job = await jobService.updateJob(tenantOf(req), req.params.id, req.body);
    res.json({ success: true, data: job });
  } catch (err: any) {
    fail(res, err);
  }
});

router.post('/:id/checkin', async (req: AuthRequest, res: Response) => {
  try {
    const job = await jobService.checkInJob(tenantOf(req), req.params.id, req.user!.id);
    res.json({ success: true, data: job });
  } catch (err: any) {
    fail(res, err);
  }
});

router.post('/:id/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const result = await jobService.checkOutJob(tenantOf(req), req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    fail(res, err);
  }
});

export default router;
