import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyHmacSha256, verifyHmacSha1 } from '../src/utils/webhookVerifier';

const src = (rel: string) => readFileSync(resolve(__dirname, '../src', rel), 'utf8');

describe('webhook signature primitives', () => {
  it('rejects malformed and wrong-length signatures without throwing', () => {
    expect(() => verifyHmacSha256('body', 'secret', 'zz')).not.toThrow();
    expect(verifyHmacSha256('body', 'secret', 'zz')).toBe(false);
    expect(verifyHmacSha256('body', 'secret', '00')).toBe(false);
    expect(verifyHmacSha1('body', 'secret', 'aabbcc')).toBe(false);
  });

  it('still accepts a correct signature', () => {
    // HMAC-SHA256('secret', 'body') — generated once, pinned here as a known-good vector.
    const expected = 'dc46983557fea127b43af721467eb9b3fde2338fe3e14f51952aa8478c13d355';
    expect(verifyHmacSha256('body', 'secret', expected)).toBe(true);
  });
});

describe('payment webhooks fail closed', () => {
  const routes = src('routes/payment.routes.ts');

  it('verifies BTCPay and PayLio signatures at the route boundary', () => {
    expect(routes).toMatch(/webhook\/btcpay['"],\s*webhookVerifierMiddleware\('btcpay'\)/);
    expect(routes).toMatch(/webhook\/paylio['"],\s*webhookVerifierMiddleware\('paylio'\)/);
  });

  it('does not auto-settle anything from public OCR', () => {
    const raast = src('routes/raastPayment.routes.ts');
    const publicHandler = raast.slice(raast.indexOf("'/verify-public'"), raast.indexOf('GET /api/v1/payments/raast/pending'));
    expect(publicHandler).not.toMatch(/status:\s*'PAID'/);
    expect(publicHandler).not.toMatch(/advanceBookingEscrow/);
    expect(publicHandler).toMatch(/requiresBusinessConfirmation:\s*true/);
    expect(publicHandler).toMatch(/uploadSecurity/);
  });

  it('requires a signature for the off-ramp settlement webhook', () => {
    expect(src('routes/offramp-webhook.routes.ts')).toMatch(/router\.post\('\/emi',\s*verifyOfframpWebhook/);
  });
});

describe('agent money routes require a scoped API key', () => {
  const routes = src('routes/agent.routes.ts');

  it('never falls back to a plain JWT on money-moving endpoints', () => {
    const moneyRoutes = [
      "post('/bookings'",
      "get('/bookings/:id'",
      "post('/bookings/:id/checkin'",
      "post('/bookings/:id/release'",
      "post('/bookings/:id/refund'",
      "post('/payouts'",
      "get('/payouts/history'",
    ];
    for (const route of moneyRoutes) {
      const line = routes.split('\n').find((l) => l.includes(`router.${route}`));
      expect(line, `${route} must require an agent key`).toBeDefined();
      expect(line).toMatch(/requireAgentKey/);
    }
  });

  it('does not allow wildcard keys or unlimited money keys', () => {
    const keys = src('services/agentKeys.service.ts');
    expect(keys).toMatch(/scopes\.includes\('\*'\).*owner\.role.*ADMIN/s);
    expect(keys).toMatch(/Number\.isFinite\(Number\(spendLimitUsd\)\)/);
  });
});

describe('production session configuration', () => {
  it('accepts the JWT_SECRET fallback instead of hard-failing on two extra vars', () => {
    const app = src('app.ts');
    expect(app).toMatch(/no session secret available/);
    expect(app).not.toMatch(/SESSION_SECRET and COOKIE_SESSION_SECRET must be set/);
  });
});

describe('payment detail endpoints are owner-checked', () => {
  const routes = src('routes/payment.routes.ts');

  it('uses authenticate rather than optionalAuthenticate on detail/status/verify', () => {
    for (const route of ["get('/:id/status'", "post('/:id/verify'", "get('/:id'", "get('/paylio/:id/status'"]) {
      const line = routes.split('\n').find((l) => l.includes(`router.${route}`));
      expect(line, `${route} must require authentication`).toBeDefined();
      expect(line).toMatch(/authenticate/);
      expect(line).not.toMatch(/optionalAuthenticate/);
    }
  });

  it('checks ownership in the controller', () => {
    expect(src('controllers/payment.controller.ts')).toMatch(/function canAccessPayment/);
  });
});

describe('AI inputs are quarantined and rate limited', () => {
  const routes = src('routes/ai.routes.ts');

  it('mounts the AI rate limiter on generating endpoints', () => {
    for (const route of ['/nlp/classify', '/nlp/generate', '/test', '/concierge', '/test-vision']) {
      const line = routes.split('\n').find((l) => l.includes(`router.post('${route}'`));
      expect(line, `${route} must be rate limited`).toMatch(/aiRateLimiter/);
    }
  });

  it('sanitizes untrusted text and redacts model output', () => {
    expect(routes).toMatch(/sanitizeUntrusted/);
    expect(routes).toMatch(/guardOutput/);
  });

  it('validates the requested provider', () => {
    expect(routes).toMatch(/AI_PROVIDERS\.has\(requestedProvider\)/);
  });
});
