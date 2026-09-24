"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.courtListenerLimiter = exports.strictApiLimiter = exports.apiLimiter = void 0;
exports.courtListenerDailyLimiter = courtListenerDailyLimiter;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// General API Rate Limiter
// 100 requests per 15 minutes per IP
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again after 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Strict Limiter for sensitive endpoints like POST /check-hash
// 20 requests per minute per IP
exports.strictApiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: {
        success: false,
        error: 'Rate limit exceeded for hash checking.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// CourtListener screening rate limiter.
// CourtListener API limits:
//   - With API key: 5,000/day, ~10/min burst
//   - Anonymous:     10/min, 5000/day
// We enforce per-IP + per-user ceilings to stay safe.
exports.courtListenerLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 screenings/minute per IP
    message: {
        success: false,
        error: 'CourtListener screening rate limit reached (10/min). Please wait a moment.',
        retryAfter: 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Key by user id if authed, else IP
        const userId = req.user?.id;
        return userId ? `cl-user-${userId}` : `cl-ip-${req.ip}`;
    },
});
// Per-user daily screening cap (100/day) to avoid burning CourtListener quota.
const SCREEN_DAILY_MAX = 100;
const screenDailyHits = new Map();
function courtListenerDailyLimiter(req, res, next) {
    const userId = req.user?.id || req.ip || 'anon';
    const key = `cl-daily-${userId}`;
    const now = Date.now();
    const entry = screenDailyHits.get(key);
    if (!entry || now >= entry.resetAt) {
        screenDailyHits.set(key, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
        return next();
    }
    if (entry.count >= SCREEN_DAILY_MAX) {
        const retrySecs = Math.ceil((entry.resetAt - now) / 1000);
        return res.status(429).json({
            success: false,
            error: `Daily screening cap reached (${SCREEN_DAILY_MAX}/day). Try again in ${Math.ceil(retrySecs / 60)} minutes.`,
            retryAfter: retrySecs,
        });
    }
    entry.count++;
    next();
}
//# sourceMappingURL=rateLimit.middleware.js.map