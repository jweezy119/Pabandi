import { Router, Request, Response, NextFunction } from 'express';
import { webhookManager, OpenWAWebhookPayload } from '../services/openwa.webhook-manager.service';
import { getMessageAck } from '../services/openwa.webhook-handler.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/openwa/webhook/incoming
 *
 * Receives webhook payloads from OpenWA. Verifies HMAC signature before
 * dispatching to the registered handlers.
 *
 * OpenWA sends the signature in the `X-Webhook-Signature` header as "sha256=<hex>".
 */
router.post('/incoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string | undefined;

    // Get raw body for HMAC verification.
    // Express json() middleware may have already parsed it, so we reconstruct
    // or rely on a raw body buffer if available.
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (!webhookManager.verifySignature(rawBody, signature)) {
      logger.warn('[WebhookController] Invalid webhook signature');
      res.status(401).json({ success: false, error: 'Invalid signature' });
      return;
    }

    const payload = req.body as OpenWAWebhookPayload;

    if (!payload || !payload.event) {
      res.status(400).json({ success: false, error: 'Missing event field' });
      return;
    }

    // Respond immediately — handle asynchronously to avoid OpenWA retry on slow processing
    res.status(200).json({ success: true, received: true });

    // Dispatch in background
    webhookManager.dispatch(payload).catch(error => {
      logger.error(`[WebhookController] Dispatch error: ${error?.message || error}`);
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/openwa/webhook/status
 *
 * Returns webhook manager status: whether a webhook is registered,
 * health of the OpenWA connection, etc.
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: {
        callbackUrl: webhookManager.callbackUrl,
        registered: !!(webhookManager as any).registeredWebhookId,
        sessionId: (webhookManager as any).sessionId,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/openwa/webhook/ack/:messageId
 *
 * Look up delivery receipt status for a message.
 */
router.get('/ack/:messageId', (req: Request, res: Response) => {
  const record = getMessageAck(req.params.messageId);
  res.json({
    success: true,
    data: record || { messageId: req.params.messageId, ack: null, status: 'unknown' },
  });
});

export default router;
