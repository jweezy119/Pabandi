import express from 'express';
import { Router, NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.post(
  '/',
  express.raw({ type: 'application/json', verify: (req: any, _res, buf) => { req.rawBody = buf; } }),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const rawBody: Buffer = req.rawBody || Buffer.from('');
      let payload: any = {};

      try {
        payload = JSON.parse(rawBody.toString('utf-8') || '{}');
      } catch (parseError) {
        logger.warn('[EscrowWebhook] Invalid JSON received');
        return res.status(200).json({ received: true });
      }

      const event = payload?.event || payload?.event_type || '';
      const escrowTransactionId = String(payload?.transaction_id || payload?.transactionId || '');

      if (!escrowTransactionId) {
        return res.status(200).json({ received: true });
      }

      // Escrow.com event examples: payment_approved, funded, released, cancelled, dispute_opened
      // TODO: persist to Prisma when escrowTransactionId mapping exists in checkout_session metadata
      logger.info('[EscrowWebhook] Received event=%s transactionId=%s', event, escrowTransactionId);

      return res.status(200).json({ received: true });
    } catch (error) {
      logger.error('[EscrowWebhook] Processing error: %s', (error as any)?.message || error);
      return res.status(200).json({ received: true });
    }
  }
);

export default router;
