/**
 * Subscription state — the local record of what a merchant is paying.
 *
 * WHY THIS IS A CACHE, AND WHAT WINS WHEN IT DISAGREES
 * Whop owns the billing: the card, the ACH mandate, the retries, the dunning. We
 * keep a local row because `assessFee` reads a merchant's tier on every charge,
 * and asking Whop "what plan is this merchant on" would put a network round-trip
 * in the pricing path of a customer's payment.
 *
 * That makes this a cache, and a cache is only trustworthy if there is a rule for
 * who wins. The rule: **a webhook always overwrites the cache.** Never the other
 * way round. A merchant's card failing does not mean their plan changed, but a
 * membership deactivating definitely does, and only the webhook knows.
 *
 * WHAT A DOWNGRADE DOES NOT DO IMMEDIATELY
 * `cancelAtPeriodEnd` is honoured. A merchant who cancels at the end of the month
 * keeps their tier until then, and treating the cancellation as immediate would
 * charge them the wrong fee for the rest of the period they already paid for.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { tierDefinition, type SubscriptionTier } from '../config/subscriptions';
import { isActiveStatus } from './whop.service';

export type SubscriptionStatus =
  | 'inactive'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid';

export interface SubscriptionView {
  tier: SubscriptionTier;
  status: string;
  /** False when status is not active/trialing. */
  isPaying: boolean;
  priceCents: number;
  currency: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * A merchant's subscription, with free as the answer when they have none.
 *
 * Free rather than null because every business starts free, and "no row" must not
 * become "unknown tier" somewhere downstream — an unknown tier defaults to a 1.0
 * multiplier, which is correct, but only by accident if it is not explicit.
 */
export async function getSubscription(businessId: string): Promise<SubscriptionView> {
  const row = await prisma.merchantSubscription.findUnique({
    where: { businessId },
    select: {
      tier: true,
      status: true,
      priceCents: true,
      currency: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  if (!row) return freeView();

  return {
    tier: tierDefinition(row.tier).tier,
    status: row.status,
    isPaying: isActiveStatus(row.status),
    // No usageFeeMultiplier. The tier buys product features, not a fee discount —
    // see config/subscriptions.ts for why that was removed.
    priceCents: row.priceCents,
    currency: row.currency,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  };
}

export function freeView(): SubscriptionView {
  return {
    tier: 'free',
    status: 'inactive',
    isPaying: false,
    priceCents: 0,
    currency: 'USD',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
}

/**
 * Apply a Whop membership event to the local record.
 *
 * `webhookId` is the idempotency key. Whop redelivers, and applying
 * `membership.activated` twice would restart the period — a merchant paying once
 * and getting two months.
 *
 * One row per business (businessId is UNIQUE), so an event for a merchant who
 * already subscribed updates rather than stacks. `whopMembershipId` is unique too,
 * so two businesses cannot claim the same Whop membership.
 */
export async function applyMembershipEvent(event: {
  webhookId: string;
  businessId: string;
  tier: string;
  status: SubscriptionStatus;
  whopMembershipId?: string | null;
  whopPlanId?: string | null;
  whopCompanyId?: string | null;
  priceCents?: number;
  currency?: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}): Promise<{ applied: boolean; reason?: string }> {
  // An unparseable tier must not be stored. Free is the safe default: it is what
  // an unknown merchant should be charged, not a discount.
  const definition = tierDefinition(event.tier);
  const tier: SubscriptionTier = definition.tier;

  const existing = await prisma.merchantSubscription.findUnique({
    where: { businessId: event.businessId },
    select: { id: true, lastWebhookId: true },
  });

  // Idempotency. Only the most recently applied webhook id is remembered, which
  // is sufficient because Whop delivers in order per membership.
  if (existing?.lastWebhookId === event.webhookId) {
    logger.info(`[Subscriptions] Ignoring redelivered webhook ${event.webhookId}.`);
    return { applied: false, reason: 'duplicate webhook' };
  }

  const priceCents =
    event.priceCents ?? (definition.monthlyPrice != null ? Math.round(definition.monthlyPrice * 100) : 0);

  const data = {
    tier,
    status: event.status,
    whopMembershipId: event.whopMembershipId ?? null,
    whopPlanId: event.whopPlanId ?? null,
    whopCompanyId: event.whopCompanyId ?? null,
    priceCents,
    currency: event.currency ?? 'USD',
    currentPeriodStart: event.currentPeriodStart ?? null,
    currentPeriodEnd: event.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: event.cancelAtPeriodEnd ?? false,
    lastWebhookId: event.webhookId,
    ...(event.status === 'canceled' || event.status === 'unpaid' ? { canceledAt: new Date() } : {}),
  };

  if (existing) {
    await prisma.merchantSubscription.update({ where: { id: existing.id }, data });
  } else {
    try {
      await prisma.merchantSubscription.create({ data: { businessId: event.businessId, ...data } });
    } catch (err: any) {
      // Lost a race against a concurrent event for the same business. The other
      // writer's row is equivalent — same business, same unique key.
      if (err?.code === 'P2002') {
        logger.info(`[Subscriptions] Concurrent event for business ${event.businessId}; re-reading.`);
        await prisma.merchantSubscription.updateMany({
          where: { businessId: event.businessId },
          data,
        });
      } else {
        throw err;
      }
    }
  }

  logger.info(
    `[Subscriptions] Business ${event.businessId} → ${tier}/${event.status}` +
      `${event.cancelAtPeriodEnd ? ' (cancels at period end)' : ''} from webhook ${event.webhookId}.`,
  );
  return { applied: true };
}

/**
 * Mark a subscription lapsed locally, for the case where Whop tells us nothing.
 *
 * An admin action, not an automatic one. A merchant who has not paid should be
 * moved to the standard rate, but deciding that from our side — with no
 * confirmation from the billing provider — would downgrade a paying customer over
 * a delayed webhook.
 */
export async function markLapsed(businessId: string, reason: string): Promise<void> {
  await prisma.merchantSubscription.updateMany({
    where: { businessId },
    data: { status: 'past_due', lastWebhookId: null },
  });
  logger.warn(`[Subscriptions] Business ${businessId} marked past_due (${reason}).`);
}

/** Cancels immediately. Not the same as the merchant cancelling at period end. */
export async function cancelImmediately(businessId: string): Promise<void> {
  await prisma.merchantSubscription.updateMany({
    where: { businessId },
    data: {
      status: 'canceled',
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
      lastWebhookId: null,
    },
  });
  logger.info(`[Subscriptions] Business ${businessId} subscription canceled immediately.`);
}

/** Counts by tier, for a revenue dashboard. Active only — lapsed is not revenue. */
export async function subscriberCounts(): Promise<Record<string, number>> {
  const rows = await prisma.merchantSubscription.groupBy({
    by: ['tier'],
    where: { status: { in: ['active', 'trialing'] } },
    _count: { _all: true },
  });
  const out: Record<string, number> = { free: 0, pro: 0, business: 0 };
  for (const row of rows) {
    out[row.tier] = row._count._all;
  }
  return out;
}

/** Monthly recurring revenue in cents. The number a subscription business lives on. */
export async function monthlyRecurringRevenueCents(): Promise<number> {
  const agg = await prisma.merchantSubscription.aggregate({
    where: { status: { in: ['active', 'trialing'] } },
    _sum: { priceCents: true },
  });
  return agg._sum.priceCents ?? 0;
}
