import { Router } from 'express';
import {
  beds24Webhook,
  cloudbedsWebhook,
  connectProperty,
  listProperties,
  getProperty,
  simulateBooking,
} from '../controllers/hospitality.controller';

const router = Router();

// ─── PMS Webhook Receivers ────────────────────────────────────────────────────
// These endpoints are called directly by PMS platforms — no auth middleware

/**
 * POST /api/hospitality/beds24/webhook
 * Beds24 v2 booking event receiver.
 * Token auth via X-Beds24-Auth header.
 */
router.post('/beds24/webhook', beds24Webhook);

/**
 * POST /api/hospitality/cloudbeds/webhook
 * Cloudbeds signed booking event receiver.
 * Auth via X-Cloudbeds-Webhook-Signature (HMAC-SHA256).
 */
router.post('/cloudbeds/webhook', cloudbedsWebhook);

// ─── Property Management (authenticated) ─────────────────────────────────────

/**
 * POST /api/hospitality/connect
 * Connect a hotel/lodge PMS to Pabandi.
 */
router.post('/connect', connectProperty);

/**
 * GET /api/hospitality/properties
 * List all connected properties for the authenticated business.
 */
router.get('/properties', listProperties);

/**
 * GET /api/hospitality/property/:id
 * Get a single connected property.
 */
router.get('/property/:id', getProperty);

/**
 * POST /api/hospitality/test-booking
 * Simulate a test booking event — for onboarding and demos.
 */
router.post('/test-booking', simulateBooking);

export default router;
