import { logger } from '../utils/logger';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

/**
 * PayPal REST API v2 client — native fetch, zero extra dependencies.
 * Sandbox: api-m.sandbox.paypal.com  |  Live: api-m.paypal.com
 */

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

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

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      logger.warn('PayPal credentials not set — returning mock checkout URL');
      return `${frontendUrl}/reservations?paypal_mock_success=true&ref=${reservationId}`;
    }

    try {
      const token = await getAccessToken();

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
        `PayPal order created for reservation: ${reservationId} (${currency.toUpperCase()} ${amountStr})`
      );
      return approveLink;
    } catch (error: any) {
      logger.error('PayPal checkout creation failed', error.message);
      return `${frontendUrl}/reservations?paypal_mock_success=true&ref=${reservationId}`;
    }
  },

  /**
   * Capture a PayPal order after the customer approves it.
   * Call this from your PayPal return URL handler.
   */
  async captureOrder(orderId: string): Promise<boolean> {
    try {
      const token = await getAccessToken();

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
    if (!PAYPAL_CLIENT_ID) {
      logger.warn('PayPal credentials not set — skipping refund');
      return true;
    }

    try {
      const token = await getAccessToken();

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
   * Verify a PayPal IPN / Webhook event.
   * PayPal uses a verification call-back — check transmission-id header.
   */
  async verifyWebhook(
    headers: Record<string, string>,
    rawBody: string,
    webhookId: string
  ): Promise<boolean> {
    if (!PAYPAL_CLIENT_ID) {
      logger.warn('PayPal webhook verification skipped: no credentials');
      return process.env.NODE_ENV !== 'production';
    }

    try {
      const token = await getAccessToken();

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
            webhook_event: JSON.parse(rawBody),
          }),
        }
      );

      const data = (await response.json()) as any;
      return data.verification_status === 'SUCCESS';
    } catch (error: any) {
      logger.error('PayPal webhook verification failed', error.message);
      return false;
    }
  },
};
