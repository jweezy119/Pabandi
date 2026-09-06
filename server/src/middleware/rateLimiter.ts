import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// LP API key auth: strict rate limit (5 attempts per 15 min per IP) to prevent
// brute-force on the OFFRAMP__LP_API_KEY. Applied in the route, not globally.
export const lpAuthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 LP auth attempts per IP per 15 min
  message: 'Too many LP authentication attempts. Try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// AI endpoints: strict rate limit to prevent abuse and control costs.
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 AI requests per IP per minute
  message: 'Too many AI requests. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
});
