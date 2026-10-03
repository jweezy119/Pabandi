import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/utils/database', () => ({
  prisma: {
    merchantSubscription: { findUnique: vi.fn(async () => null), update: vi.fn(), create: vi.fn(), count: vi.fn(async () => 0), aggregate: vi.fn(async () => ({ _sum: { priceCents: 0 } })) },
  },
}));
vi.mock('../src/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/services/whop.service', () => ({
  verifyWebhookDelivery: vi.fn(async () => true),
  createSubscriptionCheckout: vi.fn(async () => ({ ok: true, purchaseUrl: 'https://whop.test/buy' })),
  whopConfigured: vi.fn(() => true),
  isActiveStatus: vi.fn(() => true),
}));
vi.mock('../src/services/subscription.service', () => ({
  applyMembershipEvent: vi.fn(async () => ({ applied: true })),
  getSubscription: vi.fn(async () => ({ tier: 'free', status: 'inactive', isPaying: false, priceCents: 0, currency: 'USD', currentPeriodEnd: null, cancelAtPeriodEnd: false })),
  subscriberCounts: vi.fn(async () => ({ free: 1 })),
  monthlyRecurringRevenueCents: vi.fn(async () => 0),
}));

import { readFileSync } from 'node:fs';
import router from '../src/routes/subscription.routes';
import { verifyWebhookDelivery } from '../src/services/whop.service';

const SRC = readFileSync(new URL('../src/routes/subscription.routes.ts', import.meta.url), 'utf8');

function layer(path: string, method = 'post') {
  return (router as any).stack.find(
    (l: any) => l.route?.path === path && Object.keys(l.route.methods).includes(method),
  );
}

beforeEach(() => vi.clearAllMocks());

describe('the webhook is public and signature-gated', () => {
  it('exists', () => expect(layer('/webhook')).toBeDefined());

  it('is NOT behind authenticate', () => {
    // Whop has no Pabandi token. Auth here means no subscription ever activates.
    const wh = layer('/webhook');
    const handlers = wh.route.stack.map((h: any) => h.handle.name ?? String(h.handle));
    expect(handlers.join(',')).not.toContain('authenticate');
  });

  it('does not authenticate before the webhook — router.use comes after it', () => {
    // Structural, and the reason the behavioural check above can pass at all.
    const wh = (router as any).stack.find((l: any) => l.route?.path === '/webhook');
    const idx = (router as any).stack.indexOf(wh);
    const authLayers = (router as any).stack
      .slice(0, idx)
      .filter((l: any) => (l.handle?.name ?? '').includes('authenticate'));
    expect(authLayers).toHaveLength(0);
  });

  it('rejects an unsigned delivery with 401', async () => {
    vi.mocked(verifyWebhookDelivery).mockReturnValueOnce(false as never);
    const { status } = await call('post', '/api/v1/subscriptions/webhook', {});
    expect(status).toBe(401);
  });

  it('derives the signed body from the raw capture, never from the parsed object', () => {
    // express.json() re-stringifies. Whop signs the exact bytes it sent, so a
    // re-serialised body never matches and the webhook is permanently dead.
    //
    // Two separate claims, asserted separately:
    //   1. the signed value comes off the captured raw body
    //   2. JSON.stringify(req.body) does not appear in executable code
    //
    // The source is comment-stripped first. An earlier version matched the
    // identifier inside a comment and passed while the code did the wrong thing.
    const code = SRC.split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');

    // (1) The extraction reads req.rawBody and hands THAT to the verifier.
    const captureIdx = code.indexOf('.rawBody');
    expect(captureIdx, 'no req.rawBody capture found in executable code').toBeGreaterThan(-1);

    const window = code.slice(
      Math.max(0, captureIdx - 260),
      code.indexOf('const valid = verifyWebhookDelivery'),
    );
    // The captured value is what reaches verifyWebhookDelivery, either directly or
    // through a local. Both are fine; the fallback to a re-stringified object is not.
    expect(window).toMatch(/rawBody/);
    expect(window).toMatch(/captured|req\.rawBody/);

    // (2) No re-serialisation anywhere in executable code.
    expect(code).not.toMatch(/JSON\.stringify\(req\.body/);
  });
});

describe('public routes are registered ABOVE authenticate', () => {
  // Ordering is the whole point. A pricing page behind a login is a pricing page
  // nobody can read before deciding to log in, and the webhook behind one never
  // activates because Whop has no token.
  it('/pricing and /webhook come before router.use(authenticate)', () => {
    const src = SRC.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
    const auth = src.indexOf('router.use(authenticate)');
    expect(auth).toBeGreaterThan(-1);
    expect(src.indexOf("router.get('/pricing'")).toBeLessThan(auth);
    expect(src.indexOf("router.post('/webhook'")).toBeLessThan(auth);
    // And the authenticated ones come after, or they would be public by accident.
    expect(src.indexOf("router.get('/me'")).toBeGreaterThan(auth);
    expect(src.indexOf("router.post('/checkout'")).toBeGreaterThan(auth);
  });

  it('/pricing is served without a token', async () => {
    const { status, body } = await call('get', '/api/v1/subscriptions/pricing');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(Array.isArray(body?.data?.tiers)).toBe(true);
  });
});

describe('authenticated subscription routes', () => {
  for (const [m, p] of [['get', '/me'], ['post', '/checkout'], ['get', '/stats']] as const) {
    it(`${m.toUpperCase()} ${p} exists`, () => expect(layer(p, m)).toBeDefined());
  }

  it('accepts a businessId in the body only for display, never for authority', () => {
    // businessName is cosmetic. If the code read a business id from the body, a
    // caller could start a checkout against another business.
    const checkout = SRC.slice(SRC.indexOf("router.post('/checkout'"));
    const segment = checkout.slice(0, checkout.indexOf('\n});'));
    expect(segment).toContain('callerBusinessId(req)');
    expect(segment).not.toMatch(/req\.body\.businessId/);
  });

  it('refuses to sell the free tier', () => {
    const checkout = SRC.slice(SRC.indexOf("router.post('/checkout'"));
    expect(checkout).toMatch(/PAID_TIERS\.includes\(tier\)/);
  });

  it('prices the table from the same definitions checkout uses', () => {
    expect(SRC).toMatch(/SUBSCRIPTION_TIERS\[key\]/);
    expect(SRC).toMatch(/SUBSCRIPTION_TIERS\[tier\]\.monthlyPrice/);
  });
});

async function call(method: string, path: string, body: unknown) {
  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).rawBody = JSON.stringify(req.body ?? {});
    next();
  });
  app.use('/api/v1/subscriptions', router);
  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const port = (server.address() as any).port;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-a-real-token' },
    body: method === 'post' ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch {}
  await new Promise<void>((r) => server.close(() => r()));
  return { status: res.status, body: parsed };
}
