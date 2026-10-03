import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Subscription reconciliation.
 *
 * Subscription state lives in a local row written only by webhook. Webhooks are
 * best-effort — they retry a bounded number of times and then stop — so a lost
 * delivery silently reverts a paying customer to the free tier and nothing
 * notices. This reconciles local state against the provider.
 *
 * THE PROPERTY THAT MATTERS MOST
 * ------------------------------
 * A provider outage must not downgrade anyone. A job that reacts to its own
 * failure by stripping every paying customer of paid features is a worse bug than
 * the one it repairs, and it would look correct in review — the code "corrects"
 * rows, it just corrects them to free.
 *
 * Every test below is about which of those two things happens.
 */

const rows: any[] = [];
const updates: any[] = [];

vi.mock('../src/utils/database', () => ({
  prisma: {
    merchantSubscription: {
      findMany: vi.fn(async () => rows),
      update: vi.fn(async ({ where, data }: any) => {
        updates.push({ where, data });
        return {};
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
      groupBy: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({ _sum: { priceCents: 0 } })),
    },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

process.env.WHOP_API_KEY = 'whop_test_key';

import { reconcileSubscriptions } from '../src/services/subscription-reconcile.service';

/** Shape the provider is stubbed to return. */
let provider: any;
const fetchMock = vi.fn(async () => provider);

beforeEach(() => {
  rows.length = 0;
  updates.length = 0;
  vi.stubGlobal('fetch', fetchMock as never);
  fetchMock.mockClear();
  provider = { ok: true, status: 200, json: async () => ({}) };
});

const ACTIVE_ROW = {
  id: 'sub_1',
  businessId: 'biz_1',
  tier: 'free', // we think they are free; the provider says otherwise
  status: 'inactive',
  whopMembershipId: 'mem_1',
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
};

describe('recovering a merchant whose webhook was lost', () => {
  it('promotes them when the provider says they are paying', async () => {
    rows.push({ ...ACTIVE_ROW });
    provider = {
      ok: true,
      status: 200,
      json: async () => ({
        membership: {
          id: 'mem_1',
          status: 'active',
          metadata: { pabandiBusinessId: 'biz_1', pabandiTier: 'pro' },
          current_period_end: '2026-11-01T00:00:00Z',
        },
      }),
    };

    const r = await reconcileSubscriptions();

    expect(r.corrected).toBe(1);
    expect(updates[0].data.tier).toBe('pro');
    expect(updates[0].data.status).toBe('active');
    // Clearing lastWebhookId makes the next webhook apply rather than dedupe away.
    expect(updates[0].data.lastWebhookId).toBeNull();
  });

  it('derives the tier from the plan name when metadata is absent', async () => {
    // Checkout metadata normally carries it. If Whop ever stops echoing it, the
    // plan name is the fallback and must not silently leave them on free.
    rows.push({ ...ACTIVE_ROW, tier: 'free' });
    provider = {
      ok: true,
      status: 200,
      json: async () => ({ membership: { id: 'mem_1', status: 'active', plan: { name: 'Pabandi Business' } } }),
    };

    await reconcileSubscriptions();
    expect(updates[0].data.tier).toBe('business');
  });

  it('leaves a row alone when it already agrees', async () => {
    rows.push({ ...ACTIVE_ROW, tier: 'pro', status: 'active', currentPeriodEnd: new Date('2026-11-01T00:00:00Z') });
    provider = {
      ok: true,
      status: 200,
      json: async () => ({
        membership: {
          id: 'mem_1',
          status: 'active',
          metadata: { pabandiTier: 'pro' },
          current_period_end: '2026-11-01T00:00:00Z',
        },
      }),
    };

    const r = await reconcileSubscriptions();
    expect(r.corrected).toBe(0);
    expect(r.unchanged).toBe(1);
    expect(updates).toHaveLength(0);
  });
});

describe('THE SAFETY PROPERTY: a provider outage downgrades nobody', () => {
  it('leaves rows untouched on a 500 from the provider', async () => {
    rows.push({ ...ACTIVE_ROW });
    provider = { ok: false, status: 500, json: async () => ({}) };

    const r = await reconcileSubscriptions();

    expect(updates).toHaveLength(0);
    expect(r.corrected).toBe(0);
    // Counted as unknown, not as "gone".
    expect(r.skippedUnknown).toBe(1);
  });

  it('leaves rows untouched when the network throws', async () => {
    rows.push({ ...ACTIVE_ROW });
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET') as never);

    const r = await reconcileSubscriptions();

    expect(updates).toHaveLength(0);
    expect(r.skippedUnknown).toBe(1);
  });

  it('leaves rows untouched on a rate limit', async () => {
    // 429 is the single most likely transient here, and the most dangerous to
    // treat as a cancellation: it would downgrade every customer on the plan.
    rows.push({ ...ACTIVE_ROW });
    provider = { ok: false, status: 429, json: async () => ({}) };

    await reconcileSubscriptions();
    expect(updates).toHaveLength(0);
  });

  it('does nothing at all when the provider is unconfigured', async () => {
    const saved = process.env.WHOP_API_KEY;
    delete process.env.WHOP_API_KEY;
    rows.push({ ...ACTIVE_ROW });

    const r = await reconcileSubscriptions();

    expect(r.checked).toBe(0);
    expect(updates).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.WHOP_API_KEY = saved;
  });
});

describe('a membership the provider does not have', () => {
  it('downgrades to free rather than leaving a phantom paid subscription', async () => {
    // Distinct from a 500: 404 is an ANSWER. Leaving a subscription active that
    // nobody pays for lets a merchant keep Pro features indefinitely.
    rows.push({ ...ACTIVE_ROW, tier: 'pro', status: 'active' });
    provider = { ok: false, status: 404, json: async () => ({}) };

    const r = await reconcileSubscriptions();

    expect(updates).toHaveLength(1);
    expect(updates[0].data.status).toBe('canceled');
    expect(updates[0].data.tier).toBe('free');
    expect(r.corrected).toBe(1);
  });
});

describe('scope of the query', () => {
  it('only considers rows with a membership id', async () => {
    const { prisma } = await import('../src/utils/database');
    rows.push({ ...ACTIVE_ROW });
    await reconcileSubscriptions();

    const call = vi.mocked(prisma.merchantSubscription.findMany).mock.calls[0][0] as any;
    // Without a membership id there is nothing to ask the provider about.
    expect(call.where.whopMembershipId).toEqual({ not: null });
    // Only rows we believe are paying; a canceled row needs no correction.
    expect(call.where.status.in).toContain('active');
    expect(call.where.status.in).not.toContain('canceled');
  });
});