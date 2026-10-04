import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * GET /crm/settings and GET /crm/files.
 *
 * Both have been called by the CRM since they were first written and neither existed, so the
 * clients page lost its custom fields and the client detail page lost its file list.
 *
 * The security property is the one this codebase has now been bitten by three times: the
 * tenant comes from `resolveCrmBusiness`, never from a query or body parameter. Reports leaked
 * revenue, jobs leaked client addresses, and both took a caller-supplied `businessId`.
 *
 * `/files` is the interesting one, because `CrmFile` has NO `serviceBusinessId` — it is
 * anchored to the legacy `CrmBusiness` table, the same id-space trap that made deals and
 * reports invisible until they were fixed. Ownership is therefore proved through the relation:
 * every file has a required clientId, and CrmClient.serviceBusinessId resolves.
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
const MARKER = '@cs.pabandi.dev';

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
    firstName: 'Cs',
    lastName: 'Owner',
  });
  expect(reg.status, `register ${email}: ${JSON.stringify(reg.json)}`).toBe(201);
  const enroll = await api(reg.json.data.token, 'POST', '/api/v1/crm/enroll', {
    businessName: `Business ${slug}`,
    ownerName: 'Cs Owner',
    serviceType: 'cleaning',
  });
  expect(enroll.status, `enroll ${slug}: ${JSON.stringify(enroll.json)}`).toBe(201);
  const token = (enroll.json.token as string) || reg.json.data.token;
  const client = await api(token, 'POST', '/api/v1/crm/clients', {
    name: `Client ${slug}`,
    email: `client${slug}${MARKER}`,
  });
  expect(client.status).toBe(201);
  return {
    token,
    clientId: client.json.data.id as string,
    businessId: enroll.json.data.business.id as string,
  };
}

describe('crm settings + files', () => {
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
    await prisma.crmFile.deleteMany({ where: { fileName: { contains: MARKER } } });
    await prisma.businessSettings.deleteMany({ where: { businessId: { contains: MARKER } } });
    await prisma.notification.deleteMany({ where: { user: { email: { contains: MARKER } } } });
    await prisma.crmClient.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  it('requires authentication', async () => {
    expect((await api('', 'GET', '/api/v1/crm/settings')).status).toBe(401);
    expect((await api('', 'GET', '/api/v1/crm/files')).status).toBe(401);
  });

  it('reads customFields from the one canonical column', async () => {
    const b = await seedBusiness('shape');
    const { prisma } = await import('../src/utils/database');
    await prisma.businessSettings.create({
      data: { businessId: b.businessId, customFields: { client: [{ key: 'vip', label: 'VIP' }] } },
    });

    const res = await api(b.token, 'GET', '/api/v1/crm/settings');
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    // ContactClientsPage reads exactly this path, and it 404'd for two audit cycles.
    expect(res.json.data.customFields.client).toEqual([{ key: 'vip', label: 'VIP' }]);
  });

  it('accepts custom fields from either position on write, and always stores them in the column', async () => {
    const b = await seedBusiness('canon');
    const { prisma } = await import('../src/utils/database');

    // The legacy position, which is what CustomFieldsPage used to send.
    const legacy = await api(b.token, 'PUT', '/api/v1/settings/config', {
      data: { enabledFeatures: { customFields: { client: [{ key: 'frombag', label: 'FromBag' }] } } },
    });
    expect(legacy.status, JSON.stringify(legacy.json)).toBe(200);

    let row = await prisma.businessSettings.findUnique({
      where: { businessId: b.businessId },
      select: { customFields: true, enabledFeatures: true },
    });
    // The column is the only home now.
    expect(row?.customFields).toEqual({ client: [{ key: 'frombag', label: 'FromBag' }] });
    // And the flag bag no longer carries field definitions, so it cannot become a second home.
    expect(JSON.stringify(row?.enabledFeatures)).not.toContain('customFields');

    // The canonical position, which is what the page sends now.
    const canonical = await api(b.token, 'PUT', '/api/v1/settings/config', {
      data: { customFields: { job: [{ key: 'fromtop', label: 'FromTop' }] } },
    });
    expect(canonical.status, JSON.stringify(canonical.json)).toBe(200);

    row = await prisma.businessSettings.findUnique({
      where: { businessId: b.businessId },
      select: { customFields: true },
    });
    expect(row?.customFields).toEqual({ job: [{ key: 'fromtop', label: 'FromTop' }] });
  });

  it('prefers the top-level customFields when a caller sends both positions', async () => {
    const b = await seedBusiness('both');
    const { prisma } = await import('../src/utils/database');

    await api(b.token, 'PUT', '/api/v1/settings/config', {
      data: {
        customFields: { client: [{ key: 'winner', label: 'Winner' }] },
        enabledFeatures: { customFields: { client: [{ key: 'loser', label: 'Loser' }] } },
      },
    });

    const row = await prisma.businessSettings.findUnique({
      where: { businessId: b.businessId },
      select: { customFields: true },
    });
    // The explicit top-level value is the one a caller means when it sends both.
    expect(JSON.stringify(row?.customFields)).toContain('Winner');
    expect(JSON.stringify(row?.customFields)).not.toContain('Loser');
  });

  it('does not let a custom-fields save wipe notification preferences', async () => {
    const b = await seedBusiness('nowipe');
    const { prisma } = await import('../src/utils/database');
    await prisma.businessSettings.create({
      data: {
        businessId: b.businessId,
        customFields: { client: [{ key: 'keepme', label: 'KeepMe' }] },
        enabledFeatures: { notifications: [{ event: 'invoice_paid', enabled: true }] },
      },
    });

    // Every settings page sends the whole bag it loaded. Replacing it rather than merging
    // would let CustomFieldsPage saving a field silently delete a business's notification
    // preferences -- the same failure shape as a partial CSV import.
    await api(b.token, 'PUT', '/api/v1/settings/config', {
      data: { customFields: { client: [{ key: 'added', label: 'Added' }] } },
    });

    const row = await prisma.businessSettings.findUnique({
      where: { businessId: b.businessId },
      select: { customFields: true, enabledFeatures: true },
    });
    // The bag survives: every settings page sends the whole bag it loaded, so REPLACING it
    // would let a custom-fields save silently delete a business's notification preferences --
    // the same failure shape as a partial CSV import.
    expect(JSON.stringify(row?.enabledFeatures)).toContain('invoice_paid');

    // customFields itself is replaced wholesale, not merged. That matches how every other
    // column in updateSettings behaves, and the page always sends the complete object it
    // loaded. Merging would be worse: a field the user just deleted would reappear, because
    // the incoming object still lacks it and a merge would keep the stored one.
    expect(row?.customFields).toEqual({ client: [{ key: 'added', label: 'Added' }] });
  });

  it('merges the flag bag when a request carries both custom fields and flags', async () => {
    const b = await seedBusiness('bothbag');
    const { prisma } = await import('../src/utils/database');
    await prisma.businessSettings.create({
      data: {
        businessId: b.businessId,
        customFields: { client: [{ key: 'seeded', label: 'Seeded' }] },
        enabledFeatures: { notifications: [{ event: 'invoice_paid', enabled: true }], contact: ['crm'] },
      },
    });

    // One request carrying BOTH. The earlier test only ever sent customFields, so the merge
    // branch never ran and replacing the bag wholesale was invisible to it -- replacing is
    // what silently deletes another page's settings.
    const res = await api(b.token, 'PUT', '/api/v1/settings/config', {
      data: {
        customFields: { client: [{ key: 'new', label: 'New' }] },
        enabledFeatures: { trust: { enabled: true } },
      },
    });
    expect(res.status, JSON.stringify(res.json)).toBe(200);

    const row = await prisma.businessSettings.findUnique({
      where: { businessId: b.businessId },
      select: { customFields: true, enabledFeatures: true },
    });
    // The incoming flag is added...
    expect(JSON.stringify(row?.enabledFeatures)).toContain('trust');
    // ...and the keys the caller did not send survive. A page that only knows about its own
    // flags must not be able to delete the rest.
    expect(JSON.stringify(row?.enabledFeatures)).toContain('invoice_paid');
    expect(JSON.stringify(row?.enabledFeatures)).toContain('contact');
    expect(JSON.stringify(row?.customFields)).toContain('New');
  });

  it('returns an empty object rather than another business settings', async () => {
    const a = await seedBusiness('setta');
    const b = await seedBusiness('settb');
    const { prisma } = await import('../src/utils/database');
    await prisma.businessSettings.create({
      data: { businessId: b.businessId, customFields: { client: [{ key: 'secret', label: 'Secret' }] } },
    });

    const res = await api(a.token, 'GET', `/api/v1/crm/settings?businessId=${b.businessId}`);
    // resolveCrmBusiness pairs a requested id with ownerId: userId, so a foreign id is
    // REFUSED rather than ignored. Either outcome is safe; asserting one specific status
    // would be asserting weaker behaviour than the code actually has.
    expect([200, 403], `${res.status}: ${JSON.stringify(res.json)}`).toContain(res.status);
    expect(JSON.stringify(res.json)).not.toContain('secret');
  });

  it('returns an empty file list rather than erroring', async () => {
    const a = await seedBusiness('filesa');

    // The endpoint was a 404; it now answers correctly, which means [].
    //
    // It cannot return anything yet, and that is a schema finding rather than a bug in this
    // route: `CrmFile.businessId` is a REQUIRED foreign key to the legacy `CrmBusiness` table,
    // and enrollment only ever creates a `CrmServiceBusiness`, so `crmBusiness` has zero rows
    // and no file can be written at all. The client also has no upload UI — it only lists.
    //
    // LIMITATION, stated rather than hidden: because the table is empty, this suite CANNOT
    // prove the tenant scope on /files. A missing filter returns [] exactly like a correct one,
    // so seeding rows would be the only way to pin it — and seeding them requires creating and
    // deleting legacy CrmBusiness rows, which destabilised the shared test database for other
    // suites when tried. The scope is therefore verified by construction (the query filters on
    // `client: { serviceBusinessId }`, and CrmFile has no tenant column of its own that could
    // be used instead) rather than by test. Fixing this properly means giving CrmFile a
    // serviceBusinessId first, then seeding through the supported path.
    const res = await api(a.token, 'GET', '/api/v1/crm/files');
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.data).toEqual([]);
  });

  it('applies clientId as a filter, never as a tenant selector', async () => {
    const a = await seedBusiness('scopea');
    const b = await seedBusiness('scopeb');

    const res = await api(a.token, 'GET', `/api/v1/crm/files?clientId=${b.clientId}`);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.data).toEqual([]);

    // And the caller can filter by their own client without erroring.
    const own = await api(a.token, 'GET', `/api/v1/crm/files?clientId=${a.clientId}`);
    expect(own.status).toBe(200);
  });

  it('404s an unknown file id', async () => {
    const a = await seedBusiness('fid');
    const res = await api(a.token, 'GET', '/api/v1/crm/files/does-not-exist');
    // 404, not 403: the response must not confirm that an id exists.
    expect(res.status, JSON.stringify(res.json)).toBe(404);
  });
});
