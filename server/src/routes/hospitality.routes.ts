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
  getPropertyAvailability,
  simulateBooking,
} from '../controllers/hospitality.controller';
import { requirePassport } from '../middleware/requirePassport.middleware';

const router = Router();

router.post('/beds24/webhook', beds24Webhook);
router.post('/cloudbeds/webhook', cloudbedsWebhook);
router.post('/lodgify/webhook', lodgifyWebhook);
router.post('/manual/webhook', manualWebhook);
router.post('/connect', connectProperty);
router.get('/properties', listProperties);
router.get('/property/:id', getProperty);
router.get('/health', getConnectionHealth);
router.get('/business/:businessId/availability', checkAvailability);
router.post('/receptionist/checkout', createReceptionistCheckout);
router.get('/receptionist/analytics/:businessId', receptionistAnalytics);

/**
 * GET /api/hospitality/property/:id/availability
 * Return real slots from connected PMS.
 */
router.get('/property/:id/availability', getPropertyAvailability);

/**
 * POST /api/hospitality/test-booking
 * Simulate a test booking event — for onboarding and demos.
 */
router.post('/test-booking', requirePassport('act:book'), simulateBooking);

export default router;
