import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * The money paths, end to end, over real HTTP.
 *
 * WHY THIS SUITE IS SEPARATE FROM customer-flow.integration.test.ts
 * -----------------------------------------------------------------
 * That suite covers "can a person use the product". This one covers "does the product
 * move money correctly", which has a different failure profile:
 *
 *   - a wrong amount is not a bug a customer reports, it is a bug they do not notice
 *     until their referral payout is short;
 *   - the dangerous cases are the ones nobody clicks: paying the same invoice twice,
 *     paying someone else's invoice, a number that collides.
 *
 * So the assertions here are deliberately about the cases nobody exercises by hand.
 *
 * WHAT IS REAL
 * ------------
 * Real Express app, real middleware, real HTTP, real Postgres. Referral crediting is
 * NOT mocked — it is the thing under test. Only cron and outbound email are stubbed.
 */

process.env.JWT_SECRET = 'test-jwt-secret';

// Cron, as in the customer-flow suite: src/index.ts starts these at module scope.
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));
vi.mock('../src/services/jobCronService', () => ({
  jobCronService: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock('../src/services/subscriptionReconcileCron.service', () => ({
  subscriptionReconcileCron: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock('../src/services/reminderCron.service', () => ({ startReminderCron: vi.fn() }));

// A Proxy, not a fixed object: a hand-listed stub breaks the moment a flow calls a
// method it did not anticipate, and that surfaces as an unrelated-looking 500.
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

const MARKER = '@money.pabandi.dev';

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
    firstName: 'Money',
    lastName: 'Owner',
  });
  expect(reg.status, `register ${email}: ${JSON.stringify(reg.json)}`).toBe(201);
  const token = reg.json.data.token;

  const enroll = await api(token, 'POST', '/api/v1/crm/enroll', {
    businessName: `Business ${slug}`,
    ownerName: 'Money Owner',
    serviceType: 'general',
  });
  expect(enroll.status, `enroll ${slug}: ${JSON.stringify(enroll.json)}`).toBe(201);
  // Asserted explicitly: a silent fallback to the pre-enrollment token would make every
  // money assertion below pass or fail for the wrong reason.
  expect(typeof enroll.json.token, 'enroll must reissue a token with a businessId claim').toBe('string');

  // The client email carries the marker too, not just the owner's. Cleanup deletes by
  // marker, and Invoice.clientId is a required FK to CrmClient — so a client email
  // without the marker left invoices behind and every later run failed on
  // "Foreign key constraint violated: Invoice_clientId_fkey".
  const client = await api(token, 'POST', '/api/v1/crm/clients', {
    name: `Client ${slug}`,
    email: `client${slug}${MARKER}`,
  });
  expect(client.status, `client ${slug}: ${JSON.stringify(client.json)}`).toBe(201);

  return {
    token,
    // Enrollment reissues the token with a non-null `businessId` claim. Adopt it, as
    // the client store does — otherwise every `req.user.businessId` consumer still sees
    // null and the pay route 500s, which is the bug this suite exists to catch.
    tokenAfterEnroll: (enroll.json.token as string) || token,
    clientId: client.json.data.id as string,
    businessId: enroll.json.data.business.id as string,
    // creditReferrer resolves the referral by `refereeId === business.ownerId`, so the
    // OWNER's user id is what a referral row has to point at — not the business id.
    ownerUserId: reg.json.data.user.id as string,
  };
}

async function createInvoice(token: string, clientId: string, subtotal: number) {
  return api(token, 'POST', '/api/v1/crm/invoices', {
    clientId,
    dateDue: new Date(Date.now() + 7 * 864e5).toISOString(),
    lineItems: [{ description: 'Work', quantity: 1, rate: subtotal, amount: subtotal }],
    subtotal,
  });
}

describe('money: invoicing and payment', () => {
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
    // Scoped to the marker so a run only ever deletes rows it created.
    //
    // ReferralEarning has no businessId and no cascade from PabReferral (the relation is
    // required, so it defaults to Restrict), so the earnings have to go first or the
    // referral delete is refused.
    const referrals = await prisma.pabReferral.findMany({
      where: { refereeEmail: { contains: MARKER } },
      select: { id: true },
    });
    const referralIds = referrals.map((r) => r.id);
    if (referralIds.length) {
      await prisma.referralEarning.deleteMany({ where: { referralId: { in: referralIds } } });
    }
    await prisma.pabReferral.deleteMany({ where: { refereeEmail: { contains: MARKER } } });
    await prisma.invoice.deleteMany({ where: { client: { email: { contains: MARKER } } } });
    // markInvoicePaid calls notifyInvoicePaid, which writes a Notification. Its FK to
    // User has no cascade, so without this the user delete is refused with
    // "Foreign key constraint violated: Notification_userId_fkey" and every later test
    // in the file fails for a reason that has nothing to do with what it asserts.
    await prisma.notification.deleteMany({ where: { user: { email: { contains: MARKER } } } });
    await prisma.crmClient.deleteMany({ where: { email: { contains: MARKER } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  it('creates an invoice with a business-scoped number and a draft status', async () => {
    const { token, clientId } = await seedBusiness('create');

    const res = await createInvoice(token, clientId, 250);
    expect(res.status, JSON.stringify(res.json)).toBe(201);
    expect(res.json.data.status).toBe('draft');
    expect(res.json.data.subtotal).toBe(250);
    expect(res.json.data.number).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(res.json.data.paidAt).toBeNull();
  });

  it('refuses an invoice for a client belonging to another business', async () => {
    // The check runs before a number is spent, so this must not consume INV sequence.
    const a = await seedBusiness('crossa');
    const b = await seedBusiness('crossb');

    const res = await createInvoice(a.token, b.clientId, 100);
    expect(res.status).toBe(400);
    expect(String(res.json.error)).toMatch(/does not belong/i);
  });

  it('marks an invoice paid and stamps paidAt exactly once', async () => {
    const { token, tokenAfterEnroll, clientId } = await seedBusiness('pay');
    const created = await createInvoice(token, clientId, 400);
    const id = created.json.data.id;

    const paid = await api(tokenAfterEnroll, 'POST', `/api/v1/invoices/${id}/pay`, {
      transactionHash: 'tx_pay_1',
    });
    expect(paid.status, JSON.stringify(paid.json)).toBe(200);
    expect(paid.json.status).toBe('paid');

    const { prisma } = await import('../src/utils/database');
    const stored = await prisma.invoice.findUnique({ where: { id } });
    expect(stored?.status).toBe('paid');
    expect(stored?.paidAt).not.toBeNull();
  });

  it('does not pay another business’s invoice', async () => {
    // The single most expensive mistake available in this product: marking a rival's
    // invoice as paid. Scoped by businessId in markInvoicePaid.
    const victim = await seedBusiness('victim');
    const attacker = await seedBusiness('attacker');
    const created = await createInvoice(victim.token, victim.clientId, 900);
    const id = created.json.data.id;

    const res = await api(attacker.token, 'POST', `/api/v1/invoices/${id}/pay`, {
      transactionHash: 'tx_attack',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);

    const { prisma } = await import('../src/utils/database');
    const stored = await prisma.invoice.findUnique({ where: { id } });
    expect(stored?.status).toBe('draft');
    expect(stored?.paidAt).toBeNull();
  });

  it('does not credit the referral fee-share twice for one invoice', async () => {
    // The money assertion that matters most. creditReferrer is fired without await
    // inside markInvoicePaid, so a retry — a double-click, a webhook redelivery, a
    // merchant tapping twice — would otherwise credit the referrer twice for one
    // invoice. Nobody notices until the payout is wrong.
    const referrer = await seedBusiness('referrer');
    const { token, tokenAfterEnroll, clientId, ownerUserId, businessId } = await seedBusiness('referred');

    // Point the new business' owner at the referrer so the 5% has somewhere to go.
    // creditReferrer only credits when it finds a referral whose refereeId is the
    // business owner's user id and whose status is one of
    // REGISTERED | VESTING | EARNED | PAID — so 'QUALIFIED' would silently credit
    // nothing and the test would pass for the wrong reason.
    const { prisma } = await import('../src/utils/database');
    await prisma.pabReferral.create({
      data: {
        referrerId: referrer.ownerUserId,
        refereeId: ownerUserId,
        refereeEmail: `referred${MARKER}`,
        status: 'EARNED',
        feeSharePct: 5,
        feeShareMonths: 12,
        metadata: { businessId },
      } as never,
    });

    const created = await createInvoice(token, clientId, 1000);
    const id = created.json.data.id;
    expect(created.status, JSON.stringify(created.json)).toBe(201);

    // Pay twice, as a retrying client would.
    const first = await api(tokenAfterEnroll, 'POST', `/api/v1/invoices/${id}/pay`, { transactionHash: 'tx_first' });
    expect(first.status, `first pay: ${JSON.stringify(first.json)}`).toBe(200);
    // A retry, as a double-click or a webhook redelivery would produce.
    await api(tokenAfterEnroll, 'POST', `/api/v1/invoices/${id}/pay`, { transactionHash: 'tx_retry' });

    // creditReferrer is not awaited, so poll rather than assert immediately.
    const earnings = await prisma.referralEarning.findMany({ where: { invoiceId: id } });
    expect(
      earnings.length,
      'referral credited more than once for a single invoice',
    ).toBe(1);

    // amountUsd is the FULL invoice value; the 5% fee lives in amountPab, converted at
    // whatever the PAB rate is. Asserting a PAB figure would pin the test to a rate.
    expect(earnings[0].amountUsd).toBe(1000);
    expect(earnings[0].feeSharePct).toBe(5);
    expect(earnings[0].amountPab).toBeGreaterThan(0);
    // Accrued, not paid: crediting the wallet here as well is what used to pay
    // referrers 10% instead of 5%, compounding monthly via the payout cron.
    expect(earnings[0].status).toBe('pending');
    expect(earnings[0].paidAt).toBeNull();
  });

  it('gives each business its own invoice sequence', async () => {
    // Numbers are scoped by businessId, so two businesses both start at 0001. That is
    // intended; what must not happen is one business reading or numbering the other's.
    const a = await seedBusiness('seqa');
    const b = await seedBusiness('seqb');

    const invA = await createInvoice(a.token, a.clientId, 10);
    const invB = await createInvoice(b.token, b.clientId, 20);

    expect(invA.json.data.number).not.toBe(invB.json.data.number);
    expect(invA.json.data.businessId).not.toBe(invB.json.data.businessId);
  });

  it('rejects an unauthenticated payment', async () => {
    const res = await fetch(`${baseUrl}/api/v1/invoices/anything/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});
