import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { offrampService } from '../services/offramp.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * The EMI receiver is still a mock ("Stage A"), but it settles real intents.
 * Without a signature, anyone who knows/guesses an intentId can settle one.
 * Require HMAC over the raw body wherever the mock is enabled; in production
 * an unconfigured secret disables the endpoint instead of accepting unsigned
 * settlement events.
 */
function verifyOfframpWebhook(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.OFFRAMP_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('[OfframpWebhook] OFFRAMP_WEBHOOK_SECRET missing; rejecting settlement webhook');
      return res.status(503).json({ error: 'Off-ramp webhook is not configured' });
    }
    logger.warn('[OfframpWebhook] unsigned mock webhook accepted (non-production only)');
    return next();
  }

  const signature = String(req.headers['x-offramp-signature'] || '');
  const raw = Buffer.isBuffer(req.body) ? req.body : (req as any).rawBody;
  if (!signature || !raw) return res.status(401).json({ error: 'Missing signature or raw body' });

  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const providedBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (
    providedBuf.length !== expectedBuf.length ||
    !/^[0-9a-f]+$/i.test(signature) ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  return next();
}

/**
 * Stage A: Mock EMI Webhook receiver
 * In production, this would verify HMAC signatures from JazzCash/NayaPay.
 */
router.post('/emi', verifyOfframpWebhook, async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    logger.info(`[Webhook] Received EMI webhook payload`, payload);

    const intentId = req.query.intentId as string;
    
    if (!intentId) {
      return res.status(400).json({ error: 'Missing intentId in query parameters' });
    }

    // In a real scenario, the EMI might just send the bank account and amount,
    // and we would have to query the DB for an intent matching those details.
    // For this mock, we assume the webhook includes the intentId (e.g. passed as a callback parameter).
    
    const success = await offrampService.processWebhookMatch(intentId, payload);
    
    if (success) {
      return res.status(200).json({ success: true, message: 'Intent settled via webhook' });
    } else {
      return res.status(400).json({ success: false, message: 'Webhook failed to match or intent invalid' });
    }
  } catch (error: any) {
    logger.error(`[Webhook] EMI Error: ${error.message}`);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
