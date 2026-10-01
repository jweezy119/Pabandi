import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMoneyFlow, RAIL_FEES } from '../src/services/money-flow.service';
import { prisma } from '../src/utils/database';

vi.mock('../src/utils/database', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    invoice: { findMany: vi.fn() },
    reconciliationMatch: { findMany: vi.fn() },
    businessPaymentMethod: { findFirst: vi.fn() },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const NOW = new Date('2026-10-10T12:00:00Z');
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

function inv(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv_1',
    number: 'INV-0001',
    status: 'sent',
    subtotal: 100,
    dateDue: days(7),
    paidAt: null,
    notes: null,
    ...overrides,
  };
}

async function summary(invoices: Record<string, unknown>[], opts: { matches?: { invoiceId: string; rail: string }[]; defaultRail?: string } = {}) {
  mock(prisma.business.findUnique).mockResolvedValue({ currency: 'USD', name: 'Acme' });
  mock(prisma.invoice.findMany).mockResolvedValue(invoices);
  mock(prisma.reconciliationMatch.findMany).mockResolvedValue(opts.matches ?? []);
  mock(prisma.businessPaymentMethod.findFirst).mockResolvedValue(
    opts.defaultRail ? { railId: opts.defaultRail } : null,
  );
  return getMoneyFlow('biz_1');
}

describe('getMoneyFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
  });

  describe('expected incoming', () => {
    it('buckets by due date relative to now', async () => {
      const s = await summary([
        inv({ id: 'a', subtotal: 100, dateDue: days(-5) }),   // overdue
        inv({ id: 'b', subtotal: 200, dateDue: days(3) }),    // this week
        inv({ id: 'c', subtotal: 400, dateDue: days(40) }),   // later
      ]);

      expect(s.expectedIncoming).toEqual({
        total: 700,
        overdue: 100,
        dueThisWeek: 200,
        dueLater: 400,
      });
    });

    it('excludes drafts, which are not money in motion', async () => {
      const s = await summary([inv({ id: 'a', status: 'draft', subtotal: 500 })]);

      expect(s.expectedIncoming.total).toBe(0);
      expect(s.outstanding.count).toBe(0);
    });

    it('tracks the oldest days past due', async () => {
      const s = await summary([
        inv({ id: 'a', subtotal: 100, dateDue: days(-2) }),
        inv({ id: 'b', subtotal: 100, dateDue: days(-19) }),
      ]);

      expect(s.outstanding.oldestDaysPastDue).toBe(19);
    });
  });

  describe('received this week', () => {
    it('counts only payments settled in the last 7 days', async () => {
      const s = await summary([
        inv({ id: 'a', status: 'paid', subtotal: 150, paidAt: days(-1) }),
        inv({ id: 'b', status: 'paid', subtotal: 300, paidAt: days(-3) }),
        inv({ id: 'c', status: 'paid', subtotal: 500, paidAt: days(-20) }),
      ]);

      expect(s.receivedThisWeek).toEqual({ total: 450, count: 2 });
    });

    it('ignores paid invoices with no paidAt, rather than counting them as recent', async () => {
      const s = await summary([inv({ id: 'a', status: 'paid', subtotal: 900, paidAt: null })]);

      expect(s.receivedThisWeek).toEqual({ total: 0, count: 0 });
    });
  });

  describe('outstanding', () => {
    it('covers sent and overdue but not paid or draft', async () => {
      const s = await summary([
        inv({ id: 'a', status: 'sent', subtotal: 100 }),
        inv({ id: 'b', status: 'overdue', subtotal: 200 }),
        inv({ id: 'c', status: 'paid', subtotal: 999, paidAt: days(-1) }),
        inv({ id: 'd', status: 'draft', subtotal: 888 }),
      ]);

      expect(s.outstanding).toMatchObject({ total: 300, count: 2 });
    });
  });

  describe('rail attribution', () => {
    it('prefers a real reconciliation match over the business default', async () => {
      const s = await summary([inv({ id: 'a', subtotal: 1000 })], {
        matches: [{ invoiceId: 'a', rail: 'solana' }],
        defaultRail: 'square',
      });

      const solana = s.byRail.find((r) => r.railId === 'solana');
      const square = s.byRail.find((r) => r.railId === 'square');

      expect(solana).toMatchObject({ amount: 1000, measured: true });
      expect(square).toBeUndefined();
    });

    it('falls back to the business default and marks it as projected', async () => {
      const s = await summary([inv({ id: 'a', subtotal: 1000 })], { defaultRail: 'square' });

      expect(s.byRail[0]).toMatchObject({ railId: 'square', amount: 1000, measured: false });
    });

    it('reports unattributable money separately rather than guessing a rail', async () => {
      const s = await summary([inv({ id: 'a', subtotal: 750 })]);

      expect(s.byRail).toHaveLength(0);
      expect(s.unattributed).toEqual({ amount: 750, invoiceCount: 1 });
    });

    it('omits rails with no volume', async () => {
      const s = await summary([inv({ id: 'a', subtotal: 100 })], { defaultRail: 'square' });

      expect(s.byRail.map((r) => r.railId)).toEqual(['square']);
    });
  });

  describe('projected fees', () => {
    it('applies each rail basis-point rate', async () => {
      const s = await summary([inv({ id: 'a', subtotal: 1000 })], { defaultRail: 'square' });

      // 1000 at 290bps = $29.
      expect(s.byRail[0].projectedFees).toBe(29);
      expect(s.totalProjectedFees).toBe(29);
    });

    it('charges nothing on bank transfers', async () => {
      const s = await summary([inv({ id: 'a', subtotal: 5000 })], { defaultRail: 'bank' });

      expect(s.byRail[0].projectedFees).toBe(0);
      expect(s.totalProjectedFees).toBe(0);
    });

    it('sums fees across rails', async () => {
      const s = await summary(
        [inv({ id: 'a', subtotal: 1000 }), inv({ id: 'b', subtotal: 1000 })],
        { matches: [{ invoiceId: 'a', rail: 'square' }, { invoiceId: 'b', rail: 'solana' }] },
      );

      // square 29 + solana 2.50
      expect(s.totalProjectedFees).toBe(31.5);
    });

    it('has a rate for every registered rail', () => {
      for (const rail of ['square', 'solana', 'paypal', 'safepay', 'bank'] as const) {
        expect(RAIL_FEES[rail]).toBeDefined();
        expect(typeof RAIL_FEES[rail].bps).toBe('number');
      }
    });
  });

  describe('currency exposure', () => {
    it('collapses to one row for a single-currency business', async () => {
      const s = await summary([inv({ id: 'a', subtotal: 100, dateDue: days(3) })]);

      expect(s.currencyExposure).toHaveLength(1);
      expect(s.currencyExposure[0]).toEqual({
        currency: 'USD',
        receivable: 100,
        received: 0,
        net: -100,
        invoiceCount: 1,
      });
    });

    it('reports a net position per currency when mixed', async () => {
      const s = await summary([
        inv({ id: 'a', subtotal: 100, notes: JSON.stringify({ metadata: { currency: 'EUR' } }) }),
        inv({ id: 'b', subtotal: 200, status: 'paid', paidAt: days(-1) }),
      ]);

      const eur = s.currencyExposure.find((c) => c.currency === 'EUR');
      const usd = s.currencyExposure.find((c) => c.currency === 'USD');

      expect(eur).toMatchObject({ receivable: 100, received: 0, net: -100 });
      expect(usd).toMatchObject({ receivable: 0, received: 200, net: 200 });
    });

    it('falls back to the business currency for unparseable notes', async () => {
      const s = await summary([inv({ id: 'a', subtotal: 100, notes: 'just some text' })]);

      expect(s.currencyExposure[0].currency).toBe('USD');
    });
  });

  it('handles a business with no invoices at all', async () => {
    const s = await summary([]);

    expect(s.expectedIncoming.total).toBe(0);
    expect(s.receivedThisWeek.total).toBe(0);
    expect(s.outstanding.count).toBe(0);
    expect(s.byRail).toHaveLength(0);
    expect(s.totalProjectedFees).toBe(0);
  });

  it('provides a link for every stat that links somewhere', async () => {
    const s = await summary([inv()]);

    for (const key of ['expectedIncoming', 'overdue', 'receivedThisWeek', 'outstanding']) {
      expect(s.links[key]).toMatch(/^\/contact\/invoices\?status=/);
    }
  });
});
