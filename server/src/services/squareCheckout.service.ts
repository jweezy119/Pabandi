import { SquareClient, SquareEnvironment } from 'square';
import { logger } from '../utils/logger';
import { squareEnvironment, squareBaseUrl, parseInvoiceNote } from './square-connection.service';

const accessToken = process.env.SQUARE_ACCESS_TOKEN || '';

/**
 * Environment-aware client.
 *
 * This used to be hardcoded to `SquareEnvironment.Production` while
 * square.routes.ts honoured SQUARE_ENV (defaulting to sandbox). The two
 * disagreed, so a sandbox token was pointed at production checkout or vice
 * versa — and a sandbox checkout accepts no real money, so the failure looked
 * like a silent no-op rather than an error.
 */
const squareClient = new SquareClient({
  token: accessToken,
  environment:
    squareEnvironment() === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
});

/** Reconciliation annotation the controller attaches to a processed webhook. */
export interface SquareReconciliationNote {
  status: string;
  duplicate: boolean;
  reasoning: string;
}

export type SquareWebhookResult =
  | {
      type: 'PAYMENT_UPDATED';
      paymentId: string;
      status: string;
      /** Square reports minor units; reconciliation compares against major. */
      amountCents: number | null;
      currency: string | null;
      clientId: string | null;
      /**
       * Set when the payment was created for a Pabandi invoice, read from the
       * `note` we wrote at checkout time. This is what makes reconciliation an
       * exact match instead of a guess on amount alone.
       */
      invoiceId: string | null;
      invoiceNumber: string | null;
      reconciliation?: SquareReconciliationNote;
    }
  | { type: 'REFUND_CREATED'; paymentId: string; amount: unknown }
  | { type: 'UNKNOWN'; eventType: string };

const SQUARE_BASE = squareBaseUrl();
const SQUARE_VERSION = '2026-09-16';
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID || '';

function authHeaders(): Record<string, string> {
  return {
    Authorization: 'Bearer ' + accessToken,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Square-Version': SQUARE_VERSION,
  };
}

export class SquareService {
  /**
   * Create a Square Checkout (hosted payment page)
   * Customer is redirected to Square's hosted page
   */
  async createCheckout(params: {
    referenceId: string;
    amount: number;             // in cents
    currency: string;           // USD
    redirectUrl: string;
    cancelUrl: string;
    note?: string;
    customerEmail?: string;
  }) {
    const cents = Math.round(params.amount);
    if (!Number.isFinite(cents) || cents <= 0) throw new Error('Invalid amount');

    let locationId = SQUARE_LOCATION_ID;
    if (!locationId) {
      const loc = await this.getDefaultLocation();
      if (!loc) throw new Error('No Square location found. Set SQUARE_LOCATION_ID.');
      locationId = loc;
    }

    const resp = await fetch(SQUARE_BASE + '/v2/online-checkout/payment-links', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        idempotency_key: params.referenceId,
        order: {
          location_id: locationId,
          line_items: [
            {
              name: 'Pabandi Booking #' + params.referenceId.slice(-8),
              quantity: '1',
              base_price_money: { amount: cents, currency: params.currency },
            },
          ],
          metadata: { pabandiRef: params.referenceId },
        },
        checkout_options: {
          redirect_url: params.redirectUrl,
          ask_for_shipping_address: false,
        },
        pre_populated_data: params.customerEmail
          ? { buyer_email: params.customerEmail }
          : undefined,
        payment_note: params.note || 'Pabandi booking deposit',
      }),
    });

    const data: any = await resp.json();
    if (!resp.ok || !data?.payment_link?.url) {
      throw new Error(data?.errors?.[0]?.detail || 'Square checkout creation failed');
    }
    return {
      id: data.payment_link.id,
      url: data.payment_link.url,
      orderId: data.payment_link.order_id,
      referenceId: params.referenceId,
    };
  }

  async getDefaultLocation(): Promise<string | null> {
    try {
      const resp = await fetch(SQUARE_BASE + '/v2/locations', {
        headers: authHeaders(),
      });
      const data: any = await resp.json();
      if (!resp.ok || !data?.locations?.length) return null;
      const active = data.locations.find((l: any) => l.status === 'ACTIVE');
      return (active || data.locations[0])?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Get payment details from Square
   */
  async getPayment(paymentId: string) {
    const response = await squareClient.payments.get({ paymentId });
    if (response.payment) {
      return response.payment;
    }
    throw new Error('Payment not found');
  }

  /**
   * Verify a Square webhook signature
   */
  async verifyWebhook(body: string, signature: string | undefined, url: string) {
    const crypto = await import('crypto');
    const webhookSecret = process.env.SQUARE_WEBHOOK_SECRET || '';

    // Fail closed once the secret is configured to be required. An unset
    // SQUARE_WEBHOOK_SECRET used to mean "accept everything", which turns this
    // endpoint into an unauthenticated way to mark any invoice as paid.
    if (!webhookSecret) {
      if (process.env.NODE_ENV === 'production') {
        logger.error(
          '[SquareWebhook] SQUARE_WEBHOOK_SECRET is unset in production. Rejecting webhook rather than accepting an unverifiable request.',
        );
        return false;
      }
      return true;
    }

    if (!signature) return false;

    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(url + body)
      .digest('base64');

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Process Square webhook event
   *
   * The result is echoed straight back in the webhook HTTP response, and the
   * controller annotates it with a reconciliation outcome. That annotation is
   * part of the shape, so it is declared here rather than added ad hoc.
   */
  async processWebhook(event: any): Promise<SquareWebhookResult> {
    const eventType = event.type;
    const data = event.data?.object;

    switch (eventType) {
      case 'payment.completed':
      case 'payment.updated': {
        const payment = data?.payment;
        // Square sends snake_case in webhooks; accept both for safety.
        const amountMoney = payment?.amount_money ?? payment?.amountMoney;
        const note = payment?.note ?? null;
        const ours = parseInvoiceNote(note);

        return {
          type: 'PAYMENT_UPDATED',
          paymentId: payment?.id,
          status: payment?.status,
          // Square reports money in minor units; reconciliation compares
          // against Invoice.subtotal, which is stored in major units.
          amountCents: amountMoney?.amount != null ? Number(amountMoney.amount) : null,
          currency: amountMoney?.currency ?? null,
          // Only trust reference_id when we put a Pabandi client id there.
          // order_id is opaque to us, so it is no longer read as a client id —
          // doing so handed reconciliation a Square identifier it could not use.
          clientId: payment?.reference_id ?? null,
          invoiceId: ours?.invoiceId ?? null,
          invoiceNumber: ours?.invoiceNumber ?? null,
        };
      }
      case 'refund.created':
        return {
          type: 'REFUND_CREATED',
          paymentId: data?.refund?.paymentId,
          amount: data?.refund?.amountMoney,
        };
      default:
        return { type: 'UNKNOWN', eventType };
    }
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(paymentId: string, amountCents: number, reason: string) {
    const response = await squareClient.refunds.refundPayment({
      idempotencyKey: 'refund-' + paymentId + '-' + Date.now(),
      paymentId,
      amountMoney: {
        amount: BigInt(amountCents),
        currency: 'USD',
      },
      reason,
    });
    return response.refund;
  }
}

export const squareService = new SquareService();
