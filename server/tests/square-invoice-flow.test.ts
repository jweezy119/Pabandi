import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  parseInvoiceNote,
  invoiceNote,
  squareEnvironment,
  squareBaseUrl,
  INVOICE_NOTE_PREFIX,
} from '../src/services/square-connection.service';
import { reconcileIncomingPayment } from '../src/services/auto-reconciliation.service';
import { squareService } from '../src/services/squareCheckout.service';
import { prisma } from '../src/utils/database';
import crypto from 'crypto';
import { markInvoicePaid } from '../src/services/invoice.service';
import { createNotification } from '../src/services/notification.service';

/**
 * The Square invoice path.
 *
 * Two defects are locked down here:
 *
 *  1. The invoice flow built its payment link by appending `?amount=` to a
 *     Square Payment Link. Square Payment Links are fixed-price hosted pages
 *     and ignore an amount query parameter, so every invoice collected whatever
 *     the business's one registered link was pinned at.
 *
 *  2. The webhook read `payment.order_id` as if it were a client id. Square
 *     puts metadata on the order and returns an opaque id here, so
 *     reconciliation fell back to matching on amount alone — meaning a real
 *     payment could queue for manual review because a second invoice happened
 *     to share its amount. The invoice id is now carried in `payment_note` and
 *     comes back on the payment itself.
 */

vi.mock('../src/utils/database', () => ({
  prisma: {
    reconciliationMatch: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    invoice: { findUnique: vi.fn(), findMany: vi.fn() },
    business: { findUnique: vi.fn() },
  },
}));

vi.mock('../src/services/invoice.service', () => ({ markInvoicePaid: vi.fn() }));
vi.mock('../src/services/notification.service', () => ({ createNotification: vi.fn() }));
vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

describe('invoice note round-trip', () => {
  it('writes and reads back the same invoice id', () => {
    const note = invoiceNote('inv_abc123', 'INV-0042');
    expect(note.startsWith(INVOICE_NOTE_PREFIX)).toBe(true);
    expect(parseInvoiceNote(note)).toEqual({ invoiceId: 'inv_abc123', invoiceNumber: 'INV-0042' });
  });

  it('handles an invoice number containing colons', () => {
    // The id is taken up to the first colon, so a number with a colon in it
    // must not truncate the id or merge the two.
    const parsed = parseInvoiceNote(invoiceNote('inv_1', 'INV-2026:0042'));
    expect(parsed).toEqual({ invoiceId: 'inv_1', invoiceNumber: 'INV-2026:0042' });
  });

  it('returns null for a note that is not ours', () => {
    expect(parseInvoiceNote('Pabandi booking abc')).toBeNull();
    expect(parseInvoiceNote('')).toBeNull();
    expect(parseInvoiceNote(null)).toBeNull();
    expect(parseInvoiceNote(undefined)).toBeNull();
  });

  it('returns null for a malformed ours-prefixed note', () => {
    expect(parseInvoiceNote(`${INVOICE_NOTE_PREFIX}nocolon`)).toBeNull();
    expect(parseInvoiceNote(`${INVOICE_NOTE_PREFIX}:noname`)).toBeNull();
  });
});

describe('Square environment resolution', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to sandbox, never production', () => {
    delete process.env.SQUARE_ENV;
    delete process.env.SQUARE_ENVIRONMENT;
    // Production was hardcoded before, so a sandbox token was pointed at
    // production checkout — where a test charge becomes a real card charge.
    expect(squareEnvironment()).toBe('sandbox');
    expect(squareBaseUrl()).toContain('sandbox');
  });

  it('honours SQUARE_ENVIRONMENT=production', () => {
    process.env.SQUARE_ENVIRONMENT = 'production';
    expect(squareEnvironment()).toBe('production');
    expect(squareBaseUrl()).toBe('https://connect.squareup.com');
  });

  it('accepts SQUARE_ENV as a fallback and treats junk as sandbox', () => {
    delete process.env.SQUARE_ENVIRONMENT;
    process.env.SQUARE_ENV = 'production';
    expect(squareEnvironment()).toBe('production');

    process.env.SQUARE_ENV = 'nonsense';
    expect(squareEnvironment()).toBe('sandbox');
  });
});

describe('processWebhook — recovering the invoice', () => {
  it('reads the invoice id out of the payment note', async () => {
    const result = await squareService.processWebhook({
      type: 'payment.updated',
      data: {
        object: {
          payment: {
            id: 'pay_1',
            status: 'COMPLETED',
            amount_money: { amount: 15000, currency: 'USD' },
            note: invoiceNote('inv_abc', 'INV-0042'),
            order_id: 'ORDER_OPAQUE',
          },
        },
      },
    });

    expect(result.type).toBe('PAYMENT_UPDATED');
    if (result.type !== 'PAYMENT_UPDATED') throw new Error('wrong branch');
    expect(result.invoiceId).toBe('inv_abc');
    expect(result.invoiceNumber).toBe('INV-0042');
    // Minor units in, and reconciliation compares against major units.
    expect(result.amountCents).toBe(15000);
  });

  it('does not treat an opaque order_id as a client id', async () => {
    // This was the bug: order_id is a Square identifier, so handing it to
    // reconciliation as `clientId` made the client filter compare a Pabandi
    // client id against a Square order and never match.
    const result = await squareService.processWebhook({
      type: 'payment.updated',
      data: { object: { payment: { id: 'p', status: 'COMPLETED', order_id: 'ORDER_OPAQUE' } } },
    });
    if (result.type !== 'PAYMENT_UPDATED') throw new Error('wrong branch');
    expect(result.clientId).toBeNull();
    expect(result.invoiceId).toBeNull();
  });

  it('accepts camelCase amountMoney as well as snake_case', async () => {
    const result = await squareService.processWebhook({
      type: 'payment.completed',
      data: { object: { payment: { id: 'p', status: 'COMPLETED', amountMoney: { amount: 500, currency: 'USD' } } } },
    });
    if (result.type !== 'PAYMENT_UPDATED') throw new Error('wrong branch');
    expect(result.amountCents).toBe(500);
    expect(result.currency).toBe('USD');
  });
});

describe('reconcileIncomingPayment with a rail-supplied invoice id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock(prisma.reconciliationMatch.create).mockResolvedValue({ id: 'match_1' });
    mock(prisma.reconciliationMatch.update).mockResolvedValue({});
    mock(prisma.business.findUnique).mockResolvedValue({ ownerId: 'user_1', name: 'Acme' });
  });

  const base = { paymentRef: 'square:pay_1', rail: 'square' as const, amount: 150 };

  it('settles the named invoice without scanning for candidates', async () => {
    mock(prisma.invoice.findUnique).mockResolvedValue({
      id: 'inv_abc',
      number: 'INV-0042',
      businessId: 'biz_1',
      status: 'sent',
      subtotal: 150,
    });

    const outcome = await reconcileIncomingPayment({ ...base, invoiceId: 'inv_abc' });

    expect(outcome.status).toBe('matched');
    expect(outcome.invoiceId).toBe('inv_abc');
    expect(markInvoicePaid).toHaveBeenCalledWith('biz_1', 'inv_abc', 'square:pay_1');
    // The amount scan is the thing that could tie with another invoice.
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalled();
  });

  it('is a duplicate no-op when the paymentRef was already claimed', async () => {
    mock(prisma.reconciliationMatch.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    mock(prisma.reconciliationMatch.findUnique).mockResolvedValue({
      id: 'match_x',
      status: 'matched',
      invoiceId: 'inv_abc',
      confidence: 1,
    });

    const outcome = await reconcileIncomingPayment({ ...base, invoiceId: 'inv_abc' });

    expect(outcome.duplicate).toBe(true);
    expect(markInvoicePaid).not.toHaveBeenCalled();
    expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
  });

  it('records an orphan rather than guessing when the named invoice is gone', async () => {
    mock(prisma.invoice.findUnique).mockResolvedValue(null);

    const outcome = await reconcileIncomingPayment({ ...base, invoiceId: 'inv_deleted' });

    expect(outcome.status).toBe('orphan');
    expect(markInvoicePaid).not.toHaveBeenCalled();
    // Crucially, it must NOT fall back to an amount scan: that could settle an
    // unrelated invoice that happens to match.
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it('records an orphan when the named invoice is already paid', async () => {
    mock(prisma.invoice.findUnique).mockResolvedValue({
      id: 'inv_abc',
      number: 'INV-0042',
      businessId: 'biz_1',
      status: 'paid',
      subtotal: 150,
    });

    const outcome = await reconcileIncomingPayment({ ...base, invoiceId: 'inv_abc' });

    expect(outcome.status).toBe('orphan');
    expect(outcome.reasoning).toMatch(/already paid/i);
    expect(markInvoicePaid).not.toHaveBeenCalled();
  });

  it('still falls back to amount matching when no invoice id was supplied', async () => {
    // The pre-existing behaviour must be preserved for rails that cannot carry
    // a reference (bank transfers, for instance).
    mock(prisma.invoice.findMany).mockResolvedValue([
      { id: 'inv_1', number: 'INV-0001', subtotal: 150, status: 'sent', dateDue: new Date(), clientId: 'cli_1' },
    ]);
    mock(prisma.invoice.findUnique).mockResolvedValue({
      id: 'inv_1',
      businessId: 'biz_1',
      number: 'INV-0001',
      status: 'sent',
    });

    const outcome = await reconcileIncomingPayment(base);

    expect(outcome.status).toBe('matched');
    expect(markInvoicePaid).toHaveBeenCalledWith('biz_1', 'inv_1', 'square:pay_1');
  });
});

/**
 * Webhook signature verification.
 *
 * This is the gate that made every Square delivery fail. Two independent bugs
 * are pinned here, because either alone produces a 401 with a correct signing
 * key and no clue why:
 *
 *  - the handler read `x-square-signature`, which Square never sends (it sends
 *    `x-square-hmacsha256-signature`), so the signature was always undefined;
 *  - the body was re-serialised with JSON.stringify instead of using the raw
 *    bytes Square signed.
 */

describe('Square webhook signature verification', () => {
  const SECRET = 'sq0csp-signing-key';
  const URL = 'https://pabandi.onrender.com/api/v1/square-checkout/webhook';

  const sign = (body: string) =>
    crypto.createHmac('sha256', SECRET).update(URL + body).digest('base64');

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SQUARE_WEBHOOK_SECRET = SECRET;
  });

  const originalSecret = process.env.SQUARE_WEBHOOK_SECRET;
  afterEach(() => {
    process.env.SQUARE_WEBHOOK_SECRET = originalSecret;
  });

  it('accepts a correctly signed payload', async () => {
    const body = JSON.stringify({ type: 'payment.updated', data: { object: { payment: { id: 'p1' } } } });
    await expect(squareService.verifyWebhook(body, sign(body), URL)).resolves.toBe(true);
  });

  it('rejects when the header Square actually sends is absent', async () => {
    const body = JSON.stringify({ type: 'payment.updated' });
    // What the handler used to read. Square never sends this header, so this
    // is the case that returned 401 for every real delivery.
    await expect(squareService.verifyWebhook(body, undefined, URL)).resolves.toBe(false);
  });

  it('rejects a tampered body', async () => {
    const body = JSON.stringify({ type: 'payment.updated' });
    const signature = sign(body);
    const tampered = JSON.stringify({ type: 'payment.completed' });
    await expect(squareService.verifyWebhook(tampered, signature, URL)).resolves.toBe(false);
  });

  it('rejects a signature made for a different URL', async () => {
    // Square signs notificationUrl + body, so a payload re-signed for another
    // endpoint must not verify here.
    const body = JSON.stringify({ type: 'payment.updated' });
    const wrongUrl = 'https://evil.example/api/v1/square-checkout/webhook';
    const signature = crypto.createHmac('sha256', SECRET).update(wrongUrl + body).digest('base64');
    await expect(squareService.verifyWebhook(body, signature, URL)).resolves.toBe(false);
  });

  it('rejects everything in production when no signing key is configured', async () => {
    delete process.env.SQUARE_WEBHOOK_SECRET;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const body = JSON.stringify({ type: 'payment.updated' });

    // Fail closed: an unset secret must not mean "accept anything", which
    // would make this an unauthenticated "mark any invoice paid" endpoint.
    await expect(squareService.verifyWebhook(body, 'anything', URL)).resolves.toBe(false);

    process.env.NODE_ENV = previousNodeEnv;
  });

  it('does not throw on a signature of the wrong length', async () => {
    // timingSafeEqual throws on a length mismatch rather than returning false,
    // which would turn a malformed header into a 500 instead of a 401.
    const body = JSON.stringify({ type: 'payment.updated' });
    await expect(squareService.verifyWebhook(body, 'short', URL)).resolves.toBe(false);
  });
});
