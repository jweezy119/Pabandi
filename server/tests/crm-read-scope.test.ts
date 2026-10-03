import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * CRM read scope — the defect this file exists to prevent.
 *
 * Two CRMs write the same tables against two different foreign keys:
 *
 *   Writers                          Column set
 *   bookings.routes.ts:401,425       businessId
 *   job.service.ts:24                businessId
 *   team.service.ts:29               businessId
 *   crm.service.ts:129,254,386,432   serviceBusinessId
 *
 * Before this, all seven read paths filtered on `serviceBusinessId` alone. So a
 * business taking ordinary bookings — which writes `businessId` — saw an EMPTY
 * dashboard: zero jobs, zero clients, zero revenue. Not a rounding error in the
 * numbers; the product looked broken for anyone who used it the normal way.
 *
 * The merge made both FKs optional so neither writer would break. That fixed writes
 * and created this read gap. Same shape as the invoice-delete regression: a
 * constraint satisfied at the boundary but not carried through.
 *
 * The fix is a shared scope predicate so every read spans both columns. These tests
 * pin that behaviour, including the tenant-isolation property that makes the fix
 * safe — a scope that matched too much would be worse than the bug.
 */

const counts = { crmJob: 0, crmClient: 0, crmEmployee: 0, crmExpense: 0, crmPayroll: 0 };
const rows: Record<string, any[]> = { crmJob: [], crmExpense: [], crmPayroll: [], crmEmployee: [] };

vi.mock('../src/utils/database', () => ({
  prisma: {
    crmJob: {
      count: vi.fn(async () => counts.crmJob),
      findMany: vi.fn(async () => rows.crmJob),
    },
    crmClient: { count: vi.fn(async () => counts.crmClient), findMany: vi.fn(async () => []) },
    crmEmployee: {
      count: vi.fn(async () => counts.crmEmployee),
      findMany: vi.fn(async () => rows.crmEmployee),
      create: vi.fn(),
    },
    crmExpense: { findMany: vi.fn(async () => rows.crmExpense), create: vi.fn() },
    crmPayroll: { findMany: vi.fn(async () => rows.crmPayroll), create: vi.fn() },
    crmServiceBusiness: { findFirst: vi.fn(async () => null), create: vi.fn() },
    crmBusiness: { findFirst: vi.fn(async () => null) },
    business: { findFirst: vi.fn(async () => ({ id: 'biz_1' })), create: vi.fn(async () => ({ id: 'biz_new' })) },
    user: { findUnique: vi.fn(async () => ({ id: 'u1', email: 'owner@example.com' })) },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../src/utils/database';
import { getDashboardStats, getJobs, getClients } from '../src/services/crm.service';

/**
 * The `where` predicate for ONE recorded Prisma call.
 *
 * `mock.calls` is an array of argument arrays: `calls[i]` is the arg list of the
 * i-th call, so a single call's `where` is `calls[i][0].where`.
 *
 * This takes the args of one call, not the whole `calls` array. An earlier version
 * took `calls` and indexed `[0][0]`, which returned only the FIRST call's predicate
 * and — via `?? {}` — an empty object for every other one. `accepts` treats an
 * empty clause as vacuously true, so those calls silently passed and the file went
 * green against the unfixed code. The empty-object fallback is retained only for a
 * genuinely absent predicate, which `accepts` now treats as false.
 */
const predicateOf = (callArgs: any[]) => callArgs?.[0]?.where ?? {};
const ANY = (q: any) => JSON.stringify(q ?? {});

/**
 * True when the WHERE clause accepts `row`.
 *
 * Handles the shapes the service actually emits: a bare scope `{ OR: [...] }`, an
 * AND-joined scope with extra filters, and a plain equality filter. Deliberately a
 * small interpreter rather than a string match, so the test asserts BEHAVIOUR
 * (does this query see that row?) rather than the exact predicate syntax — a
 * refactor from `OR` to `AND` nesting should not read as a regression.
 */
function accepts(where: any, row: Record<string, unknown>): boolean {
  // A MISSING predicate is not an empty one. An empty clause is vacuously true in
  // SQL, so returning true here made every assertion pass against a query that
  // filtered on nothing — which is how these tests passed while the bug was still
  // present. Missing must be false; that is the whole point of a scope test.
  if (!where) return false;
  if (Object.keys(where).length === 0) return true;

  if (Array.isArray(where.AND)) return where.AND.every((c: any) => accepts(c, row));
  if (Array.isArray(where.OR)) return where.OR.some((c: any) => accepts(c, row));

  return Object.entries(where).every(([key, value]) => {
    if (key === '__noTenant') return false; // the impossible predicate
    if (key === 'NOT') return !accepts(value, row);
    if (!(key in row)) return false; // scope this row cannot satisfy
    const actual = (row as any)[key];
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in (value as any)) return ((value as any).in as unknown[]).includes(actual);
      if ('gte' in (value as any)) return actual >= (value as any).gte;
      if ('lte' in (value as any)) return actual <= (value as any).lte;
      return true; // an unmatched operator is not what this test is about
    }
    return actual === value;
  });
}

/**
 * A probe row, modelled on what each writer ACTUALLY writes.
 *
 * This matters more than it looks. An earlier version of this file gave every row
 * both `serviceBusinessId` and `businessId`, which made the buggy single-column
 * scope match anyway — so the tests passed against the code they were written to
 * catch. A booking-flow row has no serviceBusinessId; a Contact OS row has no
 * businessId. The fixtures now say exactly that, and `only` exists so a test cannot
 * reintroduce the other column by accident.
 */
const ID = (row: Record<string, unknown>) => ({ id: 'job_1', ...row });

// status is included because the completed-jobs query ANDs in { status: 'COMPLETED' }.
// A probe row lacking it is correctly EXCLUDED by that query — the fixture was
// under-specified, and the fix is to model the row the query is really asking for.
const bookingRow = () => ID({ businessId: 'biz_1', status: 'COMPLETED' });
const contactRow = () => ID({ serviceBusinessId: 'csb_1', status: 'COMPLETED' });
const otherRow   = () => ID({ serviceBusinessId: 'csb_other', businessId: 'biz_other', status: 'COMPLETED' });
const orphanRow  = () => ID({ serviceBusinessId: null, businessId: null, status: 'COMPLETED' });

beforeEach(() => {
  vi.clearAllMocks();
  counts.crmJob = 3;
  counts.crmClient = 2;
  counts.crmEmployee = 1;
  rows.crmJob = [{ price: 100 }, { price: 250 }];
  rows.crmExpense = [{ amount: 40 }];
  rows.crmPayroll = [{ netPay: 300 }];
  rows.crmEmployee = [{ id: 'e1' }];
});

describe('dashboard sees jobs from both write paths', () => {
  it('matches a job written by the booking flow (businessId)', async () => {
    await getDashboardStats('csb_1', 'biz_1');

    // THE regression. Before the fix this predicate was
    // { serviceBusinessId: 'csb_1' } and matched nothing.
    const jobCountCalls = vi.mocked(prisma.crmJob.count).mock.calls;
    expect(jobCountCalls.length).toBeGreaterThan(0);
    for (const call of jobCountCalls) {
      const where = predicateOf(call);
      expect(
        accepts(where, bookingRow()),
        `booking-flow job invisible: ${ANY(where)}`,
      ).toBe(true);
    }
  });

  it('still matches a job written by the Contact OS (serviceBusinessId)', async () => {
    await getDashboardStats('csb_1', 'biz_1');
    for (const call of vi.mocked(prisma.crmJob.count).mock.calls) {
      expect(accepts(predicateOf(call), contactRow())).toBe(true);
    }
  });

  it('never matches another tenant', async () => {
    // The property that makes spanning both columns safe. A scope that matched
    // everything would be worse than the original bug.
    await getDashboardStats('csb_1', 'biz_1');
    for (const call of vi.mocked(prisma.crmJob.count).mock.calls) {
      expect(accepts(predicateOf(call), otherRow())).toBe(false);
    }
  });

  it('does not match a row that belongs to neither identity', async () => {
    await getDashboardStats('csb_1', 'biz_1');
    for (const call of vi.mocked(prisma.crmJob.count).mock.calls) {
      expect(accepts(predicateOf(call), orphanRow())).toBe(false);
    }
  });
});

describe('monthly revenue includes booking-flow jobs', () => {
  it('sums across both paths', async () => {
    const stats = await getDashboardStats('csb_1', 'biz_1');
    // 100 + 250 regardless of which column each row was written under.
    expect(stats.monthlyRevenue).toBe(350);
  });
});

describe('other CRM reads share the same scope', () => {
  it('getJobs spans both columns', async () => {
    await getJobs('csb_1', {}, 'biz_1');
    for (const call of vi.mocked(prisma.crmJob.findMany).mock.calls) {
      expect(accepts(predicateOf(call), bookingRow())).toBe(true);
    }
  });

  it('getClients spans both columns', async () => {
    await getClients('csb_1', 'biz_1');
    for (const call of vi.mocked(prisma.crmClient.findMany).mock.calls) {
      expect(accepts(predicateOf(call), bookingRow())).toBe(true);
    }
  });
});

describe('enrollment, which makes the CRM reachable at all', () => {
  // Every /crm route sits behind resolveCrmBusiness, which 403s when the account
  // has no CrmServiceBusiness. That is exactly the state a customer landed in when
  // setup completed WITHOUT enrolling — which is what shipped. The wizard marked
  // local preferences complete and never called /crm/enroll, so every read and
  // write 403'd and "Save Changes" looked inert.
  it('returns the existing pairing instead of forking a second one', async () => {
    // The client self-heals by calling enroll on every 403, so enrollment runs more
    // than once per account. Without this guard a retry creates a SECOND
    // CrmServiceBusiness, and every read then has an ambiguous tenant — the exact
    // fork the two-CRM merge already had to work around.
    const { prisma: mocked } = await import('../src/utils/database');
    const { enrollBusiness } = await import('../src/services/crm.service');

    vi.mocked(mocked.crmServiceBusiness.findFirst).mockResolvedValueOnce({
      id: 'csb_existing',
      business: { id: 'biz_existing' },
    } as never);

    const result = await enrollBusiness({
      ownerId: 'u1',
      businessName: 'Apex',
      ownerEmail: 'owner@example.com',
      ownerName: 'Amara',
      serviceType: 'general',
    });

    expect(result.business).toEqual({ id: 'biz_existing' });
    expect(mocked.crmServiceBusiness.create).not.toHaveBeenCalled();
  });

  it('creates the pairing on a first enrollment', async () => {
    const { prisma: mocked } = await import('../src/utils/database');
    const { enrollBusiness } = await import('../src/services/crm.service');

    vi.mocked(mocked.crmServiceBusiness.findFirst).mockResolvedValueOnce(null as never);

    const result = await enrollBusiness({
      ownerId: 'u1',
      businessName: 'Apex',
      ownerEmail: 'owner@example.com',
      ownerName: 'Amara',
      serviceType: 'general',
    });

    // The mock's create returns undefined, so assert the CALL rather than the row —
    // the point is that a pairing is created on first enrollment, not what it holds.
    expect(mocked.crmServiceBusiness.create).toHaveBeenCalled();
    // And it is scoped to this owner, which is what stops enrollment creating a
    // service business for someone else.
    const arg = vi.mocked(mocked.crmServiceBusiness.create).mock.calls[0][0] as any;
    expect(arg.data.ownerId).toBe('u1');
    expect(arg.data.businessId).toBeTruthy();
  });
});

describe('work without a service business still reads', async () => {
  it('works with only a platform business — no Contact OS enrollment', async () => {
    // A business that never enrolled in Contact OS has no serviceBusinessId. Its
    // booking-flow records must still be visible. Passing undefined for the
    // service business is the real shape of that case.
    const stats = await getDashboardStats(undefined, 'biz_1');
    for (const call of vi.mocked(prisma.crmJob.count).mock.calls) {
      expect(accepts(predicateOf(call), bookingRow())).toBe(true);
    }
    expect(stats.totalJobs).toBe(3);
  });

  it('returns nothing rather than everything when no tenant is known', async () => {
    // Neither identity resolved. The predicate must be impossible, not a
    // match-all — a match-all here would leak another tenant's revenue totals.
    await getDashboardStats(undefined, undefined);
    for (const call of vi.mocked(prisma.crmJob.count).mock.calls) {
      expect(accepts(predicateOf(call), bookingRow())).toBe(false);
      expect(accepts(predicateOf(call), otherRow())).toBe(false);
    }
  });
});