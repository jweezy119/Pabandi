import { Router, Request, Response } from 'express';
import { SettingsService } from '../services/settings.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { resolvePlatformBusinessId } from '../middleware/tenant.middleware';
import { prisma } from '../utils/database';

/**
 * Business settings.
 *
 * WHAT WAS WRONG, AND IT WAS THE WORST LEAK IN THE AUDIT
 *
 * Four of the six routes had NO AUTHENTICATION AT ALL:
 *
 *     GET /settings/profile    -> String(req.query.businessId)
 *     PUT /settings/profile    -> String(req.body.businessId)
 *     GET /settings/config     -> String(req.query.businessId)
 *     PUT /settings/config     -> String(req.body.businessId)
 *
 * No `authenticate`, and the tenant straight from the caller. So anyone on the internet could
 * read any business's profile and configuration, and WRITE to both — rewriting another
 * tenant's settings with no session at all. The two dashboard-layout routes were at least
 * authenticated, but still fell back to `req.user.businessId || req.query.businessId`.
 *
 * Every route here now authenticates (`router.use`, so a route added later is covered by
 * default) and takes its tenant from `resolvePlatformBusinessId`, which is server-derived and
 * ownership-checked. A `businessId` in the query or body is IGNORED, not merely validated:
 * there is no longer a caller-influenced tenant on this router at all.
 *
 * `resolvePlatformBusinessId` rather than `resolveCrmBusiness` because this is the platform
 * business's settings, not the CRM's. A business that has not enrolled in Contact OS still has
 * a platform Business and still needs its dashboard layout and profile.
 *
 * A caller with no business gets a 403 naming the cause, rather than an empty object that reads
 * like "you have no settings configured".
 */
const router = Router();
router.use(authenticate);

/** The caller's own platform business id, or throw with a reason a user can act on. */
async function tenantOf(req: Request): Promise<string> {
  const businessId = await resolvePlatformBusinessId(req);
  if (!businessId) {
    throw Object.assign(new Error('No business is associated with your account'), {
      statusCode: 403,
    });
  }
  return businessId;
}

/** Preserve the error status; a bare 500 turns a 403 into "server broke". */
function fail(res: Response, err: any, fallback: string) {
  const status = Number(err?.statusCode) || 500;
  res.status(status).json({ success: false, error: status >= 500 ? fallback : err.message });
}

router.get('/profile', async (req: Request, res: Response) => {
  try {
    const businessId = await tenantOf(req);
    const data = await SettingsService.getBusinessProfile(businessId);
    res.json(data);
  } catch (err: any) {
    fail(res, err, 'Could not load profile');
  }
});

router.put('/profile', async (req: Request, res: Response) => {
  try {
    const businessId = await tenantOf(req);
    const data = await SettingsService.updateBusinessProfile(businessId, req.body.data);
    res.json(data);
  } catch (err: any) {
    fail(res, err, 'Could not save profile');
  }
});

router.get('/config', async (req: Request, res: Response) => {
  try {
    const businessId = await tenantOf(req);
    const data = await SettingsService.getSettings(businessId);
    res.json(data);
  } catch (err: any) {
    fail(res, err, 'Could not load settings');
  }
});

router.put('/config', async (req: Request, res: Response) => {
  try {
    const businessId = await tenantOf(req);
    const data = await SettingsService.updateSettings(businessId, req.body.data);
    res.json(data);
  } catch (err: any) {
    fail(res, err, 'Could not save settings');
  }
});

router.get('/dashboard-layout', async (req: Request, res: Response) => {
  try {
    const businessId = await tenantOf(req);

    // Through the service, not a direct findUnique: one owner for this table, so the
    // custom-fields normalisation and the flag-bag merge cannot be bypassed by a new route.
    return res.json({ success: true, data: await SettingsService.getDashboardLayout(businessId) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

router.put('/dashboard-layout', async (req: Request, res: Response) => {
  try {
    const businessId = await tenantOf(req);

    const { layout, theme } = req.body;
    // Was its own upsert against prisma directly. Replacing the whole row on a dashboard save
    // is the failure mode the custom-fields work just fixed for /config; going through the
    // service means both routes share one merge.
    const settings = await SettingsService.updateDashboardLayout(businessId, { layout, theme });

    return res.json({ success: true, data: settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
