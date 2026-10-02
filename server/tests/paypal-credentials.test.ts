import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * PayPal credential resolution and webhook verification.
 *
 * Three defects are locked down here:
 *
 * 1. One variable pair served two unrelated jobs. PayPal *login* and the
 *    payments service both read PAYPAL_CLIENT_ID/SECRET, so rotating that pair
 *    for checkout silently broke sign-in at the next container restart. They
 *    are separate now, and login does not read the payment pair.
 *
 * 2. The reconciliation webhook verified PayPal deliveries with an HMAC of the
 *    raw body keyed by PAYPAL_WEBHOOK_SECRET. That is Square's scheme. PayPal
 *    signs with a certificate and has no such shared secret, so the check could
 *    never pass and PayPal payments were collected but never reconciled.
 *
 * 3. verifyWebhook returned `NODE_ENV !== 'production'` when credentials were
 *    missing — accepting every unverified delivery in staging and dev.
 */

const ORIGINAL_ENV = { ...process.env };

async function loadModules() {
  vi.resetModules();
  return {
    creds: await import('../src/config/paypal-credentials'),
    service: await import('../src/services/paypal.service'),
  };
}

describe('PayPal credential resolution', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    delete process.env.PAYPAL_LOGIN_CLIENT_ID;
    delete process.env.PAYPAL_LOGIN_CLIENT_SECRET;
    delete process.env.PAYPAL_MERCHANT_CLIENT_ID;
    delete process.env.PAYPAL_MERCHANT_CLIENT_SECRET;
    delete process.env.PAYPAL_PLATFORM_CLIENT_ID;
    delete process.env.PAYPAL_PLATFORM_CLIENT_SECRET;
    delete process.env.PAYPAL_PAYMENT_ACCOUNT;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('keeps PayPal login off the payment credentials', async () => {
    process.env.PAYPAL_MERCHANT_CLIENT_ID = 'merchant-id';
    process.env.PAYPAL_MERCHANT_CLIENT_SECRET = 'merchant-secret';
    const { creds } = await loadModules();

    // Login must not silently adopt the pair that checkout is using, because
    // that is precisely the collision this split exists to remove.
    expect(creds.loginCredentials()).toBeNull();
    expect(creds.paymentCredentials()).toMatchObject({
      account: 'merchant',
      clientId: 'merchant-id',
    });
  });

  it('reads login from its own variables', async () => {
    process.env.PAYPAL_LOGIN_CLIENT_ID = 'login-id';
    process.env.PAYPAL_LOGIN_CLIENT_SECRET = 'login-secret';
    process.env.PAYPAL_MERCHANT_CLIENT_ID = 'merchant-id';
    process.env.PAYPAL_MERCHANT_CLIENT_SECRET = 'merchant-secret';
    const { creds } = await loadModules();

    expect(creds.loginCredentials()).toEqual({ clientId: 'login-id', clientSecret: 'login-secret' });
  });

  it('treats a half-configured pair as absent', async () => {
    // An empty secret produces an opaque 401 from PayPal that reads like a
    // permissions problem, so this must be caught locally instead.
    process.env.PAYPAL_MERCHANT_CLIENT_ID = 'merchant-id';
    process.env.PAYPAL_MERCHANT_CLIENT_SECRET = '';
    const { creds } = await loadModules();

    expect(creds.paymentCredentials()).toBeNull();
  });

  it('defaults to merchant when both pairs are present', async () => {
    process.env.PAYPAL_MERCHANT_CLIENT_ID = 'm-id';
    process.env.PAYPAL_MERCHANT_CLIENT_SECRET = 'm-secret';
    process.env.PAYPAL_PLATFORM_CLIENT_ID = 'p-id';
    process.env.PAYPAL_PLATFORM_CLIENT_SECRET = 'p-secret';
    const { creds } = await loadModules();

    // Merchant means Pabandi is seller of record, i.e. it holds the funds. That
    // is the worse liability profile, so opting into platform must be explicit.
    expect(creds.preferredPaymentAccount()).toBe('merchant');
  });

  it('honours PAYPAL_PAYMENT_ACCOUNT=platform explicitly', async () => {
    process.env.PAYPAL_MERCHANT_CLIENT_ID = 'm-id';
    process.env.PAYPAL_MERCHANT_CLIENT_SECRET = 'm-secret';
    process.env.PAYPAL_PLATFORM_CLIENT_ID = 'p-id';
    process.env.PAYPAL_PLATFORM_CLIENT_SECRET = 'p-secret';
    process.env.PAYPAL_PAYMENT_ACCOUNT = 'platform';
    const { creds } = await loadModules();

    expect(creds.paymentCredentials()).toMatchObject({
      account: 'platform',
      clientId: 'p-id',
    });
  });

  it('falls back to the legacy pair for login, and says so', async () => {
    process.env.PAYPAL_CLIENT_ID = 'legacy-id';
    process.env.PAYPAL_CLIENT_SECRET = 'legacy-secret';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { creds } = await loadModules();

    expect(creds.loginCredentials()).toEqual({ clientId: 'legacy-id', clientSecret: 'legacy-secret' });
    // The fallback must be loud: while it exists, the ambiguity it was meant to
    // remove is still live.
    expect(warn.mock.calls.flat().join(' ')).toMatch(/legacy/i);
    warn.mockRestore();
  });
});

describe('PayPal webhook verification fails closed', () => {
  const goodHeaders = {
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.paypal.com/v1/notifications/cert/CERT-abc',
    'paypal-transmission-id': 'trans-1',
    'paypal-transmission-sig': 'sig-1',
    'paypal-transmission-time': '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.PAYPAL_MERCHANT_CLIENT_ID = 'm-id';
    process.env.PAYPAL_MERCHANT_CLIENT_SECRET = 'm-secret';
    process.env.PAYPAL_WEBHOOK_ID = 'WH-123';
    vi.resetModules();
    // Two calls are made per verification: an OAuth token, then the signature
    // check. They need different responses.
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/v1/oauth2/token')) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'tok-1' }) } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ verification_status: 'SUCCESS' }),
      } as any;
    });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('rejects when no webhook id is configured', async () => {
    delete process.env.PAYPAL_WEBHOOK_ID;
    const { service } = await loadModules();

    // No PAYPAL_WEBHOOK_SECRET can substitute for this — PayPal's verification
    // endpoint requires the dashboard's webhook id.
    expect(await service.paypalService.verifyWebhook(goodHeaders, '{"event_type":"PAYMENT.CAPTURE.COMPLETED"}')).toBe(false);
  });

  it('rejects when no credentials are configured, in non-production too', async () => {
    delete process.env.PAYPAL_MERCHANT_CLIENT_ID;
    delete process.env.PAYPAL_MERCHANT_CLIENT_SECRET;
    process.env.NODE_ENV = 'development';
    const { service } = await loadModules();

    // The old guard was `return NODE_ENV !== 'production'`, which accepted
    // every unverified delivery anywhere but production.
    expect(await service.paypalService.verifyWebhook(goodHeaders, '{}')).toBe(false);
  });

  it('rejects a missing transmission header', async () => {
    const { service } = await loadModules();
    const { 'paypal-transmission-sig': _drop, ...incomplete } = goodHeaders;

    expect(await service.paypalService.verifyWebhook(incomplete, '{}')).toBe(false);
  });

  it('rejects a cert_url that is not a PayPal host', async () => {
    // Otherwise a forged header could aim verification at an attacker-signed
    // certificate.
    const { service } = await loadModules();
    const headers = { ...goodHeaders, 'paypal-cert-url': 'https://evil.example.com/cert.pem' };

    expect(await service.paypalService.verifyWebhook(headers, '{}')).toBe(false);
  });

  it('rejects a body that is not valid JSON', async () => {
    const { service } = await loadModules();
    expect(await service.paypalService.verifyWebhook(goodHeaders, 'not-json')).toBe(false);
  });

  it('accepts only when PayPal reports SUCCESS', async () => {
    const { service } = await loadModules();

    expect(await service.paypalService.verifyWebhook(goodHeaders, '{"a":1}')).toBe(true);

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ verification_status: 'FAILURE' }),
    });
    expect(await service.paypalService.verifyWebhook(goodHeaders, '{"a":1}')).toBe(false);
  });

  it('rejects when the verification call itself errors', async () => {
    (global.fetch as any).mockRejectedValue(new Error('network down'));
    const { service } = await loadModules();

    // Must not throw: the route turns a throw into a 5xx and PayPal retries.
    expect(await service.paypalService.verifyWebhook(goodHeaders, '{}')).toBe(false);
  });
});

describe('PayPal refunds do not report success when nothing was refunded', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.PAYPAL_MERCHANT_CLIENT_ID;
    delete process.env.PAYPAL_MERCHANT_CLIENT_SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns false when credentials are absent', async () => {
    const { service } = await loadModules();

    // This used to `return true`, so an unconfigured deployment recorded every
    // deposit as refunded while the customer kept their money.
    expect(await service.paypalService.refundDeposit('capture-1', 1000)).toBe(false);
  });
});