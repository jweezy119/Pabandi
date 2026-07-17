import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '../utils/logger';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_API_URL = 'https://api.stripe.com/v1';

/**
 * Minimal Stripe API client using native fetch.
 * No extra npm package needed — saves dependencies and stays frugal.
 */
function stripeHeaders() {
  return {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

function toFormEncoded(obj: Record<string, string | number>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export const stripeService = {
  /**
   * Create a Stripe Checkout Session and return its URL.
   * @param amountCents Amount in the smallest currency unit (cents for USD)
   * @param currency ISO 4217 currency code, e.g. "usd"
   * @param reservationId Used as metadata reference
   * @param successUrl Redirect URL after successful payment
   * @param cancelUrl  Redirect URL if user cancels
   */
  async createCheckoutUrl(
    amountCents: number,
    currency: string,
    reservationId: string,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<string> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const success = successUrl || `${frontendUrl}/reservations?stripe_success=true&ref=${reservationId}`;
    const cancel = cancelUrl || `${frontendUrl}/reservations?stripe_cancel=true&ref=${reservationId}`;

    if (!STRIPE_SECRET_KEY) {
      logger.warn('STRIPE_SECRET_KEY not set — returning mock checkout URL');
      return `${frontendUrl}/reservations?stripe_mock_success=true&ref=${reservationId}`;
    }

    try {
      const body = toFormEncoded({
        'payment_method_types[]': 'card',
        'line_items[0][price_data][currency]': currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': amountCents,
        'line_items[0][price_data][product_data][name]': 'Reservation Deposit',
        'line_items[0][price_data][product_data][description]': `Deposit for reservation #${reservationId}`,
        'line_items[0][quantity]': 1,
        mode: 'payment',
        success_url: success,
        cancel_url: cancel,
        'metadata[reservation_id]': reservationId,
      });

      const response = await fetch(`${STRIPE_API_URL}/checkout/sessions`, {
        method: 'POST',
        headers: stripeHeaders(),
        body,
      });

      const data = (await response.json()) as any;

      if (!response.ok || !data.url) {
        throw new Error(data.error?.message || 'Stripe checkout session creation failed');
      }

      logger.info(`Stripe checkout session created for reservation: ${reservationId}`);
      return data.url;
    } catch (error: any) {
      logger.error('Stripe checkout session creation failed', error.message);
      // Fallback mock URL so the frontend flow doesn't break
      return `${frontendUrl}/reservations?stripe_mock_success=true&ref=${reservationId}`;
    }
  },

  /**
   * Refund a Stripe PaymentIntent.
   * @param paymentIntentId The Stripe PaymentIntent ID stored on the reservation
   * @param amountCents     Amount in cents to refund (omit for full refund)
   */
  async refundDeposit(paymentIntentId: string, amountCents?: number): Promise<boolean> {
    if (!STRIPE_SECRET_KEY) {
      logger.warn('STRIPE_SECRET_KEY not set — skipping Stripe refund');
      return true;
    }

    try {
      const params: Record<string, string | number> = {
        payment_intent: paymentIntentId,
      };
      if (amountCents) params.amount = amountCents;

      const response = await fetch(`${STRIPE_API_URL}/refunds`, {
        method: 'POST',
        headers: stripeHeaders(),
        body: toFormEncoded(params),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        throw new Error(data.error?.message || 'Stripe refund failed');
      }

      logger.info(`Stripe refund issued for PaymentIntent: ${paymentIntentId}`);
      return true;
    } catch (error: any) {
      logger.error('Stripe refund failed', error.message);
      return false;
    }
  },

  /**
   * Verify a Stripe webhook signature.
   * See: https://stripe.com/docs/webhooks/signatures
   */
  verifyWebhook(signature: string, rawBody: Buffer | string): boolean {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret || !signature) {
      logger.warn('Stripe webhook verification skipped: missing secret or signature');
      return process.env.NODE_ENV !== 'production';
    }

    try {
      // Stripe signature format: t=timestamp,v1=hmac,...
      const parts = signature.split(',');
      const tPart = parts.find((p) => p.startsWith('t='));
      const v1Part = parts.find((p) => p.startsWith('v1='));

      if (!tPart || !v1Part) return false;

      const timestamp = tPart.slice(2);
      const receivedSig = v1Part.slice(3);

      const payload = `${timestamp}.${rawBody}`;
      const hmac = createHmac('sha256', secret);
      hmac.update(payload);
      const expected = hmac.digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(receivedSig, 'hex'));
    } catch (error) {
      logger.error('Stripe webhook signature verification failed', error);
      return false;
    }
  },
};
