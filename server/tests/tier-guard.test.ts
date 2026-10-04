import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tier limits.
 *
 * Before this, `checkLimits` and `tierLimits` had ZERO callers and the three
 * subscription tiers were described but not enforceable. A free business could
 * create unlimited clients, jobs and invoices. The product was already built and
 * the limits were already written — only the door was missing.
 *
 * These assert the boundary behaviour, because that is where an off-by-one silently
 * charges a customer: at 50 clients the 50th must succeed and the 51st must not.
 */

const mockSubscription = { tier: 'free', status: 'inactive', isPaying: false };

vi.mock('../src/services/subscription.service', () => ({
  getSubscription: vi.fn(async () => mockSubscription),
}));

const counts = {
  crmClient: 0,
  invoice: 0,
  crmJob: 0,
};

vi.mock('../src/utils/database', () => ({
  prisma: {
    crmClient: { count: vi.fn(async () => counts.crmClient) },
    invoice: { count: vi.fn(async () => counts.invoice) },
    crmJob: { count: vi.fn(async () => counts.crmJob) },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { tierGuard } from '../src/middleware/tierGuard.middleware';
import { getSubscription } from '../src/services/subscription.service';
import { prisma } from '../src/utils/database';

type Captured = { error?: { statusCode: number; message: string }; nextCalled: boolean };

function run(options: { resource: 'clients' | 'invoices' | 'jobs' }, overrides: Record<string, any> = {}): Promise<Captured> {
  const guard = tierGuard(options);
  return new Promise((resolve) => {
    // `id` is required as well as `businessId`: it is the ownership key the tenant
    // resolver checks an explicit serviceBusinessId against, and every real JWT carries
    // it. The fixture previously omitted it and only passed because the old resolver
    // never looked at anything but `businessId`.
    const req: any = { user: { id: 'user_1', businessId: 'biz_1' }, body: {}, query: {}, ...overrides };
    guard(req, {} as any, (err?: any) => {
      resolve({ error: err, nextCalled: !err });
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  counts.crmClient = 0;
  counts.invoice = 0;
  counts.crmJob = 0;
  mockSubscription.tier = 'free';
  mockSubscription.status = 'inactive';
});

describe('free tier client limit', () => {
  it('allows a client while under the cap', async () => {
    counts.crmClient = 49;
    const r = await run({ resource: 'clients' });
    // The 50th client is within "up to 50".
    expect(r.nextCalled).toBe(true);
  });

  it('refuses the 51st client', async () => {
    counts.crmClient = 50;
    const r = await run({ resource: 'clients' });
    expect(r.nextCalled).toBe(false);
    expect(r.error?.statusCode).toBe(402);
    expect(r.error?.message).toMatch(/50/);
  });

  it('tells the customer upgrading will not touch their existing records', async () => {
    // The refusal must not read as "your data is at risk". Businesses escalate to
    // support over exactly this sentence.
    counts.crmClient = 60;
    const r = await run({ resource: 'clients' });
    expect(r.error?.message).toMatch(/existing records are unaffected/i);
  });
});

describe('free tier invoice limit', () => {
  it('allows the 100th invoice and refuses the 101st', async () => {
    counts.invoice = 99;
    expect((await run({ resource: 'invoices' })).nextCalled).toBe(true);

    counts.invoice = 100;
    const r = await run({ resource: 'invoices' });
    expect(r.error?.statusCode).toBe(402);
  });
});

describe('paid tiers are not limited', () => {
  it('pro has unlimited clients', async () => {
    mockSubscription.tier = 'pro';
    counts.crmClient = 5000;
    expect((await run({ resource: 'clients' })).nextCalled).toBe(true);
  });

  it('business has unlimited invoices', async () => {
    mockSubscription.tier = 'business';
    counts.invoice = 5000;
    expect((await run({ resource: 'invoices' })).nextCalled).toBe(true);
  });
});

describe('jobs are never capped', () => {
  it('no tier defines a job limit, so the guard must not invent one', async () => {
    // maxClients and maxInvoicesPerMonth exist; maxJobsPerMonth does not. Capping
    // jobs here would impose a limit no plan advertises.
    mockSubscription.tier = 'free';
    counts.crmJob = 99_999;
    expect((await run({ resource: 'jobs' })).nextCalled).toBe(true);
  });
});

describe('safety properties', () => {
  it('refuses an unauthenticated request with 401', async () => {
    // No user at all is unauthenticated, which is 401 — not 403. The two used to be
    // conflated, because the old resolver asked only for `businessId` and had no way to
    // tell "signed out" from "signed in with nothing set up".
    const guard = tierGuard({ resource: 'clients' });
    const r = await new Promise<Captured>((resolve) => {
      guard({ body: {}, query: {} } as any, {} as any, (err?: any) =>
        resolve({ error: err, nextCalled: !err }),
      );
    });
    expect(r.error?.statusCode).toBe(401);
    expect(r.nextCalled).toBe(false);
  });

  it('refuses an authenticated caller with no business', async () => {
    // Signed in, but setup was never completed: nothing to attribute usage to, and
    // guessing a tenant would apply another business's limit.
    const r = await run({ resource: 'clients' }, { user: { id: 'user_1' } });
    expect(r.error?.statusCode).toBe(403);
    expect(r.nextCalled).toBe(false);
  });

  it('fails open if the tier lookup itself breaks', async () => {
    // An outage in billing must not become an outage for a paying merchant. The
    // cost is one unmetered write; failing closed would stop them invoicing.
    vi.mocked(getSubscription).mockRejectedValueOnce(new Error('db down') as never);
    const r = await run({ resource: 'clients' });
    expect(r.nextCalled).toBe(true);
  });

  it('counts usage scoped to the caller, never globally', async () => {
    await run({ resource: 'clients' }, { user: { businessId: 'biz_1' } });
    // An unscoped count would let one business's volume lock out another.
    for (const call of vi.mocked(prisma.crmClient.count).mock.calls) {
      expect(JSON.stringify(call[0])).toContain('biz_1');
    }
  });
});