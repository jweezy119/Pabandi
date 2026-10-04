import rateLimit from 'express-rate-limit';

/**
 * Paths that must NEVER be rate limited.
 *
 * Provider callbacks — payment rails, WhatsApp, bank rails — arrive from the provider's
 * own infrastructure, not from a user. They are authenticated by a signature check, not by
 * an IP budget, and they are counted against the SAME per-IP bucket as every human request
 * because `app.use('/api/', rateLimiter)` covers all of `/api/`.
 *
 * That is a money defect. Square emits an event per payment state change, from shared
 * Square IPs, so a busy merchant's webhook traffic competes with every other request from
 * the same address and can exhaust a 100-per-15-minute budget. When that happens Square
 * gets a 429, retries later, and in the meantime we have not recorded the payment event.
 *
 * Measured on production before this change: a 105-request burst at
 * `/api/v1/square-checkout/webhook` left the shared bucket partly spent, and a following
 * burst at `/api/v1/health` was refused at request 64 rather than 100 — the two paths
 * demonstrably share one counter.
 *
 * Skipping them is safe: they are not a DoS surface, because an unauthenticated flood of
 * webhook POSTs cannot do anything — the handler rejects it on the signature. They are also
 * not a place where a 429 is a useful answer: the provider cannot fix it and will not
 * stop retrying.
 *
 * `/callback` is matched too, which pulls in OAuth redirects
 * (`/auth/google/callback`, `/oauth/callback`). That is deliberate rather than incidental:
 * they are user-initiated, they are protected by the OAuth `state` parameter rather than by
 * an IP budget, the volume is one request per login, and a 429 there produces a confusing
 * broken sign-in with no way for the user to retry successfully. If a callback is ever added
 * that is genuinely provider-to-provider, it is still correct to skip it for the same
 * reasons as any other webhook.
 */
// Anchored on SEGMENT boundaries, not on substrings.
//
// The first version used `\/webhook-` as a clause, which also matched
// `/api/v1/webhook-templates` and `/api/v1/notifications/webhook-settings` — routes that
// are not provider callbacks and would silently have lost their rate limiting. Caught by
// the test that asserts ordinary API traffic is still limited.
//
// Matches: `/webhook`, `/webhooks/…`, `/webhook/…`, anything ending in `-webhook`,
// `-webhook/…` (e.g. `/rail-webhook/bank`, `/paypal-webhook`), and `/callback/…`.
const WEBHOOK_PATH = /\/webhook(\/|$)|\/webhooks\/|-webhook(\/|$)|\/callback(\/|$)/i;

// `/webhooks` in the PLURAL requires a subpath, so a merchant-facing management route
// like `/api/v1/subscriptions/webhooks` keeps its rate limit. Only the singular
// `/webhook` may stand alone, because that is the shape providers actually post to
// (`/square-checkout/webhook`).

export function isProviderWebhookPath(path: string): boolean {
  return WEBHOOK_PATH.test(path);
}

export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isProviderWebhookPath(req.originalUrl || req.url || ''),
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
