import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import twilio from 'twilio';

/**
 * /api/v1/sms used to have no authentication, no tier check, and took `businessId`
 * from the request body:
 *
 *   router.post('/send', ...) -> smsService.sendSMS(to, message, req.body.businessId)
 *
 * So the moment TWILIO_ACCOUNT_SID existed, anyone on the internet could send SMS
 * through Pabandi's account, attribute it to any business id, and we paid the bill.
 * Latent only because no credentials were configured.
 *
 * These tests hold that shut. Real app, real HTTP, real Postgres.
 */

process.env.JWT_SECRET = 'test-jwt-secret';

vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));
vi.mock('../src/services/jobCronService', () => ({
  jobCronService: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock('../src/services/subscriptionReconcileCron.service', () => ({
  subscriptionReconcileCron: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock('../src/services/reminderCron.service', () => ({ startReminderCron: vi.fn() }));
vi.mock('../src/services/email.service', () => {
  const emailService = new Proxy(
    {},
    { get: (_t, p) => (p === 'then' ? undefined : vi.fn(async () => ({ skipped: true }))) },
  );
  return { emailService, default: { emailService } };
});

function assertIsolatedDatabase() {
  let name = '';
  try {
    name = new URL(process.env.DATABASE_URL || '').pathname.replace(/^\//, '');
  } catch {
    /* handled below */
  }
  if (!/test|integration|ci/i.test(name)) {
    throw new Error(`Refusing to run against database "${name || '<unknown>'}"`);
  }
}

let baseUrl: string;
let server: Server;
const MARKER = '@sms.pabandi.dev';

async function api(token: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep null */
  }
  return { status: res.status, json, text };
}

/** A registered, enrolled business, with its subscription tier set explicitly. */
async function seedBusiness(slug: string, tier: 'free' | 'starter' | 'pro' | 'business') {
  const email = `${slug}${MARKER}`;
  const reg = await api(null, 'POST', '/api/v1/auth/register', {
    email,
    password: 'Integration1!',
    firstName: 'Sms',
    lastName: 'Owner',
  });
  expect(reg.status, `register ${slug}: ${reg.text.slice(0, 160)}`).toBe(201);

  const enroll = await api(reg.json.data.token, 'POST', '/api/v1/crm/enroll', {
    businessName: `Business ${slug}`,
    ownerName: 'Sms Owner',
    serviceType: 'general',
  });
  expect(enroll.status, `enroll ${slug}: ${enroll.text.slice(0, 160)}`).toBe(201);

  const token = (enroll.json.token as string) || reg.json.data.token;
  const businessId = enroll.json.data.business.id as string;

  const { prisma } = await import('../src/utils/database');
  if (tier !== 'free') {
    await prisma.merchantSubscription.upsert({
      where: { businessId },
      create: { businessId, tier: tier.toUpperCase(), status: 'active', priceCents: 4900 },
      update: { tier: tier.toUpperCase(), status: 'active' },
    } as never);
  } else {
    await prisma.merchantSubscription.deleteMany({ where: { businessId } });
  }

  return { token, businessId };
}

describe('SMS is authenticated, tenant-scoped, and gated by tier', () => {
  beforeAll(async () => {
    assertIsolatedDatabase();
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

  beforeEach(async () => {
    const { prisma } = await import('../src/utils/database');
    await prisma.merchantSubscription.deleteMany({ where: { business: { owner: { email: { contains: MARKER } } } } } as never);
    await prisma.sMSLog.deleteMany({ where: { business: { owner: { email: { contains: MARKER } } } } } as never);
    // Notifications first. Registering/enrolling a business emits them (e.g.
    // `trust_score_changed`), and Notification.userId has no cascade — so without this
    // the user delete is refused and every later test in the file fails on an error that
    // has nothing to do with what it asserts.
    await prisma.notification.deleteMany({ where: { user: { email: { contains: MARKER } } } });
    await prisma.crmClient.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  it('refuses an unauthenticated send — this was the headline hole', async () => {
    const res = await api(null, 'POST', '/api/v1/sms/send', {
      to: '+15550100',
      message: 'hello',
      businessId: 'anything',
    });
    expect(res.status).toBe(401);
  });

  it('refuses an unauthenticated bulk send and log read', async () => {
    expect((await api(null, 'POST', '/api/v1/sms/bulk', { numbers: ['+15550100'], message: 'x' })).status).toBe(401);
    expect((await api(null, 'GET', '/api/v1/sms/logs')).status).toBe(401);
    expect((await api(null, 'GET', '/api/v1/sms/status/anything')).status).toBe(401);
  });

  it('blocks SMS on the free tier', async () => {
    const { token } = await seedBusiness('free-tier', 'free');
    const res = await api(token, 'POST', '/api/v1/sms/send', { to: '+15550100', message: 'hi' });
    // 402, not 403: authorised, refused because of what it would cost.
    expect(res.status).toBe(402);
    expect(res.json.message).toMatch(/sms reminders is not included/i);
  });

  it('blocks SMS on the $29 starter tier too — it is deliberately above the entry rung', async () => {
    const { token } = await seedBusiness('starter-tier', 'starter');
    const res = await api(token, 'POST', '/api/v1/sms/send', { to: '+15550100', message: 'hi' });
    expect(res.status).toBe(402);
  });

  it('allows SMS on Pro, past the gate', async () => {
    const { token } = await seedBusiness('pro-tier', 'pro');
    const res = await api(token, 'POST', '/api/v1/sms/send', { to: '+15550100', message: 'hi' });
    // No provider is configured in tests, so it cannot succeed — but it must NOT be a
    // 402. Any 402 here would mean the entitlement is not being honoured.
    expect(res.status).not.toBe(402);
    expect(res.status).not.toBe(401);
  });

  it('never trusts a body businessId that disagrees with the caller', async () => {
    const victim = await seedBusiness('victim', 'pro');
    const attacker = await seedBusiness('attacker', 'pro');

    const res = await api(attacker.token, 'POST', '/api/v1/sms/send', {
      to: '+15550100',
      message: 'billing to someone else',
      businessId: victim.businessId,
    });
    // Rejected rather than silently ignored: a caller who thinks they are billing
    // another tenant has a bug worth surfacing.
    expect(res.status).toBe(403);
    expect(res.json.message).toMatch(/does not match the authenticated account/i);
  });

  it('scopes the log read to the caller, with no businessId parameter at all', async () => {
    const a = await seedBusiness('log-a', 'pro');
    const b = await seedBusiness('log-b', 'pro');

    const { prisma } = await import('../src/utils/database');
    await prisma.sMSLog.create({
      data: { businessId: a.businessId, to: '+15550101', message: 'a only', provider: 'TWILIO', status: 'SENT' },
    });

    const own = await api(a.token, 'GET', '/api/v1/sms/logs');
    expect(own.status).toBe(200);
    expect(own.json.data).toHaveLength(1);
    expect(own.json.data[0].message).toBe('a only');

    // And another business sees none of it.
    const other = await api(b.token, 'GET', '/api/v1/sms/logs');
    expect(other.json.data).toEqual([]);
  });

  it('will not report the delivery status of another business’s message', async () => {
    const a = await seedBusiness('status-a', 'pro');
    const b = await seedBusiness('status-b', 'pro');

    const { prisma } = await import('../src/utils/database');
    const log = await prisma.sMSLog.create({
      data: { businessId: a.businessId, to: '+15550102', message: 'private', provider: 'TWILIO', status: 'SENT' },
    });

    const res = await api(b.token, 'GET', `/api/v1/sms/status/${log.id}`);
    expect(res.status).toBe(404);
  });

  it('caps a single bulk request', async () => {
    const { token } = await seedBusiness('bulk', 'pro');
    const numbers = Array.from({ length: 501 }, (_, i) => `+1555${String(1000 + i)}`);
    const res = await api(token, 'POST', '/api/v1/sms/bulk', { numbers, message: 'x' });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/limited to 500/i);
  });

  it('no longer accepts credentials and reports success without storing anything', async () => {
    // It used to reply "Credentials saved" while persisting nothing — a false
    // confirmation on the one route where a false confirmation costs money.
    const { token } = await seedBusiness('creds', 'pro');
    const res = await api(token, 'POST', '/api/v1/sms/credentials', {
      twilioSid: 'ACfake',
      twilioToken: 'secret',
      twilioFrom: '+15550199',
    });
    expect(res.status).toBe(404);
  });
});

describe('the Twilio webhook is verified, and fails closed', () => {
  const AUTH_TOKEN = 'test-auth-token-for-signing';

  beforeAll(async () => {
    assertIsolatedDatabase();
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    const { default: app } = await import('../src/index');
    server = app.listen(0);
    await new Promise<void>((r) => server.once('listening', () => r()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    await new Promise<void>((r) => server.close(() => r()));
    const { prisma } = await import('../src/utils/database');
    await prisma.$disconnect();
  });

  const post = (body: unknown, signature?: string) =>
    fetch(`${baseUrl}/api/v1/sms/webhook/twilio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(signature ? { 'X-Twilio-Signature': signature } : {}),
      },
      body: new URLSearchParams(body as Record<string, string>).toString(),
    });

  it('accepts a correctly signed callback and records the delivery', async () => {
    const { token } = await seedBusiness('hook-ok', 'pro');
    const { prisma } = await import('../src/utils/database');
    const log = await prisma.sMSLog.create({
      data: {
        businessId: (await prisma.business.findFirstOrThrow({ where: { owner: { email: `hook-ok${MARKER}` } } })).id,
        to: '+15550103',
        message: 'deliver me',
        provider: 'TWILIO',
        status: 'SENT',
        externalId: 'SM_signed_ok',
      },
    });
    void token;
    void log;

    const params = { MessageSid: 'SM_signed_ok', MessageStatus: 'delivered' };
    const url = `${baseUrl}/api/v1/sms/webhook/twilio`;
    // Positional args, not an object — the object form silently produces a signature
    // over `undefined` and the test fails on the route rather than in the helper.
    const signature = twilio.getExpectedTwilioSignature(AUTH_TOKEN, url, params);

    const res = await post(params, signature);
    expect(res.status).toBe(200);

    const stored = await prisma.sMSLog.findFirst({ where: { externalId: 'SM_signed_ok' } });
    expect(stored?.status).toBe('DELIVERED');
    expect(stored?.deliveredAt).not.toBeNull();
  });

  it('rejects a forged callback', async () => {
    const res = await post({ MessageSid: 'SM_forged', MessageStatus: 'delivered' }, 'not-a-real-signature');
    expect(res.status).toBe(403);

    // And nothing was written.
    const { prisma } = await import('../src/utils/database');
    const forged = await prisma.sMSLog.findFirst({ where: { externalId: 'SM_forged' } });
    expect(forged).toBeNull();
  });

  it('rejects a callback with no signature at all', async () => {
    const res = await post({ MessageSid: 'SM_unsigned', MessageStatus: 'delivered' });
    expect(res.status).toBe(403);
  });

  it('refuses every callback when no auth token is configured, rather than trusting them', async () => {
    // Failing open here would let anyone write a "delivered" status onto any message id.
    delete process.env.TWILIO_AUTH_TOKEN;
    const res = await post({ MessageSid: 'SM_unsigned2', MessageStatus: 'delivered' }, 'any-signature');
    expect(res.status).toBe(503);
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
  });
});
