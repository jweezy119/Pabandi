import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * Deal pipeline: /api/v1/crm/deals.
 *
 * WHY
 * ---
 * The CRM deals pages (ContactDealsPage, ContactDealDetailPage) have been fully built for
 * some time — DealKanbanBoard, DealListTable, DealFormModal, CSVImportModal — and they all
 * fetch /api/v1/crm/deals. That endpoint did not exist, so every load 404'd and the pages
 * rendered empty. Not a styling gap: an entire feature wired to nothing.
 *
 * The interesting part is WHY the endpoint was missing, because it is the same bug as the
 * empty /contact/reports. There were three Deal models:
 *
 *   Deal         legacy Abode-era, owner-scoped through AbodeManager. Orphaned: 0 reads,
 *                0 writes, `prisma.deal` appears 0 times in the server, and nothing ever
 *                created an AbodeManager row for anyone.
 *   ContactDeal  ContactOS, scoped by lead.ownerId — personal, not per-business.
 *   CrmDeal      already business-scoped, and a field-for-field match for the client.
 *
 * CrmDeal is the right target: businessId, clientId -> CrmClient, the same six-stage
 * vocabulary, probability, lostReason, notes, expectedCloseDate. It is the model the UI was
 * written against.
 *
 * But CrmDeal had no serviceBusinessId, and there is no path from CrmServiceBusiness to the
 * legacy CrmBusiness. So scoping it the way every other CRM endpoint is scoped matched
 * nothing for a correctly enrolled business — the pages would STILL have been empty even
 * after adding routes. Hence the column, hence these tests.
 *
 * These tests are mostly about tenant isolation, because a deals endpoint that trusts a
 * body-supplied businessId is a cross-tenant P&L leak, and a pipeline is exactly the data
 * a competitor wants.
 */

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

// A Proxy, not a fixed object: a hand-listed stub breaks the moment a flow calls a method
// it did not anticipate — the first version of this file mocked only sendEmail and
// sendJobConfirmation, and registration's sendWelcome turned every seed into an unrelated
// 500.
vi.mock('../src/services/email.service', () => {
  const emailService = new Proxy(
    {},
    { get: (_t, prop) => (prop === 'then' ? undefined : vi.fn(async () => ({ skipped: true }))) },
  );
  return { emailService, default: { emailService } };
});

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

const MARKER = '@deals.pabandi.dev';

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

/** A registered, enrolled business owner with one client. */
async function seedBusiness(slug: string) {
  const email = `${slug}${MARKER}`;
  const reg = await api('', 'POST', '/api/v1/auth/register', {
    email,
    password: 'Integration1!',
    firstName: 'Deal',
    lastName: 'Owner',
  });
  expect(reg.status, `register ${email}: ${JSON.stringify(reg.json)}`).toBe(201);
  const token = reg.json.data.token;

  const enroll = await api(token, 'POST', '/api/v1/crm/enroll', {
    businessName: `Business ${slug}`,
    ownerName: 'Deal Owner',
    serviceType: 'general',
  });
  expect(enroll.status, `enroll ${slug}: ${JSON.stringify(enroll.json)}`).toBe(201);

  const client = await api(token, 'POST', '/api/v1/crm/clients', {
    name: `Client ${slug}`,
    email: `client${slug}${MARKER}`,
  });
  expect(client.status, `client ${slug}: ${JSON.stringify(client.json)}`).toBe(201);

  return {
    token: (enroll.json.token as string) || token,
    clientId: client.json.data.id as string,
    businessId: enroll.json.data.business.id as string,
  };
}

/** Create a deal, asserting the happy path so a failure points at the cause. */
async function createDeal(token: string, body: Record<string, unknown>) {
  const res = await api(token, 'POST', '/api/v1/crm/deals', body);
  expect(res.status, `create deal: ${JSON.stringify(res.json)}`).toBe(201);
  return res.json.data;
}

describe('crm deals: pipeline CRUD', () => {
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
    // Deals carry no email, so cleanup keys off the marker in the title. Done before the
    // clients: CrmDeal.clientId is SetNull but CrmDeal itself must go first, and the
    // notification rows are FK'd to User with no cascade.
    await prisma.crmDeal.deleteMany({ where: { title: { contains: MARKER } } });
    await prisma.notification.deleteMany({ where: { user: { email: { contains: MARKER } } } });
    await prisma.crmClient.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  it('requires authentication', async () => {
    const res = await api('', 'GET', '/api/v1/crm/deals');
    expect(res.status).toBe(401);
  });

  it('creates a deal and returns it with the stage default probability', async () => {
    const { token, clientId } = await seedBusiness('create');

    const deal = await createDeal(token, {
      title: `Kitchen refit ${MARKER}`,
      value: '4500',
      stage: 'PROPOSAL',
      clientId,
    });

    expect(deal.title).toBe(`Kitchen refit ${MARKER}`);
    expect(deal.value).toBe(4500);
    expect(deal.stage).toBe('PROPOSAL');
    // The client sends `probability: parseInt(form.probability) || 10`; when it is absent
    // the stage default applies, so the kanban forecast and the column cannot disagree.
    expect(deal.probability).toBe(60);
    expect(deal.clientId).toBe(clientId);
    expect(deal.closedAt).toBeNull();
  });

  it('lists only the caller tenant pipeline', async () => {
    const a = await seedBusiness('scopea');
    const b = await seedBusiness('scopeb');

    await createDeal(a.token, { title: `Apex job ${MARKER}`, value: 1000, stage: 'LEAD' });
    await createDeal(b.token, { title: `Bosun job ${MARKER}`, value: 2000, stage: 'LEAD' });

    const listA = await api(a.token, 'GET', '/api/v1/crm/deals');
    expect(listA.status, JSON.stringify(listA.json)).toBe(200);
    const titlesA: string[] = listA.json.data.map((d: any) => d.title);
    expect(titlesA).toContain(`Apex job ${MARKER}`);
    expect(titlesA).not.toContain(`Bosun job ${MARKER}`);

    const listB = await api(b.token, 'GET', '/api/v1/crm/deals');
    const titlesB: string[] = listB.json.data.map((d: any) => d.title);
    expect(titlesB).toContain(`Bosun job ${MARKER}`);
    expect(titlesB).not.toContain(`Apex job ${MARKER}`);
  });

  it('does not leak a deal across tenants on read-modify-write', async () => {
    const a = await seedBusiness('xtea');
    const b = await seedBusiness('xteb');

    const aDeal = await createDeal(a.token, { title: `Apex secret ${MARKER}`, value: 9000 });

    // PATCH and DELETE must 404, not 403: a 403 would confirm the id exists, turning the
    // endpoint into an oracle for enumerating another tenant's pipeline.
    const patch = await api(b.token, 'PATCH', `/api/v1/crm/deals/${aDeal.id}`, { stage: 'WON' });
    expect(patch.status, JSON.stringify(patch.json)).toBe(404);

    const del = await api(b.token, 'DELETE', `/api/v1/crm/deals/${aDeal.id}`);
    expect(del.status, JSON.stringify(del.json)).toBe(404);

    // And the row must be untouched, not merely hidden.
    const stillThere = await api(a.token, 'GET', '/api/v1/crm/deals');
    const found = stillThere.json.data.find((d: any) => d.id === aDeal.id);
    expect(found, 'cross-tenant delete must not remove the row').toBeTruthy();
    expect(found.stage).toBe('LEAD');
  });

  it('ignores a body-supplied serviceBusinessId', async () => {
    const a = await seedBusiness('bodya');
    const b = await seedBusiness('bodyb');

    // `serviceBusinessId` is not a selector resolveCrmBusiness reads, and createDeal takes
    // its tenant ids from the resolved context rather than the body. So a deal filed with
    // someone else's serviceBusinessId lands in the CALLER's pipeline — it cannot be
    // redirected into another tenant's board.
    const deal = await createDeal(a.token, {
      title: `Injected ${MARKER}`,
      value: 500,
      serviceBusinessId: 'someone-elses-service-business',
    });

    const listB = await api(b.token, 'GET', '/api/v1/crm/deals');
    const titlesB: string[] = listB.json.data.map((d: any) => d.title);
    expect(titlesB).not.toContain(`Injected ${MARKER}`);

    const listA = await api(a.token, 'GET', '/api/v1/crm/deals');
    expect(listA.json.data.some((d: any) => d.id === deal.id)).toBe(true);
  });

  it("refuses a body-supplied businessId the caller does not own", async () => {
    const a = await seedBusiness('bizboda');
    const b = await seedBusiness('bizbodb');

    // Unlike serviceBusinessId, `businessId` IS read by resolveCrmBusiness — as an
    // owner-scoped selector. Asking for another tenant's id therefore resolves to nothing
    // and the request is refused, rather than silently falling back to the caller's own
    // business. Either behaviour would be safe; what must not happen is a 201.
    const res = await api(a.token, 'POST', '/api/v1/crm/deals', {
      title: `Hijack ${MARKER}`,
      value: 500,
      businessId: b.businessId,
    });
    expect(res.status, JSON.stringify(res.json)).toBe(403);

    // And nothing was written on either side.
    for (const owner of [a, b]) {
      const list = await api(owner.token, 'GET', '/api/v1/crm/deals');
      expect(
        list.json.data.some((d: any) => d.title === `Hijack ${MARKER}`),
        'a refused create must not leave a row behind',
      ).toBe(false);
    }
  });

  it("refuses to attach another tenant's client", async () => {
    const a = await seedBusiness('cxta');
    const b = await seedBusiness('cxtb');

    // Otherwise the kanban renders the other business's client name and email on this
    // business's board.
    const res = await api(a.token, 'POST', '/api/v1/crm/deals', {
      title: `Borrowed client ${MARKER}`,
      value: 100,
      clientId: b.clientId,
    });
    expect(res.status, JSON.stringify(res.json)).toBe(404);
  });

  it('rejects an invalid stage rather than filing the deal off the board', async () => {
    const { token } = await seedBusiness('badstage');

    const res = await api(token, 'POST', '/api/v1/crm/deals', {
      title: `Bad stage ${MARKER}`,
      stage: 'won',
    });
    // Lowercase "won" is what the legacy ContactDeal rows use. Storing it would put the
    // deal in a column the kanban does not render, which reads to the user as data loss.
    expect(res.status, JSON.stringify(res.json)).toBe(400);
    expect(String(res.json?.message ?? res.json?.error ?? '')).toMatch(/stage/i);
  });

  it('rejects a negative value and an out-of-range probability', async () => {
    const { token } = await seedBusiness('badnum');

    const neg = await api(token, 'POST', '/api/v1/crm/deals', {
      title: `Negative ${MARKER}`,
      value: -500,
    });
    expect(neg.status, JSON.stringify(neg.json)).toBe(400);

    const prob = await api(token, 'POST', '/api/v1/crm/deals', {
      title: `Overconfident ${MARKER}`,
      probability: 140,
    });
    expect(prob.status, JSON.stringify(prob.json)).toBe(400);
  });

  it('requires a title', async () => {
    const { token } = await seedBusiness('notitle');
    const res = await api(token, 'POST', '/api/v1/crm/deals', { value: 10 });
    expect(res.status, JSON.stringify(res.json)).toBe(400);
  });

  it('derives probability and closedAt from a stage transition', async () => {
    const { token } = await seedBusiness('won');

    const deal = await createDeal(token, { title: `Won job ${MARKER}`, value: 3000, stage: 'LEAD' });
    expect(deal.probability).toBe(10);
    expect(deal.closedAt).toBeNull();

    const won = await api(token, 'PATCH', `/api/v1/crm/deals/${deal.id}`, { stage: 'WON' });
    expect(won.status, JSON.stringify(won.json)).toBe(200);
    expect(won.json.data.stage).toBe('WON');
    // The client sends a probability alongside the stage; when it does not, the stage
    // default applies so the forecast cannot drift from the board.
    expect(won.json.data.probability).toBe(100);
    expect(won.json.data.closedAt).not.toBeNull();
  });

  it('keeps an explicit probability supplied with the stage', async () => {
    const { token } = await seedBusiness('override');

    const deal = await createDeal(token, { title: `Override ${MARKER}`, value: 100, stage: 'LEAD' });
    // "This proposal is 90% likely" is judgement, not arithmetic — an override must survive.
    const res = await api(token, 'PATCH', `/api/v1/crm/deals/${deal.id}`, {
      stage: 'NEGOTIATION',
      probability: 90,
    });
    expect(res.json.data.probability).toBe(90);
  });

  it('records a lost reason and reopens cleanly', async () => {
    const { token } = await seedBusiness('lost');

    const deal = await createDeal(token, { title: `Lost job ${MARKER}`, value: 800, stage: 'LEAD' });

    const lost = await api(token, 'PATCH', `/api/v1/crm/deals/${deal.id}`, {
      stage: 'LOST',
      lostReason: 'Went with a cheaper quote',
    });
    expect(lost.json.data.stage).toBe('LOST');
    expect(lost.json.data.lostReason).toBe('Went with a cheaper quote');
    expect(lost.json.data.closedAt).not.toBeNull();

    // Reopening must clear closedAt, or the deal shows a close date while sitting in an
    // open column.
    const reopened = await api(token, 'PATCH', `/api/v1/crm/deals/${deal.id}`, { stage: 'LEAD' });
    expect(reopened.json.data.closedAt).toBeNull();
  });

  it('deletes a deal the caller owns', async () => {
    const { token } = await seedBusiness('del');

    const deal = await createDeal(token, { title: `Doomed ${MARKER}`, value: 100, stage: 'LEAD' });
    const res = await api(token, 'DELETE', `/api/v1/crm/deals/${deal.id}`);
    expect(res.status, JSON.stringify(res.json)).toBe(200);

    const list = await api(token, 'GET', '/api/v1/crm/deals');
    expect(list.json.data.some((d: any) => d.id === deal.id)).toBe(false);
  });

  it('404s an unknown deal id', async () => {
    const { token } = await seedBusiness('ghost');
    const res = await api(token, 'PATCH', '/api/v1/crm/deals/does-not-exist', { stage: 'WON' });
    expect(res.status).toBe(404);
  });

  it('reports the pipeline grouped by stage', async () => {
    const { token } = await seedBusiness('forecast');

    await createDeal(token, { title: `Lead one ${MARKER}`, value: 100, stage: 'LEAD' });
    await createDeal(token, { title: `Lead two ${MARKER}`, value: 250, stage: 'LEAD' });
    await createDeal(token, { title: `Proposal ${MARKER}`, value: 500, stage: 'PROPOSAL' });

    // The forecast widget reads this shape from PipelineOSDashboard.
    const list = await api(token, 'GET', '/api/v1/crm/deals');
    expect(list.status).toBe(200);
    const stages = list.json.data.map((d: any) => d.stage);
    expect(stages.filter((s: string) => s === 'LEAD')).toHaveLength(2);
    expect(stages.filter((s: string) => s === 'PROPOSAL')).toHaveLength(1);
  });
});
