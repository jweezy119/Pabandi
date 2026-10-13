import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Two search boxes that returned the same rows as no search box.
 *
 * The invoices list has sent `?search=` on every keystroke since it was written. The
 * route destructured `{ status }`, ignored everything else, and the client rendered
 * the unfiltered array it was handed with no filter of its own.
 *
 * The jobs list is the mirror image, and worse. It is the only page in the CRM that
 * sends query params at all: `search`, `sortBy`, `sortOrder`, and
 * `scheduledDate_gte`/`scheduledDate_lte` for the four date chips. The handler read
 * `dateFrom`/`dateTo` and nothing else. Every parameter was discarded, so search,
 * both sort directions and all four date filters were inert — and each control still
 * showed its selection, so the page looked like it was filtering.
 *
 * The parameter names are pinned here on purpose. This bug was two codebases agreeing
 * on nothing while each looked correct in isolation, which is exactly the kind of
 * mismatch that a "does it 200" test passes straight through.
 */

vi.mock('../../src/utils/database', () => ({
  prisma: { invoice: { findMany: vi.fn() }, crmJob: { findMany: vi.fn() } },
}));

import { getJobs } from '../../src/services/crm.service';
import { prisma } from '../../src/utils/database';

const SVC = 'svc_1';

function jobArgs() {
  const calls = (prisma.crmJob.findMany as any).mock.calls;
  return calls[calls.length - 1][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.crmJob.findMany as any).mockResolvedValue([]);
});

describe('getJobs honours the parameters the jobs page actually sends', () => {
  it('applies free-text search across the fields a person recognises a job by', async () => {
    await getJobs(SVC, { search: 'deep clean' });
    const or = jobArgs().where.AND[1].OR;

    expect(or).toContainEqual({ clientName: { contains: 'deep clean', mode: 'insensitive' } });
    expect(or).toContainEqual({ serviceType: { contains: 'deep clean', mode: 'insensitive' } });
    expect(or).toContainEqual({ address: { contains: 'deep clean', mode: 'insensitive' } });
    expect(or).toContainEqual({ client: { is: { name: { contains: 'deep clean', mode: 'insensitive' } } } });
  });

  it('ignores a whitespace-only search rather than filtering on " "', async () => {
    await getJobs(SVC, { search: '   ' });
    // Every non-blank string contains a space, so this would empty the list.
    expect(jobArgs().where.AND).toHaveLength(1);
  });

  it('sorts by a whitelisted column in the requested direction', async () => {
    await getJobs(SVC, { sortBy: 'price', sortOrder: 'asc' });
    expect(jobArgs().orderBy).toEqual({ price: 'asc' });

    await getJobs(SVC, { sortBy: 'price', sortOrder: 'desc' });
    expect(jobArgs().orderBy).toEqual({ price: 'desc' });
  });

  it('sorts by client name through the relation', async () => {
    await getJobs(SVC, { sortBy: 'clientName', sortOrder: 'asc' });
    // `clientName` is a denormalised column AND a relation exists; sorting by the
    // relation is what keeps a renamed client ordered by their current name.
    expect(jobArgs().orderBy).toEqual({ client: { name: 'asc' } });
  });

  it('ignores an unknown sort column instead of passing it to Prisma', async () => {
    await getJobs(SVC, { sortBy: 'reliabilityScore', sortOrder: 'asc' });
    // Unfiltered, this reaches orderBy and throws a 500 for a value that came from
    // a dropdown. Falling back to the default order is the recoverable outcome.
    expect(jobArgs().orderBy).toEqual({ scheduledDate: 'asc' });
  });

  it('defaults an unrecognised direction to desc rather than trusting it', async () => {
    await getJobs(SVC, { sortBy: 'scheduledDate', sortOrder: 'ascending; DROP TABLE' });
    expect(jobArgs().orderBy).toEqual({ scheduledDate: 'desc' });
  });

  it('keeps the original date-only ordering when no sort is asked for', async () => {
    await getJobs(SVC, {});
    expect(jobArgs().orderBy).toEqual({ scheduledDate: 'asc' });
  });

  it('applies the date range', async () => {
    await getJobs(SVC, { dateFrom: '2026-01-01', dateTo: '2026-01-31' });
    expect(jobArgs().where.AND).toContainEqual({ scheduledDate: { gte: new Date('2026-01-01') } });
    expect(jobArgs().where.AND).toContainEqual({ scheduledDate: { lte: new Date('2026-01-31') } });
  });

  it('filters by assigned employee, which the handler always passed and the service dropped', async () => {
    await getJobs(SVC, { employeeId: 'emp_1' });
    expect(jobArgs().where.AND).toContainEqual({ assignments: { some: { employeeId: 'emp_1' } } });
  });

  it('still scopes to the tenant when a search term is present', async () => {
    await getJobs(SVC, { search: 'x' });
    // The tenant scope and the search term are both OR groups. Sharing the OR key
    // means one silently replaces the other, and here the loser is the tenant
    // filter -- a search for "x" would return every job on the platform.
    const clauses = jobArgs().where.AND;
    expect(clauses[0].OR).toContainEqual({ serviceBusinessId: SVC });
    expect(clauses).toHaveLength(2);
  });

  it('never lets a search term widen the tenant', async () => {
    await getJobs(SVC, { search: 'x' }, 'biz_other');
    const clauses = jobArgs().where.AND;
    // Both anchors stay in the tenant clause; the search OR contains no anchor at all.
    expect(clauses[0].OR).toEqual(
      expect.arrayContaining([{ serviceBusinessId: SVC }, { businessId: 'biz_other' }]),
    );
  });
});