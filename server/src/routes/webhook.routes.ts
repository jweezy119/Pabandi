import express from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validateRequest';
import {
  createWebhook,
  getWebhooks,
  updateWebhook,
  deleteWebhook,
  regenerateSecret,
} from '../controllers/webhook.controller';

const router = express.Router();

// All webhook routes require authentication and business owner role
router.use(authenticate);
router.use(authorize('BUSINESS_OWNER'));

// Get all webhooks
router.get('/', getWebhooks);

// Create a new webhook
router.post(
  '/',
  [
    body('targetUrl').isURL().withMessage('Must be a valid URL'),
    body('subscribedEvents').optional().isArray(),
  ],
  validateRequest,
  createWebhook
);

// Update a webhook
router.put(
  '/:id',
  [
    body('targetUrl').optional().isURL().withMessage('Must be a valid URL'),
    body('subscribedEvents').optional().isArray(),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  updateWebhook
);

// Delete a webhook
router.delete('/:id', deleteWebhook);

// Regenerate secret
router.post('/:id/regenerate-secret', regenerateSecret);

export default router;
