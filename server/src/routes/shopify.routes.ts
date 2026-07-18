import { Router } from 'express';
import {
  shopifyAuth,
  shopifyAuthCallback,
  shopifyWebhooks,
} from '../controllers/shopify.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// OAuth initiation
router.get('/auth', shopifyAuth);

// OAuth callback
router.get('/callback', shopifyAuthCallback);

// Webhooks
router.post('/webhooks', shopifyWebhooks);

export default router;
