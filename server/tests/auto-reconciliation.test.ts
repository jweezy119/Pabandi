import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { reconcileIncomingPayment, alreadyReconciled, MATCH_WINDOW_DAYS } from '../src/services/auto-reconciliation.service';
import { prisma } from '../src/utils/database';
import { markInvoicePaid } from '../src/services/invoice.service';
import { createNotification } from '../src/services/notification.service';

vi.mock('../src/utils/database', () => ({
  prisma: {
    reconciliationMatch: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    business: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../src/services/invoice.service', () => ({
  markInvoicePaid: vi.fn(),
}));

vi.mock('../src/services/notification.service', () => ({
  createNotification: vi.fn(),
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/**
 * A genuine PrismaClientKnownRequestError, not a duck-typed object. The
 * service uses `instanceof` to detect a unique-constraint violation, so a
 * plain Error with a `code` property would not exercise the real code path —
 * the test would pass while production threw.
 */
function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function invoice(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv_1',
    number: 'INV-0042',
    businessId: 'biz_1',
    clientId: 'cli_1',
    subtotal: 150,
    status: 'sent',
    dateIssued: new Date(),
    dateDue: new Date(),
    ...overrides,
  };
}

const basePayment = {
  paymentRef: 'square:pay_123',
  rail: 'square' as const,
  amount: 150,
  paidAt: new Date('2026-10-01T12:00:00Z'),
};

describe('reconcileIncomingPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.reconciliationMatch.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'match_1' });
    (prisma.reconciliationMatch.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.business.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ownerId: 'user_1', name: 'Acme' });
  });

  describe('idempotency', () => {
    it('records the payment as a duplicate and settles nothing when paymentRef already exists', async () => {
      (prisma.reconciliationMatch.create as ReturnType<typeof vi.fn>).mockRejectedValue(uniqueViolation());
      (prisma.reconciliationMatch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'match_existing',
        status: 'matched',
        invoiceId: 'inv_1',
        confidence: 0.9,
      });

      const outcome = await reconcileIncomingPayment(basePayment);

      expect(outcome.duplicate).toBe(true);
      expect(outcome.status).toBe('matched');
      expect(outcome.invoiceId).toBe('inv_1');
      // The critical assertion: a redelivered webhook must not settle again.
      expect(markInvoicePaid).not.toHaveBeenCalled();
      expect(prisma.invoice.findMany).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
    });

    it('leaves the invoice untouched when a non-unique error occurs', async () => {
      (prisma.reconciliationMatch.create as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('db down', { code: 'P1001', clientVersion: 'test' }),
      );

      await expect(reconcileIncomingPayment(basePayment)).rejects.toThrow('db down');
      expect(markInvoicePaid).not.toHaveBeenCalled();
    });
  });

  describe('unique match', () => {
    beforeEach(() => {
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([invoice()]);
      (prisma.invoice.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(invoice());
    });

    it('marks the invoice paid and notifies the business', async () => {
      const outcome = await reconcileIncomingPayment(basePayment);

      expect(outcome.status).toBe('matched');
      expect(outcome.invoiceId).toBe('inv_1');
      expect(markInvoicePaid).toHaveBeenCalledWith('biz_1', 'inv_1', 'square:pay_123');
      expect(prisma.reconciliationMatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'match_1' },
          data: expect.objectContaining({ status: 'matched', invoiceId: 'inv_1' }),
        }),
      );
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('INV-0042 auto-matched to square payment of $150') }),
      );
    });
  });

  describe('ambiguous match', () => {
    it('queues for manual review and settles nothing', async () => {
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        invoice({ id: 'inv_1', number: 'INV-0042' }),
        invoice({ id: 'inv_2', number: 'INV-0043' }),
      ]);

      const outcome = await reconcileIncomingPayment(basePayment);

      expect(outcome.status).toBe('queued');
      expect(outcome.candidates).toHaveLength(2);
      expect(markInvoicePaid).not.toHaveBeenCalled();
      expect(prisma.reconciliationMatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'queued', candidates: expect.any(Array) }),
        }),
      );
    });
  });

  describe('no match', () => {
    it('records an orphan and notifies the business', async () => {
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const outcome = await reconcileIncomingPayment({ ...basePayment, businessId: 'biz_1' });

      expect(outcome.status).toBe('orphan');
      expect(markInvoicePaid).not.toHaveBeenCalled();
      expect(prisma.reconciliationMatch.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'orphan' }) }),
      );
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('Unmatched square payment') }),
      );
    });

    it('survives a business with no linked owner', async () => {
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.business.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ownerId: null, name: 'Acme' });

      const outcome = await reconcileIncomingPayment({ ...basePayment, businessId: 'biz_1' });

      expect(outcome.status).toBe('orphan');
      expect(createNotification).not.toHaveBeenCalled();
    });
  });

  describe('candidate selection', () => {
    it('only considers unpaid invoices', async () => {
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await reconcileIncomingPayment(basePayment);

      const where = (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
      expect(where.status.in).not.toContain('paid');
    });

    it('bounds the invoice window to the configured number of days', async () => {
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([invoice()]);

      await reconcileIncomingPayment(basePayment);

      const where = (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
      const expected = new Date(basePayment.paidAt.getTime() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      expect(Math.abs(where.dateIssued.gte.getTime() - expected.getTime())).toBeLessThan(1000);
    });

    it('ignores invoices whose amount does not match', async () => {
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([invoice({ subtotal: 152.75 })]);

      const outcome = await reconcileIncomingPayment(basePayment);

      expect(outcome.status).toBe('orphan');
    });
  });

  it('rejects an unknown rail', async () => {
    await expect(reconcileIncomingPayment({ ...basePayment, rail: 'stripe' as 'square' })).rejects.toThrow(
      'Unknown rail: stripe',
    );
  });
});

describe('alreadyReconciled', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when a row exists for the reference', async () => {
    (prisma.reconciliationMatch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'match_1' });
    await expect(alreadyReconciled('square:pay_123')).resolves.toBe(true);
  });

  it('returns false when nothing exists', async () => {
    (prisma.reconciliationMatch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(alreadyReconciled('square:pay_404')).resolves.toBe(false);
  });
});
