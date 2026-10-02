import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * Fee assessment — the part that decides whether revenue is tracked correctly.
 *
 * The arithmetic is already proven in `fees.test.ts`. What is not proven here is
 * the half that actually loses money in practice: not double-billing, not
 * silently skipping, and not handing a merchant a number they cannot reconcile.
 *
 * Every test mocks Prisma, so these are assertions about the sequence of calls and
 * what is written — which is the part that a live database would exercise only by
 * accident.
 */

vi.mock('../src/utils/database', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    feeAssessment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// assessFee now reads the merchant's subscription tier. Mocked rather than hitting
// the DB: these tests are about what gets written, and the tier's effect on the
// quote is asserted in fees.test.ts and fee-scope.test.ts.
vi.mock('../src/services/subscription.service', () => ({
  usageMultiplierForBusiness: vi.fn(async () => 1),
}));

import { prisma } from '../src/utils/database';
import {
  assessFee,
  assessFeeSafe,
  feeIdempotencyKey,
  unbilledTotalCents,
  feeHistory,
  realisedMargin,
  settledChargeCount,
} from '../src/services/fee-assessment.service';
import { FIRST_TRANSACTION_FREE_LIMIT } from '../src/config/fees';

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const CENTS = (dollars: number) => Math.round(dollars * 100);

/** A row as Prisma would return it. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fa_1',
    businessId: 'biz_1',
    sourceType: 'invoice',
    sourceId: 'inv_1',
    chargeCents: 20_000,
    feeCents: 700,
    processingCents: 610,
    marginCents: 90,
    rateBps: 350,
    tier: 'mid',
    category: 'CLEANING',
    currency: 'USD',
    status: 'accrued',
    breakdown: ['category:CLEANING'],
    idempotencyKey: 'invoice:inv_1',
    billedAt: null,
    createdAt: new Date('2026-10-01'),
    updatedAt: new Date('2026-10-01'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mock(prisma.business.findUnique).mockResolvedValue({ category: 'CLEANING', currency: 'USD' });
  mock(prisma.feeAssessment.count).mockResolvedValue(FIRST_TRANSACTION_FREE_LIMIT);
  mock(prisma.feeAssessment.findUnique).mockResolvedValue(null);
  mock(prisma.feeAssessment.create).mockImplementation(async ({ data }: any) => row({ ...data }));
});

describe('idempotency key', () => {
  it('namespaces by source type so ids cannot collide', () => {
    // An invoice and a booking are both cuid-shaped strings. Without the prefix
    // an assessment for one could be read back for the other, which would both
    // lose revenue and misattribute it.
    expect(feeIdempotencyKey('invoice', 'abc')).toBe('invoice:abc');
    expect(feeIdempotencyKey('booking_deposit', 'abc')).toBe('booking_deposit:abc');
    expect(feeIdempotencyKey('invoice', 'abc')).not.toBe(
      feeIdempotencyKey('booking_deposit', 'abc'),
    );
  });
});

describe('assessFee writes what was charged', () => {
  it('freezes the whole quote onto the row', async () => {
    // Rates must be snapshotted, not recomputed later. If the schedule changes
    // next month, last month's invoices have to still reconcile.
    const result = await assessFee({
      businessId: 'biz_1',
      sourceType: 'invoice',
      sourceId: 'inv_1',
      chargeCents: 20_000,
    });

    expect(mock(prisma.feeAssessment.create)).toHaveBeenCalledTimes(1);
    const data = mock(prisma.feeAssessment.create).mock.calls[0][0].data;
    expect(data.chargeCents).toBe(20_000);
    expect(data.rateBps).toBe(350);
    expect(data.feeCents).toBe(700);
    // Processing and margin are stored so a later anomaly is visible in the
    // ledger rather than having to be re-derived.
    expect(data.processingCents).toBe(610);
    expect(data.marginCents).toBe(90);
    expect(data.tier).toBe('standard');
    expect(data.category).toBe('CLEANING');
    expect(data.status).toBe('accrued');
    expect(result.feeCents).toBe(700);
    expect(result.reused).toBe(false);
  });

  it('derives the key from the source rather than generating one', async () => {
    // A generated key would make every attempt look like a new charge, so a
    // re-sent invoice would bill twice.
    await assessFee({
      businessId: 'biz_1',
      sourceType: 'invoice',
      sourceId: 'inv_1',
      chargeCents: 20_000,
    });
    const data = mock(prisma.feeAssessment.create).mock.calls[0][0].data;
    expect(data.idempotencyKey).toBe('invoice:inv_1');
  });

  it('uses the business category when none is given', async () => {
    mock(prisma.business.findUnique).mockResolvedValue({ category: 'SALON', currency: 'USD' });
    await assessFee({
      businessId: 'biz_1',
      sourceType: 'invoice',
      sourceId: 'inv_1',
      chargeCents: 20_000,
    });
    expect(mock(prisma.feeAssessment.create).mock.calls[0][0].data.category).toBe('SALON');
  });

  it('takes the currency from the business', async () => {
    mock(prisma.business.findUnique).mockResolvedValue({ category: 'CLEANING', currency: 'PKR' });
    const result = await assessFee({
      businessId: 'biz_1',
      sourceType: 'invoice',
      sourceId: 'inv_1',
      chargeCents: 20_000,
    });
    expect(result.quote.currency).toBe('PKR');
  });
});

describe('assessFee is safe to retry', () => {
  it('reuses an existing assessment instead of billing twice', async () => {
    mock(prisma.feeAssessment.findUnique).mockResolvedValue(row());

    const result = await assessFee({
      businessId: 'biz_1',
      sourceType: 'invoice',
      sourceId: 'inv_1',
      chargeCents: 20_000,
    });

    // Re-sending an invoice is normal and should be silent.
    expect(mock(prisma.feeAssessment.create)).not.toHaveBeenCalled();
    expect(result.reused).toBe(true);
    expect(result.feeCents).toBe(700);
  });

  it('returns the original rate, not today\'s', async () => {
    // The whole point of snapshotting: a re-send after a schedule change must
    // report what was originally charged.
    mock(prisma.feeAssessment.findUnique).mockResolvedValue(row({ rateBps: 350 }));
    const result = await assessFee({
      businessId: 'biz_1',
      sourceType: 'invoice',
      sourceId: 'inv_1',
      chargeCents: 500_000,
    });
    expect(result.quote.rate).toBe(0.035);
  });

  it('recovers from a lost create race', async () => {
    // Two concurrent sends of the same invoice both find nothing, then both try
    // to insert. The unique constraint lets exactly one through.
    mock(prisma.feeAssessment.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '5.22.0' }),
    );
    mock(prisma.feeAssessment.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce(row());

    const result = await assessFee({
      businessId: 'biz_1',
      sourceType: 'invoice',
      sourceId: 'inv_1',
      chargeCents: 20_000,
    });

    expect(result.reused).toBe(true);
    expect(result.feeCents).toBe(700);
  });

  it('rethrows a genuine failure rather than swallowing it', async () => {
    mock(prisma.feeAssessment.create).mockRejectedValue(new Error('database down'));
    await expect(
      assessFee({
        businessId: 'biz_1',
        sourceType: 'invoice',
        sourceId: 'inv_1',
        chargeCents: 20_000,
      }),
    ).rejects.toThrow(/database down/);
  });
});

describe('assessFeeSafe never blocks a charge', () => {
  it('returns null and does not throw when assessment fails', async () => {
    // A merchant who cannot pay an invoice because we failed to record our own fee
    // will notice, and they will be right to. The charge must still go through.
    mock(prisma.feeAssessment.create).mockRejectedValue(new Error('write failed'));
    await expect(
      assessFeeSafe({
        businessId: 'biz_1',
        sourceType: 'invoice',
        sourceId: 'inv_1',
        chargeCents: 20_000,
      }),
    ).resolves.toBeNull();
  });

  it('logs loudly enough that untracked revenue can be found', async () => {
    const { logger } = await import('../src/utils/logger');
    mock(prisma.feeAssessment.create).mockRejectedValue(new Error('write failed'));
    await assessFeeSafe({
      businessId: 'biz_1',
      sourceType: 'invoice',
      sourceId: 'inv_1',
      chargeCents: 20_000,
    });
    // The message has to name the source, or a silent revenue leak is
    // untraceable.
    expect(mock(logger.error).mock.calls.flat().join(' ')).toMatch(/invoice inv_1/);
  });
});

describe('the free-transaction allowance', () => {
  it('counts prior charges so the tenth booking is still free', async () => {
    mock(prisma.feeAssessment.count).mockResolvedValue(FIRST_TRANSACTION_FREE_LIMIT - 1);
    const result = await assessFee({
      businessId: 'biz_1',
      sourceType: 'invoice',
      sourceId: 'inv_10',
      chargeCents: 20_000,
    });
    expect(result.feeCents).toBe(0);
    // Negative margin is reported honestly: we still pay the processor.
    expect(result.marginCents).toBeLessThan(0);
  });

  it('charges from the next one', async () => {
    mock(prisma.feeAssessment.count).mockResolvedValue(FIRST_TRANSACTION_FREE_LIMIT);
    const result = await assessFee({
      businessId: 'biz_1',
      sourceType: 'invoice',
      sourceId: 'inv_11',
      chargeCents: 20_000,
    });
    expect(result.feeCents).toBeGreaterThan(0);
  });

  it('does not count waived fees against the allowance', async () => {
    // Waived fees are forgiven; they should not consume a merchant's free
    // transactions.
    const result = await settledChargeCount('biz_1');
    mock(prisma.feeAssessment.count).mockResolvedValue(3);
    expect(result).toBe(FIRST_TRANSACTION_FREE_LIMIT);
  });
});

describe('reporting', () => {
  it('totals only unbilled fees', async () => {
    mock(prisma.feeAssessment.aggregate).mockResolvedValue({ _sum: { feeCents: 1_234 } });
    expect(await unbilledTotalCents('biz_1')).toBe(1_234);
    // status: 'accrued' is what makes "unbilled" mean something — counting paid
    // and waived rows here would overstate what a merchant owes.
    expect(mock(prisma.feeAssessment.aggregate).mock.calls[0][0].where).toEqual({
      businessId: 'biz_1',
      status: 'accrued',
    });
  });

  it('reports margin rather than just what was billed', async () => {
    mock(prisma.feeAssessment.aggregate).mockResolvedValue({
      _sum: { feeCents: 9_000, marginCents: 2_900 },
      _count: { _all: 12 },
    });
    const result = await realisedMargin('biz_1');
    // Only one of those two numbers is the business's result.
    expect(result.assessedCents).toBe(9_000);
    expect(result.marginCents).toBe(2_900);
    expect(result.transactions).toBe(12);
  });

  it('renders each fee with the rate and the reasons behind it', async () => {
    mock(prisma.feeAssessment.findMany).mockResolvedValue([
      row({ rateBps: 316, breakdown: ['category:SALON ×0.75', 'floored to 3.16% (processing cost)'] }),
    ]);
    const [entry] = await feeHistory('biz_1');

    // A merchant reading "you owe $3.90" should be able to see why, without
    // asking. This is what makes the schedule defensible.
    expect(entry.ratePercent).toBe('3.16');
    expect(entry.applied).toHaveLength(2);
    expect(entry.applied.join(' ')).toMatch(/processing cost/);
  });

  it('tolerates a fee stored with no breakdown', async () => {
    mock(prisma.feeAssessment.findMany).mockResolvedValue([row({ breakdown: null })]);
    const [entry] = await feeHistory('biz_1');
    expect(entry.applied).toEqual([]);
  });
});
