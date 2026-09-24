"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const apiKey_middleware_1 = require("../middleware/apiKey.middleware");
const external_controller_1 = require("../controllers/external.controller");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const router = (0, express_1.Router)();
// Stricter rate limiter for external API: 120 req/min per IP
const externalRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests — slow down' },
});
router.use(externalRateLimiter);
// ─── Webhooks (No API Key Required) ──────────────────────────────────────────
/**
 * POST /external/v1/webhooks/channex
 * Receives ARI and Booking updates from Channex (Airbnb, etc.)
 */
router.post('/webhooks/channex', external_controller_1.channexWebhook);
// Apply API key auth + usage logging to all external routes
router.use(apiKey_middleware_1.apiKeyAuth);
router.use(apiKey_middleware_1.logApiUsage);
/**
 * POST /external/v1/score
 * Core endpoint: submit booking context, receive Reliability Score + deposit recommendation.
 */
router.post('/score', external_controller_1.getReliabilityScore);
/**
 * GET /external/v1/badge/:userId
 * Fetch the public trust badge of a known Pabandi user by their Pabandi ID.
 */
router.get('/badge/:userId', external_controller_1.getPartnerTrustBadge);
/**
 * POST /external/v1/trust/report
 * Report a transaction outcome (e.g., COMPLETED, NO_SHOW) to update the Trust Physics Engine.
 */
router.post('/trust/report', external_controller_1.reportTransactionOutcome);
/**
 * GET /external/v1/usage
 * Returns the calling client's current quota usage for the billing period.
 */
router.get('/usage', external_controller_1.getUsage);
exports.default = router;
//# sourceMappingURL=external.routes.js.map