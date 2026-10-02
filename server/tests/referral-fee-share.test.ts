import { describe, it, expect, vi, beforeEach } from 'vitest';
import { referralFeeShareService } from '../src/services/referral-fee-share.service';
import { prisma } from '../src/utils/database';

/**
 * Referral fee share was paid twice.
 *
 * `creditReferrer` incremented PabWallet.balance when an invoice was paid AND
 * created a ReferralEarning with status 'pending'. `processMonthlyPayouts` then
 * incremented the same wallet rows again when flipping pending -> paid.
 * Nothing debits in between, so a referrer received the fee share twice: 10% of
 * invoice value rather than 5%, compounding monthly.
 *
 * These tests pin the corrected model: creditReferrer accrues, and the monthly
 * payout is the single place money reaches a wallet.
 */

vi.mock('../src/utils/database', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    pabReferral: { findFirst: vi.fn() },
    referralEarning: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    pabWallet: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    pabTransaction: { create: vi.fn() },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const REFERRER = 'user_referrer';
const REFEREE = 'user_referee';

function referral(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ref_1',
    referrerId: REFERRER,
    refereeId: REFEREE,
    status: 'REGISTERED',
    createdAt: new Date(),
    feeSharePct: 5,
    feeShareMonths: 12,
    ...overrides,
  };
}

describe('creditReferrer — accrues, does not pay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock(prisma.business.findUnique).mockResolvedValue({ id: 'biz_1', ownerId: REFEREE, name: 'Acme' });
    mock(prisma.pabReferral.findFirst).mockResolvedValue(referral());
    mock(prisma.referralEarning.findFirst).mockResolvedValue(null);
    mock(prisma.referralEarning.create).mockResolvedValue({ id: 'earn_1', status: 'pending' });
  });

  it('does NOT touch the wallet balance', async () => {
    await referralFeeShareService.creditReferrer({ businessId: 'biz_1', invoiceId: 'inv_1', amount: 1000 });

    // The bug: this used to be called here as well as in the monthly payout.
    expect(prisma.pabWallet.update).not.toHaveBeenCalled();
    expect(prisma.pabWallet.create).not.toHaveBeenCalled();
    expect(prisma.pabWallet.upsert).not.toHaveBeenCalled();
  });

  it('records a pending earning for the payout to settle', async () => {
    const earning = await referralFeeShareService.creditReferrer({
      businessId: 'biz_1', invoiceId: 'inv_1', amount: 1000,
    });

    expect(earning).toEqual({ id: 'earn_1', status: 'pending' });
    expect(prisma.referralEarning.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ invoiceId: 'inv_1', status: 'pending' }),
      }),
    );
  });

  it('is idempotent for the same invoice', async () => {
    mock(prisma.referralEarning.findFirst).mockResolvedValue({ id: 'earn_existing', status: 'pending' });

    const earning = await referralFeeShareService.creditReferrer({
      businessId: 'biz_1', invoiceId: 'inv_1', amount: 1000,
    });

    expect(earning).toEqual({ id: 'earn_existing', status: 'pending' });
    expect(prisma.referralEarning.create).not.toHaveBeenCalled();
  });
});

describe('processMonthlyPayouts — the single crediting point', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('credits the wallet exactly once and marks the earning paid', async () => {
    mock(prisma.referralEarning.findMany).mockResolvedValue([
      { id: 'earn_1', referrerId: REFERRER, amountPab: 5000, invoiceId: 'inv_1', referral: {} },
    ]);
    mock(prisma.referralEarning.updateMany).mockResolvedValue({ count: 1 });
    mock(prisma.pabWallet.upsert).mockResolvedValue({ id: 'wal_1', balance: 5000, totalEarned: 5000 });

    await referralFeeShareService.processMonthlyPayouts();

    expect(prisma.pabWallet.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.pabWallet.upsert).toHaveBeenCalledWith({
      where: { userId: REFERRER },
      create: expect.objectContaining({ userId: REFERRER, balance: 5000 }),
      update: { balance: { increment: 5000 }, totalEarned: { increment: 5000 } },
    });
    expect(prisma.referralEarning.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'earn_1', status: 'pending' } }),
    );
    expect(prisma.pabTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('skips an earning another run already claimed', async () => {
    // Two overlapping cron runs both read the same pending rows. Claiming the
    // row with updateMany on the status predicate means the loser gets count 0
    // and pays nothing, so an earning cannot be paid twice.
    mock(prisma.referralEarning.findMany).mockResolvedValue([
      { id: 'earn_1', referrerId: REFERRER, amountPab: 5000, invoiceId: 'inv_1', referral: {} },
    ]);
    mock(prisma.referralEarning.updateMany).mockResolvedValue({ count: 0 });

    await referralFeeShareService.processMonthlyPayouts();

    expect(prisma.pabWallet.upsert).not.toHaveBeenCalled();
    expect(prisma.pabTransaction.create).not.toHaveBeenCalled();
  });

  it('does not pay the same earning twice across two runs', async () => {
    const earning = { id: 'earn_1', referrerId: REFERRER, amountPab: 5000, invoiceId: 'inv_1', referral: {} };

    // Run 1 claims it and pays.
    mock(prisma.referralEarning.findMany).mockResolvedValue([earning]);
    mock(prisma.referralEarning.updateMany).mockResolvedValue({ count: 1 });
    mock(prisma.pabWallet.upsert).mockResolvedValue({ id: 'wal_1', balance: 5000 });

    await referralFeeShareService.processMonthlyPayouts();
    expect(prisma.pabWallet.upsert).toHaveBeenCalledTimes(1);

    // Run 2 sees the same row but the claim now fails.
    mock(prisma.referralEarning.updateMany).mockResolvedValue({ count: 0 });
    vi.clearAllMocks();
    mock(prisma.referralEarning.findMany).mockResolvedValue([earning]);
    mock(prisma.referralEarning.updateMany).mockResolvedValue({ count: 0 });

    await referralFeeShareService.processMonthlyPayouts();
    expect(prisma.pabWallet.upsert).not.toHaveBeenCalled();
  });
});

describe('accrue then pay is balanced end to end', () => {
  it('credits the fee share exactly once across the whole lifecycle', async () => {
    // $1000 invoice, 5% = $50, at the $0.01 PAB price = 5000 PAB. One credit.
    mock(prisma.business.findUnique).mockResolvedValue({ id: 'biz_1', ownerId: REFEREE, name: 'Acme' });
    mock(prisma.pabReferral.findFirst).mockResolvedValue(referral());
    mock(prisma.referralEarning.findFirst).mockResolvedValue(null);
    mock(prisma.referralEarning.create).mockResolvedValue({ id: 'earn_1', status: 'pending' });

    await referralFeeShareService.creditReferrer({ businessId: 'biz_1', invoiceId: 'inv_1', amount: 1000 });

    mock(prisma.referralEarning.findMany).mockResolvedValue([
      { id: 'earn_1', referrerId: REFERRER, amountPab: 5000, invoiceId: 'inv_1', referral: {} },
    ]);
    mock(prisma.referralEarning.updateMany).mockResolvedValue({ count: 1 });
    mock(prisma.pabWallet.upsert).mockResolvedValue({ id: 'wal_1', balance: 5000 });

    await referralFeeShareService.processMonthlyPayouts();

    const upserts = mock(prisma.pabWallet.upsert).mock.calls;
    expect(upserts).toHaveLength(1);
    expect(mock(prisma.pabWallet.update)).not.toHaveBeenCalled();
    expect(mock(prisma.pabWallet.create)).not.toHaveBeenCalled();
  });
});