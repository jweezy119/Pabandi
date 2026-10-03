/**
 * Whop client — checkout creation and Standard Webhooks verification.
 *
 * WHY WHOP FOR SUBSCRIPTIONS
 * Square has no marketplace product and no way to charge a connected account, so
 * it cannot collect a merchant's fee at all (see square-invoice.service.ts for
 * how usage fees are collected instead). Whop handles the card, the ACH mandate,
 * the retries and the dunning, which is exactly the manual work that does not
 * scale past a few dozen merchants.
 *
 * WHY NOT WHOP FOR THE USAGE FEE
 * Whop's application_fee_amount comes from a sale the *merchant* makes. Our usage
 * fee is computed from their sales — there is no sale to attach it to. Whop does
 * not solve that, and inventing a synthetic transaction to charge through it would
 * be worse than invoicing.
 *
 * WEBHOOKS ARE NOT LIKE SQUARE'S
 * Square signs the raw body with a shared HMAC. Whop follows the Standard
 * Webhooks spec: the signed content is `webhook-id.webhook-timestamp.body`, the
 * key is the base64 part of a `whsec_`-prefixed secret, and the signature is
 * base64. Copying Square's verifier here would reject every delivery.
 *
 * Three things the spec requires and that are easy to skip:
 *   - Timestamp tolerance, or a captured delivery replays forever.
 *   - Constant-time comparison, or the endpoint becomes a signing oracle.
 *   - Multiple space-delimited signatures, which is how zero-downtime secret
 *     rotation works. Treating the header as one signature breaks rotation.
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

/** The spec's signing-content separator. */
const SEPARATOR = '.';

/**
 * How far a delivery's timestamp may be from now.
 *
 * Five minutes, per the reference implementation. This is the replay defence: a
 * captured webhook stays valid forever without it, and this endpoint grants
 * subscription tiers that change what we charge.
 */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export const WHOP_API_BASE = 'https://api.whop.com';

function apiKey(): string | null {
  const key = (process.env.WHOP_API_KEY || '').trim();
  return key.length > 0 ? key : null;
}

/** True when Whop is configured. Never throws — callers branch on the result. */
export function whopConfigured(): boolean {
  return apiKey() !== null;
}

/**
 * The plan id for a tier, from env.
 *
 * Plans are created in Whop's dashboard and referenced by id. Inventing one here
 * would mean guessing at their id format, and a wrong id produces a checkout that
 * 404s for the merchant at the worst possible moment.
 */
export function planIdForTier(tier: string): string | null {
  const envVar = {
    free: 'WHOP_PLAN_FREE',
    pro: 'WHOP_PLAN_PRO',
    business: 'WHOP_PLAN_BUSINESS',
  }[tier.toLowerCase()];
  if (!envVar) return null;
  const id = (process.env[envVar] || '').trim();
  return id.length > 0 ? id : null;
}

export interface WhopCheckoutResult {
  ok: boolean;
  purchaseUrl?: string;
  checkoutId?: string;
  /** Why it failed, when it did. Safe to show a merchant. */
  reason?: string;
}

/**
 * Create a checkout for a subscription tier.
 *
 * Uses the inline-plan form so a tier can be sold without a pre-created plan
 * object, but prefers an existing plan id when one is configured: plans carry
 * their own trial and renewal settings, and re-declaring them here would mean two
 * places to keep a price in sync.
 *
 * Never throws. A merchant being unable to subscribe must not take down whatever
 * page they were on.
 */
export async function createSubscriptionCheckout(params: {
  tier: string;
  businessId: string;
  businessName: string;
  /** Usd dollars, matching Whop's plan currency. */
  monthlyPrice: number;
  /** Where Whop sends the merchant after payment. */
  redirectUrl?: string;
  trialDays?: number;
}): Promise<WhopCheckoutResult> {
  const key = apiKey();
  if (!key) {
    return { ok: false, reason: 'Subscriptions are not configured (WHOP_API_KEY is unset).' };
  }

  const planId = planIdForTier(params.tier);

  // Whop's own identifier scheme for the business, so a membership can be traced
  // back without a lookup table. Whop requires this to be a unique string; the
  // business id is.
  const companyId = `pabandi_business_${params.businessId}`;

  const inlinePlan = {
    title: `Pabandi ${params.tier.charAt(0).toUpperCase()}${params.tier.slice(1)}`,
    plan_type: 'renewal',
    billing_period: 30,
    initial_price: params.monthlyPrice,
    renewal_price: params.monthlyPrice,
    currency: 'usd',
    release_method: 'buy_now',
    visibility: 'hidden',
    ...(params.trialDays ? { trial_period_days: params.trialDays } : {}),
    metadata: {
      pabandiBusinessId: params.businessId,
      pabandiTier: params.tier,
    },
  };

  try {
    const res = await fetch(`${WHOP_API_BASE}/checkout-configurations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        company_id: companyId,
        // A plan id and an inline plan are mutually exclusive; sending both is a
        // 400 from Whop, so exactly one is sent.
        ...(planId ? { plan_id: planId } : { plan: inlinePlan }),
        ...(params.redirectUrl ? { redirect_url: params.redirectUrl } : {}),
        checkout_configuration: { language: 'en' },
        metadata: {
          pabandiBusinessId: params.businessId,
          pabandiTier: params.tier,
        },
      }),
    });

    const data = (await res.json()) as any;
    if (!res.ok) {
      const detail = data?.message ?? data?.error ?? `Whop returned ${res.status}`;
      logger.error(`[Whop] Checkout creation failed for tier ${params.tier}: ${detail}`);
      return { ok: false, reason: detail };
    }

    const purchaseUrl = data?.purchase_url ?? data?.checkout_configuration?.purchase_url;
    if (!purchaseUrl) {
      return { ok: false, reason: 'Whop created a checkout but returned no purchase URL.' };
    }

    logger.info(`[Whop] Checkout created for business ${params.businessId} on ${params.tier}.`);
    return { ok: true, purchaseUrl, checkoutId: data?.id };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.error(`[Whop] Checkout request threw: ${detail}`);
    return { ok: false, reason: 'Could not reach the subscription provider.' };
  }
}

/**
 * Decode a Standard Webhooks secret.
 *
 * `whsec_` is an identification prefix, not part of the key — the actual secret is
 * the base64 after it. Passing the whole string to HMAC would produce a signature
 * that never matches, which looks like "webhooks are broken" rather than a bug.
 *
 * Base64 padding is added defensively: some dashboards display the secret without
 * its trailing `=`.
 */
export function decodeWebhookSecret(secret: string): Buffer | null {
  let raw = secret.trim();
  if (raw.startsWith('whsec_')) raw = raw.slice('whsec_'.length);
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw + '='.repeat((4 - (raw.length % 4)) % 4), 'base64');
    // A secret that decodes to nothing is a misconfiguration, not a valid secret.
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Verify a Standard Webhooks delivery.
 *
 * Fails closed at every step: no secret configured, missing headers, an implausible
 * timestamp, or no matching signature all return false. There is no path that
 * accepts an unverified delivery, because accepting one would let anyone grant
 * themselves a tier and change what we charge.
 */
export function verifyWebhookDelivery(params: {
  headers: Record<string, string | undefined>;
  rawBody: string;
  /** Overrides WHOP_WEBHOOK_SECRET. For tests. */
  secret?: string;
  now?: Date;
}): boolean {
  const configured = (params.secret ?? process.env.WHOP_WEBHOOK_SECRET ?? '').trim();
  if (!configured) {
    logger.warn('[Whop] Rejected webhook: WHOP_WEBHOOK_SECRET is not configured.');
    return false;
  }

  const key = decodeWebhookSecret(configured);
  if (!key) {
    logger.error('[Whop] Rejected webhook: WHOP_WEBHOOK_SECRET is not a valid whsec_ value.');
    return false;
  }

  const id = params.headers['webhook-id'];
  const timestamp = params.headers['webhook-timestamp'];
  const signatureHeader = params.headers['webhook-signature'];

  if (!id || !timestamp || !signatureHeader) {
    logger.warn('[Whop] Rejected webhook: missing webhook-id, -timestamp or -signature.');
    return false;
  }

  // Replay defence. Without this a captured delivery stays valid indefinitely,
  // and this endpoint decides what a merchant is charged.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    logger.warn('[Whop] Rejected webhook: webhook-timestamp is not a number.');
    return false;
  }
  const now = (params.now ?? new Date()).getTime();
  if (Math.abs(now / 1000 - ts) > WEBHOOK_TOLERANCE_SECONDS) {
    logger.warn('[Whop] Rejected webhook: timestamp outside the tolerance window.');
    return false;
  }

  // The signed content includes the id and timestamp, not just the body. Signing
  // the body alone would let an attacker pair a real body with a fresh timestamp.
  const signedContent = `${id}${SEPARATOR}${timestamp}${SEPARATOR}${params.rawBody}`;
  const expected = crypto.createHmac('sha256', key).update(signedContent, 'utf8').digest();

  // Space-delimited because the sender may sign with both the current and the
  // previous secret during a rotation. One of them matching is the whole point.
  for (const part of signatureHeader.split(' ')) {
    const [version, signature] = part.split(',');
    if (version !== 'v1' || !signature) continue;
    let provided: Buffer;
    try {
      provided = Buffer.from(signature, 'base64');
    } catch {
      continue;
    }
    // Constant-time. A byte-by-byte compare that short-circuits on the first
    // difference turns this endpoint into a signing oracle.
    if (provided.length === expected.length && crypto.timingSafeEqual(provided, expected)) {
      return true;
    }
  }

  logger.warn('[Whop] Rejected webhook: no signature matched.');
  return false;
}

/** True when a status means the merchant is currently paying. */
export function isActiveStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing';
}
