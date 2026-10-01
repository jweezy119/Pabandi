import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { encrypt, decrypt } from '../utils/encryption';

/**
 * Square credentials for a business.
 *
 * WHY THIS IS EXTRACTED
 * `square.routes.ts` implemented OAuth connect, token refresh, location lookup
 * and payment-link creation inline. `squareCheckout.service.ts` did none of it
 * and instead used a single platform-wide SQUARE_ACCESS_TOKEN, hardcoded to the
 * Production environment.
 *
 * Those two disagreed about whose money it is:
 *   - square.routes.ts   → the MERCHANT's own Square account (per-business
 *                          OAuth via SquareConnection). Its own comment says so:
 *                          "the business takes the payment on rails they already
 *                          trust".
 *   - squareCheckout     → Pabandi's platform account.
 *
 * For a service business invoicing a US client, the second means the client's
 * money lands in Pabandi's account with no Square-side split or transfer behind
 * it. This module is the single implementation both now use, and it prefers the
 * merchant connection and falls back to the platform token.
 */

const SQUARE_VERSION = '2026-09-16';
const APP_URL = process.env.APP_URL || 'https://pabandi.com';

export type SquareEnvironmentName = 'sandbox' | 'production';

/**
 * Which Square environment to talk to.
 *
 * `squareCheckout.service.ts` used to hardcode `SquareEnvironment.Production`
 * while `square.routes.ts` honoured SQUARE_ENV (defaulting to sandbox). With the
 * two disagreeing, a sandbox token tested against a sandbox checkout could
 * charge a real card, or a production token would be pointed at sandbox
 * checkout and silently accept no money. One resolver, one answer.
 */
export function squareEnvironment(): SquareEnvironmentName {
  const raw = (process.env.SQUARE_ENVIRONMENT || process.env.SQUARE_ENV || 'sandbox').toLowerCase();
  return raw === 'production' ? 'production' : 'sandbox';
}

export function squareBaseUrl(): string {
  return squareEnvironment() === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

/** The OAuth app credentials, if configured. Absent means no Square at all. */
export function squareAppConfigured(): boolean {
  return Boolean(process.env.SQUARE_APP_ID && process.env.SQUARE_APP_SECRET);
}

/** Platform-level token, if one is configured. This is Pabandi's own account. */
export function platformAccessToken(): string | null {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  return token && token.length > 0 ? token : null;
}

export function protectToken(token: string): string {
  if (process.env.ENCRYPTION_KEY) {
    try {
      return encrypt(token);
    } catch (err) {
      logger.error(`[square] could not encrypt token, storing raw: ${err instanceof Error ? err.message : err}`);
      return token;
    }
  }
  logger.warn('[square] ENCRYPTION_KEY not set — storing OAuth token unencrypted');
  return token;
}

export function unprotectToken(stored: string): string {
  if (!process.env.ENCRYPTION_KEY) return stored;
  try {
    return decrypt(stored);
  } catch {
    // A token written before ENCRYPTION_KEY was configured is stored raw.
    return stored;
  }
}

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<{
  access_token: string;
  expires_at?: string;
}> {
  const res = await fetch(`${squareBaseUrl()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_at?: string;
    message?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data?.message || data?.error_description || 'Square token refresh failed');
  }
  // Narrowed by the guard above; the declared return type records that.
  return { access_token: data.access_token, expires_at: data.expires_at };
}

export async function fetchSquareLocations(accessToken: string): Promise<unknown[]> {
  const res = await fetch(`${squareBaseUrl()}/v2/locations`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const data = (await res.json()) as { locations?: unknown[]; errors?: { detail?: string }[] };
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.detail || 'Square locations fetch failed');
  }
  return data.locations || [];
}

export type SquareCredentialSource = 'merchant' | 'platform';

export interface SquareCredentials {
  accessToken: string;
  locationId: string;
  source: SquareCredentialSource;
  merchantId?: string | null;
}

/**
 * Resolve usable Square credentials for a business.
 *
 * Order matters: the merchant's own connection first, because that is the
 * account the money should land in. The platform token is a fallback for a
 * business that has not completed OAuth, and the caller is told which it got so
 * the situation can be surfaced rather than silently paying Pabandi.
 *
 * Returns null when neither is available, rather than throwing: the caller's
 * correct response is to fall back, not to fail the invoice.
 */
export async function resolveSquareCredentials(businessId: string): Promise<SquareCredentials | null> {
  const conn = await prisma.squareConnection.findUnique({ where: { businessId } });

  if (conn) {
    let accessToken = unprotectToken(conn.accessToken);

    if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date() && conn.refreshToken) {
      const appId = process.env.SQUARE_APP_ID;
      const appSecret = process.env.SQUARE_APP_SECRET;
      if (!appId || !appSecret) {
        logger.warn('[square] token expired and no app credentials to refresh with');
      } else {
        try {
          const refreshed = await refreshAccessToken(conn.refreshToken, appId, appSecret);
          accessToken = refreshed.access_token;
          await prisma.squareConnection.update({
            where: { businessId },
            data: {
              accessToken: protectToken(accessToken),
              ...(refreshed.expires_at ? { tokenExpiresAt: new Date(refreshed.expires_at) } : {}),
              lastSyncedAt: new Date(),
            },
          });
        } catch (err) {
          logger.error(`[square] token refresh failed for business ${businessId}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    // A location is required to create a checkout. Fall back to looking it up
    // rather than failing: the connection may predate location capture.
    let locationId = conn.squareLocationId;
    if (!locationId) {
      try {
        const locations = (await fetchSquareLocations(accessToken)) as { id: string; status?: string }[];
        const active = locations.find((l) => l.status === 'ACTIVE') || locations[0];
        locationId = active?.id;
        if (locationId) {
          await prisma.squareConnection.update({
            where: { businessId },
            data: { squareLocationId: locationId, lastSyncedAt: new Date() },
          });
        }
      } catch (err) {
        logger.warn(`[square] location lookup failed for business ${businessId}: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (locationId) {
      return { accessToken, locationId, source: 'merchant', merchantId: conn.merchantId };
    }
    logger.warn(`[square] business ${businessId} has a connection but no location; falling back to platform token`);
  }

  const platformToken = platformAccessToken();
  const platformLocation = process.env.SQUARE_LOCATION_ID;
  if (platformToken && platformLocation) {
    return { accessToken: platformToken, locationId: platformLocation, source: 'platform' };
  }

  return null;
}

export interface CreateSquarePaymentLinkInput {
  credentials: SquareCredentials;
  /** Stable per-invoice key, so a retried send returns the same link. */
  idempotencyKey: string;
  lineItemName: string;
  /** Major units — dollars. Square is sent minor units. */
  amount: number;
  currency: string;
  /** Echoed back on the payment's `note`, which is how the webhook finds us. */
  note: string;
  buyerEmail?: string;
  redirectUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface CreatedSquarePaymentLink {
  url: string;
  paymentLinkId: string;
  orderId: string;
}

/**
 * Create a Square-hosted payment link for one specific amount.
 *
 * This is the mechanism the invoice flow needed. Square Payment Links created
 * by hand are fixed-price pages: appending `?amount=` to a `square.link` URL
 * does nothing, so an invoice for $15,000 collected whatever the link was
 * pinned at. Each invoice needs its own link, priced from the invoice.
 */
export async function createSquarePaymentLink(
  input: CreateSquarePaymentLinkInput,
): Promise<CreatedSquarePaymentLink> {
  const cents = Math.round(input.amount * 100);
  if (!Number.isFinite(cents) || cents <= 0) {
    throw new Error(`Invalid amount for Square checkout: ${input.amount}`);
  }

  const res = await fetch(`${squareBaseUrl()}/v2/online-checkout/payment-links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.credentials.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Square-Version': SQUARE_VERSION,
    },
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      order: {
        location_id: input.credentials.locationId,
        line_items: [
          {
            name: input.lineItemName,
            quantity: '1',
            base_price_money: { amount: cents, currency: input.currency.toUpperCase() },
          },
        ],
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
      checkout_options: {
        ...(input.redirectUrl ? { redirect_url: input.redirectUrl } : {}),
        ask_for_shipping_address: false,
      },
      ...(input.buyerEmail ? { pre_populated_data: { buyer_email: input.buyerEmail } } : {}),
      payment_note: input.note,
    }),
  });

  const data = (await res.json()) as {
    payment_link?: { id?: string; url?: string; order_id?: string };
    errors?: { detail?: string }[];
  };

  if (!res.ok || !data?.payment_link?.url) {
    throw new Error(data?.errors?.[0]?.detail || 'Square payment link creation failed');
  }

  return {
    url: data.payment_link.url,
    paymentLinkId: data.payment_link.id ?? '',
    orderId: data.payment_link.order_id ?? '',
  };
}

/**
 * The marker written into `payment_note` so the webhook can identify the
 * invoice.
 *
 * WHY THE NOTE AND NOT THE ORDER METADATA
 * createCheckout stores `order.metadata.pabandiRef`, but Square's webhook
 * delivers the *payment* object, and metadata lives on the order — so reading
 * `payment.order_id` yielded an opaque Square id and reconciliation fell back to
 * matching on amount alone. `payment_note` comes back on the payment itself as
 * `note`, which makes the match exact with no extra API call.
 */
export const INVOICE_NOTE_PREFIX = 'pabandi:invoice:';

export function invoiceNote(invoiceId: string, invoiceNumber: string): string {
  return `${INVOICE_NOTE_PREFIX}${invoiceId}:${invoiceNumber}`;
}

/** Pull the invoice id back out of a payment note. Null if it is not ours. */
export function parseInvoiceNote(note: string | null | undefined): { invoiceId: string; invoiceNumber: string } | null {
  if (!note || !note.startsWith(INVOICE_NOTE_PREFIX)) return null;
  const rest = note.slice(INVOICE_NOTE_PREFIX.length);
  const sep = rest.indexOf(':');
  if (sep <= 0) return null;
  return { invoiceId: rest.slice(0, sep), invoiceNumber: rest.slice(sep + 1) };
}