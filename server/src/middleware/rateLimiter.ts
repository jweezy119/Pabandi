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

/**
 * Account creation.
 *
 * Registration was previously covered only by the global limiter (100 requests
 * per 15 minutes per IP), which permits ~100 new accounts per window from a
 * single address. A script was found doing precisely that, leaving a trail of
 * `probe-N@example.com` rows in the user table. Ten per quarter-hour is generous
 * for real signups — including shared office and campus IPs — while making bulk
 * account creation impractical.
 */
export const registrationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many accounts created from this network. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skipped under test ONLY.
  //
  // The integration suites register a dozen or more throwaway businesses from one
  // address, which trips this and fails them with a 429 that has nothing to do with
  // what they assert — it cost real debugging time on tests/sms-security.
  //
  // The tempting fix is to raise `max`, and that would be wrong: this limiter exists
  // because a script was found creating accounts in bulk. Raising the ceiling to suit a
  // test suite removes the protection in production, where NODE_ENV is never 'test'.
  //
  // Keyed on NODE_ENV rather than an env var so it cannot be misconfigured into being
  // off in production by a stray variable.
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Email-code login request/verify.
 *
 * Deliberately looser than `authRateLimiter`. These endpoints send a real email
 * or SMS to a real person, and the platform's primary market is Pakistan where
 * large numbers of subscribers share carrier-grade NAT addresses. A five-per-
 * quarter-hour cap would lock out legitimate users behind a shared IP, so this
 * is set to twenty and still stops enumeration.
 */
export const emailCodeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: 'Too many verification attempts. Please try again later.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
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
