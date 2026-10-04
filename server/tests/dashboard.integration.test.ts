import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * Business dashboard API.
 *
 * WHY
 * ---
 * `/dashboard` is the primary navigation target for a business owner: the AppShell logo, the
 * breadcrumb root, the command palette and the avatar menu all point at it. Every screen
 * behind it fetched `/api/v1/dashboard/:businessId/*`, and none of those six endpoints
 * existed -- the registration pointed at a module that was never on disk, so each request
 * 500'd, and an earlier pass removed the registration to turn that into a visible 404.
 *
 * These endpoints are written against data that already exists. The security property that
 * matters is the one already learned twice in this codebase: the `:businessId` PATH
 * PARAMETER IS IGNORED and the tenant comes from `resolveCrmBusiness`. Honouring a
 * caller-supplied id is exactly what leaked revenue in reports.routes and client addresses
 * in job.routes, and this is the screen every owner lands on.
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
        'These tests write and delete real rows. Point DATABASE_URL at a disposable ' +
        'database whose name contains "test".',
    );
  }
  return name;
}

let baseUrl: string;
let server: Server;

const MARKER = '@dash.pabandi.dev';

async function api(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
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
    firstName: 'Dash',
    lastName: 'Owner',
  });
  expect(reg.status, `register ${email}: ${JSON.stringify(reg.json)}`).toBe(201);

  const enroll = await api(reg.json.data.token, 'POST', '/api/v1/crm/enroll', {
    businessName: `Business ${slug}`,
    ownerName: 'Dash Owner',
    serviceType: 'cleaning',
  });
  expect(enroll.status, `enroll ${slug}: ${JSON.stringify(enroll.json)}`).toBe(201);
  const token = (enroll.json.token as string) || reg.json.data.token;

  const client = await api(token, 'POST', '/api/v1/crm/clients', {
    name: `Client ${slug}`,
    email: `client${slug}${MARKER}`,
  });
  expect(client.status, `client ${slug}: ${JSON.stringify(client.json)}`).toBe(201);

  const employee = await api(token, 'POST', '/api/v1/crm/employees', {
    name: `Employee ${slug}`,
    role: 'CLEANER',
    email: `employee${slug}${MARKER}`,
  });
  expect(employee.status, `employee ${slug}: ${JSON.stringify(employee.json)}`).toBe(201);

  return {
    token,
    businessId: enroll.json.data.business.id as string,
    clientId: client.json.data.id as string,
    employeeId: employee.json.data.id as string,
  };
}

/** Today in UTC, so the `today` endpoint actually sees it. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

async function createJob(b: { token: string; clientId: string; employeeId: string }, time: string) {
  const res = await api(b.token, 'POST', '/api/v1/crm/jobs', {
    clientId: b.clientId,
    serviceType: 'cleaning',
    scheduledDate: today(),
    scheduledTime: time,
    durationMinutes: 60,
    address: `Addr ${MARKER}`,
    price: 100,
    employeeId: b.employeeId,
  });
  expect(res.status, JSON.stringify(res.json)).toBe(201);
  return res.json.data;
}

describe('dashboard api', () => {
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
    await prisma.crmJob.deleteMany({ where: { address: { contains: MARKER } } });
    await prisma.crmExpense.deleteMany({ where: { description: { contains: MARKER } } });
    await prisma.crmEmployee.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.notification.deleteMany({ where: { user: { email: { contains: MARKER } } } });
    await prisma.crmClient.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  it('registers the router (no "module failed to load")', async () => {
    // The registration previously pointed at a file that did not exist, so every request
    // 500'd with "Route module failed to load" rather than a 404.
    const b = await seedBusiness('registered');
    for (const path of ['today', 'calendar', 'customers', 'employees', 'money']) {
      const res = await api(b.token, 'GET', `/api/v1/dashboard/${b.businessId}/${path}`);
      expect(res.status, `${path}: ${JSON.stringify(res.json)}`).toBe(200);
      expect(JSON.stringify(res.json)).not.toMatch(/failed to load/i);
    }
  });

  it('requires authentication on every endpoint', async () => {
    for (const path of ['today', 'calendar', 'customers', 'employees', 'money']) {
      const res = await api('', 'GET', `/api/v1/dashboard/whatever/${path}`);
      expect(res.status, `${path} must not be anonymous`).toBe(401);
    }
    const post = await api('', 'POST', '/api/v1/dashboard/whatever/expense', {
      category: 'x',
      amount: 1,
    });
    expect(post.status).toBe(401);
  });

  it("ignores the caller's businessId and serves only their own tenant", async () => {
    const victim = await seedBusiness('dvictim');
    const attacker = await seedBusiness('dattacker');
    await createJob(victim, '09:00');

    // The exploit shape used in the reports and jobs leaks: name another tenant.
    for (const path of ['today', 'calendar', 'customers', 'employees', 'money']) {
      const res = await api(
        attacker.token,
        'GET',
        `/api/v1/dashboard/${victim.businessId}/${path}`,
      );
      expect([200, 403], `${path}: ${JSON.stringify(res.json)}`).toContain(res.status);
      const body = JSON.stringify(res.json);
      expect(body, `${path} leaked the victim tenant`).not.toContain(victim.clientId);
      expect(body).not.toContain(`Employee ${'dvictim'}`);
    }

    // And the victim still sees themselves.
    const own = await api(victim.token, 'GET', `/api/v1/dashboard/${victim.businessId}/today`);
    expect(own.status).toBe(200);
    expect(own.json.data.bookings.length).toBe(1);
    expect(own.json.data.bookings[0].customerName).toBe('Client dvictim');
  });

  it('returns today jobs in the shape the dashboard renders', async () => {
    const b = await seedBusiness('today');
    await createJob(b, '09:00');

    const res = await api(b.token, 'GET', `/api/v1/dashboard/${b.businessId}/today`);
    expect(res.status, JSON.stringify(res.json)).toBe(200);

    const booking = res.json.data.bookings[0];
    // The `Booking` type requires these; a missing one renders "undefined" on the card.
    expect(booking.id).toBeTruthy();
    expect(booking.customerName).toBe('Client today');
    expect(typeof booking.customerPhone).toBe('string');
    expect(booking.time).toBe('09:00');
    expect(booking.status).toBe('SCHEDULED');
  });

  it('lists customers and employees for the caller only', async () => {
    const b = await seedBusiness('lists');
    const cust = await api(b.token, 'GET', `/api/v1/dashboard/${b.businessId}/customers`);
    const emp = await api(b.token, 'GET', `/api/v1/dashboard/${b.businessId}/employees`);
    expect(cust.json.data.map((c: any) => c.id)).toContain(b.clientId);
    expect(emp.json.data.map((e: any) => e.id)).toContain(b.employeeId);
  });

  it('records an expense and reflects it in money', async () => {
    const b = await seedBusiness('money');

    const created = await api(b.token, 'POST', `/api/v1/dashboard/${b.businessId}/expense`, {
      category: 'Supplies',
      amount: 42.5,
      description: `Cleaning kit ${MARKER}`,
    });
    expect(created.status, JSON.stringify(created.json)).toBe(201);

    const money = await api(b.token, 'GET', `/api/v1/dashboard/${b.businessId}/money`);
    expect(money.status, JSON.stringify(money.json)).toBe(200);
    expect(money.json.data.totalExpenses).toBeCloseTo(42.5, 2);
    expect(money.json.data.netProfit).toBeCloseTo(-42.5, 2);
    expect(money.json.data.recentExpenses[0].description).toBe(`Cleaning kit ${MARKER}`);
  });

  it('rejects an unusable expense instead of poisoning the totals', async () => {
    const b = await seedBusiness('badexpense');

    // Number('abc') is NaN, and a NaN reaching the SUM in /money silently poisons net profit.
    for (const body of [
      { category: 'Supplies', amount: 'abc' },
      { category: 'Supplies', amount: -10 },
      { category: 'Supplies', amount: 0 },
      { amount: 10 },
    ]) {
      const res = await api(b.token, 'POST', `/api/v1/dashboard/${b.businessId}/expense`, body);
      expect(res.status, `${JSON.stringify(body)}: ${JSON.stringify(res.json)}`).toBe(400);
    }

    const money = await api(b.token, 'GET', `/api/v1/dashboard/${b.businessId}/money`);
    expect(money.json.data.totalExpenses).toBe(0);
  });

  it('marks the PayLio balance unavailable rather than reporting a fabricated 0', async () => {
    const b = await seedBusiness('paylio');
    const money = await api(b.token, 'GET', `/api/v1/dashboard/${b.businessId}/money`);

    // There is no PayLio balance endpoint in the platform, so there is nothing truthful to
    // return. The client renders this with .toFixed(2), so the value must stay a number --
    // but a bare 0 would assert the business holds no money.
    expect(typeof money.json.data.paylioBalance).toBe('number');
    expect(money.json.data.paylioBalanceAvailable).toBe(false);
  });

  it('rejects a bad calendar range instead of returning the whole table', async () => {
    const b = await seedBusiness('cal');
    await createJob(b, '09:00');

    const inverted = await api(
      b.token,
      'GET',
      `/api/v1/dashboard/${b.businessId}/calendar?start=2026-06-01&end=2026-01-01`,
    );
    expect(inverted.status, JSON.stringify(inverted.json)).toBe(400);

    const garbage = await api(
      b.token,
      'GET',
      `/api/v1/dashboard/${b.businessId}/calendar?start=not-a-date`,
    );
    expect(garbage.status, JSON.stringify(garbage.json)).toBe(400);
  });
});
