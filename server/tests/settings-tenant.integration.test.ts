import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * /api/v1/settings/* tenant isolation.
 *
 * Four of the six routes on this router had NO AUTHENTICATION and took their tenant straight
 * from the caller:
 *
 *     GET /settings/profile  -> String(req.query.businessId)
 *     PUT /settings/profile  -> String(req.body.businessId)
 *     GET /settings/config   -> String(req.query.businessId)
 *     PUT /settings/config   -> String(req.body.businessId)
 *
 * So anyone on the internet could read any business's profile and configuration and WRITE to
 * both, with no session at all. The two dashboard-layout routes were authenticated but fell
 * back to `req.user.businessId || req.query.businessId`.
 *
 * This is the worst leak found in the CRM audit, and it is here so it cannot come back: the
 * tenant is now server-derived, and every route below is probed both anonymously and with
 * another business's id.
 */

vi.mock('../src/services/email.service', () => {
  const emailService = new Proxy(
    {},
    { get: (_t, prop) => (prop === 'then' ? undefined : vi.fn(async () => ({ skipped: true }))) },
  );
  return { emailService, default: { emailService } };
});

process.env.JWT_SECRET = 'test-jwt-secret';
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));
vi.mock('../src/services/jobCronService', () => ({
  jobCronService: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock('../src/services/subscriptionReconcileCron.service', () => ({
  subscriptionReconcileCron: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock('../src/services/reminderCron.service', () => ({ startReminderCron: vi.fn() }));
process.env.RATE_LIMIT_MAX_REQUESTS = process.env.RATE_LIMIT_MAX_REQUESTS || '100000';

function assertIsolatedDatabase() {
  const url = process.env.DATABASE_URL || '';
  let name = '';
  try {
    name = new URL(url).pathname.replace(/^\//, '');
  } catch {
    /* handled below */
  }
  if (!/test|integration|ci/i.test(name)) {
    throw new Error(
      `Refusing to run integration tests against database "${name || '<unknown>'}"\n` +
        'Point DATABASE_URL at a disposable database whose name contains "test".',
    );
  }
  return name;
}

let baseUrl: string;
let server: Server;
const MARKER = '@set.pabandi.dev';

async function api(token: string, method: string, path: string, body?: unknown) {
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
  return { status: res.status, json };
}

async function seedBusiness(slug: string) {
  const email = `${slug}${MARKER}`;
  const reg = await api('', 'POST', '/api/v1/auth/register', {
    email,
    password: 'Integration1!',
    firstName: 'Set',
    lastName: 'Owner',
  });
  expect(reg.status, `register ${email}: ${JSON.stringify(reg.json)}`).toBe(201);
  const enroll = await api(reg.json.data.token, 'POST', '/api/v1/crm/enroll', {
    businessName: `Business ${slug}`,
    ownerName: 'Set Owner',
    serviceType: 'cleaning',
  });
  expect(enroll.status, `enroll ${slug}: ${JSON.stringify(enroll.json)}`).toBe(201);
  const token = (enroll.json.token as string) || reg.json.data.token;
  return { token, businessId: enroll.json.data.business.id as string };
}

const ROUTES: Array<[string, string]> = [
  ['GET', '/api/v1/settings/profile'],
  ['GET', '/api/v1/settings/config'],
  ['GET', '/api/v1/settings/dashboard-layout'],
  ['PUT', '/api/v1/settings/profile'],
  ['PUT', '/api/v1/settings/config'],
  ['PUT', '/api/v1/settings/dashboard-layout'],
];

describe('settings: authentication and tenant isolation', () => {
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
    const owner = { email: { contains: MARKER } };
    await prisma.businessSettings.deleteMany({ where: { businessId: { contains: MARKER } } });
    await prisma.notification.deleteMany({ where: { user: owner } });
    await prisma.user.deleteMany({ where: owner });
  });

  it('refuses every route without a session', async () => {
    for (const [method, path] of ROUTES) {
      const res = await api('', method, path, method === 'GET' ? undefined : { businessId: 'x' });
      // Four of these six used to answer 200 to an anonymous caller.
      expect(res.status, `${method} ${path} must require auth, got ${res.status}`).toBe(401);
    }
  });

  it('ignores a caller-supplied businessId on every read', async () => {
    const victim = await seedBusiness('victim');
    const attacker = await seedBusiness('attacker');
    const { prisma } = await import('../src/utils/database');

    await prisma.businessSettings.create({
      data: {
        businessId: victim.businessId,
        customFields: { client: [{ key: 'vip', label: 'VictimSecret' }] },
      },
    });

    for (const path of ['/api/v1/settings/config', '/api/v1/settings/dashboard-layout']) {
      const res = await api(
        attacker.token,
        'GET',
        `${path}?businessId=${encodeURIComponent(victim.businessId)}`,
      );
      expect([200, 403], `${path}: ${res.status} ${JSON.stringify(res.json)}`).toContain(res.status);
      expect(JSON.stringify(res.json), `${path} leaked the victim tenant`).not.toContain('VictimSecret');
    }
  });

  it('cannot write to another tenant settings', async () => {
    const victim = await seedBusiness('wvictim');
    const attacker = await seedBusiness('wattacker');
    const { prisma } = await import('../src/utils/database');

    await prisma.businessSettings.create({
      data: {
        businessId: victim.businessId,
        customFields: { client: [{ key: 'keep', label: 'MustSurvive' }] },
      },
    });

    const res = await api(attacker.token, 'PUT', '/api/v1/settings/config', {
      businessId: victim.businessId,
      data: { customFields: { client: [{ key: 'pwn', label: 'Overwritten' }] } },
    });
    expect([200, 403], `${res.status}: ${JSON.stringify(res.json)}`).toContain(res.status);

    // The decisive assertion: the victim's row is untouched. A 200 that still wrote the row
    // would pass the status check above.
    const after = await prisma.businessSettings.findUnique({
      where: { businessId: victim.businessId },
      select: { customFields: true },
    });
    expect(JSON.stringify(after?.customFields)).toContain('MustSurvive');
    expect(JSON.stringify(after?.customFields)).not.toContain('Overwritten');
  });

  it('serves the caller their own settings', async () => {
    const own = await seedBusiness('own');
    const { prisma } = await import('../src/utils/database');
    await prisma.businessSettings.create({
      data: { businessId: own.businessId, customFields: { client: [{ key: 'mine', label: 'Mine' }] } },
    });

    const res = await api(own.token, 'GET', '/api/v1/settings/config');
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    // Not a blanket refusal: fixing the leak must not break the legitimate case.
    expect(JSON.stringify(res.json)).toContain('Mine');
  });
});
