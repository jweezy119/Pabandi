import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

/**
 * Trust event emission.
 *
 * `trustCore.emit` no longer writes an `InvoiceTrustEvent` row. It resolves the
 * scope, updates the scoped score for events in the delta map, and fires an
 * attestation for the event types that need one. These tests pin that contract:
 * a missing invoice must stay null, a missing passport must stay null, and an
 * event outside the delta map must not move a score.
 */

const findUniquePassport = vi.fn();
const updatePassport = vi.fn();
const findUniqueClient = vi.fn();
const invoiceFindFirst = vi.fn();

vi.mock('../src/utils/database', () => ({
  prisma: {
    trustPassport: { findUnique: findUniquePassport, update: updatePassport },
    crmClient: { findUnique: findUniqueClient },
    invoice: { findFirst: invoiceFindFirst },
  },
}));

vi.mock('../src/services/email.service', () => ({
  emailService: { sendTrustScoreChanged: vi.fn() },
}));

vi.mock('../src/services/onchain-attestation.service', () => ({
  writeAttestation: vi.fn(async () => undefined),
}));

let trustCore: typeof import('../src/trust/trust-core')['trustCore'];

beforeAll(async () => {
  ({ trustCore } = await import('../src/trust/trust-core'));
});

const INVOICE_ID = 'inv_1';

beforeEach(() => {
  findUniquePassport.mockReset().mockResolvedValue(null);
  updatePassport.mockReset().mockResolvedValue({});
  findUniqueClient.mockReset().mockResolvedValue(null);
  invoiceFindFirst.mockReset().mockResolvedValue(null);
});

// ─────────────────────────────────────────────────────────────────────────────

describe('trustCore.emit — scope', () => {
  it('reports the invoice and passport it was given', async () => {
    const result = await trustCore.emit('invoice.sent', { invoiceId: INVOICE_ID, passportId: 'pp_1' });
    expect(result).toMatchObject({ recorded: true, invoiceId: INVOICE_ID, passportId: 'pp_1' });
  });

  it('never queries for an invoice to stand in for a missing one', async () => {
    // The old implementation called `prisma.invoice.findFirst()` here and used
    // whatever came back, filing bookings against an unrelated invoice.
    const result = await trustCore.emit('booking.created', { passportId: 'pp_1' });
    expect(result.invoiceId).toBeNull();
    expect(invoiceFindFirst).not.toHaveBeenCalled();
  });

  it('reports a NULL passport rather than an empty string', async () => {
    // '' fails the foreign key to TrustPassport.
    const result = await trustCore.emit('activity.logged', { invoiceId: INVOICE_ID });
    expect(result.passportId).toBeNull();
  });

  it('succeeds for an event with neither an invoice nor a passport', async () => {
    const result = await trustCore.emit('activity.logged', {});
    expect(result).toMatchObject({ recorded: true, invoiceId: null, passportId: null });
  });

  it('accepts clientPassportId as the passport', async () => {
    const result = await trustCore.emit('invoice.sent', { invoiceId: INVOICE_ID, clientPassportId: 'pp_9' });
    expect(result.passportId).toBe('pp_9');
  });
});

describe('trustCore.emit — score neutrality', () => {
  it('leaves the score alone for events outside the delta map', async () => {
    for (const eventType of [
      'invoice.sent',
      'payment.retry_attempted',
      'payment.retry_exhausted',
      'booking.created',
      'booking.attended',
      'escrow.released',
    ]) {
      await trustCore.emit(eventType, { invoiceId: INVOICE_ID, passportId: 'pp_1' });
    }

    // A declined card must not cost a client their score, and a booking being
    // created is not payment behaviour at all.
    expect(updatePassport).not.toHaveBeenCalled();
  });

  it('skips the score lookup entirely when there is no passport', async () => {
    await trustCore.emit('activity.logged', { invoiceId: INVOICE_ID });
    expect(findUniquePassport).not.toHaveBeenCalled();
  });

  it('clamps the score to the 0-1000 range', async () => {
    findUniquePassport.mockResolvedValue({ id: 'pp_1', paymentScore: 3 });
    await trustCore.emit('invoice.overdue', { invoiceId: INVOICE_ID, passportId: 'pp_1' });
    expect(updatePassport).toHaveBeenCalledWith({ where: { id: 'pp_1' }, data: { paymentScore: 0 } });
  });
});