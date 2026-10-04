import { describe, it, expect } from 'vitest';
import { isProviderWebhookPath } from '../src/middleware/rateLimiter';

/**
 * Payment webhooks must not share a rate-limit bucket with human traffic.
 *
 * `app.use('/api/', rateLimiter)` covers every route under /api/, including provider
 * callbacks. Square emits an event per payment state change from shared Square IPs, so a
 * busy merchant's webhook traffic competes with every other request from the same address
 * against a 100-per-15-minute budget. When it runs out Square receives a 429 and, in the
 * meantime, the payment event has not been recorded.
 *
 * Measured on production before the fix: a 105-request burst at
 * `/api/v1/square-checkout/webhook` partially spent the shared bucket, and a following
 * burst at `/api/v1/health` was refused at request 64 rather than 100 — proof the two
 * paths share one counter.
 */

describe('provider callbacks are exempt', () => {
  for (const p of [
    '/api/v1/square-checkout/webhook',
    '/api/v1/openwa/webhook/incoming',
    '/api/v1/rail-webhook/bank',
    '/api/v1/webhook/escrow',
    '/api/v1/webhooks/stripe',
    '/api/v1/paypal-webhook',
    '/api/v1/sms/webhook/twilio/biz_1',
  ]) {
    it(`skips ${p}`, () => {
      expect(isProviderWebhookPath(p)).toBe(true);
    });
  }
});

describe('ordinary API traffic is still limited', () => {
  for (const p of [
    '/api/v1/crm/clients',
    '/api/v1/crm/invoices',
    '/api/v1/settings/sms',
    '/api/v1/auth/login',
    '/api/v1/health',
    // A path that merely CONTAINS the word "webhook" without being a callback must not
    // slip through the exemption.
    '/api/v1/webhook-templates',
    '/api/v1/notifications/webhook-settings',
    // A merchant-facing management route, not an incoming callback.
    '/api/v1/subscriptions/webhooks',
  ]) {
    it(`still limits ${p}`, () => {
      expect(isProviderWebhookPath(p)).toBe(false);
    });
  }
});

describe('OAuth redirects are exempt, deliberately', () => {
  // They are user-initiated, protected by the `state` parameter rather than an IP budget,
  // one request per login, and a 429 there is a confusing broken sign-in the user cannot
  // retry their way out of.
  for (const p of ['/api/v1/auth/google/callback', '/api/v1/oauth/callback']) {
    it(`skips ${p}`, () => {
      expect(isProviderWebhookPath(p)).toBe(true);
    });
  }
});
