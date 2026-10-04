import { Router, Request, Response, NextFunction } from 'express';
import { smsService } from '../services/sms.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth.middleware';
import { tierFeature } from '../middleware/tierGuard.middleware';
import { resolvePlatformBusinessId } from '../middleware/tenant.middleware';
import { CustomError } from '../middleware/errorHandler';

/**
 * SMS — sending, delivery status, and per-business logs.
 *
 * WHAT WAS WRONG WITH EVERY ROUTE HERE
 * ------------------------------------
 * This router had NO authentication, NO authorisation and NO tier check on any of its
 * routes, and took `businessId` from the request body:
 *
 *   router.post('/send', ...)  ->  smsService.sendSMS(to, message, req.body.businessId)
 *
 * So the moment TWILIO_ACCOUNT_SID existed, anyone on the internet could send SMS
 * through Pabandi's account, attribute it to any business id they liked, and we paid
 * the bill. It was latent only because no credentials were configured — `smsConfigured`
 * has been false in /health throughout.
 *
 * It also meant `smsReminders`, priced into the $49 plan and advertised, was read by
 * nothing: a free account could send billed SMS.
 *
 * WHAT CHANGED
 * ------------
 * - `authenticate` on every user-facing route.
 * - `tierFeature('smsReminders')` on the two that spend money.
 * - Tenant resolved from the verified token / CRM context, NEVER from the body. A
 *   mismatched body id is rejected rather than ignored, so a confused caller finds out
 *   instead of silently operating on the wrong tenant.
 * - A cap on bulk size, so one request cannot drain an account.
 * - The Twilio callback verifies its signature and fails closed.
 * - `/credentials` is GONE. It accepted a Twilio SID and auth token, stored nothing,
 *   and replied "Credentials saved" — a false confirmation on the one route where a
 *   false confirmation costs money. Per-business provider credentials are a separate
 *   change and will arrive with a real, verified flow.
 */

const router = Router();

/** Ceiling on one bulk request. A single call must not be able to drain an account. */
const MAX_BULK = 500;

/**
 * The tenant this request acts on, or a clear refusal.
 *
 * Rejects a body/query `businessId` that disagrees, rather than quietly preferring it.
 * Preferring it would let a caller with a valid session read or bill another tenant;
 * silently ignoring it hides the caller's own bug. Either way it must never be trusted.
 */
async function ownedBusiness(req: Request): Promise<string> {
  const businessId = await resolvePlatformBusinessId(req);
  if (!businessId) {
    throw new CustomError(
      'This action needs a linked platform business. Complete business setup and try again.',
      409,
    );
  }

  // The resolver never reads body or query — a caller-supplied id is an assertion, not a
  // fact. Rejecting a mismatch rather than ignoring it turns a caller's own bug into a
  // clear error instead of silently billing the wrong tenant.
  const claimed = (req.body?.businessId ?? req.query?.businessId) as unknown;
  if (typeof claimed === 'string' && claimed && claimed !== businessId) {
    throw new CustomError('businessId does not match the authenticated account', 403);
  }
  return businessId;
}

// POST /api/v1/sms/send — Send one SMS
router.post(
  '/send',
  authenticate,
  tierFeature('smsReminders'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = await ownedBusiness(req);
      const { to, message } = req.body;

      if (!to || !message) {
        res.status(400).json({ success: false, error: 'to and message are required' });
        return;
      }

      const result = await smsService.sendSMS(to, message, businessId);
      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        data: { messageId: result.messageId, provider: result.provider, cost: result.cost },
      });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/v1/sms/bulk — Send many
router.post(
  '/bulk',
  authenticate,
  tierFeature('smsReminders'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = await ownedBusiness(req);
      const { numbers, message } = req.body;

      if (!Array.isArray(numbers) || numbers.length === 0 || !message) {
        res.status(400).json({ success: false, error: 'numbers (array) and message are required' });
        return;
      }
      if (numbers.length > MAX_BULK) {
        res.status(400).json({
          success: false,
          error: `A single bulk request is limited to ${MAX_BULK} numbers. Send ${numbers.length} in batches.`,
        });
        return;
      }

      const result = await smsService.sendBulkSMS(numbers, message, businessId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/sms/status/:id — Delivery status for a message this business sent
router.get(
  '/status/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = await ownedBusiness(req);

      // Scoped to the caller. Without this, any authenticated business could poll the
      // delivery status of any message id it could guess or obtain.
      const log = await prisma.sMSLog.findFirst({
        where: { id: req.params.id, businessId },
        select: { id: true, provider: true, status: true },
      });
      if (!log) {
        res.status(404).json({ success: false, error: 'Message not found' });
        return;
      }

      const result = await smsService.getStatus(log.id, (log.provider as 'TWILIO' | 'VONAGE') || 'TWILIO');
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/sms/logs — This business's messages only
router.get('/logs', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = await ownedBusiness(req);
    const { limit, offset } = req.query as { limit?: string; offset?: string };

    const take = Math.min(Math.max(parseInt(limit || '50', 10) || 50, 1), 200);
    const skip = Math.max(parseInt(offset || '0', 10) || 0, 0);

    const logs = await smsService.getSMSLogs(businessId, take, skip);
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/sms/webhook/twilio — Delivery status callbacks.
 *
 * NO session auth, because Twilio cannot present one. Authenticity comes from Twilio's
 * request signature instead, verified against the configured account auth token.
 *
 * Fails CLOSED. When no auth token is configured there is nothing to verify against, and
 * the previous behaviour — accept the callback and write whatever status it claims into
 * our delivery records — would let anyone forge delivery confirmations for any message
 * id. An unconfigured provider means no callbacks, not open ones.
 */
router.post('/webhook/twilio', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
    if (!authToken) {
      logger.warn('[SMS] rejected Twilio webhook: TWILIO_AUTH_TOKEN is not configured');
      res.status(503).type('text/xml').send('<Response/>');
      return;
    }

    const signature = req.header('X-Twilio-Signature');
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    if (!signature || !smsService.verifyTwilioSignature(url, req.body as Record<string, string>, signature, authToken)) {
      logger.warn('[SMS] rejected Twilio webhook with an invalid signature');
      res.status(403).type('text/xml').send('<Response/>');
      return;
    }

    await smsService.handleTwilioWebhook(req.body);
    res.type('text/xml').send('<Response/>');
  } catch (error) {
    next(error);
  }
});

export default router;
