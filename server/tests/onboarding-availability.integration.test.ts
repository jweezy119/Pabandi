import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * Onboarding and opening hours.
 *
 * OnboardingWizard is routed at /onboarding and has always POSTed
 * { profile, services, availability, employees } to /api/v1/onboarding/complete, which did not
 * exist. It also sent NO Authorization header (a client bug, since fixed) and failed
 * completely silently -- the user clicked Complete and nothing happened, with the reason only
 * ever reaching the console.
 *
 * The `availability` half had nowhere to go: there was no availability model at all. The
 * double-booking work added conflict DETECTION -- one employee booked twice -- which is a
 * different question from "are we open then". CrmAvailability is business-level recurring
 * weekly hours, because that is the shape the wizard collects, and inventing per-employee
 * semantics the product has not decided would have been a guess.
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
const MARKER = '@onb.pabandi.dev';

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

function errOf(json: any): string {
  return String(json?.error ?? json?.message ?? '');
}

async function seedBusiness(slug: string) {
  const email = `${slug}${MARKER}`;
  const reg = await api('', 'POST', '/api/v1/auth/register', {
    email,
    password: 'Integration1!',
    firstName: 'Onb',
    lastName: 'Owner',
  });
  expect(reg.status, `register ${email}: ${JSON.stringify(reg.json)}`).toBe(201);
  const enroll = await api(reg.json.data.token, 'POST', '/api/v1/crm/enroll', {
    businessName: `Business ${slug}`,
    ownerName: 'Onb Owner',
    serviceType: 'cleaning',
  });
  expect(enroll.status, `enroll ${slug}: ${JSON.stringify(enroll.json)}`).toBe(201);
  const token = (enroll.json.token as string) || reg.json.data.token;
  const client = await api(token, 'POST', '/api/v1/crm/clients', {
    name: `Client ${slug}`,
    email: `client${slug}${MARKER}`,
  });
  expect(client.status).toBe(201);
  return { token, clientId: client.json.data.id as string };
}

/** The next date falling on `weekday` (0=Sun), so no test depends on today's date. */
function nextWeekday(weekday: number, weeksAhead = 1): string {
  const d = new Date(Date.now() + weeksAhead * 7 * 864e5);
  const delta = (weekday - d.getUTCDay() + 7) % 7;
  return new Date(d.getTime() + delta * 864e5).toISOString().slice(0, 10);
}

function jobBody(clientId: string, date: string, time: string, minutes = 60) {
  return {
    clientId,
    serviceType: 'cleaning',
    scheduledDate: date,
    scheduledTime: time,
    durationMinutes: minutes,
    address: `Addr ${MARKER}`,
    price: 100,
  };
}

const HOURS = {
  days: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '17:00',
  slotMinutes: 60,
  bufferMinutes: 15,
};

function onboard(b: { token: string }, businessName: string, availability: any = HOURS, employees: any[] = []) {
  return api(b.token, 'POST', '/api/v1/onboarding/complete', {
    profile: { businessName, ownerName: 'Ada' },
    availability,
    employees,
  });
}

describe('onboarding + availability', () => {
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
    await prisma.crmJob.deleteMany({ where: { address: { contains: MARKER } } });
    await prisma.crmAvailability.deleteMany({ where: { serviceBusiness: { is: { owner } } } });
    await prisma.crmEmployee.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.notification.deleteMany({ where: { user: owner } });
    await prisma.crmClient.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.user.deleteMany({ where: owner });
  });

  it('requires authentication', async () => {
    const res = await api('', 'POST', '/api/v1/onboarding/complete', { profile: {} });
    expect(res.status).toBe(401);
  });

  it('persists profile, hours, crew and returns a slug', async () => {
    const b = await seedBusiness('ok');
    const res = await api(b.token, 'POST', '/api/v1/onboarding/complete', {
      profile: { businessName: 'Acme Cleaning', ownerName: 'Ada', city: 'Leeds' },
      services: [{ name: 'Deep clean', price: 120, duration: 180, description: 'Everything' }],
      availability: HOURS,
      employees: [{ name: 'Bo', phone: '1', payRate: 15, payType: 'HOURLY' }],
    });
    expect(res.status, JSON.stringify(res.json)).toBe(201);
    expect(res.json.data.slug).toBe('acme-cleaning');
    expect(res.json.data.employees).toBe(1);
    expect(res.json.data.availability).toBe(5);

    const hours = await api(b.token, 'GET', '/api/v1/onboarding/availability');
    expect(hours.status).toBe(200);
    expect(hours.json.data).toHaveLength(5);
    expect(hours.json.data[0].weekday).toBe(1);
    expect(hours.json.data[0].startTime).toBe('09:00');
  });

  it('refuses a duplicate slug rather than sharing a handle', async () => {
    const a = await seedBusiness('sluga');
    const b = await seedBusiness('slugb');

    const first = await onboard(a, 'Shared Name');
    expect(first.json.data.slug).toBe('shared-name');

    const second = await onboard(b, 'Shared Name');
    expect(second.status, JSON.stringify(second.json)).toBe(201);
    // A shared handle would let one business appear at another business's public URL.
    expect(second.json.data.slug).not.toBe('shared-name');
    expect(second.json.data.slug).toMatch(/^shared-name-\d+$/);
  });

  it('rejects malformed hours and writes nothing', async () => {
    const b = await seedBusiness('badhours');
    for (const availability of [
      { ...HOURS, startTime: '25:00' },
      { ...HOURS, endTime: 'nope' },
      { ...HOURS, days: [9] },
      { ...HOURS, slotMinutes: 1 },
      { ...HOURS, bufferMinutes: -5 },
    ]) {
      const res = await onboard(b, 'Bad Hours', availability);
      expect(res.status, `${JSON.stringify(availability)}: ${JSON.stringify(res.json)}`).toBe(400);
    }

    const hours = await api(b.token, 'GET', '/api/v1/onboarding/availability');
    expect(hours.json.data).toHaveLength(0);
  });

  it('requires businessName and ownerName', async () => {
    const b = await seedBusiness('names');
    const noName = await api(b.token, 'POST', '/api/v1/onboarding/complete', {
      profile: { ownerName: 'X' },
      availability: HOURS,
    });
    expect(noName.status).toBe(400);
    expect(errOf(noName.json)).toMatch(/businessName/i);

    const noOwner = await api(b.token, 'POST', '/api/v1/onboarding/complete', {
      profile: { businessName: 'Y' },
      availability: HOURS,
    });
    expect(noOwner.status).toBe(400);
    expect(errOf(noOwner.json)).toMatch(/ownerName/i);
  });

  it('replaces the crew rather than duplicating it on re-run', async () => {
    const b = await seedBusiness('rerun');
    const payload = [
      { name: 'Bo', payRate: 15 },
    ];
    await onboard(b, 'Rerun', HOURS, payload);
    await onboard(b, 'Rerun', HOURS, payload);

    const { prisma } = await import('../src/utils/database');
    const crew = await prisma.crmEmployee.count({
      where: { serviceBusiness: { is: { owner: { email: { contains: `rerun${MARKER}` } } } } },
    });
    // Re-opening the wizard must not double the roster every time.
    expect(crew).toBe(1);
  });

  it('allows jobs inside opening hours and refuses them outside', async () => {
    const b = await seedBusiness('hours');
    expect((await onboard(b, 'Hours Co')).status).toBe(201);

    const monday = nextWeekday(1);
    const inside = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, monday, '10:00'));
    expect(inside.status, JSON.stringify(inside.json)).toBe(201);

    const tooEarly = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, monday, '08:00'));
    expect(tooEarly.status, JSON.stringify(tooEarly.json)).toBe(409);
    expect(errOf(tooEarly.json)).toMatch(/opening hours/i);

    // A 16:30 job for 60 minutes runs past the 17:00 close even though it STARTS in hours.
    // Checking only the start time is the bug this assertion exists for.
    const overruns = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, monday, '16:30'));
    expect(overruns.status, JSON.stringify(overruns.json)).toBe(409);

    const forced = await api(b.token, 'POST', '/api/v1/crm/jobs', {
      ...jobBody(b.clientId, monday, '08:00'),
      allowConflict: true,
    });
    expect(forced.status, JSON.stringify(forced.json)).toBe(201);
  });

  it('refuses a job on a day the business is closed', async () => {
    const b = await seedBusiness('closed');
    await onboard(b, 'Closed Days');
    const sunday = nextWeekday(0);
    const res = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, sunday, '10:00'));
    expect(res.status, JSON.stringify(res.json)).toBe(409);
    expect(errOf(res.json)).toMatch(/not open on this day/i);
  });

  it('imposes no restriction until hours are recorded', async () => {
    const b = await seedBusiness('nohours');
    // Never onboarded, so no availability rows. Defaulting to "closed" would silently break
    // scheduling for every existing tenant the moment this shipped.
    const sunday = nextWeekday(0);
    const res = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, sunday, '23:00'));
    expect(res.status, JSON.stringify(res.json)).toBe(201);
  });

  it('scopes hours per tenant', async () => {
    const a = await seedBusiness('scopea');
    const b = await seedBusiness('scopeb');
    await onboard(a, 'Scope A');

    const sunday = nextWeekday(0);
    // B never set hours, so B is unrestricted even though A is closed on Sundays.
    const res = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, sunday, '10:00'));
    expect(res.status, JSON.stringify(res.json)).toBe(201);
  });
});
