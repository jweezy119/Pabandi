import { Router, Request, Response } from 'express';
import { offrampService } from '../services/offramp.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Stage A: Mock EMI Webhook receiver
 * In production, this would verify HMAC signatures from JazzCash/NayaPay.
 */
router.post('/emi', async (req: Request, res: Response) => {
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
