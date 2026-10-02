import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Square invoice collection for fee statements.
 *
 * Two failures this guards against, and they are the expensive kind:
 *
 *   THE WRONG MONEY MOVES. A merchant's fee invoice and a customer's deposit can
 *   be the same amount. If a fee invoice is reconciled as a deposit, a customer's
 *   booking is marked paid because a merchant paid their bill. Everything here is
 *   matched by Square's invoice id, never by amount.
 *
 *   DOUBLE INVOICING. A batch that runs twice, or an operator retrying after a
 *   timeout, must not send a second demand for the same fees. Two Square invoices
 *   for one statement is a double bill in the merchant's inbox.
 */

vi.mock('../src/utils/database', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    merchantFeeStatement: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../src/services/square-connection.service', () => ({
  squareBaseUrl: () => 'https://connect.squareup.com',
  platformAccessToken: () => 'test-token',
  platformLocation: () => 'LOC_TEST',
}));

import { prisma } from '../src/utils/database';
import {
  sendStatementViaSquare,
  buildFeeLineItems,
  resolveBillingEmail,
  findStatementBySquareInvoice,
  attachSquareInvoice,
  MIN_INVOICE_CENTS,
} from '../src/services/square-invoice.service';

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

/** Queue of fetch responses, in call order. */
function mockFetchSequence(responses: Array<{ ok?: boolean; status?: number; body?: unknown }>) {
  const calls: Array<{ url: string; body: any }> = [];
  let i = 0;
  global.fetch = vi.fn(async (url: string, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    const r = responses[Math.min(i++, responses.length - 1)];
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.body ?? {},
    } as any;
  }) as any;
  return calls;
}

const happyPath = () =>
  mockFetchSequence([
    { body: { order: { id: 'ORD_1' } } },
    { body: { invoice: { id: 'INV_1', public_url: 'https://squareup.com/invoice/INV_1' } } },
    { body: { invoice: { id: 'INV_1', public_url: 'https://squareup.com/invoice/INV_1' } } },
  ]);

const baseArgs = {
  statementNumber: 'FEES-202609-123456',
  totalCents: 4_500,
  currency: 'USD',
  recipientEmail: 'salon@example.com',
  lineItems: [{ name: 'Platform fee on invoices (12 charges @ 4.50%)', amountCents: 4_500 }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendStatementViaSquare', () => {
  it('creates an order, an invoice, then publishes — in that order', async () => {
    const calls = happyPath();
    const result = await sendStatementViaSquare(baseArgs);

    expect(result.ok).toBe(true);
    // Order must exist before the invoice can reference it, and nothing is
    // payable until publish. Doing them out of order produces an inert draft.
    expect(calls.map((c) => c.url)).toEqual([
      'https://connect.squareup.com/v2/orders',
      'https://connect.squareup.com/v2/invoices',
      'https://connect.squareup.com/v2/invoices/INV_1/publish',
    ]);
  });

  it('sends the fee to Pabandi, using the platform token and location', async () => {
    const calls = happyPath();
    await sendStatementViaSquare(baseArgs);

    // Never the merchant's own token here. Using the merchant's would invoice
    // them to themselves, which settles to a dead end and looks like collection.
    const order = calls[0].body.order;
    expect(order.location_id).toBe('LOC_TEST');
    expect(order.reference_id).toBe('FEES-202609-123456');
  });

  it('keys both creates off the statement number so a retry cannot duplicate', async () => {
    const calls = happyPath();
    await sendStatementViaSquare(baseArgs);

    // Square's idempotency keys are what make a retried send return the same
    // order and invoice rather than creating a second of each.
    expect(calls[0].body.idempotency_key).toBe('fee-order-FEES-202609-123456');
    expect(calls[1].body.idempotency_key).toBe('fee-invoice-FEES-202609-123456');
    expect(calls[2].body.idempotency_key).toBe('fee-publish-FEES-202609-123456');
  });

  it('requires a recipient, because Square cannot publish without one', async () => {
    const calls = happyPath();
    await sendStatementViaSquare(baseArgs);
    expect(calls[1].body.invoice.primary_recipient.email_address).toBe('salon@example.com');
  });

  it('does not store a card for the merchant', async () => {
    const calls = happyPath();
    await sendStatementViaSquare(baseArgs);

    // Storing a card for a B2B fee whose amount changes monthly is PCI surface
    // for no benefit.
    expect(calls[1].body.invoice.store_payment_method_enabled).toBe(false);
  });

  it('declines a fee too small to invoice', async () => {
    const result = await sendStatementViaSquare({ ...baseArgs, totalCents: 40 });
    // The card fee on a 40c invoice exceeds the invoice. It rolls into next
    // period rather than being sent.
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toBe('below_minimum');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('requires at least one line item', async () => {
    const result = await sendStatementViaSquare({ ...baseArgs, lineItems: [] });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toBe('rejected');
  });

  it('reports a permissions failure as a capability problem, not a generic error', async () => {
    // These need different responses from whoever is fixing it: "the app is not
    // approved for invoices and merchants must re-consent" versus "Square is down".
    mockFetchSequence([
      { ok: false, status: 403, body: { errors: [{ detail: 'Permission denied' }] } },
    ]);
    const result = await sendStatementViaSquare(baseArgs);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toBe('capability');
    expect(result.detail).toMatch(/INVOICES_WRITE|ORDERS_WRITE/);
  });

  it('never throws on a network failure', async () => {
    // A collection attempt must not take down the statement cycle for everyone else.
    global.fetch = vi.fn(async () => {
      throw new Error('ECONNRESET');
    }) as any;
    const result = await sendStatementViaSquare(baseArgs);
    expect(result.ok).toBe(false);
  });

  it('does not report success when publish fails', async () => {
    // A created-but-unpublished invoice is inert: no email, nothing payable.
    // Reporting it as sent would leave a statement that looks invoiced and is not.
    mockFetchSequence([
      { body: { order: { id: 'ORD_1' } } },
      { body: { invoice: { id: 'INV_1', public_url: 'https://squareup.com/invoice/INV_1' } } },
      { ok: false, status: 400, body: { errors: [{ detail: 'Cannot publish' }] } },
    ]);
    const result = await sendStatementViaSquare(baseArgs);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.detail).toMatch(/not published/i);
  });

  it('does not report success when Square returns no payment URL', async () => {
    mockFetchSequence([
      { body: { order: { id: 'ORD_1' } } },
      { body: { invoice: { id: 'INV_1' } } },
      { body: { invoice: { id: 'INV_1' } } },
    ]);
    const result = await sendStatementViaSquare(baseArgs);
    expect(result.ok).toBe(false);
  });
});

describe('line items are itemised, not one opaque total', () => {
  it('groups by charge type so a merchant can reconcile it', () => {
    const items = buildFeeLineItems([
      { sourceType: 'invoice', feeCents: 900, currency: 'USD', category: 'CLEANING', rateBps: 450 },
      { sourceType: 'invoice', feeCents: 450, currency: 'USD', category: 'SALON', rateBps: 316 },
      { sourceType: 'booking_deposit', feeCents: 185, currency: 'USD', category: 'SALON', rateBps: 370 },
    ]);

    expect(items).toHaveLength(2);
    // A $4.90 fee labelled "Platform fee" cannot be checked. Rows the merchant
    // can match against their own bookings can be.
    const invoices = items.find((i) => i.name.includes('invoices'))!;
    expect(invoices.amountCents).toBe(1_350);
    expect(invoices.name).toMatch(/2 charges/);
    expect(invoices.name).toMatch(/4\.50%|3\.16%/);
  });

  it('shows distinct rates when the floor applied to some charges', () => {
    // The floor is what makes the schedule honest, so the merchant should see
    // that two different rates applied rather than one unexplained number.
    const items = buildFeeLineItems([
      { sourceType: 'invoice', feeCents: 900, currency: 'USD', category: 'CLEANING', rateBps: 450 },
      { sourceType: 'invoice', feeCents: 390, currency: 'USD', category: 'SALON', rateBps: 316 },
    ]);
    expect(items[0].name).toMatch(/4\.50% \/ 3\.16%/);
  });

  it('returns nothing for no fees', () => {
    expect(buildFeeLineItems([])).toEqual([]);
  });
});

describe('billing email', () => {
  it('prefers the owner account over the denormalised business email', async () => {
    // ownerEmail is written at creation and never re-synced, so a merchant who
    // changed address would keep being invoiced somewhere they no longer control
    // — unpaid, with no way to reach them.
    mock(prisma.business.findUnique).mockResolvedValue({
      ownerId: 'u1',
      name: 'Salon',
      owner: { email: 'new@example.com', firstName: 'Ada', lastName: 'L' },
    });

    const result = await resolveBillingEmail('biz_1');
    expect(result).toEqual({ email: 'new@example.com', name: 'Ada L' });
  });

  it('returns null when there is no owner account', async () => {
    mock(prisma.business.findUnique).mockResolvedValue({ ownerId: null, name: 'Salon', owner: null });
    expect(await resolveBillingEmail('biz_1')).toBeNull();
  });

  it('returns null for a business that does not exist', async () => {
    mock(prisma.business.findUnique).mockResolvedValue(null);
    expect(await resolveBillingEmail('nope')).toBeNull();
  });
});

describe('settlement matches by Square invoice id, never by amount', () => {
  it('looks the statement up by the webhook id', async () => {
    mock(prisma.merchantFeeStatement.findFirst).mockResolvedValue({ id: 'st_1', status: 'sent' });
    expect(await findStatementBySquareInvoice('INV_1')).toEqual({ id: 'st_1', status: 'sent' });
    expect(mock(prisma.merchantFeeStatement.findFirst).mock.calls[0][0].where).toEqual({
      squareInvoiceId: 'INV_1',
    });
  });

  it('returns null for an invoice we did not create', async () => {
    mock(prisma.merchantFeeStatement.findFirst).mockResolvedValue(null);
    expect(await findStatementBySquareInvoice('INV_UNKNOWN')).toBeNull();
  });

  it('records the invoice and marks the statement sent', async () => {
    mock(prisma.merchantFeeStatement.update).mockResolvedValue({});
    await attachSquareInvoice({
      statementId: 'st_1',
      squareInvoiceId: 'INV_1',
      paymentLink: 'https://squareup.com/invoice/INV_1',
    });

    const data = mock(prisma.merchantFeeStatement.update).mock.calls[0][0].data;
    expect(data.squareInvoiceId).toBe('INV_1');
    expect(data.paymentLink).toBe('https://squareup.com/invoice/INV_1');
    expect(data.status).toBe('sent');
    // sentAt means "the merchant has been asked to pay", which is what dunning
    // reads. Distinct from never having tried.
    expect(data.sentAt).toBeTruthy();
  });
});

describe('the invoicing minimum is enforced in one place', () => {
  it('is below the smallest fee the schedule can produce', () => {
    // Guards the assumption that below_minimum only ever fires for genuine
    // stragglers. If the schedule ever charged less than $1, this would start
    // rejecting ordinary charges.
    expect(MIN_INVOICE_CENTS).toBe(100);
  });
});
