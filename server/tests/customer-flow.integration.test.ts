import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * The customer flow, end to end, over real HTTP.
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * Reported as "I add a client, click Save Changes, nothing happens", then, after
 * that was fixed, "clicking on contact os brings us back to pabandi.com".
 *
 * Both defects lived in the seams between components, and 556 unit tests could not see
 * either one:
 *
 *   1. Setup completed WITHOUT calling /crm/enroll. Every /crm route sits behind
 *      resolveCrmBusiness, so every read and write 403'd. The wizard, the 403, and the
 *      Save button were each individually correct.
 *   2. BusinessGuard answered a personal-mode request with <Navigate to="/" replace />.
 *      Client-side routing, invisible to the server suite entirely.
 *
 * A unit test asserts that a function returns what it should. This asserts that a
 * person can register, set up a business, and add a client — which is the only
 * question the customer was actually asking.
 *
 * WHAT IS REAL HERE
 * -----------------
 * The real Express app with its real middleware stack, over real HTTP on an ephemeral
 * port, against a real Postgres. Not supertest: supertest calls the app in-process and
 * skips the socket, and the socket is where a wrong host, a CORS rejection and a
 * rejected content-type actually show up. No new dependency either — Node 22 has a
 * global fetch.
 *
 * Only two things are stubbed: outbound email, and the cron jobs that src/index.ts
 * starts at import time (which would otherwise leave timers running against the test
 * database for the life of the process).
 */

// Env defaults come from tests/setup-env.ts (a setupFile), which runs before this
// module. They are not repeated here: an earlier version of this file set JWT_SECRET
// but not JWT_REFRESH_SECRET, passed locally because server/.env supplied it, and failed
// in CI with "secretOrPrivateKey must have a value" from deep inside jsonwebtoken.

// Cron. src/index.ts calls .start() on two services and schedules three node-cron jobs
// at module scope. Unmocked, they run against this database for the whole run.
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));
vi.mock('../src/services/jobCronService', () => ({
  jobCronService: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock('../src/services/subscriptionReconcileCron.service', () => ({
  subscriptionReconcileCron: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock('../src/services/reminderCron.service', () => ({ startReminderCron: vi.fn() }));

// Email. Registration sends a welcome message and there is no provider in CI.
//
// A Proxy rather than a fixed object, because a hand-listed stub breaks the moment a
// flow calls a method it did not anticipate — and that failure surfaces as a 500 in the
// middle of an unrelated test, which reads like a product bug. Two earlier attempts at
// this mock each failed exactly that way (`sendWelcome is not a function`), so the mock
// now answers any method instead of enumerating the ones used today.
vi.mock('../src/services/email.service', () => {
  const emailService = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'then') return undefined; // not a thenable
        return vi.fn(async () => ({ skipped: true }));
      },
    },
  );
  return { emailService, default: { emailService } };
});

/**
 * REFUSE TO RUN AGAINST A REAL DATABASE.
 *
 * This test creates users, businesses, clients and invoices, and cleans up with
 * deleteMany. server/.env points DATABASE_URL at the live Aliyun RDS instance, so
 * running the suite locally without thinking would write to it — and the cleanup would
 * delete rows by pattern.
 *
 * The name of the connected database is the last line of defence. There is no test
 * flag that makes this destructive-safe, because there is no flag that can be trusted
 * to have been set.
 */
function assertIsolatedDatabase() {
  const url = process.env.DATABASE_URL || '';
  const name = (() => {
    try {
      return new URL(url).pathname.replace(/^\//, '');
    } catch {
      return '';
    }
  })();

  if (!/test|integration|ci/i.test(name)) {
    throw new Error(
      `Refusing to run integration tests against database "${name || '<unknown>'}"\n` +
        'These tests write and delete real rows. Point DATABASE_URL at a disposable ' +
        'database whose name contains "test", e.g.\n' +
        '  docker run -d --name pabandi_it -e POSTGRES_USER=pabandi ' +
        '-e POSTGRES_PASSWORD=pabandi -e POSTGRES_DB=pabandi_integration ' +
        '-p 55433:5432 postgres:16\n' +
        '  DATABASE_URL=postgresql://pabandi:pabandi@localhost:55433/pabandi_integration ' +
        'npx vitest run tests/customer-flow.integration.test.ts',
    );
  }
  return name;
}

let baseUrl: string;
let server: Server;

/** Registers a user and returns their bearer token. */
async function registerUser(email: string): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      // Must satisfy the server's complexity rule: 8+, upper, lower, digit, and one
      // of !@#$&*. A weak password here fails with a 400 that looks like a broken test
      // rather than a rejected credential.
      password: 'Integration1!',
      firstName: 'Integration',
      lastName: 'Owner',
    }),
  });
  // Read the body ONCE and parse from the string.
  //
  // The obvious `expect(res.status, await res.text()).toBe(201)` looks equivalent but
  // is not: vitest evaluates the message argument eagerly, so the body is consumed even
  // when the assertion passes, and the following res.json() throws "Body is unusable".
  const text = await res.text();
  expect(res.status, `register failed: ${text}`).toBe(201);
  const body = JSON.parse(text);
  return { token: body.data.token, userId: body.data.user.id };
}

function auth(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function crm(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}/api/v1/crm${path}`, {
    method,
    headers: auth(token),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep null */
  }
  return { res, json, status: res.status };
}

describe('customer flow: register -> set up business -> add a client', () => {
  beforeAll(async () => {
    const dbName = assertIsolatedDatabase();

    const { default: app } = await import('../src/index');
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const { prisma } = await import('../src/utils/database');
    // Fail fast if the schema is missing, rather than 25 confusing errors later.
    const probe = await prisma.user.count();
    console.log(`[integration] database "${dbName}" reachable, ${probe} users`);

    process.env.SMOKE_TEST_BASE_URL = baseUrl;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const { prisma } = await import('../src/utils/database');
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const { prisma } = await import('../src/utils/database');
    // Scoped to a marker so a run never touches rows it did not create.
    await prisma.crmClient.deleteMany({ where: { email: { contains: '@flow.pabandi.dev' } } });
    await prisma.user.deleteMany({ where: { email: { contains: '@flow.pabandi.dev' } } });
  });

  // ── The regression, stated as a test ──────────────────────────────────────
  it('a business that never enrolled gets 403 on every CRM route', async () => {
    // This is the exact state the customer was in. It is asserted deliberately, not as
    // a bug: resolveCrmBusiness refusing an unenrolled account is CORRECT. What was
    // broken is that nothing ever enrolled them. Pinning the 403 means the test below
    // is a real before/after rather than a coincidence.
    const { token } = await registerUser('unenrolled@flow.pabandi.dev');

    const list = await crm(token, 'GET', '/clients');
    expect(list.status).toBe(403);
    expect(list.json.message).toMatch(/no service business enrolled/i);

    // And a write fails the same way, which is why Save Changes did nothing.
    const create = await crm(token, 'POST', '/clients', { name: 'Never Saved' });
    expect(create.status).toBe(403);
  });

  it('enrolling is what makes the CRM reachable, and it is idempotent', async () => {
    const { token } = await registerUser('enrolled@flow.pabandi.dev');

    const enroll = await crm(token, 'POST', '/enroll', {
      businessName: 'Apex Plumbing',
      ownerName: 'Integration Owner',
      serviceType: 'general',
    });
    // 201, not 200: enrollment creates the business/service-business pairing.
    expect(enroll.status).toBe(201);
    expect(enroll.json.data.business.name).toBe('Apex Plumbing');

    // The guard passes now — this single assertion is the whole bug.
    const list = await crm(token, 'GET', '/clients');
    expect(list.status).toBe(200);
    expect(list.json.data).toEqual([]);

    // Re-enrolling must not fork a second service business. The client self-heals by
    // calling enroll on every 403, so this runs more than once per real account.
    const again = await crm(token, 'POST', '/enroll', {
      businessName: 'Apex Plumbing',
      ownerName: 'Integration Owner',
      serviceType: 'general',
    });
    expect(again.status).toBe(201);
    expect(again.json.data.crmBusiness.id).toBe(enroll.json.data.crmBusiness.id);
    expect(again.json.data.business.id).toBe(enroll.json.data.business.id);
  });

  it('adds a client and reads it back — the flow that reported as a dead button', async () => {
    const { token } = await registerUser('clientflow@flow.pabandi.dev');
    await crm(token, 'POST', '/enroll', {
      businessName: 'Apex Plumbing',
      ownerName: 'Integration Owner',
      serviceType: 'general',
    });

    const created = await crm(token, 'POST', '/clients', {
      name: 'Amara Okonkwo',
      email: 'amara@customer.example',
      phone: '+15550100',
    });
    expect(created.status, `create failed: ${JSON.stringify(created.json)}`).toBe(201);
    expect(created.json.data.name).toBe('Amara Okonkwo');
    const clientId = created.json.data.id;

    // The Save button's whole contract: the thing you added is there afterwards.
    const list = await crm(token, 'GET', '/clients');
    expect(list.status).toBe(200);
    expect(list.json.data).toHaveLength(1);
    expect(list.json.data[0].id).toBe(clientId);
  });

  it('keeps one tenant out of another tenant’s client list', async () => {
    // Two businesses, same service. If the CRM scoped by anything other than the
    // caller's own tenant, this is where it would show.
    const a = await registerUser('tenant-a@flow.pabandi.dev');
    const b = await registerUser('tenant-b@flow.pabandi.dev');
    // Asserted, not fire-and-forget: when this failed silently the symptom was a 403
    // two lines later that pointed at tenant scoping rather than at enrollment.
    const enrollA = await crm(a.token, 'POST', '/enroll', { businessName: 'Tenant A', ownerName: 'Owner A', serviceType: 'general' });
    const enrollB = await crm(b.token, 'POST', '/enroll', { businessName: 'Tenant B', ownerName: 'Owner B', serviceType: 'general' });
    expect(enrollA.status, `A: ${JSON.stringify(enrollA.json)}`).toBe(201);
    expect(enrollB.status, `B: ${JSON.stringify(enrollB.json)}`).toBe(201);

    await crm(a.token, 'POST', '/clients', { name: 'A Client' });

    const bSees = await crm(b.token, 'GET', '/clients');
    expect(bSees.status).toBe(200);
    expect(bSees.json.data).toEqual([]);
  });

  it('rejects an unauthenticated CRM request', async () => {
    const res = await fetch(`${baseUrl}/api/v1/crm/clients`);
    expect(res.status).toBe(401);
  });
});
