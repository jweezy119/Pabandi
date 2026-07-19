import { Router } from 'express';
import {
  shopifyAuth,
  shopifyAuthCallback,
  connectShopifyStore,
  shopifyWebhooks,
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

export default router;
