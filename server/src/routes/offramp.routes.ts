import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  createIntent,
  matchLp,
  submitProof,
  getIntents,
  acceptProof,
  expireStaleIntents,
  listProviders,
  registerProvider,
  testWebhookDelivery,
  emiWebhook,
  createSettlementReceipt,
  streamLpIntents,
} from '../controllers/offramp.controller';
import { logger } from '../utils/logger';
import { lpAuthRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// ── LP API Key auth (header only — never accept via query param) ──────────────
function lpAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(401).json({ success: false, error: 'Unauthorized LP' });
  }
  const expected = process.env.OFFRAMP__LP_API_KEY;
  if (!expected) {
    logger.error('[Offramp] OFFRAMP__LP_API_KEY is not configured — LP auth cannot verify');
    return res.status(500).json({ success: false, error: 'Server misconfiguration' });
  }
  // Constant-time comparison to avoid timing attacks on the API key
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(apiKey);
  if (expectedBuf.length !== providedBuf.length || !expectedBuf.equals(providedBuf)) {
    return res.status(401).json({ success: false, error: 'Unauthorized LP' });
  }
  next();
}

// Admin / Internal Routes
router.post('/intent', authenticate, createIntent);
router.post('/lp/match/:intentId', authenticate, authorize('BUSINESS_OWNER', 'ADMIN'), matchLp);
router.post('/lp/accept-proof', authenticate, authorize('BUSINESS_OWNER', 'ADMIN'), acceptProof);
router.post('/admin/expire-stale', authenticate, authorize('ADMIN'), expireStaleIntents);
router.get('/providers', authenticate, listProviders);
router.post('/providers/register', authenticate, authorize('BUSINESS_OWNER', 'ADMIN'), registerProvider);
router.post('/dev/test-webhook', authenticate, authorize('ADMIN'), testWebhookDelivery);
router.post('/webhook/emi', emiWebhook);
router.post('/settlement/receipt', authenticate, authorize('BUSINESS_OWNER', 'ADMIN'), createSettlementReceipt);

// LP Facing Routes — rate-limited at the IP level before LP key check
router.get('/lp/stream', lpAuthRateLimiter, lpAuthMiddleware, streamLpIntents);
router.post('/lp/submit-proof/:intentId', lpAuthRateLimiter, lpAuthMiddleware, submitProof);

export default router;
