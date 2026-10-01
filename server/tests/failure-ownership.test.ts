import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runFailureOwnership, scanFailureOwnership, fileInvoiceDispute, FAILURE_OWNERSHIP_GRACE_DAYS } from '../src/services/failure-ownership.service';
import { prisma } from '../src/utils/database';
import { emailService } from '../src/services/email.service';
import { createNotification } from '../src/services/notification.service';
import { invoiceTrustService } from '../src/services/invoice-trust.service';
import { trustCore } from '../src/trust/trust-core';
import { universalEscrowService } from '../src/services/universal-escrow.service';
import { disputeService } from '../src/services/dispute.service';

vi.mock('../src/utils/database', () => ({
  prisma: {
    invoice: { findUnique: vi.fn(), findMany: vi.fn() },
    business: { findUnique: vi.fn() },
    trustPassport: { findUnique: vi.fn() },
    universalEscrow: { findUnique: vi.fn() },
    dispute: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('../src/services/email.service', () => ({
  emailService: { sendPaymentDidntArrive: vi.fn(), sendDisputeOpened: vi.fn() },
}));

vi.mock('../src/services/notification.service', () => ({
  createNotification: vi.fn(),
}));

vi.mock('../src/services/invoice-trust.service', () => ({
  invoiceTrustService: { processInvoiceStatusChange: vi.fn() },
}));

vi.mock('../src/trust/trust-core', () => ({
  trustCore: { emit: vi.fn() },
}));

vi.mock('../src/services/universal-escrow.service', () => ({
  universalEscrowService: { updateStatus: vi.fn() },
}));

vi.mock('../src/services/dispute.service', () => ({
  disputeService: { assignJurors: vi.fn() },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const NOW = new Date('2026-10-10T12:00:00Z');

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv_1',
    number: 'INV-0042',
    businessId: 'biz_1',
    clientId: 'cli_1',
    status: 'sent',
    subtotal: 150,
    dateDue: daysAgo(5),
    notes: null,
    client: { id: 'cli_1', name: 'Acme Client', email: 'client@example.com', passportId: 'pp_client' },
    ...overrides,
  };
}

const business = { id: 'biz_1', name: 'Acme Services', email: 'biz@example.com', ownerId: 'user_1' };

describe('runFailureOwnership', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    mock(prisma.business.findUnique).mockResolvedValue(business);
    mock(prisma.trustPassport.findUnique).mockResolvedValue({ id: 'pp_biz', paymentScore: 500 });
    mock(prisma.universalEscrow.findUnique).mockResolvedValue(null);
    mock(prisma.dispute.findFirst).mockResolvedValue(null);
  });

  describe('grace period', () => {
    it('does nothing inside the grace period', async () => {
      mock(prisma.invoice.findUnique).mockResolvedValue(invoice({ dateDue: daysAgo(FAILURE_OWNERSHIP_GRACE_DAYS - 1) }));

      const result = await runFailureOwnership('inv_1');

      expect(result.clientNotified).toBe(false);
      expect(emailService.sendPaymentDidntArrive).not.toHaveBeenCalled();
      expect(result.notes[0]).toContain('grace period');
    });

    it('engages exactly at the grace boundary', async () => {
      mock(prisma.invoice.findUnique).mockResolvedValue(invoice({ dateDue: daysAgo(FAILURE_OWNERSHIP_GRACE_DAYS) }));

      const result = await runFailureOwnership('inv_1');

      expect(result.daysPastDue).toBe(FAILURE_OWNERSHIP_GRACE_DAYS);
      expect(result.clientNotified).toBe(true);
    });

    it('leaves a paid invoice alone', async () => {
      mock(prisma.invoice.findUnique).mockResolvedValue(invoice({ status: 'paid' }));

      const result = await runFailureOwnership('inv_1');

      expect(result.clientNotified).toBe(false);
      expect(emailService.sendPaymentDidntArrive).not.toHaveBeenCalled();
    });
  });

  describe('notifications', () => {
    beforeEach(() => {
      mock(prisma.invoice.findUnique).mockResolvedValue(invoice());
    });

    it('emails the client and notifies the business', async () => {
      const result = await runFailureOwnership('inv_1');

      expect(emailService.sendPaymentDidntArrive).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'client@example.com' }),
        expect.objectContaining({ number: 'INV-0042' }),
        expect.objectContaining({ name: 'Acme Services' }),
        5,
      );
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'INV-0042 overdue — client notified' }),
      );
      expect(result.clientNotified).toBe(true);
      expect(result.businessNotified).toBe(true);
    });

    it('still notifies the business when the client has no email', async () => {
      mock(prisma.invoice.findUnique).mockResolvedValue(
        invoice({ client: { id: 'cli_1', name: 'No Email', email: null, passportId: 'pp_client' } }),
      );

      const result = await runFailureOwnership('inv_1');

      expect(result.clientNotified).toBe(false);
      expect(result.businessNotified).toBe(true);
      expect(result.notes.join(' ')).toContain('no email address');
    });

    it('sends nothing at all when notify is false', async () => {
      await runFailureOwnership('inv_1', { notify: false });

      expect(emailService.sendPaymentDidntArrive).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
    });
  });

  describe('trust events', () => {
    beforeEach(() => {
      mock(prisma.invoice.findUnique).mockResolvedValue(invoice());
    });

    it('fires on both the client and the business passport', async () => {
      const result = await runFailureOwnership('inv_1', { notify: false });

      expect(invoiceTrustService.processInvoiceStatusChange).toHaveBeenCalledWith(
        'inv_1',
        'cli_1',
        'sent',
        'overdue',
        NOW,
        false,
        true,
        false,
      );
      expect(trustCore.emit).toHaveBeenCalledWith(
        'invoice.overdue',
        expect.objectContaining({ passportId: 'pp_biz', invoiceId: 'inv_1' }),
      );
      expect(result.trustEventsFired).toEqual(['client:invoice.overdue', 'business:invoice.overdue']);
    });

    it('fires the client event only when the business owner has no passport', async () => {
      mock(prisma.trustPassport.findUnique).mockResolvedValue(null);

      const result = await runFailureOwnership('inv_1', { notify: false });

      expect(result.trustEventsFired).toEqual(['client:invoice.overdue']);
      expect(trustCore.emit).not.toHaveBeenCalled();
      expect(result.notes.join(' ')).toContain('no trust passport');
    });
  });

  describe('escrow and dispute escalation', () => {
    beforeEach(() => {
      mock(prisma.invoice.findUnique).mockResolvedValue(invoice());
    });

    it('does not escalate when no escrow is held', async () => {
      const result = await runFailureOwnership('inv_1', { notify: false });

      expect(result.escrowHeld).toBe(false);
      expect(result.escalatedToDispute).toBe(false);
      expect(prisma.dispute.create).not.toHaveBeenCalled();
    });

    it('holds escrow and files a dispute when escrow exists', async () => {
      mock(prisma.universalEscrow.findUnique).mockResolvedValue({ id: 'esc_1', status: 'funded', amount: 150 });
      mock(prisma.dispute.create).mockResolvedValue({ id: 'dsp_1' });

      const result = await runFailureOwnership('inv_1', { notify: false });

      expect(universalEscrowService.updateStatus).toHaveBeenCalledWith('invoice:inv_1', 'disputed');
      expect(prisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contextType: 'INVOICE', contextId: 'inv_1', type: 'NON_PAYMENT' }),
        }),
      );
      expect(result.escalatedToDispute).toBe(true);
      expect(result.disputeId).toBe('dsp_1');
      expect(emailService.sendDisputeOpened).toHaveBeenCalled();
    });

    it('does not reopen a dispute that already exists', async () => {
      mock(prisma.universalEscrow.findUnique).mockResolvedValue({ id: 'esc_1', status: 'funded', amount: 150 });
      mock(prisma.dispute.findFirst).mockResolvedValue({ id: 'dsp_existing' });

      const result = await runFailureOwnership('inv_1', { notify: false });

      expect(prisma.dispute.create).not.toHaveBeenCalled();
      expect(result.disputeId).toBe('dsp_existing');
    });

    it('does not hold escrow that is already released', async () => {
      mock(prisma.universalEscrow.findUnique).mockResolvedValue({ id: 'esc_1', status: 'released', amount: 150 });

      const result = await runFailureOwnership('inv_1', { notify: false });

      expect(universalEscrowService.updateStatus).not.toHaveBeenCalled();
      expect(result.escalatedToDispute).toBe(false);
      expect(result.notes.join(' ')).toContain('already released');
    });
  });
});

describe('scanFailureOwnership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock(prisma.business.findUnique).mockResolvedValue(business);
    mock(prisma.trustPassport.findUnique).mockResolvedValue(null);
    mock(prisma.universalEscrow.findUnique).mockResolvedValue(null);
  });

  it('only selects invoices past the grace period', async () => {
    mock(prisma.invoice.findMany).mockResolvedValue([]);

    await scanFailureOwnership();

    const where = mock(prisma.invoice.findMany).mock.calls[0][0].where;
    const expected = new Date(Date.now() - FAILURE_OWNERSHIP_GRACE_DAYS * 24 * 60 * 60 * 1000);
    expect(Math.abs(where.dateDue.lt.getTime() - expected.getTime())).toBeLessThan(1000);
    expect(where.status.in).toContain('sent');
    expect(where.status.in).toContain('overdue');
    expect(where.status.in).not.toContain('paid');
  });

  it('keeps going when one invoice throws', async () => {
    mock(prisma.invoice.findMany).mockResolvedValue([{ id: 'bad' }, { id: 'inv_2' }]);
    mock(prisma.invoice.findUnique)
      .mockRejectedValueOnce(new Error('db blew up'))
      .mockResolvedValueOnce(invoice({ id: 'inv_2', number: 'INV-0043' }));

    const results = await scanFailureOwnership();

    expect(results).toHaveLength(1);
    expect(results[0].invoiceNumber).toBe('INV-0043');
  });
});

describe('fileInvoiceDispute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock(prisma.invoice.findUnique).mockResolvedValue(invoice());
    mock(prisma.business.findUnique).mockResolvedValue(business);
    mock(prisma.universalEscrow.findUnique)
      .mockResolvedValueOnce({ id: 'esc_1', status: 'funded' })
      .mockResolvedValueOnce({ status: 'disputed' });
    mock(prisma.dispute.findFirst).mockResolvedValue(null);
    mock(prisma.dispute.create).mockResolvedValue({ id: 'dsp_1' });
  });

  it('creates the case, holds escrow, and notifies both parties', async () => {
    const outcome = await fileInvoiceDispute({
      invoiceId: 'inv_1',
      reason: 'Client disputes the amount',
      evidence: ['https://example.com/a.png'],
    });

    expect(universalEscrowService.updateStatus).toHaveBeenCalledWith('invoice:inv_1', 'disputed');
    expect(prisma.dispute.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'NON_PAYMENT',
          contextType: 'INVOICE',
          evidenceUrls: ['https://example.com/a.png'],
        }),
      }),
    );
    expect(disputeService.assignJurors).toHaveBeenCalledWith('dsp_1');
    // Both parties: the client email and the business email.
    expect(emailService.sendDisputeOpened).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ disputeId: 'dsp_1', escrowHeld: true, escrowStatus: 'disputed' });
  });

  it('returns the existing case instead of filing a duplicate', async () => {
    mock(prisma.dispute.findFirst).mockResolvedValue({ id: 'dsp_existing' });

    const outcome = await fileInvoiceDispute({ invoiceId: 'inv_1', reason: 'again' });

    expect(prisma.dispute.create).not.toHaveBeenCalled();
    expect(outcome.disputeId).toBe('dsp_existing');
  });

  it('throws when the invoice does not exist', async () => {
    mock(prisma.invoice.findUnique).mockResolvedValue(null);

    await expect(fileInvoiceDispute({ invoiceId: 'nope', reason: 'x' })).rejects.toThrow('Invoice not found');
  });
});
