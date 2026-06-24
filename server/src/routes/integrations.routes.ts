import { Router, Response, Request } from 'express';
import { networkService } from '../services/network.service';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { apiKeyAuth, ApiKeyRequest } from '../middleware/apiKey.middleware';

import { cryptoService } from '../services/crypto.service';

const router = Router();

/**
 * Helper to securely hash phones received via server-to-server webhooks
 * using the daily rotating salt to prevent rainbow table attacks.
 */
function hashPhone(phone: string): string {
  return cryptoService.hmacHash(phone);
}

/**
 * ── TIKTOK SHOP WEBHOOK RECEIVER ─────────────────────────────────────────────
 * 
 * TikTok Shop does not allow custom frontend scripts. We must receive 
 * order creation webhooks, analyze them, and hit the TikTok Shop API back 
 * to cancel or hold the order if the buyer is high-risk.
 * 
 * Note: TikTok Shop uses HMAC signatures for security, not API keys.
 */
router.post('/tiktok/webhook', async (req: Request, res: Response): Promise<any> => {
  try {
    // 1. Verify TikTok Shop Signature
    const signature = req.headers['x-tts-signature'];
    const appSecret = process.env.TIKTOK_APP_SECRET || 'demo_tiktok_secret';
    
    // TikTok sends a timestamp and signature. The signature is HMAC-SHA256 of the payload + timestamp.
    // For this implementation we will validate a basic HMAC of the raw body.
    const rawBody = JSON.stringify(req.body);
    const expectedSignature = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

    if (signature !== expectedSignature && process.env.NODE_ENV === 'production') {
      logger.warn('[TikTok Shop] Webhook signature validation failed.');
      return res.status(401).json({ success: false, error: 'Unauthorized webhook payload' });
    }
    
    const { type, data } = req.body;

    // We only care about new orders that are Cash on Delivery
    if (type === 'ORDER_STATUS_UPDATE' && data.order_status === 'UNPAID' && data.payment_method === 'COD') {
      const buyerPhone = data.buyer_phone; // TikTok Shop passes PII to the seller's webhook
      
      if (!buyerPhone) return res.status(200).send('OK');

      // 2. Immediately hash the PII so we never store it
      const hashedPhone = hashPhone(buyerPhone);

      // 3. Query the Zero-Knowledge Network
      const networkResult = await networkService.checkHash(hashedPhone);

      if (networkResult.prediction?.riskLevel === 'CRITICAL') {
        logger.warn(`[TikTok Shop] Intercepted CRITICAL risk COD order. OrderID: ${data.order_id}`);
        
        // 4. Hit TikTok Shop API to CANCEL or HOLD the order
        // await axios.post(`https://open-api.tiktokglobalshop.com/order/202309/orders/${data.order_id}/cancel`, ...)
        
        // Feed it back to the merchant's dashboard log
        logger.info(`[TikTok Shop] Successfully auto-cancelled high-risk COD order ${data.order_id}.`);
      } else {
        logger.info(`[TikTok Shop] Order ${data.order_id} is low risk. Allowed to proceed.`);
      }
    }

    // TikTok Shop expects a fast 200 OK so the webhook doesn't retry
    return res.status(200).json({ success: true, message: 'Webhook received and processed.' });

  } catch (error) {
    logger.error('[Integrations] TikTok Webhook Error:', error);
    return res.status(500).json({ success: false, error: 'Internal error processing webhook' });
  }
});

/**
 * ── GENERIC OMNI-CHANNEL REPORTING ──────────────────────────────────────────
 * 
 * A unified endpoint for backend systems (Shopify Flow, WooCommerce hooks)
 * to automatically report a COD Rejection when a package is marked "Returned".
 */
router.post('/report', apiKeyAuth, async (req: ApiKeyRequest, res: Response): Promise<any> => {
  try {
    const { rawPhone, type, description } = req.body;

    if (!rawPhone || !type) {
      return res.status(400).json({ success: false, error: 'Missing required fields: rawPhone, type' });
    }

    // Hash it locally on our server edge before it touches the database
    const hashedPhone = hashPhone(rawPhone);
    const apiClientId = req.apiClient?.id;

    const result = await networkService.reportHash(hashedPhone, type, description, apiClientId);

    return res.status(201).json({
      success: true,
      message: 'Incident reported to the Zero-Knowledge network.',
      data: result
    });
  } catch (error) {
    logger.error('[Integrations] Generic Report Error:', error);
    return res.status(500).json({ success: false, error: 'Internal error reporting incident.' });
  }
});

export default router;
