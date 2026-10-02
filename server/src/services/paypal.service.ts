import { logger } from '../utils/logger';
import {
  paymentCredentials,
  webhookId as configuredWebhookId,
  apiBaseUrl,
  type PaypalCredentials,
} from '../config/paypal-credentials';

/**
 * PayPal REST API v2 client — native fetch, zero extra dependencies.
 * Sandbox: api-m.sandbox.paypal.com  |  Live: api-m.paypal.com
 *
 * Credentials are resolved per call rather than captured at import time. The
 * old module-level `process.env` read meant a half-configured pair looked
 * configured until the first API call, which then failed with PayPal's own
 * 401 — indistinguishable from a permissions problem.
 */

async function getAccessToken(creds: PaypalCredentials): Promise<string> {
  const credentials = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
  const PAYPAL_API_URL = apiBaseUrl();

  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = (await response.json()) as any;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || 'PayPal auth failed');
  }
  return data.access_token;
}

export const paypalService = {
  /**
   * Create a PayPal Order (Checkout Session equivalent) and return the approval URL.
   * @param amount        Amount as a decimal string e.g. "9.99"
   * @param currency      ISO 4217 e.g. "USD"
   * @param reservationId Used as a custom reference
   * @param returnUrl     Where PayPal redirects on success
   * @param cancelUrl     Where PayPal redirects on cancel
   */
  async createCheckoutUrl(
    amount: number,
    currency: string,
    reservationId: string,
    returnUrl?: string,
    cancelUrl?: string
  ): Promise<string> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const success =
      returnUrl ||
      `${frontendUrl}/reservations?paypal_success=true&ref=${reservationId}`;
    const cancel =
      cancelUrl ||
      `${frontendUrl}/reservations?paypal_cancel=true&ref=${reservationId}`;

    const creds = paymentCredentials();
    if (!creds) {
      logger.warn('PayPal credentials not set — cannot create checkout');
      return `${frontendUrl}/reservations?paypal_disabled=true&ref=${reservationId}`;
    }

    const PAYPAL_API_URL = apiBaseUrl();

    try {
      const token = await getAccessToken(creds);

      // Format amount to 2 decimal places as string
      const amountStr = (amount / 100).toFixed(2); // input is cents

      const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: reservationId,
              description: `Reservation deposit #${reservationId}`,
              amount: {
                currency_code: currency.toUpperCase(),
                value: amountStr,
              },
            },
          ],
          application_context: {
            return_url: success,
            cancel_url: cancel,
            brand_name: 'Pabandi',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
          },
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        throw new Error(data?.message || 'PayPal order creation failed');
      }

      // Find the approve link
      const approveLink = data.links?.find(
        (l: any) => l.rel === 'approve'
      )?.href;

      if (!approveLink) {
        throw new Error('PayPal approval URL not found in response');
      }

      logger.info(
        `PayPal order created for reservation: ${reservationId} (${currency.toUpperCase()} ${amountStr}) via ${creds.account} credentials`
      );
      return approveLink;
    } catch (error: any) {
      logger.error('PayPal checkout creation failed', error.message);
      return `${frontendUrl}/reservations?paypal_disabled=true&ref=${reservationId}`;
    }
  },

  /**
   * Capture a PayPal order after the customer approves it.
   * Call this from your PayPal return URL handler.
   */
  async captureOrder(orderId: string): Promise<boolean> {
    const creds = paymentCredentials();
    if (!creds) {
      logger.error('PayPal credentials not set — cannot capture order');
      return false;
    }

    const PAYPAL_API_URL = apiBaseUrl();

    try {
      const token = await getAccessToken(creds);

      const response = await fetch(
        `${PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = (await response.json()) as any;

      if (!response.ok || data.status !== 'COMPLETED') {
        throw new Error(`PayPal capture failed: ${data?.message}`);
      }

      logger.info(`PayPal order ${orderId} captured successfully`);
      return true;
    } catch (error: any) {
      logger.error('PayPal capture failed', error.message);
      return false;
    }
  },

  /**
   * Issue a full refund on a captured PayPal order.
   * @param captureId  The capture ID from the completed order
   * @param amountCents Amount to refund in cents (omit for full refund)
   */
  async refundDeposit(
    captureId: string,
    amountCents?: number
  ): Promise<boolean> {
    // A refund that reports success when nothing happened is worse than one that
    // reports failure. This used to `return true` on missing credentials, which
    // meant an unconfigured deployment recorded every deposit as successfully
    // refunded while the customer kept their money.
    const creds = paymentCredentials();
    if (!creds) {
      logger.error('PayPal credentials not set — refund NOT issued');
      return false;
    }

    const PAYPAL_API_URL = apiBaseUrl();

    try {
      const token = await getAccessToken(creds);

      const body: any = {};
      if (amountCents) {
        body.amount = {
          value: (amountCents / 100).toFixed(2),
          currency_code: 'USD',
        };
      }

      const response = await fetch(
        `${PAYPAL_API_URL}/v2/payments/captures/${captureId}/refund`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const data = (await response.json()) as any;

      if (!response.ok) {
        throw new Error(`PayPal refund failed: ${data?.message}`);
      }

      logger.info(`PayPal refund issued for capture: ${captureId}`);
      return true;
    } catch (error: any) {
      logger.error('PayPal refund failed', error.message);
      return false;
    }
  },

  /**
   * Verify a PayPal webhook delivery.
   *
   * PayPal does not use a shared-secret HMAC of the body the way Square does.
   * It signs each delivery with a certificate, and the only way to check that
   * signature is PayPal's own verify-webhook-signature endpoint, which needs
   * the transmission headers, the event, and a webhook id from the dashboard.
   * A `PAYPAL_WEBHOOK_SECRET` can therefore never make this pass.
   *
   * Fails closed. The old version returned `NODE_ENV !== 'production'` when
   * credentials were missing, so in production it returned false but in every
   * other environment it returned true — accepting unverified deliveries.
   */
  async verifyWebhook(
    headers: Record<string, string>,
    rawBody: string,
    webhookIdOverride?: string
  ): Promise<boolean> {
    const creds = paymentCredentials();
    if (!creds) {
      logger.error('PayPal webhook verification failed: no payment credentials configured');
      return false;
    }

    const webhookId = (webhookIdOverride || configuredWebhookId()).trim();
    if (!webhookId) {
      logger.error(
        'PayPal webhook verification failed: PAYPAL_WEBHOOK_ID is not set. Without the dashboard webhook id PayPal cannot confirm the signature.',
      );
      return false;
    }

    // All five transmission headers are part of what PayPal verifies. Any one
    // missing means the request did not come from PayPal's delivery pipeline.
    const required = [
      'paypal-auth-algo',
      'paypal-cert-url',
      'paypal-transmission-id',
      'paypal-transmission-sig',
      'paypal-transmission-time',
    ] as const;
    const missing = required.filter((h) => !headers[h]);
    if (missing.length > 0) {
      logger.warn(`PayPal webhook rejected: missing header(s) ${missing.join(', ')}`);
      return false;
    }

    // cert_url is a URL PayPal's response is validated against. Only ever
    // accept PayPal's own hosts, so a forged header cannot point verification
    // at an attacker-controlled certificate.
    const certUrl = headers['paypal-cert-url'];
    if (!/^https:\/\/api(-m)?(\.sandbox)?\.paypal\.com\//i.test(certUrl)) {
      logger.warn(`PayPal webhook rejected: cert_url is not a PayPal host (${certUrl})`);
      return false;
    }

    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch {
      logger.warn('PayPal webhook rejected: body is not valid JSON');
      return false;
    }

    try {
      const token = await getAccessToken(creds);
      const PAYPAL_API_URL = apiBaseUrl();

      const response = await fetch(
        `${PAYPAL_API_URL}/v1/notifications/verify-webhook-signature`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            auth_algo: headers['paypal-auth-algo'],
            cert_url: headers['paypal-cert-url'],
            transmission_id: headers['paypal-transmission-id'],
            transmission_sig: headers['paypal-transmission-sig'],
            transmission_time: headers['paypal-transmission-time'],
            webhook_id: webhookId,
            webhook_event: event,
          }),
        }
      );

      const data = (await response.json()) as any;
      if (!response.ok) {
        logger.error(`PayPal webhook verification call failed: ${data?.message || response.status}`);
        return false;
      }
      return data.verification_status === 'SUCCESS';
    } catch (error: any) {
      logger.error('PayPal webhook verification failed', error.message);
      return false;
    }
  },
};
