/**
 * Square Invoices — automated collection of a merchant fee statement.
 *
 * WHY THIS AND NOT A DEDUCTION
 * Payments settle into the merchant's own Square account (resolveSquareCredentials
 * prefers the merchant token), so there is nothing to take a percentage out of at
 * the point of charge. The fee is accrued when the charge happens and collected
 * later. This module is the "later": Square hosts a payment page, emails the
 * merchant, and tells us when it settles.
 *
 * WHY SQUARE INVOICES SPECIFICALLY
 * Square has no marketplace product and no destination routing — there is no
 * way to charge a connected account. That was checked, not assumed. What Square
 * does have is Invoices: create an Order plus an Invoice in Pabandi's account,
 * publish it, and Square handles delivery, the payment page, and reconciliation.
 * The merchant pays their own fee with a card they already have.
 *
 * WHAT THIS DOES NOT SOLVE
 * Collecting $185 costs the merchant 2.9% + 30¢ — about 19% of the fee. That is
 * their cost, not ours, and it is why the tiering rule exists: this is the right
 * mechanism for merchants whose fee makes the card fee immaterial, and the wrong
 * one for a solo cleaner. Nothing here decides that; the caller does.
 *
 * CAPABILITY DEPENDENCY
 * Requires INVOICES_WRITE and ORDERS_WRITE on the app, plus a location. The OAuth
 * scopes we request today are MERCHANT_PROFILE_READ PAYMENTS_READ PAYMENTS_WRITE
 * ITEMS_READ ORDERS_READ — INVOICES_WRITE is missing, so this will 403 until it is
 * added and merchants re-consent. `sendStatementViaSquare` reports that as a
 * distinct capability error rather than a generic failure, because "your app isn't
 * approved for invoices" and "Square is down" need different responses.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/errorHandler';
import {
  squareBaseUrl,
  platformAccessToken,
  platformLocation,
} from './square-connection.service';

const SQUARE_VERSION = '2026-09-16';

/** Square rejects these as unpayable, and a fee statement is never one. */
const MIN_INVOICE_CENTS = 100; // $1.00

export type SendResult =
  | { ok: true; squareInvoiceId: string; paymentLink: string }
  | { ok: false; reason: 'not_configured' | 'below_minimum' | 'capability' | 'rejected'; detail?: string };

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Square-Version': SQUARE_VERSION,
  };
}

/** True when Square refused us for a permissions reason rather than a bad request. */
function isCapabilityError(status: number, detail: string): boolean {
  return status === 403 || status === 401 || /permission|scope|not authorized|not enabled/i.test(detail);
}

/**
 * Turn a fee statement into a Square invoice and publish it.
 *
 * Order of operations matters. Square's Invoices API requires an Order to exist
 * before an Invoice can reference it, and the invoice's `payment_requests` must
 * sum exactly to the order's `total_money` — a mismatch is rejected. Both are
 * created under one idempotency key pair so a retry cannot produce two orders and
 * two half-invoices.
 */
export async function sendStatementViaSquare(params: {
  statementNumber: string;
  totalCents: number;
  currency: string;
  recipientEmail: string;
  recipientName?: string;
  dueAt?: Date | null;
  /** Fee lines, so the merchant sees what they are paying for. */
  lineItems: Array<{ name: string; amountCents: number }>;
}): Promise<SendResult> {
  const token = platformAccessToken();
  const locationId = platformLocation();

  if (!token || !locationId) {
    // The platform token is correct here, not the merchant's: the money has to
    // arrive at Pabandi. Using the merchant's token here would invoice them to
    // themselves, which settles to a dead end and looks like collection.
    return {
      ok: false,
      reason: 'not_configured',
      detail: 'SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID is not set for the platform account.',
    };
  }

  if (params.totalCents < MIN_INVOICE_CENTS) {
    // A $0.40 fee is not worth an invoice, and the card fee on it would exceed
    // the fee itself. Roll it into the next period instead.
    return {
      ok: false,
      reason: 'below_minimum',
      detail: `Fee of ${params.totalCents}c is below the ${MIN_INVOICE_CENTS}c invoicing minimum.`,
    };
  }

  if (params.lineItems.length === 0) {
    return { ok: false, reason: 'rejected', detail: 'An invoice needs at least one line item.' };
  }

  const currency = params.currency.toUpperCase();
  const orderKey = `fee-order-${params.statementNumber}`;
  const invoiceKey = `fee-invoice-${params.statementNumber}`;

  try {
    // 1. Order. line_items must sum to the order total.
    const orderRes = await fetch(`${squareBaseUrl()}/v2/orders`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        idempotency_key: orderKey,
        order: {
          location_id: locationId,
          reference_id: params.statementNumber,
          // A short, statement-descriptive line. Square shows this to the merchant.
          line_items: params.lineItems.map((li) => ({
            name: li.name.slice(0, 500),
            quantity: '1',
            base_price_money: { amount: li.amountCents, currency },
          })),
        },
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      const detail = orderData?.errors?.[0]?.detail ?? `Order creation failed (${orderRes.status})`;
      if (isCapabilityError(orderRes.status, detail)) {
        return {
          ok: false,
          reason: 'capability',
          detail: `${detail}. The Square app needs INVOICES_WRITE and ORDERS_WRITE, which merchants must re-consent to grant.`,
        };
      }
      return { ok: false, reason: 'rejected', detail };
    }

    const orderId = orderData?.order?.id;
    if (!orderId) {
      return { ok: false, reason: 'rejected', detail: 'Square accepted the order but returned no id.' };
    }

    // 2. Draft invoice. payment_requests must equal the order total.
    const invoiceRes = await fetch(`${squareBaseUrl()}/v2/invoices`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        idempotency_key: invoiceKey,
        invoice: {
          order_id: orderId,
          // Square rejects a recipient it cannot deliver to, so this is required
          // before publish rather than optional.
          primary_recipient: {
            email_address: params.recipientEmail,
            ...(params.recipientName ? { given_name: params.recipientName } : {}),
          },
          payment_requests: [
            {
              request_type: 'BALANCE',
              due_date: (params.dueAt ?? new Date()).toISOString().slice(0, 10),
              ...(params.dueAt
                ? {}
                : { scheduled_at: new Date().toISOString() }),
            },
          ],
          delivery_method: 'EMAIL',
          accepted_payment_methods: { card: true },
          // No card on file. Storing one for a B2B fee is a PCI surface for a
          // relationship where the amount changes every month anyway.
          store_payment_method_enabled: false,
          // Square emails the merchant and hosts the page. We do not need to
          // render anything, which is the whole reason for using Invoices over
          // building a checkout.
          invoice_number: params.statementNumber,
        },
      }),
    });

    const invoiceData = await invoiceRes.json();
    if (!invoiceRes.ok) {
      const detail = invoiceData?.errors?.[0]?.detail ?? `Invoice creation failed (${invoiceRes.status})`;
      if (isCapabilityError(invoiceRes.status, detail)) {
        return { ok: false, reason: 'capability', detail: `${detail}. INVOICES_WRITE may not be enabled on this app.` };
      }
      return { ok: false, reason: 'rejected', detail };
    }

    const invoiceId: string | undefined = invoiceData?.invoice?.id;
    if (!invoiceId) {
      return { ok: false, reason: 'rejected', detail: 'Square accepted the invoice but returned no id.' };
    }

    // 3. Publish. A draft invoice is inert — nothing is sent and nothing is
    //    payable until this succeeds, so a failure here leaves a harmless draft
    //    rather than a half-sent bill.
    const publishRes = await fetch(`${squareBaseUrl()}/v2/invoices/${invoiceId}/publish`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        idempotency_key: `fee-publish-${params.statementNumber}`,
        // Without this Square generates a page URL but sends no email. A merchant
        // who never receives it does not pay, so the reminder is the point.
        send_invoice_receipt: true,
      }),
    });

    const publishData = await publishRes.json();
    if (!publishRes.ok) {
      const detail = publishData?.errors?.[0]?.detail ?? `Publish failed (${publishRes.status})`;
      return { ok: false, reason: 'rejected', detail: `Invoice ${invoiceId} created but not published: ${detail}` };
    }

    const paymentLink: string | undefined =
      publishData?.invoice?.public_url ?? invoiceData?.invoice?.public_url;

    if (!paymentLink) {
      return {
        ok: false,
        reason: 'rejected',
        detail: `Invoice ${invoiceId} published but Square returned no payment URL.`,
      };
    }

    logger.info(
      `[SquareInvoice] Published ${params.statementNumber} for ${params.recipientEmail}: ` +
        `${params.totalCents}c (invoice ${invoiceId}).`,
    );
    return { ok: true, squareInvoiceId: invoiceId, paymentLink };
  } catch (err) {
    // Network failure or an unexpected shape. Never throws: a collection attempt
    // must not take down the statement cycle for every other merchant.
    const detail = err instanceof Error ? err.message : String(err);
    logger.error(`[SquareInvoice] Failed to send ${params.statementNumber}: ${detail}`);
    return { ok: false, reason: 'rejected', detail };
  }
}

/**
 * Look up a statement by the Square invoice id a webhook carries.
 *
 * Kept as a single query so the webhook handler cannot accidentally match on
 * amount. A customer deposit of $40 and a fee statement of $40 are different
 * money in opposite directions, and amount-matching between them would settle
 * fees with customer payments.
 */
export async function findStatementBySquareInvoice(
  squareInvoiceId: string,
): Promise<{ id: string; status: string } | null> {
  // findFirst rather than findUnique: the column carries a *partial* unique index
  // (only where non-null), because the overwhelming majority of statements are
  // still collected manually and a full unique index would be a second null row
  // per merchant. Prisma cannot express partial indexes, and marking the column
  // @unique would force every statement to have one — which would make the
  // manual path impossible. Same indexed lookup, no schema lie.
  return prisma.merchantFeeStatement.findFirst({
    where: { squareInvoiceId },
    select: { id: true, status: true },
  });
}

/**
 * Record that a statement now has a Square invoice attached.
 *
 * Only sets sentAt when the invoice was actually published, so `sentAt` means
 * "the merchant has been asked to pay" rather than "we made an object". Dunning
 * reads that distinction.
 */
export async function attachSquareInvoice(params: {
  statementId: string;
  squareInvoiceId: string;
  paymentLink: string;
}): Promise<void> {
  await prisma.merchantFeeStatement.update({
    where: { id: params.statementId },
    data: {
      squareInvoiceId: params.squareInvoiceId,
      paymentLink: params.paymentLink,
      status: 'sent',
      sentAt: new Date(),
    },
  });
}

/**
 * Resolve a merchant's billing email.
 *
 * Prefers the owner User's verified email over the denormalised `ownerEmail` on
 * the business. ownerEmail is set at creation and never re-synced, so a merchant
 * who changed address keeps receiving invoices at an address they no longer
 * control — which is how a statement ends up unpaid with no way to reach anyone.
 */
export async function resolveBillingEmail(
  businessId: string,
): Promise<{ email: string; name?: string } | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      ownerId: true,
      name: true,
      owner: { select: { email: true, firstName: true, lastName: true } },
    },
  });
  if (!business) return null;
  if (business.owner?.email) {
    return {
      email: business.owner.email,
      name: [business.owner.firstName, business.owner.lastName].filter(Boolean).join(' ') || business.name,
    };
  }
  return null;
}

/**
 * Build invoice line items from the statement's individual fees.
 *
 * The merchant sees the breakdown rather than one opaque total. A $4.90 fee
 * labelled "Platform fee" is a charge they cannot check; four rows they can
 * reconcile against their own bookings is not.
 *
 * Grouped by type so a month of deposits is one row rather than forty.
 */
export function buildFeeLineItems(
  fees: Array<{
    sourceType: string;
    feeCents: number;
    currency: string;
    category: string;
    rateBps: number;
  }>,
): Array<{ name: string; amountCents: number }> {
  const byType = new Map<string, { total: number; currency: string; rates: Set<number>; categories: Set<string> }>();

  for (const fee of fees) {
    const key = fee.sourceType;
    const entry = byType.get(key) ?? {
      total: 0,
      currency: fee.currency,
      rates: new Set<number>(),
      categories: new Set<string>(),
    };
    entry.total += fee.feeCents;
    entry.rates.add(fee.rateBps);
    entry.categories.add(fee.category);
    byType.set(key, entry);
  }

  const LABELS: Record<string, string> = {
    invoice: 'Platform fee on invoices',
    booking_deposit: 'Platform fee on booking deposits',
  };

  return [...byType.entries()].map(([type, entry]) => {
    const label = LABELS[type] ?? `Platform fee (${type})`;
    const count = fees.filter((f) => f.sourceType === type).length;
    const rates = [...entry.rates]
      .map((bps) => `${(bps / 100).toFixed(2)}%`)
      .join(' / ');
    return {
      // Square truncates long names, so keep it tight. The detail is here so the
      // merchant can self-serve rather than asking us.
      name: `${label} (${count} ${count === 1 ? 'charge' : 'charges'}${rates ? ` @ ${rates}` : ''})`,
      amountCents: entry.total,
    };
  });
}

export { MIN_INVOICE_CENTS };
