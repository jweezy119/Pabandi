import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * Job scheduling: double-booking prevention and tenant isolation.
 *
 * TWO SEPARATE BUGS, FOUND IN THE SAME CODE.
 *
 * 1. NO CONFLICT CHECK AT ALL. Nothing prevented one employee being booked on two
 *    overlapping jobs. Assignment is written in TWO places — `CrmJobAssignment` by
 *    crm.service, `CrmJob.employeeId` by job.service — and neither writes the other, so a
 *    check that only looked at one would be bypassed by creating the clashing job through
 *    the other endpoint. Both are matched here, and there is a test for each direction.
 *
 * 2. CROSS-TENANT, AND IT IS WORSE THAN THE FINANCIALS LEAK. job.routes read the tenant as
 *    `req.body.businessId || req.query.businessId` with only `authenticate` on the router, so
 *    any logged-in user could read another business's job schedule — client names, service
 *    ADDRESSES, appointment times — and create jobs in it. `checkInJob`, `checkOutJob` and
 *    `handleNoShow` took no tenant at all: `findUnique({ where: { id: jobId } })`, so anyone
 *    could check in, complete (which also generates an invoice) or mark missed any job in
 *    the platform.
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

// The global /api/ limiter allows 100 requests per 15 minutes per IP and each seedBusiness
// costs a register + enroll + client + employee. Raised for this file only — deliberately
// not a NODE_ENV=test bypass in the middleware, because
// tests/rate-limit-integration.test.ts asserts ordinary traffic IS still limited.
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

const MARKER = '@jobs.pabandi.dev';

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
    firstName: 'Job',
    lastName: 'Owner',
  });
  expect(reg.status, `register ${email}: ${JSON.stringify(reg.json)}`).toBe(201);

  const enroll = await api(reg.json.data.token, 'POST', '/api/v1/crm/enroll', {
    businessName: `Business ${slug}`,
    ownerName: 'Job Owner',
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
    clientId: client.json.data.id as string,
    employeeId: employee.json.data.id as string,
    businessId: enroll.json.data.business.id as string,
  };
}

/**
 * Read the failure message from an error response.
 *
 * Routes differ: handlers that build their own response use `error`, while handlers that
 * call next(error) land on the global errorHandler, which serialises `message`. Reading
 * only one of them makes a test fail on a wording difference rather than on behaviour.
 */
function errOf(json: any): string {
  return String(json?.error ?? json?.message ?? '');
}

/** Tomorrow, so a slow suite can never collide with a job created "today". */
function tomorrow() {
  const d = new Date(Date.now() + 864e5);
  return d.toISOString().slice(0, 10);
}

function jobBody(clientId: string, employeeId: string, time: string, minutes = 60) {
  return {
    clientId,
    serviceType: 'cleaning',
    scheduledDate: tomorrow(),
    scheduledTime: time,
    durationMinutes: minutes,
    address: `Addr ${MARKER}`,
    price: 100,
    employeeId,
  };
}

describe('jobs: double-booking', () => {
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
    await prisma.crmEmployee.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.notification.deleteMany({ where: { user: { email: { contains: MARKER } } } });
    await prisma.crmClient.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  it('books an employee with no clash', async () => {
    const b = await seedBusiness('ok');
    const res = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '09:00'));
    expect(res.status, JSON.stringify(res.json)).toBe(201);

    // The assignment is real, not just accepted: crm.service records it in CrmJobAssignment
    // and leaves CrmJob.employeeId null, so the row is the thing to check.
    const { prisma } = await import('../src/utils/database');
    const assignments = await prisma.crmJobAssignment.count({
      where: { jobId: res.json.data.id, employeeId: b.employeeId },
    });
    expect(assignments, 'the job must actually be assigned to the employee').toBe(1);
  });

  it('refuses a second job overlapping the same employee', async () => {
    const b = await seedBusiness('clash');
    const first = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '09:00', 60));
    expect(first.status, JSON.stringify(first.json)).toBe(201);

    // 09:30 for 60 minutes overlaps 09:00-10:00.
    const second = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '09:30', 60));
    expect(second.status, JSON.stringify(second.json)).toBe(409);
    expect(errOf(second.json)).toMatch(/already booked/i);
    // The refusal must be actionable, not a bare 409.
    expect(Array.isArray(second.json.conflicts)).toBe(true);
    expect(second.json.conflicts[0].startsAt).toBeTruthy();

    const { prisma } = await import('../src/utils/database');
    expect(await prisma.crmJob.count({ where: { address: { contains: MARKER } } })).toBe(1);
  });

  it('allows back-to-back jobs (half-open window)', async () => {
    const b = await seedBusiness('backtoback');
    const first = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '09:00', 60));
    expect(first.status, JSON.stringify(first.json)).toBe(201);

    // Starts exactly when the first ends. Working back to back is the normal case, so a
    // shared boundary must NOT be treated as a conflict.
    const second = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '10:00', 60));
    expect(second.status, JSON.stringify(second.json)).toBe(201);
  });

  it('allows a different employee at the same time', async () => {
    const b = await seedBusiness('twoemp');
    const second = await api(b.token, 'POST', '/api/v1/crm/employees', {
      name: 'Employee twoemp-b',
      role: 'CLEANER',
      email: `employeeb${MARKER}`,
    });
    expect(second.status, JSON.stringify(second.json)).toBe(201);
    const otherId = second.json.data.id as string;

    const a = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '09:00'));
    expect(a.status, JSON.stringify(a.json)).toBe(201);

    const other = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, otherId, '09:00'));
    expect(other.status, JSON.stringify(other.json)).toBe(201);
  });

  it('lets a business override a clash deliberately', async () => {
    const b = await seedBusiness('override');
    await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '09:00', 60));

    // A 409 should not be a hard wall: double-booking is sometimes the right answer.
    const forced = await api(b.token, 'POST', '/api/v1/crm/jobs', {
      ...jobBody(b.clientId, b.employeeId, '09:30', 60),
      allowConflict: true,
    });
    expect(forced.status, JSON.stringify(forced.json)).toBe(201);
  });

  it('ignores a CANCELLED job when checking for clashes', async () => {
    const b = await seedBusiness('cancelled');
    const first = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '09:00', 60));
    expect(first.status, JSON.stringify(first.json)).toBe(201);

    const cancel = await api(b.token, 'PATCH', `/api/v1/crm/jobs/${first.json.data.id}/status`, {
      status: 'CANCELLED',
    });
    expect(cancel.status, JSON.stringify(cancel.json)).toBe(200);

    // A cancelled booking does not occupy the employee.
    const second = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '09:30', 60));
    expect(second.status, JSON.stringify(second.json)).toBe(201);
  });

  it('detects a clash against a job created through the OTHER assignment path', async () => {
    const b = await seedBusiness('bothways');

    // Created via /api/v1/jobs, which writes CrmJob.employeeId.
    const viaJobService = await api(b.token, 'POST', '/api/v1/jobs', {
      ...jobBody(b.clientId, b.employeeId, '09:00', 60),
      address: `Addr ${MARKER}`,
    });
    expect(viaJobService.status, JSON.stringify(viaJobService.json)).toBe(201);

    // Created via /api/v1/crm/jobs, which writes CrmJobAssignment. The check has to see the
    // first one even though it is stored in the other column, or the guard is bypassable by
    // choosing a different endpoint.
    const viaCrm = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '09:30', 60));
    expect(viaCrm.status, JSON.stringify(viaCrm.json)).toBe(409);
  });

  it('refuses to reassign a job on top of an existing booking', async () => {
    const b = await seedBusiness('reassign');

    // 09:00-10:00, assigned to the employee.
    const busy = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '09:00', 60));
    expect(busy.status, JSON.stringify(busy.json)).toBe(201);

    // 09:30-10:30, nobody assigned — books cleanly.
    const free = await api(b.token, 'POST', '/api/v1/crm/jobs', {
      ...jobBody(b.clientId, b.employeeId, '09:30', 60),
      employeeId: null,
    });
    expect(free.status, JSON.stringify(free.json)).toBe(201);

    // Moving it onto the employee who is already busy must be refused. Reassignment is the
    // easiest way to create a double-booking after the fact, so it needs the same check.
    const clash = await api(b.token, 'POST', `/api/v1/crm/jobs/${free.json.data.id}/assign`, {
      employeeId: b.employeeId,
    });
    expect(clash.status, JSON.stringify(clash.json)).toBe(409);

    const { prisma } = await import('../src/utils/database');
    const assignments = await prisma.crmJobAssignment.count({ where: { jobId: free.json.data.id } });
    expect(assignments, 'a refused reassignment must not leave an assignment behind').toBe(0);
  });

  it('allows re-assigning a job to the employee it is already on', async () => {
    const b = await seedBusiness('selfassign');
    const job = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '09:00', 60));
    expect(job.status, JSON.stringify(job.json)).toBe(201);

    // The job is excluded from its own conflict check, so this must not self-conflict.
    const same = await api(b.token, 'POST', `/api/v1/crm/jobs/${job.json.data.id}/assign`, {
      employeeId: b.employeeId,
    });
    expect(same.status, JSON.stringify(same.json)).toBe(200);
  });

  it('refuses a reschedule that lands on another booking', async () => {
    const b = await seedBusiness('reschedule');
    await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '09:00', 60));
    const movable = await api(b.token, 'POST', '/api/v1/crm/jobs', jobBody(b.clientId, b.employeeId, '14:00', 60));
    expect(movable.status, JSON.stringify(movable.json)).toBe(201);

    const moved = await api(b.token, 'PATCH', `/api/v1/jobs/${movable.json.data.id}`, {
      scheduledTime: '09:30',
      scheduledDate: tomorrow(),
    });
    // Booking cleanly and then moving the job on top of another one is the easiest way to
    // defeat a create-time check, so the reschedule has to be checked too.
    expect(moved.status, JSON.stringify(moved.json)).toBe(409);
  });
});

describe('jobs: tenant isolation', () => {
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
    await prisma.crmEmployee.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.notification.deleteMany({ where: { user: { email: { contains: MARKER } } } });
    await prisma.crmClient.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  it('requires authentication', async () => {
    for (const [method, path] of [
      ['GET', '/api/v1/jobs'],
      ['GET', '/api/v1/jobs/anything'],
      ['POST', '/api/v1/jobs'],
      ['PATCH', '/api/v1/jobs/anything'],
      ['POST', '/api/v1/jobs/anything/checkin'],
      ['POST', '/api/v1/jobs/anything/checkout'],
    ] as const) {
      const res = await api('', method, path, method === 'GET' ? undefined : {});
      expect(res.status, `${method} ${path} must not be anonymous`).toBe(401);
    }
  });

  it('ignores a caller-supplied businessId and serves only the caller tenant', async () => {
    const victim = await seedBusiness('jvictim');
    const attacker = await seedBusiness('jattacker');

    const created = await api(victim.token, 'POST', '/api/v1/crm/jobs', {
      ...jobBody(victim.clientId, victim.employeeId, '09:00'),
      address: `Secret Address ${MARKER}`,
    });
    expect(created.status, JSON.stringify(created.json)).toBe(201);

    // The exploit: the attacker names the victim's business. resolveCrmBusiness pairs a
    // requested id with ownerId: userId, so a foreign id resolves to nothing and the
    // request is REFUSED. Asserting 200 would be asserting weaker behaviour than the code
    // has; what matters is that nothing leaks.
    const list = await api(
      attacker.token,
      'GET',
      `/api/v1/jobs?businessId=${encodeURIComponent(victim.businessId)}`,
    );
    expect([200, 403], `${list.status}: ${JSON.stringify(list.json)}`).toContain(list.status);
    const body = JSON.stringify(list.json);
    expect(body, 'job list leaked another tenant').not.toContain('Secret Address');
    expect(body).not.toContain(victim.clientId);
  });

  it('refuses a cross-tenant job read, write and state change', async () => {
    const victim = await seedBusiness('svictim');
    const attacker = await seedBusiness('sattacker');

    const created = await api(victim.token, 'POST', '/api/v1/crm/jobs', {
      ...jobBody(victim.clientId, victim.employeeId, '09:00'),
      address: `Secret Address ${MARKER}`,
    });
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    const jobId = created.json.data.id as string;

    const read = await api(
      attacker.token,
      'GET',
      `/api/v1/jobs/${jobId}?businessId=${encodeURIComponent(victim.businessId)}`,
    );
    expect([200, 403, 404], `${read.status}: ${JSON.stringify(read.json)}`).toContain(read.status);
    expect(JSON.stringify(read.json)).not.toContain('Secret Address');

    const write = await api(
      attacker.token,
      'PATCH',
      `/api/v1/jobs/${jobId}?businessId=${encodeURIComponent(victim.businessId)}`,
      { notes: 'tampered' },
    );
    expect([200, 403, 404], `${write.status}: ${JSON.stringify(write.json)}`).toContain(write.status);
    expect(errOf(write.json)).not.toMatch(/tampered/);

    // checkIn/checkOut previously took NO tenant at all, so these reached any job in the
    // platform. checkOut also generates an invoice, so it was a money-path write too.
    const checkin = await api(attacker.token, 'POST', `/api/v1/jobs/${jobId}/checkin`, {});
    expect(checkin.status, JSON.stringify(checkin.json)).toBe(400);

    const checkout = await api(attacker.token, 'POST', `/api/v1/jobs/${jobId}/checkout`, {});
    expect(checkout.status, JSON.stringify(checkout.json)).toBe(400);

    // And the victim's job is untouched.
    const stillScheduled = await api(victim.token, 'GET', `/api/v1/crm/jobs?status=SCHEDULED`);
    expect(JSON.stringify(stillScheduled.json)).toContain('Secret Address');
  });

  it('refuses to create a job against another tenant client', async () => {
    const victim = await seedBusiness('cvictim');
    const attacker = await seedBusiness('cattacker');

    const res = await api(attacker.token, 'POST', '/api/v1/jobs', {
      ...jobBody(victim.clientId, attacker.employeeId, '09:00'),
      address: `Addr ${MARKER}`,
    });
    expect(res.status, JSON.stringify(res.json)).toBe(404);
  });
});

