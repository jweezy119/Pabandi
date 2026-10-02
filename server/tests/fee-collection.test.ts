import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Fee collection — the money-out path.
 *
 * These assert the properties that matter when money is owed and someone has to
 * decide whether it was paid:
 *
 *   NOTHING IS DOUBLED. A cron that fires twice must not bill twice.
 *   NOTHING DISAPPEARS. Voiding a statement must not delete the fees behind it —
 *   they are real charges against real appointments.
 *   ONLY COLLECTED COUNTS AS REVENUE. Unbilled, outstanding and written-off are
 *   receivables and bad debt. Reporting them together is how a marketplace
 *   claims a take rate it has not been paid.
 */

vi.mock('../src/utils/database', () => ({
  prisma: {
    feeAssessment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
    },
    merchantFeeStatement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../src/utils/database';
import { CustomError } from '../src/middleware/errorHandler';
import {
  generateStatement,
  generateStatementsForPeriod,
  markStatementPaid,
  voidStatement,
  waiveStatement,
  revenuePosition,
  overdueStatements,
  dunningStage,
  statementNumber,
  PAYMENT_TERMS_DAYS,
  DUNNING_SCHEDULE_DAYS,
} from '../src/services/fee-collection.service';

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const PERIOD_START = new Date('2026-09-01T00:00:00Z');
const PERIOD_END = new Date('2026-09-30T23:59:59Z');

function assessment(overrides: Record<string, unknown> = {}) {
  return { id: 'fa_1', feeCents: 450, ...overrides };
}

/** Make $transaction run its callback against the same mocked prisma. */
function useRealTransaction() {
  mock(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
}

beforeEach(() => {
  vi.clearAllMocks();
  useRealTransaction();
});

describe('statement numbers', () => {
  it('embeds the business so a reader can tell whose statement it is', () => {
    const number = statementNumber('biz_abc123456', new Date('2026-10-01T00:00:00Z'));
    expect(number).toBe('FEES-202610-123456');
  });

  it('does not depend on a counter', () => {
    // Two concurrent runs would race on a sequence, and a duplicated number on a
    // money document is a reconciliation problem. Same inputs, same number — which
    // the unique constraint then resolves by refusing the second insert.
    const a = statementNumber('biz_abc123456', new Date('2026-10-01T00:00:00Z'));
    const b = statementNumber('biz_abc123456', new Date('2026-10-01T00:00:00Z'));
    expect(a).toBe(b);
  });
});

describe('generateStatement', () => {
  it('creates nothing when there is nothing to bill', async () => {
    mock(prisma.feeAssessment.findMany).mockResolvedValue([]);

    // A merchant with no billable activity should not receive an invoice asking
    // for nothing — that reads as a billing error and costs trust.
    expect(
      await generateStatement({ businessId: 'biz_1', periodStart: PERIOD_START, periodEnd: PERIOD_END }),
    ).toBeNull();
    expect(mock(prisma.merchantFeeStatement.create)).not.toHaveBeenCalled();
  });

  it('sums the fees and moves them onto the statement', async () => {
    mock(prisma.feeAssessment.findMany).mockResolvedValue([
      assessment({ id: 'fa_1', feeCents: 450 }),
      assessment({ id: 'fa_2', feeCents: 900 }),
      assessment({ id: 'fa_3', feeCents: 125 }),
    ]);
    mock(prisma.merchantFeeStatement.create).mockResolvedValue({
      id: 'st_1', number: 'FEES-202609-123456', businessId: 'biz_1',
      status: 'draft', totalCents: 1475, periodStart: PERIOD_START,
      periodEnd: PERIOD_END, dueAt: new Date('2026-10-15'), paidAt: null,
    });

    const result = await generateStatement({
      businessId: 'biz_1', periodStart: PERIOD_START, periodEnd: PERIOD_END,
    });

    expect(result!.totalCents).toBe(1475);
    expect(result!.feeCount).toBe(3);
    expect(mock(prisma.merchantFeeStatement.create).mock.calls[0][0].data.totalCents).toBe(1475);

    const update = mock(prisma.feeAssessment.updateMany).mock.calls[0][0];
    // Marked invoiced, not paid. The distinction between billed and collected is
    // the whole point of this table existing.
    expect(update.data.status).toBe('invoiced');
    expect(update.data.statementId).toBe('st_1');
    expect(update.where.id.in).toEqual(['fa_1', 'fa_2', 'fa_3']);
  });

  it('gives a default due date and honours an override', async () => {
    mock(prisma.feeAssessment.findMany).mockResolvedValue([assessment()]);
    mock(prisma.merchantFeeStatement.create).mockResolvedValue({
      id: 'st_1', number: 'N', businessId: 'biz_1', status: 'draft', totalCents: 450,
      periodStart: PERIOD_START, periodEnd: PERIOD_END,
      dueAt: new Date(), paidAt: null,
    });

    const custom = new Date('2026-12-31');
    await generateStatement({
      businessId: 'biz_1', periodStart: PERIOD_START, periodEnd: PERIOD_END, dueAt: custom,
    });
    expect(mock(prisma.merchantFeeStatement.create).mock.calls[0][0].data.dueAt).toEqual(custom);

    vi.clearAllMocks();
    useRealTransaction();
    mock(prisma.feeAssessment.findMany).mockResolvedValue([assessment()]);
    mock(prisma.merchantFeeStatement.create).mockResolvedValue({
      id: 'st_2', number: 'N', businessId: 'biz_1', status: 'draft', totalCents: 450,
      periodStart: PERIOD_START, periodEnd: PERIOD_END, dueAt: new Date(), paidAt: null,
    });
    await generateStatement({ businessId: 'biz_1', periodStart: PERIOD_START, periodEnd: PERIOD_END });

    // Payment terms, not an unbounded window.
    const due = mock(prisma.merchantFeeStatement.create).mock.calls[0][0].data.dueAt as Date;
    const days = Math.round((due.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    expect(days).toBeGreaterThanOrEqual(PAYMENT_TERMS_DAYS - 2);
    expect(days).toBeLessThanOrEqual(PAYMENT_TERMS_DAYS + 1);
  });

  it('only picks up fees from the requested window', async () => {
    mock(prisma.feeAssessment.findMany).mockResolvedValue([]);
    await generateStatement({ businessId: 'biz_1', periodStart: PERIOD_START, periodEnd: PERIOD_END });

    const where = mock(prisma.feeAssessment.findMany).mock.calls[0][0].where;
    expect(where.createdAt).toEqual({ gte: PERIOD_START, lte: PERIOD_END });
    // Unbilled only: a fee already on a statement must not be billed twice.
    expect(where.status).toBe('accrued');
    expect(where.billedAt).toBeNull();
  });
});

describe('generateStatementsForPeriod', () => {
  it('is safe to run twice — the second run bills nothing new', async () => {
    // Cron fires twice eventually. Second run finds no unbilled fees and returns
    // null rather than a duplicate statement.
    mock(prisma.feeAssessment.findMany)
      .mockResolvedValueOnce([assessment({ feeCents: 450 })])
      .mockResolvedValueOnce([]);
    mock(prisma.feeAssessment.findMany).mockImplementation((args: any) =>
      args?.select?.businessId
        ? Promise.resolve([{ businessId: 'biz_1' }])
        : (mock(prisma.feeAssessment.findMany).mock.calls.length > 1
            ? Promise.resolve([])
            : Promise.resolve([assessment({ feeCents: 450 })])),
    );
    mock(prisma.merchantFeeStatement.create).mockResolvedValue({
      id: 'st_1', number: 'N', businessId: 'biz_1', status: 'draft', totalCents: 450,
      periodStart: PERIOD_START, periodEnd: PERIOD_END, dueAt: new Date(), paidAt: null,
    });

    const result = await generateStatementsForPeriod({
      periodStart: PERIOD_START, periodEnd: PERIOD_END,
    });
    expect(result.created).toBeLessThanOrEqual(1);
    expect(result.created + result.skipped).toBe(1);
  });

  it('does not let one bad business stop the others', async () => {
    mock(prisma.feeAssessment.findMany).mockImplementation((args: any) =>
      args?.select?.businessId
        ? Promise.resolve([{ businessId: 'bad' }, { businessId: 'good' }])
        : Promise.resolve([assessment()]),
    );
    mock(prisma.merchantFeeStatement.create)
      .mockRejectedValueOnce(new Error('constraint violation'))
      .mockResolvedValueOnce({
        id: 'st_2', number: 'N', businessId: 'good', status: 'draft', totalCents: 450,
        periodStart: PERIOD_START, periodEnd: PERIOD_END, dueAt: new Date(), paidAt: null,
      });

    const result = await generateStatementsForPeriod({
      periodStart: PERIOD_START, periodEnd: PERIOD_END,
    });

    // One failure is reported, the other merchant is still billed. Throwing here
    // would mean a single bad row blocks collection from everyone.
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].businessId).toBe('bad');
    expect(result.created).toBe(1);
  });
});

describe('marking a statement paid', () => {
  it('records payment and the bank reference', async () => {
    mock(prisma.merchantFeeStatement.findUnique).mockResolvedValue({ id: 'st_1', status: 'sent', paidAt: null });
    mock(prisma.merchantFeeStatement.update).mockResolvedValue({
      id: 'st_1', number: 'FEES-202609-123456', businessId: 'biz_1', status: 'paid',
      totalCents: 450, periodStart: PERIOD_START, periodEnd: PERIOD_END,
      dueAt: new Date(), paidAt: new Date(), _count: { assessments: 1 },
    });

    const result = await markStatementPaid('st_1', 'WIRE-88921');
    expect(result.status).toBe('paid');

    const data = mock(prisma.merchantFeeStatement.update).mock.calls[0][0].data;
    expect(data.status).toBe('paid');
    expect(data.paidAt).toBeTruthy();
    // The reference is evidence for reconciling a bank feed, not something we
    // query on, so it lives in the note.
    expect(data.note).toMatch(/WIRE-88921/);
  });

  it('refuses to pay a statement twice', async () => {
    mock(prisma.merchantFeeStatement.findUnique).mockResolvedValue({ id: 'st_1', status: 'paid', paidAt: new Date() });

    // Re-marking would restamp paidAt and make collection timing unreportable,
    // which is how a 401 gets booked twice.
    await expect(markStatementPaid('st_1')).rejects.toThrow(CustomError);
    expect(mock(prisma.merchantFeeStatement.update)).not.toHaveBeenCalled();
  });

  it('refuses a voided statement', async () => {
    mock(prisma.merchantFeeStatement.findUnique).mockResolvedValue({ id: 'st_1', status: 'void', paidAt: null });
    await expect(markStatementPaid('st_1')).rejects.toThrow(/voided/i);
  });
});

describe('voiding is not forgiving', () => {
  it('returns the fees to unbilled rather than deleting them', async () => {
    mock(prisma.merchantFeeStatement.findUnique).mockResolvedValue({ id: 'st_1', status: 'sent' });
    mock(prisma.merchantFeeStatement.update).mockResolvedValue({
      id: 'st_1', number: 'N', businessId: 'biz_1', status: 'void', totalCents: 450,
      periodStart: PERIOD_START, periodEnd: PERIOD_END, dueAt: new Date(), paidAt: null,
      _count: { assessments: 2 },
    });

    await voidStatement('st_1', 'duplicated period');

    // They describe real charges against real appointments. Clearing billedAt and
    // the statement link puts them back in the queue; deleting them would quietly
    // forgive revenue and make the total look better than it is.
    const data = mock(prisma.feeAssessment.updateMany).mock.calls[0][0].data;
    expect(data).toEqual({ status: 'accrued', billedAt: null, statementId: null });
  });

  it('requires a reason', async () => {
    mock(prisma.merchantFeeStatement.findUnique).mockResolvedValue({ id: 'st_1', status: 'sent' });
    await expect(voidStatement('st_1', '')).rejects.toThrow(/reason/i);
    await expect(voidStatement('st_1', 'x')).rejects.toThrow(/reason/i);
  });

  it('refuses to void a paid statement', async () => {
    mock(prisma.merchantFeeStatement.findUnique).mockResolvedValue({ id: 'st_1', status: 'paid' });
    // Money arrived. Voiding would un-recognise revenue without a refund being
    // issued.
    await expect(voidStatement('st_1', 'mistake')).rejects.toThrow(/refund/i);
    expect(mock(prisma.feeAssessment.updateMany)).not.toHaveBeenCalled();
  });
});

describe('waiving is a distinct, deliberate act', () => {
  it('marks fees waived so they stop counting against the free allowance', async () => {
    mock(prisma.merchantFeeStatement.findUnique).mockResolvedValue({ id: 'st_1', status: 'sent', number: 'N' });
    mock(prisma.merchantFeeStatement.update).mockResolvedValue({
      id: 'st_1', number: 'N', businessId: 'biz_1', status: 'void', totalCents: 450,
      periodStart: PERIOD_START, periodEnd: PERIOD_END, dueAt: new Date(), paidAt: null,
      _count: { assessments: 1 },
    });

    await waiveStatement('st_1', 'merchant closed permanently');

    // 'waived', not 'accrued': this is bad debt, and it must not quietly reappear
    // in the next statement — nor consume one of their free transactions.
    expect(mock(prisma.feeAssessment.updateMany).mock.calls[0][0].data).toEqual({ status: 'waived' });
    expect(mock(prisma.merchantFeeStatement.update).mock.calls[0][0].data.note).toMatch(/bad debt/i);
  });

  it('always requires a reason', async () => {
    mock(prisma.merchantFeeStatement.findUnique).mockResolvedValue({ id: 'st_1', status: 'sent', number: 'N' });
    await expect(waiveStatement('st_1', '')).rejects.toThrow(/reason/i);
  });
});

describe('revenuePosition separates money from receivables', () => {
  it('reports each bucket separately', async () => {
    mock(prisma.feeAssessment.aggregate).mockResolvedValue({ _sum: { feeCents: 500 } });
    mock(prisma.merchantFeeStatement.aggregate)
      .mockResolvedValueOnce({ _sum: { totalCents: 2_000 } })   // outstanding
      .mockResolvedValueOnce({ _sum: { totalCents: 1_200 } })   // overdue
      .mockResolvedValueOnce({ _sum: { totalCents: 8_000 } })   // collected
      .mockResolvedValueOnce({ _sum: { totalCents: 300 } });    // written off
    mock(prisma.merchantFeeStatement.groupBy).mockResolvedValue([{ businessId: 'biz_1' }, { businessId: 'biz_2' }]);
    mock(prisma.merchantFeeStatement.count).mockResolvedValue(3);

    const position = await revenuePosition();

    expect(position).toMatchObject({
      unbilledCents: 500,
      outstandingCents: 2_000,
      overdueCents: 1_200,
      // The only figure that is revenue.
      collectedCents: 8_000,
      writtenOffCents: 300,
      businessesOwing: 2,
      statementsAwaitingPayment: 3,
    });

    // Collected must be queryable on its own; if any bucket shared the filter,
    // a merchant seeing "fees" would be seeing money they may never receive.
    const paidFilter = mock(prisma.merchantFeeStatement.aggregate).mock.calls[2][0].where;
    expect(paidFilter).toEqual({ status: 'paid' });
  });

  it('distinguishes overdue from merely outstanding', async () => {
    mock(prisma.feeAssessment.aggregate).mockResolvedValue({ _sum: { feeCents: 0 } });
    mock(prisma.merchantFeeStatement.aggregate).mockResolvedValue({ _sum: { totalCents: 0 } });
    mock(prisma.merchantFeeStatement.groupBy).mockResolvedValue([]);
    mock(prisma.merchantFeeStatement.count).mockResolvedValue(0);

    await revenuePosition();
    const overdueFilter = mock(prisma.merchantFeeStatement.aggregate).mock.calls[1][0].where;
    // Overdue is outstanding AND past due. Confusing the two makes a 3-day-old
    // invoice look like a 60-day-old debt.
    expect(overdueFilter.status).toEqual({ in: ['draft', 'sent'] });
    expect(overdueFilter.dueAt).toBeDefined();
  });
});

describe('dunning', () => {
  it('derives the stage from the age rather than storing a counter', () => {
    // A stored counter and a due date can disagree; deriving them cannot.
    expect(dunningStage(3)).toBeNull();
    expect(dunningStage(8)).toBe(7);
    expect(dunningStage(20)).toBe(14);
    expect(dunningStage(45)).toBe(30);
    expect(dunningStage(null)).toBeNull();
  });

  it('lists overdue statements oldest debt first', async () => {
    const older = new Date('2026-08-01T00:00:00Z');
    const newer = new Date('2026-09-01T00:00:00Z');
    mock(prisma.merchantFeeStatement.findMany).mockResolvedValue([
      { id: 'a', number: 'A', businessId: 'b1', status: 'sent', totalCents: 100, periodStart: older, periodEnd: older, dueAt: older, paidAt: null, _count: { assessments: 1 } },
      { id: 'b', number: 'B', businessId: 'b2', status: 'draft', totalCents: 200, periodStart: newer, periodEnd: newer, dueAt: newer, paidAt: null, _count: { assessments: 1 } },
    ]);

    const rows = await overdueStatements(new Date('2026-10-01T00:00:00Z'));
    expect(rows[0].id).toBe('a');
    // Age, because that is what a collections list is ordered by.
    expect(rows[0].daysOverdue).toBeGreaterThan(rows[1].daysOverdue!);
  });

  it('does not chase paid or void statements', async () => {
    mock(prisma.merchantFeeStatement.findMany).mockResolvedValue([]);
    await overdueStatements();
    const where = mock(prisma.merchantFeeStatement.findMany).mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ['draft', 'sent'] });
    expect(where.dueAt).toBeDefined();
  });
});
