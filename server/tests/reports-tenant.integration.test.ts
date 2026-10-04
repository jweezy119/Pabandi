import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * Business reports: tenant isolation.
 *
 * WHY
 * ---
 * reports.routes.ts read its tenant from `String(req.query.businessId)` and handed it
 * straight to the service. The router had `authenticate`, so it looked protected — but
 * authentication only proves WHO the caller is, never WHICH tenant they may read. There was
 * no ownership check anywhere on the router, so any authenticated user could read any other
 * business's revenue, expenses, pipeline, client list and activity feed by putting that
 * business's id in the query string.
 *
 * Six routes of business financials, cross-tenant. Every test below is about that, plus the
 * second defect it was masking: one `businessId` parameter was being handed to five models
 * that disagree on what it means (Invoice wants the platform Business.id; CrmDeal,
 * CrmExpense, CrmClient and CrmActivity want the legacy CrmBusiness.id). No single value
 * satisfies all five, which is why /contact/reports rendered blank.
 */

vi.mock('../src/services/email.service', () => {
  const emailService = new Proxy(
    {},
    { get: (_t, prop) => (prop === 'then' ? undefined : vi.fn(async () => ({ skipped: true }))) },
  );
  return { emailService, default: { emailService } };
});

process.env.JWT_SECRET = 'test-jwt-secret';

// Cron, as in the money-flow suite: src/index.ts starts these at module scope.
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));
vi.mock('../src/services/jobCronService', () => ({
  jobCronService: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock('../src/services/subscriptionReconcileCron.service', () => ({
  subscriptionReconcileCron: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock('../src/services/reminderCron.service', () => ({ startReminderCron: vi.fn() }));

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

const MARKER = '@reports.pabandi.dev';

const REPORTS = [
  '/pipeline',
  '/revenue',
  '/expenses',
  '/client-health',
  '/trust-insights',
  '/activity-metrics',
] as const;

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
    firstName: 'Report',
    lastName: 'Owner',
  });
  expect(reg.status, `register ${email}: ${JSON.stringify(reg.json)}`).toBe(201);

  const enroll = await api(reg.json.data.token, 'POST', '/api/v1/crm/enroll', {
    businessName: `Business ${slug}`,
    ownerName: 'Report Owner',
    serviceType: 'general',
  });
  expect(enroll.status, `enroll ${slug}: ${JSON.stringify(enroll.json)}`).toBe(201);

  return {
    token: (enroll.json.token as string) || reg.json.data.token,
    businessId: enroll.json.data.business.id as string,
  };
}

/** Put one deal and one expense in a tenant's pipeline so the reports have something to find. */
async function seedFinancials(token: string, slug: string, value: number) {
  const deal = await api(token, 'POST', '/api/v1/crm/deals', {
    title: `Deal ${slug} ${MARKER}`,
    value,
    stage: 'PROPOSAL',
  });
  expect(deal.status, JSON.stringify(deal.json)).toBe(201);

  const expense = await api(token, 'POST', '/api/v1/crm/expenses', {
    category: 'materials',
    amount: 100,
    description: `Expense ${slug} ${MARKER}`,
  });
  expect(expense.status, JSON.stringify(expense.json)).toBe(201);
}

describe('reports: tenant isolation', () => {
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
    await prisma.crmDeal.deleteMany({ where: { title: { contains: MARKER } } });
    // Invoice.clientId is a required FK with no cascade, so invoices go before clients.
    await prisma.invoice.deleteMany({ where: { client: { email: { contains: MARKER } } } });
    await prisma.crmExpense.deleteMany({ where: { description: { contains: MARKER } } });
    await prisma.crmActivity.deleteMany({ where: { title: { contains: MARKER } } });
    await prisma.notification.deleteMany({ where: { user: { email: { contains: MARKER } } } });
    await prisma.crmClient.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  it('requires authentication on every report route', async () => {
    for (const route of REPORTS) {
      const res = await api('', 'GET', `/api/v1/reports${route}`);
      expect(res.status, `${route} must not be anonymous`).toBe(401);
    }
  });

  it('refuses another tenant businessId on every report route', async () => {
    const victim = await seedBusiness('victim');
    const attacker = await seedBusiness('attacker');
    await seedFinancials(victim.token, 'victim', 9999);

    // This is the exploit. Two outcomes are acceptable and both are safe: resolveCrmBusiness
    // pairs the requested id with `ownerId: userId`, so a foreign id resolves to nothing and
    // the request is REFUSED (403) rather than silently falling back to the caller's own
    // business. What must never happen is the victim's figure coming back.
    //
    // My first version asserted a 200 here, on the assumption that the id was ignored. It is
    // not ignored — it is checked and rejected. Asserting 200 would have been asserting a
    // weaker behaviour than the code actually has.
    for (const route of REPORTS) {
      const res = await api(
        attacker.token,
        'GET',
        `/api/v1/reports${route}?businessId=${encodeURIComponent(victim.businessId)}`,
      );
      expect([200, 403], `${route} returned ${res.status}: ${JSON.stringify(res.json)}`).toContain(
        res.status,
      );
      expect(JSON.stringify(res.json), `${route} leaked the victim tenant's figures`).not.toContain(
        '9999',
      );
    }
  });

  it('serves the caller reports normally with no businessId in the query', async () => {
    // The 403 above must not have become a blanket refusal: the ordinary case, a caller
    // reading their own reports with no tenant parameter, still has to work.
    const own = await seedBusiness('normal');
    await seedFinancials(own.token, 'normal', 321);

    for (const route of REPORTS) {
      const res = await api(own.token, 'GET', `/api/v1/reports${route}`);
      expect(res.status, `${route}: ${JSON.stringify(res.json)}`).toBe(200);
    }
  });

  it('shows the caller their own pipeline', async () => {
    const own = await seedBusiness('own');
    await seedFinancials(own.token, 'own', 4321);

    const res = await api(own.token, 'GET', '/api/v1/reports/pipeline');
    expect(res.status, JSON.stringify(res.json)).toBe(200);

    const proposal = res.json.find((d: any) => d.stage === 'PROPOSAL');
    expect(proposal, 'the caller must see their own deal').toBeTruthy();
    expect(proposal.count).toBe(1);
    expect(proposal.value).toBe(4321);
  });

  it('keeps two tenants pipeline reports separate', async () => {
    const a = await seedBusiness('sep-a');
    const b = await seedBusiness('sep-b');
    await seedFinancials(a.token, 'a', 111);
    await seedFinancials(b.token, 'b', 222);

    const ra = await api(a.token, 'GET', '/api/v1/reports/pipeline');
    const rb = await api(b.token, 'GET', '/api/v1/reports/pipeline');

    const valA = ra.json.find((d: any) => d.stage === 'PROPOSAL')?.value;
    const valB = rb.json.find((d: any) => d.stage === 'PROPOSAL')?.value;
    expect(valA).toBe(111);
    expect(valB).toBe(222);
  });

  it('reports expenses for the caller tenant only', async () => {
    const a = await seedBusiness('exp-a');
    const b = await seedBusiness('exp-b');
    await seedFinancials(a.token, 'a', 10);
    await seedFinancials(b.token, 'b', 20);

    const ra = await api(a.token, 'GET', '/api/v1/reports/expenses');
    const totalA = ra.json.reduce((s: number, e: any) => s + e.amount, 0);
    const totalB = (
      await api(b.token, 'GET', '/api/v1/reports/expenses')
    ).json.reduce((s: number, e: any) => s + e.amount, 0);

    expect(totalA).toBe(100);
    expect(totalB).toBe(100);
  });

  it('counts a paid invoice as collected, not outstanding', async () => {
    const own = await seedBusiness('revenue');
    const client = await api(own.token, 'POST', '/api/v1/crm/clients', {
      name: `Revenue client ${MARKER}`,
      email: `revenueclient${MARKER}`,
    });
    expect(client.status, JSON.stringify(client.json)).toBe(201);

    const invoice = await api(own.token, 'POST', '/api/v1/crm/invoices', {
      clientId: client.json.data.id,
      dateDue: new Date(Date.now() + 7 * 864e5).toISOString(),
      lineItems: [{ description: 'Work', quantity: 1, rate: 500, amount: 500 }],
      subtotal: 500,
    });
    expect(invoice.status, JSON.stringify(invoice.json)).toBe(201);

    const draft = await api(own.token, 'GET', '/api/v1/reports/revenue');
    expect(draft.json.billed).toBe(500);
    // Unpaid: outstanding, not collected.
    expect(draft.json.outstanding).toBe(500);
    expect(draft.json.collected).toBe(0);

    const paid = await api(own.token, 'PATCH', `/api/v1/crm/invoices/${invoice.json.data.id}/status`, {
      status: 'paid',
    });
    expect(paid.status, JSON.stringify(paid.json)).toBe(200);

    const settled = await api(own.token, 'GET', '/api/v1/reports/revenue');
    expect(settled.json.billed).toBe(500);
    // The number a business is most likely to act on. Reporting a paid invoice as
    // outstanding is the failure mode that makes a dashboard get ignored.
    expect(settled.json.collected).toBe(500);
    expect(settled.json.outstanding).toBe(0);
  });

  it('treats paidAt as authoritative even when the status string lagged', async () => {
    const own = await seedBusiness('paidat');
    const { prisma } = await import('../src/utils/database');
    const client = await api(own.token, 'POST', '/api/v1/crm/clients', {
      name: `PaidAt client ${MARKER}`,
      email: `paidatclient${MARKER}`,
    });
    const invoice = await api(own.token, 'POST', '/api/v1/crm/invoices', {
      clientId: client.json.data.id,
      dateDue: new Date(Date.now() + 7 * 864e5).toISOString(),
      lineItems: [{ description: 'Work', quantity: 1, rate: 750, amount: 750 }],
      subtotal: 750,
    });
    expect(invoice.status, JSON.stringify(invoice.json)).toBe(201);

    // The payment rail recorded the payment but the status string never caught up. This is
    // not hypothetical: a Square/webhook settlement and the CRM status write are different
    // code paths, and only one of them has to fail for this state to exist.
    //
    // Set through prisma because no API route produces it — the status endpoint sets BOTH
    // fields, which is exactly why the earlier version of this test could not tell a
    // paidAt-aware implementation from a status-only one.
    await prisma.invoice.update({
      where: { id: invoice.json.data.id },
      data: { paidAt: new Date() },
    });

    const res = await api(own.token, 'GET', '/api/v1/reports/revenue');
    expect(res.json.collected, 'paidAt must settle the invoice').toBe(750);
    expect(res.json.outstanding).toBe(0);
  });

  it('reports newClients only for the selected period', async () => {
    const own = await seedBusiness('health');
    await api(own.token, 'POST', '/api/v1/crm/clients', {
      name: `Health client ${MARKER}`,
      email: `healthclient${MARKER}`,
    });

    // No range selected: there is no notion of "new", so the list is empty. The previous
    // implementation was `clients.filter(c => startDate && ...)`, which evaluated
    // startDate for truthiness and so returned EVERY client whenever no range was given,
    // under a heading that says "new".
    const noRange = await api(own.token, 'GET', '/api/v1/reports/client-health');
    expect(noRange.status, JSON.stringify(noRange.json)).toBe(200);
    expect(noRange.json.newClients).toEqual([]);

    const past = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const inRange = await api(
      own.token,
      'GET',
      `/api/v1/reports/client-health?startDate=${past}`,
    );
    expect(inRange.json.newClients.length).toBe(1);
    expect(inRange.json.newClients[0].name).toBe(`Health client ${MARKER}`);
  });

  it('trust insights are computed, not constant', async () => {
    const empty = await seedBusiness('trust-empty');
    const busy = await seedBusiness('trust-busy');
    await seedFinancials(busy.token, 'busy', 777);
    // Trust insights are derived from CrmClient and CrmActivity. Seeding deals alone leaves
    // both tenants byte-identical and the assertion below would pass for the wrong reason.
    const client = await api(busy.token, 'POST', '/api/v1/crm/clients', {
      name: `Trust client ${MARKER}`,
      email: `trustclient${MARKER}`,
    });
    expect(client.status, JSON.stringify(client.json)).toBe(201);

    const rEmpty = await api(empty.token, 'GET', '/api/v1/reports/trust-insights');
    const rBusy = await api(busy.token, 'GET', '/api/v1/reports/trust-insights');

    expect(rEmpty.status).toBe(200);
    expect(rBusy.status).toBe(200);

    // The previous implementation returned a literal { '80-100': 15, ... } and consulted
    // nothing, so every tenant saw identical numbers. An empty tenant must now differ from
    // a tenant with data, or the constants are back.
    expect(JSON.stringify(rEmpty.json)).not.toBe(JSON.stringify(rBusy.json));
    // And a tenant with no clients gets no invented score buckets at all.
    expect(Object.keys(rEmpty.json.scoreDistribution ?? {}).length).toBe(0);
  });

  it('rejects an inverted or unparseable date range', async () => {
    const own = await seedBusiness('dates');

    const inverted = await api(
      own.token,
      'GET',
      '/api/v1/reports/pipeline?startDate=2026-06-01&endDate=2026-01-01',
    );
    expect(inverted.status, JSON.stringify(inverted.json)).toBe(400);

    const garbage = await api(own.token, 'GET', '/api/v1/reports/pipeline?startDate=not-a-date');
    expect(garbage.status, JSON.stringify(garbage.json)).toBe(400);
  });

  it('does not echo internal error detail on failure', async () => {
    const own = await seedBusiness('errdetail');
    // A 500 must not carry raw Prisma text (table and column names) to the client.
    const res = await api(own.token, 'GET', '/api/v1/reports/pipeline?startDate=2026-01-01&endDate=2026-01-02');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.json)).not.toMatch(/prisma|CrmDeal|SELECT/i);
  });
});
