import { Router, type Request, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import {
  createSubscriptionCheckout,
  verifyWebhookDelivery,
  whopConfigured,
} from '../services/whop.service';
import {
  applyMembershipEvent,
  getSubscription,
  subscriberCounts,
  monthlyRecurringRevenueCents,
  type SubscriptionStatus,
} from '../services/subscription.service';
import { PAID_TIERS, SUBSCRIPTION_TIERS, type SubscriptionTier } from '../config/subscriptions';

/**
 * Subscriptions — the upgrade door.
 *
 * Task 1.2. The tier guard (task 0.1) refuses writes past a plan's limits. With
 * nothing to upgrade TO, that is a wall rather than a business model: a merchant
 * hitting 50 clients had no way to buy the next 5,000.
 *
 * Both halves are needed. Checkout alone leaves a paying merchant stuck on free
 * until the next webhook, and a webhook alone leaves nothing to pay through.
 *
 * BILLING IS WHOP'S, NOT OURS
 * ---------------------------
 * No card data, no PCI scope, no dunning logic written here. Pabandi stores the
 * subscription state Whop tells us about. `priceCents` is a snapshot of what was
 * sold, so a later price change cannot rewrite what a merchant agreed to.
 */

const router = Router();

/**
 * Resolve the caller's platform business id.
 *
 * Falls back to the CRM context because a business that has enrolled in Contact
 * OS reaches this through /crm/* and a plain merchant reaches it through
 * /contact/*. Passing the business id in the body was never allowed: the token is
 * the only authority, and accepting one would let a caller upgrade someone else's
 * business.
 */
function callerBusinessId(req: AuthRequest): string {
  const fromCrm = (req as any).crm?.businessId;
  if (fromCrm) return fromCrm as string;

  try {
    const crm = requireCrmContext(req);
    if (crm.businessId) return crm.businessId;
  } catch {
    // Not enrolled in Contact OS. Fall through to the token, which is correct:
    // the merchant's own business is what they are paying for.
  }

  const tokenBusiness = (req as any).user?.businessId ?? (req as any).user?.activeBusinessId;
  if (typeof tokenBusiness === 'string' && tokenBusiness) return tokenBusiness;

  throw new CustomError('No business is associated with this account', 403);
}

// ── Public (unauthenticated) ────────────────────────────────────────────────

/**
 * POST /api/v1/subscriptions/webhook
 * Whop Standard Webhooks delivery.
 *
 * NOT behind `authenticate`: Whop is the caller and has no Pabandi token. The
 * signature is the authentication, verified against the raw body — which is why
 * index.ts captures `req.rawBody` in its json verify hook. Parsing and re-stringify
 * the body would change the bytes and the signature would never match.
 *
 * Always answers 200 once the signature is valid, including for events we do not
 * act on. A non-2xx makes Whop retry, and retrying an event we deliberately
 * ignored is pure noise.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  // The signature covers the exact bytes Whop sent, so this must be the raw
  // capture and never a re-stringified object — re-serialising changes the bytes
  // and the signature would never match, leaving every subscription inactive.
  //
  // If rawBody is absent the delivery is refused rather than verified against a
  // guess. Silently falling back to JSON.stringify(req.body) is what this used to
  // do, and it is a fail-open: it produces a signature check that looks like it ran
  // and rejects every real delivery, which reads as "webhooks are broken".
  const captured = (req as Request & { rawBody?: string }).rawBody;
  const rawBody = typeof captured === 'string' ? captured : null;
  if (rawBody === null) {
    logger.error('[Subscriptions] Rejected webhook: raw body was not captured.');
    return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
  }

  const valid = verifyWebhookDelivery({
    headers: req.headers as Record<string, string | undefined>,
    rawBody,
  });

  if (!valid) {
    // 401 and nothing else. Logging the reason is done inside the verifier.
    return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
  }

  const event = req.body ?? {};
  const eventType: string = event?.type ?? event?.event ?? '';

  try {
    // Whop names membership events `membership.*`. Everything else (payouts,
    // disputes, company updates) is acknowledged and ignored.
    if (!String(eventType).startsWith('membership.')) {
      logger.info(`[Subscriptions] Ignoring webhook type ${eventType}.`);
      return res.json({ success: true, ignored: true });
    }

    const data = event?.data ?? {};
    const businessId: string | undefined =
      data?.pabandiBusinessId ??
      data?.metadata?.pabandiBusinessId ??
      data?.company?.metadata?.pabandiBusinessId;

    if (!businessId) {
      // Verified and from Whop, but not ours to apply. Whop will not retry a 2xx,
      // which is right: there is no business to attach it to and retrying will
      // not change that.
      logger.warn('[Subscriptions] Membership webhook carried no pabandiBusinessId.');
      return res.json({ success: true, ignored: true });
    }

    const status = membershipStatus(eventType, data?.status);

    const result = await applyMembershipEvent({
      webhookId: String(req.headers['webhook-id'] ?? `${eventType}:${businessId}`),
      businessId,
      tier: String(data?.pabandiTier ?? data?.metadata?.pabandiTier ?? data?.plan?.name ?? 'free')
        .toLowerCase()
        .replace(/^pabandi\s+/, ''),
      status,
      whopMembershipId: data?.id ?? data?.membership_id ?? null,
      whopPlanId: data?.plan_id ?? null,
      whopCompanyId: data?.company_id ?? null,
      priceCents:
        typeof data?.price_cents === 'number' ? data.price_cents : undefined,
      currency: typeof data?.currency === 'string' ? data.currency : undefined,
      currentPeriodStart: parseDate(data?.current_period_start),
      currentPeriodEnd: parseDate(data?.current_period_end),
      cancelAtPeriodEnd: Boolean(data?.cancel_at_period_end ?? data?.cancel_at_period_end_ms),
    });

    return res.json({ success: true, applied: result.applied, reason: result.reason });
  } catch (err) {
    // The signature was valid, so this is our bug or a transient failure. 500 makes
    // Whop retry, which is what we want for a real error — unlike an ignored event.
    logger.error('[Subscriptions] Webhook handler threw', err);
    return res.status(500).json({ success: false, error: 'Handler error' });
  }
});

function parseDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(typeof value === 'number' ? value * 1000 : String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Map a Whop membership event onto our status vocabulary.
 *
 * `membership.*` covers creation, updating, cancellation and termination. The
 * distinction that matters commercially: cancelling at period end still serves
 * until then, and marking it canceled immediately would charge the merchant the
 * wrong fee for the rest of the month.
 */
function membershipStatus(eventType: string, rawStatus: unknown): SubscriptionStatus {
  const s = String(rawStatus ?? '').toLowerCase();
  if (s === 'canceled' || s === 'cancelled') {
    // cancel_at_period_end is handled by the caller; see applyMembershipEvent.
    return 'canceled';
  }
  if (s === 'past_due' || s === 'unpaid') return s as SubscriptionStatus;
  if (s === 'trialing' || s === 'trial') return 'trialing';
  if (s === 'active') return 'active';
  if (String(eventType).includes('terminat')) return 'canceled';
  if (String(eventType).includes('creat')) return 'active';
  return 'inactive';
}

// ── Authenticated ──────────────────────────────────────────────────────────

router.use(authenticate);

/**
 * GET /api/v1/subscriptions/me
 * The caller's plan. This is also what the UI reads to decide whether to show an
 * upgrade prompt, so it must work for a free merchant with no subscription row.
 */
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = callerBusinessId(req);
    const subscription = await getSubscription(businessId);
    res.json({ success: true, data: subscription });
  } catch (err) {
    next(err, res);
  }
});

/**
 * POST /api/v1/subscriptions/checkout
 * Start an upgrade. Returns a Whop purchase URL to redirect to.
 *
 * Free is not purchasable, so it is refused rather than sent to a checkout that
 * would charge nothing — a redirect to a free "purchase" is the kind of thing that
 * looks broken to a customer and generates a support ticket.
 */
router.post('/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = callerBusinessId(req);
    const tier = String(req.body?.tier ?? '').toLowerCase() as SubscriptionTier;

    if (!(tier in SUBSCRIPTION_TIERS) || !PAID_TIERS.includes(tier)) {
      throw new CustomError(
        `Choose a paid plan. Available: ${PAID_TIERS.join(', ')}.`,
        400,
      );
    }

    if (!whopConfigured()) {
      // 503, not 400: nothing is wrong with the request, the billing provider is
      // simply not configured. A 400 would tell the merchant their click was bad.
      throw new CustomError('Subscriptions are not available right now. Please try again later.', 503);
    }

    const result = await createSubscriptionCheckout({
      tier,
      businessId,
      businessName: String(req.body?.businessName ?? 'your business'),
      monthlyPrice: SUBSCRIPTION_TIERS[tier].monthlyPrice ?? 0,
      redirectUrl: process.env.SUBSCRIPTION_REDIRECT_URL || undefined,
    });

    if (!result.ok) {
      throw new CustomError(result.reason ?? 'Could not start checkout.', 502);
    }

    res.json({ success: true, data: { purchaseUrl: result.purchaseUrl } });
  } catch (err) {
    next(err, res);
  }
});

/**
 * GET /api/v1/subscriptions/pricing
 * The public price table, generated from the same definitions checkout is built
 * from, so what a merchant reads and what they are charged cannot differ.
 */
router.get('/pricing', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      currency: 'USD',
      tiers: PAID_TIERS.map((key) => {
        const t = SUBSCRIPTION_TIERS[key];
        return {
          tier: t.tier,
          monthlyPrice: t.monthlyPrice,
          limits: t.limits,
          headline: t.headline,
        };
      }),
    },
  });
});

/** Operational counters. No PII, and useful for confirming billing is working. */
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [counts, mrrCents] = await Promise.all([subscriberCounts(), monthlyRecurringRevenueCents()]);
    res.json({
      success: true,
      data: { counts, mrrCents, mrrUsd: mrrCents / 100 },
    });
  } catch (err) {
    next(err, res);
  }
});

function next(err: unknown, res: Response) {
  const statusCode = (err as { statusCode?: number })?.statusCode ?? 500;
  const message = err instanceof Error ? err.message : String(err);
  if (statusCode >= 500) logger.error('[Subscriptions]', err);
  res.status(statusCode).json({ success: false, error: message });
}

export default router;