import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * Cross-tenant writes on the CRM employee routes.
 *
 * `PUT /crm/employees/:id` and `DELETE /crm/employees/:id` updated and deleted by primary
 * key with no tenant predicate. Any authenticated caller could rewrite any employee on the
 * platform — including changing someone's `payRate`, which needs nothing more than an
 * employee id.
 *
 * `crm.service.ts` documents this bug class at length for payroll and fixes it there;
 * these two inline handlers were written afterwards and missed it. Which is the argument
 * for asserting on the ROUTE rather than trusting the pattern to have been followed.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));
vi.mock('../src/services/jobCronService', () => ({ jobCronService: { start: vi.fn(), stop: vi.fn() } }));
vi.mock('../src/services/subscriptionReconcileCron.service', () => ({ subscriptionReconcileCron: { start: vi.fn(), stop: vi.fn() } }));
vi.mock('../src/services/reminderCron.service', () => ({ startReminderCron: vi.fn() }));
vi.mock('../src/services/email.service', () => {
  const emailService = new Proxy(
    {},
    { get: (_t, p) => (p === 'then' ? undefined : vi.fn(async () => ({ skipped: true }))) },
  );
  return { emailService, default: { emailService } };
});

let baseUrl: string;
let server: Server;
const MARKER = '@crmtenants.pabandi.dev';

async function api(token: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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

/** A registered, enrolled business owner. */
async function seedBusiness(slug: string) {
  const reg = await api(null, 'POST', '/api/v1/auth/register', {
    email: `${slug}${MARKER}`,
    password: 'Integration1!',
    firstName: 'Tenant',
    lastName: 'Owner',
  });
  expect(reg.status, `register ${slug}: ${reg.text.slice(0, 140)}`).toBe(201);
  const enroll = await api(reg.json.data.token, 'POST', '/api/v1/crm/enroll', {
    businessName: `Business ${slug}`,
    ownerName: 'Tenant Owner',
    serviceType: 'general',
  });
  expect(enroll.status, `enroll ${slug}: ${enroll.text.slice(0, 140)}`).toBe(201);
  return { token: (enroll.json.token as string) || reg.json.data.token };
}

async function addEmployee(token: string, name: string) {
  const res = await api(token, 'POST', '/api/v1/crm/employees', {
    name,
    role: 'Technician',
    email: `${name.toLowerCase().replace(/\W+/g, '.')}@crew.example`,
    payRate: 15,
    payType: 'hourly',
  });
  expect(res.status, `add employee: ${res.text.slice(0, 140)}`).toBe(201);
  return res.json.data.id as string;
}

describe('CRM employee writes are tenant-scoped', () => {
  beforeAll(async () => {
    const url = process.env.DATABASE_URL || '';
    const name = (() => {
      try {
        return new URL(url).pathname.replace(/^\//, '');
      } catch {
        return '';
      }
    })();
    if (!/test|integration|ci/i.test(name)) {
      throw new Error(`Refusing to run against database "${name}"`);
    }

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
    await prisma.crmEmployee.deleteMany({ where: { email: { contains: '@crew.example' } } });
    await prisma.notification.deleteMany({ where: { user: { email: { contains: MARKER } } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  it('lets a business edit its own employee', async () => {
    const a = await seedBusiness('own');
    const id = await addEmployee(a.token, 'Sam Rivera');

    const res = await api(a.token, 'PUT', `/api/v1/crm/employees/${id}`, { payRate: 22 });
    expect(res.status, res.text.slice(0, 140)).toBe(200);
    expect(res.json.data.payRate).toBe(22);
  });

  it('refuses to let one business edit another business’s employee', async () => {
    // The regression. Changing someone else's pay rate is about as consequential as a
    // cross-tenant write gets, and it used to need nothing more than an employee id.
    const victim = await seedBusiness('victim');
    const attacker = await seedBusiness('attacker');
    const id = await addEmployee(victim.token, 'Priya Shah');

    const res = await api(attacker.token, 'PUT', `/api/v1/crm/employees/${id}`, { payRate: 1 });
    expect(res.status).toBe(404);

    const { prisma } = await import('../src/utils/database');
    const stored = await prisma.crmEmployee.findUnique({ where: { id } });
    expect(stored?.payRate, 'pay rate was changed by another tenant').toBe(15);
  });

  it('refuses to let one business delete another business’s employee', async () => {
    const victim = await seedBusiness('delvictim');
    const attacker = await seedBusiness('delattacker');
    const id = await addEmployee(victim.token, 'Alex Duarte');

    const res = await api(attacker.token, 'DELETE', `/api/v1/crm/employees/${id}`);
    expect(res.status).toBe(404);

    const { prisma } = await import('../src/utils/database');
    const stored = await prisma.crmEmployee.findUnique({ where: { id } });
    expect(stored, 'employee was deleted by another tenant').not.toBeNull();
  });

  it('does not reveal whether another tenant’s employee id exists', async () => {
    // Both "not yours" and "does not exist" answer 404, so the endpoint cannot be used to
    // enumerate employee ids across tenants.
    const attacker = await seedBusiness('probe');
    const missing = await api(attacker.token, 'PUT', '/api/v1/crm/employees/csr_does_not_exist', { payRate: 1 });
    const victim = await seedBusiness('probe2');
    const id = await addEmployee(victim.token, 'Noor Haddad');
    const notYours = await api(attacker.token, 'PUT', `/api/v1/crm/employees/${id}`, { payRate: 1 });

    expect(notYours.status).toBe(missing.status);
  });

  it('still requires authentication', async () => {
    const res = await api(null, 'PUT', '/api/v1/crm/employees/csr_x', { payRate: 1 });
    expect(res.status).toBe(401);
  });
});
