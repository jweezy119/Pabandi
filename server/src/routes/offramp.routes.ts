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

const router = Router();

// Middleware: Simple LP API Key check for Phase 0
function lpAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!apiKey || apiKey !== process.env.OFFRAMP__LP_API_KEY) {
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

// LP Facing Routes
router.get('/lp/stream', lpAuthMiddleware, streamLpIntents);
router.post('/lp/submit-proof/:intentId', lpAuthMiddleware, submitProof);

export default router;
