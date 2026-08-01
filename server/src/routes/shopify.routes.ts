import { Router } from 'express';
import {
  shopifyAuth,
  shopifyAuthCallback,
  connectShopifyStore,
  shopifyWebhooks,
  createVerificationSession,
  verificationCallback
} from '../controllers/shopify.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// OAuth initiation
router.get('/auth', shopifyAuth);

// OAuth callback
router.get('/callback', shopifyAuthCallback);

// Connect Store to Business
router.post('/connect', authenticate, connectShopifyStore);

// Webhooks
router.post('/webhooks', shopifyWebhooks);

// VC Verification endpoints for Shopify Checkout App blocks
router.post('/verify/session', createVerificationSession);
router.post('/verify/callback', verificationCallback);

export default router;
