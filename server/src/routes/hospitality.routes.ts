import { Router } from 'express';
import {
  beds24Webhook,
  cloudbedsWebhook,
  lodgifyWebhook,
  manualWebhook,
  connectProperty,
  listProperties,
  getProperty,
  getConnectionHealth,
  checkAvailability,
  createReceptionistCheckout,
  receptionistAnalytics,
} from '../controllers/hospitality.controller';

const router = Router();

router.post('/beds24/webhook', beds24Webhook);
router.post('/cloudbeds/webhook', cloudbedsWebhook);
router.post('/lodgify/webhook', lodgifyWebhook);
router.post('/manual/webhook', manualWebhook);
router.post('/connect', connectProperty);
router.get('/properties', listProperties);
router.get('/property/:id', getProperty);
router.get('/health', getConnectionHealth);
router.get('/property/:businessId/availability', checkAvailability);
router.post('/receptionist/checkout', createReceptionistCheckout);
router.get('/receptionist/analytics/:businessId', receptionistAnalytics);

export default router;
