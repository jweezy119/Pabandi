import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The two numbers every client displayed as zero.
 *
 * `CrmClient.totalJobs`, `totalSpent` and `lastJobAt` were rendered as a job count
 * and as LTV in the clients table and on the dashboard. Nothing ever wrote them.
 * The columns are not nullable and carry defaults of 0, so there was no error
 * anywhere — a lead added this morning and a customer of ten years displayed
 * identically, and both said zero.
 *
 * The fix derives them from the rows that define them. These tests pin the
 * definition, because the tempting wrong versions are all quiet: counting `sent`
 * invoices, counting cancelled jobs, and incrementing on the way in only are each
 * defensible-looking and each wrong.
 */

vi.mock('../src/utils/database', () => ({
  prisma: {
    crmJob: { findMany: vi.fn(), update: vi.fn() },
    invoice: { findMany: vi.fn() },
    crmClient: { update: vi.fn() },
  },
}));

import { prisma } from '../src/utils/database';
import { recomputeClientTotals } from '../src/services/crm.service';

const CLIENT = 'client_1';

/** The client row the recompute asked Prisma to write. */
function written() {
  return (prisma.crmClient.update as any).mock.calls[0][0].data;
}

function jobs(rows: Array<{ completedAt: Date | null }>) {
  (prisma.crmJob.findMany as any).mockResolvedValue(rows);
}
function invoices(rows: Array<{ subtotal: number | null }>) {
  (prisma.invoice.findMany as any).mockResolvedValue(rows);
}

beforeEach(() => {
  vi.clearAllMocks();
  jobs([]);
  invoices([]);
  (prisma.crmClient.update as any).mockResolvedValue({});
});

describe('recomputeClientTotals', () => {
  it('counts only COMPLETED jobs, asking the database to do the filtering', async () => {
    jobs([{ completedAt: new Date('2026-01-01') }]);
    await recomputeClientTotals(CLIENT);

    const where = (prisma.crmJob.findMany as any).mock.calls[0][0].where;
    expect(where).toEqual({ clientId: CLIENT, status: 'COMPLETED' });
    expect(written().totalJobs).toBe(1);
  });

  it('sums only PAID invoices — an issued invoice is not revenue', async () => {
    invoices([{ subtotal: 100 }, { subtotal: 50.5 }]);
    await recomputeClientTotals(CLIENT);

    const where = (prisma.invoice.findMany as any).mock.calls[0][0].where;
    expect(where).toEqual({ clientId: CLIENT, status: 'paid' });
    expect(written().totalSpent).toBe(150.5);
  });

  it('reads 0 rather than null for a client with no history', async () => {
    await recomputeClientTotals(CLIENT);
    // The column is a non-nullable Float, so a null here is a write-time failure
    // rather than a zero.
    expect(written().totalSpent).toBe(0);
    expect(written().totalJobs).toBe(0);
  });

  it('leaves lastJobAt null when nothing completed', async () => {
    await recomputeClientTotals(CLIENT);
    expect(written().lastJobAt).toBeNull();
  });

  it('takes the latest completion, not the most recent row returned', async () => {
    jobs([
      { completedAt: new Date('2026-03-01') },
      { completedAt: new Date('2026-01-01') },
      { completedAt: new Date('2026-02-01') },
    ]);
    await recomputeClientTotals(CLIENT);
    expect(written().lastJobAt).toEqual(new Date('2026-03-01'));
  });

  it('ignores a completed job whose timestamp is null instead of producing NaN', async () => {
    jobs([{ completedAt: null }, { completedAt: new Date('2026-02-01') }]);
    await recomputeClientTotals(CLIENT);

    // MAX() in SQL skips nulls; the in-memory reduce has to as well, or a single
    // un-timestamped row poisons the date.
    expect(written().lastJobAt).toEqual(new Date('2026-02-01'));
    expect(written().totalJobs).toBe(2);
  });

  it('treats a null subtotal as zero rather than making the whole total null', async () => {
    invoices([{ subtotal: 100 }, { subtotal: null }]);
    await recomputeClientTotals(CLIENT);
    expect(written().totalSpent).toBe(100);
  });
});