import { Router } from 'express';
import { apiKeyAuth, logApiUsage } from '../middleware/apiKey.middleware';
import {
  getReliabilityScore,
  getPartnerTrustBadge,
  reportTransactionOutcome,
  getUsage,
} from '../controllers/external.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

// Stricter rate limiter for external API: 120 req/min per IP
const externalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — slow down' },
});

// Apply API key auth + usage logging to all external routes
router.use(externalRateLimiter);
router.use(apiKeyAuth);
router.use(logApiUsage);

/**
 * POST /external/v1/score
 * Core endpoint: submit booking context, receive Reliability Score + deposit recommendation.
 */
router.post('/score', getReliabilityScore);

/**
 * GET /external/v1/badge/:userId
 * Fetch the public trust badge of a known Pabandi user by their Pabandi ID.
 */
router.get('/badge/:userId', getPartnerTrustBadge);

/**
 * POST /external/v1/trust/report
 * Report a transaction outcome (e.g., COMPLETED, NO_SHOW) to update the Trust Physics Engine.
 */
router.post('/trust/report', reportTransactionOutcome);

/**
 * GET /external/v1/usage
 * Returns the calling client's current quota usage for the billing period.
 */
router.get('/usage', getUsage);

export default router;
