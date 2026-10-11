import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * Trust event emission.
 *
 * ─── WHY THIS FILE IS SMALL AND FOCUSED ─────────────────────────────────────
 * `trustCore.emit` is the only thing most of the platform's trust logic calls,
 * and it had two behaviours that were actively wrong:
 *
 *   1. It invented an invoice. Twenty-one of thirty-two call sites pass no
 *      invoiceId — bookings, check-ins, escrow, reviews — so the common path
 *      filed those events against `prisma.invoice.findFirst()`. That is not a
 *      missing value, it is a wrong one, and it corrupted the history of an
 *      invoice that had nothing to do with the event.
 *
 *   2. It threw on a repeat. The unique index on (invoiceId, eventType) exists
 *      to make repeats harmless; failure-ownership documents depending on
 *      exactly that. Instead the second emit threw, and since callers `await`
 *      it without a catch, a routine repeat could fail the operation that
 *      produced it.
 *
 * Both are tested here against a fake Prisma, with the module imported inside
 * `beforeAll` because `vi.mock` factories are hoisted above every top-level
 * declaration.
 */

type Row = Record<string, unknown>;

const create = vi.fn();
const findUniquePassport = vi.fn();
const updatePassport = vi.fn();
const findUniqueClient = vi.fn();
const invoiceFindFirst = vi.fn();

vi.mock('../../src/utils/database', () => ({ prisma: {} }));

vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');
  return {
    ...actual,
    PrismaClient: class {
      invoiceTrustEvent = { create };
      trustPassport = { findUnique: findUniquePassport, update: updatePassport };
      crmClient = { findUnique: findUniqueClient };
      // Present so that calling it is possible. The old implementation used it
      // to invent an invoiceId, and a mock without this method would turn that
      // regression into a TypeError rather than an assertion.
      invoice = { findFirst: invoiceFindFirst };
    },
  };
});

vi.mock('../../src/services/email.service', () => ({
  emailService: { sendTrustScoreChanged: vi.fn() },
}));

vi.mock('../../src/services/onchain-attestation.service', () => ({
  writeAttestation: vi.fn(async () => undefined),
}));

let trustCore: typeof import('../../src/trust/trust-core')['trustCore'];

beforeAll(async () => {
  ({ trustCore } = await import('../../src/trust/trust-core'));
});

const INVOICE_ID = 'inv_1';

function p2002() {
  return new Prisma.PrismaClientKnownRequestError('unique violation', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

beforeEach(() => {
  create.mockReset().mockResolvedValue({ id: 'e1' });
  findUniquePassport.mockReset().mockResolvedValue(null);
  updatePassport.mockReset().mockResolvedValue({});
  findUniqueClient.mockReset().mockResolvedValue(null);
});

// ─────────────────────────────────────────────────────────────────────────────

describe('trustCore.emit — scope', () => {
  it('records an invoice event against that invoice', async () => {
    const result = await trustCore.emit('invoice.sent', { invoiceId: INVOICE_ID, passportId: 'pp_1' });

    expect(create).toHaveBeenCalledWith({ data: { invoiceId: INVOICE_ID, passportId: 'pp_1', eventType: 'invoice.sent' } });
    expect(result.recorded).toBe(true);
  });

  it('records a non-invoice event with a NULL invoice, not a fabricated one', async () => {
    // THE regression. `booking.created` used to be filed against whichever
    // invoice happened to be first in the table.
    await trustCore.emit('booking.created', { passportId: 'pp_1', bookingId: 'bk_1' });

    expect(create).toHaveBeenCalledWith({
      data: { invoiceId: null, passportId: 'pp_1', eventType: 'booking.created' },
    });
  });

  it('never queries for an invoice to stand in for a missing one', async () => {
    await trustCore.emit('booking.created', { passportId: 'pp_1' });

    // The old implementation called `prisma.invoice.findFirst()` here and used
    // whatever came back. The method exists on this mock precisely so that
    // calling it would succeed silently — otherwise this would pass against a
    // regression that merely crashed.
    expect(invoiceFindFirst).not.toHaveBeenCalled();
  });

  it('records a NULL passport rather than an empty string', async () => {
    // '' fails the foreign key to TrustPassport, and the catch rethrew — so
    // eleven call sites were throwing into the operations that triggered them.
    await trustCore.emit('activity.logged', { invoiceId: INVOICE_ID });

    expect(create).toHaveBeenCalledWith({
      data: { invoiceId: INVOICE_ID, passportId: null, eventType: 'activity.logged' },
    });
  });

  it('succeeds for an event with neither an invoice nor a passport', async () => {
    // The case that previously threw a foreign-key violation out of whatever
    // route fired it.
    const result = await trustCore.emit('activity.logged', {});
    expect(result.recorded).toBe(true);
    expect(create).toHaveBeenCalledWith({ data: { invoiceId: null, passportId: null, eventType: 'activity.logged' } });
  });

  it('accepts clientPassportId as the passport', async () => {
    await trustCore.emit('invoice.sent', { invoiceId: INVOICE_ID, clientPassportId: 'pp_9' });
    expect(create).toHaveBeenCalledWith({
      data: { invoiceId: INVOICE_ID, passportId: 'pp_9', eventType: 'invoice.sent' },
    });
  });
});

describe('trustCore.emit — idempotency', () => {
  it('treats a repeated event as already recorded instead of throwing', async () => {
    create.mockRejectedValueOnce(p2002());

    const result = await trustCore.emit('invoice.overdue', { invoiceId: INVOICE_ID, passportId: 'pp_1' });
    // The constraint existing is the table working. Throwing here is what made
    // a routine repeat able to fail the caller.
    expect(result.recorded).toBe(false);
  });

  it('does not move the score a second time for a repeated penalty', async () => {
    create.mockRejectedValueOnce(p2002());
    await trustCore.emit('invoice.overdue', { invoiceId: INVOICE_ID, passportId: 'pp_1' });

    // -15 twice would be a harsher penalty for one failure, not a fairer one.
    expect(updatePassport).not.toHaveBeenCalled();
  });

  it('still applies the score on a first occurrence', async () => {
    findUniquePassport.mockResolvedValue({ id: 'pp_1', paymentScore: 500 });

    await trustCore.emit('invoice.overdue', { invoiceId: INVOICE_ID, passportId: 'pp_1' });
    expect(updatePassport).toHaveBeenCalledWith({
      where: { id: 'pp_1' },
      data: { paymentScore: 485 },
    });
  });

  it('propagates a genuine database error rather than hiding it', async () => {
    // Swallowing every failure would turn an outage into a green request. Only
    // the unique violation is treated as a success.
    create.mockRejectedValueOnce(new Error('connection reset'));

    await expect(
      trustCore.emit('invoice.sent', { invoiceId: INVOICE_ID, passportId: 'pp_1' }),
    ).rejects.toThrow(/connection reset/);
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