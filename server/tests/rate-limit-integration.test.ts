import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * Proves the limiter ACTUALLY exempts provider callbacks, not merely that a helper
 * function returns the right answer.
 *
 * The first version of this only tested `isProviderWebhookPath`. Its bite check — delete
 * the `skip:` option from the limiter and re-run — passed, because nothing ever connected
 * the predicate to the middleware. A test that cannot fail is worse than no test, because
 * it looks like coverage.
 *
 * So this fires real requests through the real app with the limit set absurdly low, and
 * asserts the asymmetry: a normal route is refused, a webhook route is not.
 */

// Read at module load by rateLimit(), so it must be set before the app is imported —
// hence the dynamic import in beforeAll rather than a static one at the top.
process.env.RATE_LIMIT_MAX_REQUESTS = '2';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

let baseUrl: string;
let server: Server;

beforeAll(async () => {
  const { default: app } = await import('../src/index');
  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  const { prisma } = await import('../src/utils/database');
  await prisma.$disconnect();
});

async function hit(method: string, path: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? '{}' : undefined,
  });
  return res.status;
}

/** Fire `times` requests and report whether any was refused. */
async function anyRefused(times: number, method: string, path: string) {
  const codes: number[] = [];
  for (let i = 0; i < times; i += 1) codes.push(await hit(method, path));
  return { refused: codes.includes(429), codes };
}

describe('the global limiter exempts provider callbacks', () => {
  it('refuses ordinary API traffic once the limit is passed', async () => {
    // Establishes that the limit is actually engaged — without this, the exemption test
    // below would pass on a limiter that was not working at all.
    const { refused, codes } = await anyRefused(5, 'GET', '/api/v1/health');
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
    expect(refused).toBe(true);
  });

  it('never refuses a provider webhook, however many arrive', async () => {
    const { codes } = await anyRefused(6, 'POST', '/api/v1/square-checkout/webhook');
    // Square emits an event per payment state change from shared Square IPs. A 429 here
    // means the payment event was not recorded.
    expect(codes).not.toContain(429);
  });

  it('never refuses the WhatsApp callback either', async () => {
    const { codes } = await anyRefused(6, 'POST', '/api/v1/openwa/webhook/incoming');
    expect(codes).not.toContain(429);
  });

  it('still refuses a webhook-SHAPED path that is really a management route', async () => {
    // `subscriptions/webhooks` is where a merchant manages their subscriptions. Skipping
    // the limit there would leave a real write surface unmetered.
    const { codes } = await anyRefused(5, 'GET', '/api/v1/subscriptions/webhooks');
    expect(codes).toContain(429);
  });
});
