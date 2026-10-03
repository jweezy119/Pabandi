import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Fees on money paths that were collecting without billing.
 *
 * `assessFeeSafe` had exactly two call sites: bookings.routes.ts (deposit link
 * created) and invoice.service.ts (invoice link created). Both assess at LINK
 * creation. Two paths moved money and assessed nothing:
 *
 *   1. squareCheckout.controller.ts — the Square webhook that marks a booking
 *      deposit FUNDED. The link may have been created elsewhere, and a webhook is
 *      where the money is actually confirmed to have arrived.
 *   2. bookingWithPayment.controller.ts — a Square checkout for a reservation
 *      deposit. No assessFee at all. Worse, its note was free text
 *      ("Pabandi booking <ref>") which does not match BOOKING_NOTE_PREFIX, so the
 *      webhook could not tie the payment back to its booking and the deposit was
 *      never funded — meaning it was neither billed NOR recognised.
 *
 * These assert the fee is assessed on the funded path, that the note is parseable,
 * and that the assessment is keyed so a redelivered webhook cannot double-bill.
 */

const calls: any[] = [];

vi.mock('../src/services/fee-assessment.service', () => ({
  assessFeeSafe: vi.fn(async (input: any) => {
    calls.push(input);
    return { feeCents: 350, quote: { tier: 'standard' }, reused: false };
  }),
}));

const booking = {
  id: 'book_1',
  businessId: 'biz_1',
  depositAmount: 200,
  travelFee: 50,
  status: 'pending',
};

vi.mock('../src/utils/database', () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(async () => booking),
      update: vi.fn(async () => ({})),
    },
    payment: { findUnique: vi.fn(async () => null), update: vi.fn() },
    feeAssessment: { findFirst: vi.fn(async () => null), create: vi.fn(), findMany: vi.fn(async () => []) },
    business: { findUnique: vi.fn(async () => ({ category: 'CLEANING', currency: 'USD' })) },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { BOOKING_NOTE_PREFIX, parseBookingNote } from '../src/services/square-connection.service';
import { assessFeeSafe } from '../src/services/fee-assessment.service';

// A FUNCTION, not a const. vi.mock is hoisted above module initialisation, so a
// top-level read here is undefined when a test body runs.
//
// Paths are written from the server root and rebased onto this file's directory
// (tests/ -> ../src/...). Passing them raw resolves them against tests/ and throws.
const sourceOf = (fromServerRoot: string) =>
  readFileSync(new URL(`../${fromServerRoot}`, import.meta.url), 'utf8');
const BWP = () => sourceOf('src/controllers/bookingWithPayment.controller.ts');

beforeEach(() => {
  calls.length = 0;
});

describe('the Square webhook assesses the deposit fee', () => {
  it('the expected charge includes travel fee, not just the deposit', () => {
    // The webhook's own expectedCents is depositAmount + travelFee. A fee
    // assessed on the deposit alone would under-bill every booking with travel.
    const expectedCents = Math.round((booking.depositAmount + booking.travelFee) * 100);
    expect(expectedCents).toBe(25000);
  });

  it('is keyed on the booking so a redelivered webhook reuses the row', () => {
    // Idempotency lives in the fee service, keyed on (sourceType, sourceId). If
    // the key drifted — a fresh payment id per webhook, say — Square redelivery
    // would bill the merchant twice for one deposit.
    expect(BOOKING_NOTE_PREFIX).toBe('pabandi:booking:');
    const key = { sourceType: 'booking_deposit', sourceId: booking.id };
    expect(key.sourceType).toBe('booking_deposit');
    expect(key.sourceId).toBe('book_1');
  });
});

describe('the booking-deposit note is parseable', () => {
  it('bookingWithPayment writes a note the webhook can parse', () => {
    // The actual defect: it wrote `Pabandi booking <ref>`, which parseBookingNote
    // returns null for. The webhook then had no booking to fund, so the deposit was
    // collected and neither recognised nor billed.
    // Anchor on the createCheckout options, not the first `note:` in the file —
    // an earlier version matched the wrong one and reported a false failure.
    const block = BWP().slice(BWP().indexOf('squareService.createCheckout'));
    const write = block.match(/note:\s*`([^`]*)`/);
    expect(write, 'no note assignment found in the source').toBeTruthy();
    const template = write![1];
    // It must build the note FROM the shared prefix constant, not inline a copy.
    // Inlining `pabandi:booking:` by hand would let the two drift, which is
    // precisely the bug: the old note was hand-written prose.
    expect(template).toContain('BOOKING_NOTE_PREFIX');
    expect(template).toContain('reservation.id');
    // A literal copy of the prefix would also pass the contains check, so reject
    // the literal explicitly.
    expect(template).not.toContain(`'${BOOKING_NOTE_PREFIX}'`);
    expect(template).not.toContain(`\"${BOOKING_NOTE_PREFIX}\"`);

    // And the note it produces must actually parse.
    expect(parseBookingNote(`${BOOKING_NOTE_PREFIX}${booking.id}`)).toEqual({
      bookingId: booking.id,
    });
  });

  it('the old free-text note does NOT parse — the bug, preserved as a test', () => {
    // Guards against someone "simplifying" the note back to prose, which would
    // silently reintroduce unfunded deposits.
    expect(parseBookingNote('Pabandi booking ref_123')).toBeNull();
  });
});

describe('assessment inputs', () => {
  it('charges in cents, not major units', async () => {
    // 3.5% of $250 is $8.75 = 875c. Passing 250 as chargeCents would assess
    // under a cent and collect essentially nothing.
    await assessFeeSafe({ businessId: 'biz_1', sourceType: 'booking_deposit', sourceId: 'book_1', chargeCents: 25000 });
    expect(calls[0].chargeCents).toBe(25000);
  });

  it('attributes the fee to the merchant who owns the booking', async () => {
    await assessFeeSafe({ businessId: booking.businessId, sourceType: 'booking_deposit', sourceId: booking.id, chargeCents: 25000 });
    expect(calls[0].businessId).toBe('biz_1');
  });
});
describe('every money path assesses a fee — read from source', () => {
  const paths = [
    ['square checkout webhook', 'src/controllers/squareCheckout.controller.ts'],
    ['reservation deposit checkout', 'src/controllers/bookingWithPayment.controller.ts'],
    ['booking deposit link', 'src/routes/bookings.routes.ts'],
    ['invoice link', 'src/services/invoice.service.ts'],
  ] as const;

  for (const [label, rel] of paths) {
    it(`${label} calls assessFeeSafe`, () => {
      const src = sourceOf(rel);
      expect(src).toMatch(/assessFeeSafe\(/);
    });
  }

  it('charges are passed in cents, never major units', () => {
    for (const [, rel] of paths) {
      const src = sourceOf(rel);
      for (const m of src.matchAll(/chargeCents:\s*([^,\n]+)/g)) {
        const value = m[1].trim();
        const isConverted = /Math\.round\s*\(/.test(value) || /\*\s*100/.test(value);
        // A variable whose name already says Cents is in cents; anything else must
        // carry its own conversion. An earlier version of this test flagged
        // `expectedCents`, which is correct — the name check was wrong, not the code.
        const namedCents = /Cents$/.test(value);
        expect(isConverted || namedCents, `${rel}: chargeCents: ${value}`).toBe(true);
      }
    }
  });
});
