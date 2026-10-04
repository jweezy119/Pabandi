import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePlatformBusinessId, resolvePlatformBusinessId } from '../middleware/tenant.middleware';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import {
  connectProvider,
  disconnectProvider,
  getProvider,
  reverify,
  type SmsProvider,
} from '../services/sms-provider.service';

/**
 * Per-business SMS provider settings.
 *
 * Mounted at /api/v1/settings/sms. Separate from /api/v1/sms, which is about SENDING —
 * mixing a credential form into the send router is how the old `/sms/credentials` ended
 * up accepting keys and reporting success while storing nothing.
 *
 * Every route resolves the tenant from the verified session. There is no businessId
 * parameter, so there is nothing for a caller to point at someone else's account.
 */

const router = Router();

router.use(authenticate);

/** The tenant, or a clear reason we cannot proceed. */
async function tenantFor(req: Request): Promise<string> {
  const businessId = await resolvePlatformBusinessId(req);
  if (!businessId) {
    throw new CustomError(
      'No business is associated with this account. Finish setting up your business first.',
      403,
    );
  }
  return businessId;
}

function parseProvider(raw: unknown): SmsProvider {
  const value = String(raw || '').toUpperCase();
  if (value !== 'TWILIO' && value !== 'VONAGE') {
    throw new CustomError('provider must be TWILIO or VONAGE', 400);
  }
  return value;
}

/**
 * GET /api/v1/settings/sms
 *
 * Returns the connection WITHOUT the credential. `connected: false` is a normal state,
 * not an error, so the settings page can render from one call.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = await tenantFor(req);
    const provider = await getProvider(businessId);
    res.json({ success: true, data: { connected: Boolean(provider), provider: provider ?? null } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/settings/sms
 *
 * Verify, then store. Responds 201 on a verified connection, and 201 with
 * `status: 'FAILED'` plus the provider's own reason when verification fails — so the
 * merchant is told what is wrong instead of getting a bare rejection and no idea
 * whether to retry.
 *
 * The credential is never echoed back.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = await tenantFor(req);
    const provider = parseProvider(req.body?.provider);
    const fromNumber = String(req.body?.fromNumber || '').trim();

    const credentials =
      provider === 'TWILIO'
        ? {
            accountSid: String(req.body?.accountSid || '').trim(),
            authToken: String(req.body?.authToken || '').trim(),
          }
        : {
            apiKey: String(req.body?.apiKey || '').trim(),
            apiSecret: String(req.body?.apiSecret || '').trim(),
          };

    const view = await connectProvider(businessId, { provider, fromNumber, credentials });

    // 201 either way: a FAILED row was created and is readable at GET, which is what
    // lets the page show the reason in place.
    res.status(201).json({ success: true, data: { connected: view.status === 'VERIFIED', provider: view } });
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/settings/sms/verify — re-check a stored credential. */
router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = await tenantFor(req);
    const view = await reverify(businessId);
    res.json({ success: true, data: { connected: view.status === 'VERIFIED', provider: view } });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/v1/settings/sms — remove the connection and the stored secret. */
router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = await tenantFor(req);
    await disconnectProvider(businessId);
    logger.info(`[sms] provider disconnected for business ${businessId}`);
    res.json({ success: true, data: { connected: false, provider: null } });
  } catch (error) {
    next(error);
  }
});

export default router;
