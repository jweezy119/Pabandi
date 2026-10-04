import { Router, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { ReportsService, type ReportsContext } from '../services/reports.service';

/**
 * Business reports.
 *
 * WHAT CHANGED AND WHY IT MATTERED
 * --------------------------------
 * This router read its tenant from `String(req.query.businessId)` and passed it to the
 * service. `authenticate` was present, so the routes looked protected — but authentication
 * only establishes WHO the caller is. There was no ownership check at all, so any
 * authenticated user could read any other business's revenue, expenses, pipeline, client
 * list and activity feed by putting that business's id in the query string.
 *
 * Six routes of business financials, reachable across tenant boundaries. The `businessId`
 * query parameter is now ignored entirely: the tenant comes from `resolveCrmBusiness`,
 * which pairs a requested id with `ownerId: userId`, so a leaked id resolves to nothing and
 * the request is refused rather than silently redirected.
 *
 * `router.use` rather than per-route so a route added later is covered by default. Adding
 * auth per handler is how the next one ends up unprotected.
 */
const router = Router();
router.use(authenticate);
router.use(resolveCrmBusiness);

/**
 * Build the report context and the date range from the request.
 *
 * The tenant is resolved server-side and cannot be overridden. Date PARSING happens here;
 * date VALIDITY is enforced by the service, for the reason noted below.
 */
function reportArgs(req: any): { ctx: ReportsContext; start?: Date; end?: Date } {
  const crm = requireCrmContext(req);
  const ctx: ReportsContext = {
    serviceBusinessId: crm.serviceBusinessId,
    businessId: crm.businessId ?? null,
  };

  const { startDate, endDate } = req.query ?? {};
  const start = startDate ? new Date(String(startDate)) : undefined;
  const end = endDate ? new Date(String(endDate)) : undefined;

  if (startDate && (!start || Number.isNaN(start.getTime()))) {
    throw Object.assign(new Error('startDate must be a valid date'), { statusCode: 400 });
  }
  if (endDate && (!end || Number.isNaN(end.getTime()))) {
    throw Object.assign(new Error('endDate must be a valid date'), { statusCode: 400 });
  }
  // Range VALIDITY (start <= end) is deliberately not checked here. ReportsService.inRange
  // owns it, because that is the layer that knows a range is meaningless. Checking it in
  // both places meant a test could not tell which one was actually enforcing it — deleting
  // the route's copy left the suite green, which is exactly how a duplicated check rots.
  return { ctx, start, end };
}

/** One shape for every handler: resolve, delegate, and never leak a stack trace. */
function handle(pick: (ctx: ReportsContext, start?: Date, end?: Date) => Promise<unknown>) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const { ctx, start, end } = reportArgs(req);
      const data = await pick(ctx, start, end);
      // Bare payload, as before. The reports client reads `res.data ?? res`, so wrapping
      // this in { success, data } would have been a silent shape change.
      res.json(data);
    } catch (err: any) {
      // A 400 raised deliberately above must stay a 400; anything unexpected is a 500 with
      // no internals. Previously every failure was a bare 500 with err.message, which
      // included raw Prisma text (table and column names) in the response.
      const status = Number(err?.statusCode) || 500;
      if (status >= 500) {
        res.status(status).json({ success: false, error: 'Failed to build report' });
      } else {
        res.status(status).json({ success: false, error: err?.message ?? 'Invalid request' });
      }
      next(err);
    }
  };
}

router.get('/pipeline', handle((ctx, s, e) => ReportsService.getPipeline(ctx, s, e)));
router.get('/revenue', handle((ctx, s, e) => ReportsService.getRevenue(ctx, s, e)));
router.get('/expenses', handle((ctx, s, e) => ReportsService.getExpenses(ctx, s, e)));
router.get('/client-health', handle((ctx, s, e) => ReportsService.getClientHealth(ctx, s, e)));
router.get('/trust-insights', handle((ctx, s, e) => ReportsService.getTrustInsights(ctx, s, e)));
router.get('/activity-metrics', handle((ctx, s, e) => ReportsService.getActivityMetrics(ctx, s, e)));

export default router;
