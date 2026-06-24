import rateLimit from 'express-rate-limit';

// General API Rate Limiter
// 100 requests per 15 minutes per IP
export const apiLimiter = rateLimit({
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
export const strictApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: {
    success: false,
    error: 'Rate limit exceeded for hash checking.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
