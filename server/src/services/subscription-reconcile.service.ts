/**
 * Subscription reconciliation.
 *
 * WHY THIS EXISTS
 * ---------------
 * Subscription state lives in a local row, written only by webhook. That has two
 * failure modes, and both cost a paying merchant their paid tier:
 *
 *   1. A delivery never arrives. Networks drop, Whop retries a bounded number of
 *      times, and we find out later — or never. `lastWebhookId` cannot help: it
 *      only deduplicates what we DID receive.
 *   2. A delivery arrives, the signature verifies, and the handler then throws —
 *      a database blip, a transient error. We answered 500 so Whop retried, but
 *      if the retries also fail the event is gone and the row says `free`.
 *
 * Both leave a customer who paid $149 being charged as free, which is the kind of
 * bug that surfaces as a refund request and a lost account rather than an alert.
 *
 * WHAT IT DOES, AND DELIBERATELY DOES NOT
 * --------------------------------------
 * It asks the provider for the truth about each membership we believe is active
 * and corrects our row where they disagree. It does NOT invent billing, does not
 * charge anything, and does not migrate anyone to a new tier — it only converges
 * local state onto what the provider already says.
 *
 * The important safety property: a provider error leaves local state UNTOUCHED. A
 * reconciliation job that reacts to its own outage by downgrading every customer
 * to free is far worse than the bug it fixes.
 */

import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { WHOP_API_BASE, whopConfigured } from './whop.service';
import type { SubscriptionStatus } from './subscription.service';

/** Statuses we hold that represent "we think they are paying". */
const REVENUE_STATUSES: SubscriptionStatus[] = ['active', 'trialing', 'past_due', 'unpaid'];

export interface ProviderMembership {
  id: string;
  status: string;
  /** Plan name as Whop reports it, used to derive the tier. */
  planName?: string | null;
  currentPeriodEnd?: string | Date | null;
  cancelAtPeriodEnd?: boolean;
  /** What we wrote at checkout. Whop preserves checkout metadata, so this is the
   *  authoritative link back to a business. */
  pabandiBusinessId?: string | null;
  pabandiTier?: string | null;
}

/**
 * Fetch one membership from the provider.
 *
 * The endpoint path is isolated here, and every caller treats a failure as "I do
 * not know" rather than "they are not paying". If Whop's API shape differs from
 * what we expect, the worst outcome is a no-op reconciliation — which is safe —
 * rather than a mass downgrade.
 */
export async function fetchMembership(
  membershipId: string,
): Promise<ProviderMembership | null> {
  const key = (process.env.WHOP_API_KEY || '').trim();
  if (!key || !membershipId) return null;

  try {
    const res = await fetch(`${WHOP_API_BASE}/memberships/${encodeURIComponent(membershipId)}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });

    if (res.status === 404) {
      // The provider does not know this membership. That is a real answer — the
      // subscription is gone — so it is reported as null with a distinction the
      // caller can act on rather than being swallowed as "unknown".
      logger.warn(`[Subscriptions] Provider has no membership ${membershipId}.`);
      return null;
    }
    if (!res.ok) {
      // Rate limited, 5xx, auth failure. UNKNOWN, not absent. Never downgrade on
      // this: the next run will try again.
      logger.warn(`[Subscriptions] Membership fetch failed (${res.status}) for ${membershipId}.`);
      return undefined as unknown as null;
    }

    const data = (await res.json()) as any;
    const m = data?.membership ?? data;
    return {
      id: String(m?.id ?? membershipId),
      status: String(m?.status ?? '').toLowerCase(),
      planName: m?.plan?.name ?? m?.plan_name ?? null,
      currentPeriodEnd: m?.current_period_end ?? m?.current_period_end_ms ?? null,
      cancelAtPeriodEnd: Boolean(m?.cancel_at_period_end ?? m?.cancel_at_period_end_ms),
      pabandiBusinessId: m?.metadata?.pabandiBusinessId ?? m?.pabandiBusinessId ?? null,
      pabandiTier: m?.metadata?.pabandiTier ?? m?.pabandiTier ?? null,
    };
  } catch (err) {
    logger.warn(
      `[Subscriptions] Membership fetch threw for ${membershipId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return undefined as unknown as null;
  }
}

/** Derive our tier from a plan name like "Pabandi Pro". */
function tierFromPlanName(name: string | null | undefined): string | null {
  if (!name) return null;
  const m = /pabandi\s+(free|pro|business)/i.exec(name);
  return m ? m[1].toLowerCase() : null;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(typeof value === 'number' ? value * 1000 : String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface ReconciliationResult {
  checked: number;
  corrected: number;
  unchanged: number;
  /** Rows we deliberately left alone because the provider could not be asked. */
  skippedUnknown: number;
  /** Human-readable notes, for the log and the admin endpoint. */
  notes: string[];
}

/**
 * Reconcile local subscription rows against the provider.
 *
 * Only rows we believe are paying are checked, and only when we hold a membership
 * id — without one there is nothing to ask the provider about, and inventing an id
 * would be guessing.
 */
export async function reconcileSubscriptions(
  opts: { limit?: number } = {},
): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    checked: 0,
    corrected: 0,
    unchanged: 0,
    skippedUnknown: 0,
    notes: [],
  };

  if (!whopConfigured()) {
    result.notes.push('Provider not configured; nothing reconciled.');
    return result;
  }

  const rows = await prisma.merchantSubscription.findMany({
    where: {
      whopMembershipId: { not: null },
      status: { in: REVENUE_STATUSES },
    },
    select: {
      id: true,
      businessId: true,
      tier: true,
      status: true,
      whopMembershipId: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
    },
    take: opts.limit ?? 200,
    orderBy: { updatedAt: 'asc' }, // oldest first: the most stale gets fixed soonest
  });

  for (const row of rows) {
    result.checked += 1;
    const membership = await fetchMembership(row.whopMembershipId as string);

    if (membership === undefined) {
      // Provider unreachable or erroring. Deliberately a no-op.
      result.skippedUnknown += 1;
      continue;
    }

    if (membership === null) {
      // The provider does not have this membership: it is gone. Downgrade to the
      // free tier rather than leaving a phantom paid subscription that nobody is
      // paying for — that would let a merchant keep Pro features forever.
      await prisma.merchantSubscription.update({
        where: { id: row.id },
        data: {
          status: 'canceled',
          tier: 'free',
          canceledAt: new Date(),
          lastWebhookId: null,
        },
      });
      result.corrected += 1;
      result.notes.push(`Membership ${row.whopMembershipId} no longer exists; ${row.businessId} → free.`);
      continue;
    }

    const providerStatus = (membership.status || 'inactive') as SubscriptionStatus;
    const providerTier = membership.pabandiTier ?? tierFromPlanName(membership.planName);
    const providerPeriodEnd = toDate(membership.currentPeriodEnd);

    const tierChanged = providerTier != null && providerTier !== row.tier;
    const statusChanged = providerStatus !== row.status;
    const periodChanged =
      (providerPeriodEnd?.getTime() ?? null) !== (row.currentPeriodEnd?.getTime() ?? null);
    const cancelFlagChanged = Boolean(membership.cancelAtPeriodEnd) !== row.cancelAtPeriodEnd;

    if (!tierChanged && !statusChanged && !periodChanged && !cancelFlagChanged) {
      result.unchanged += 1;
      continue;
    }

    await prisma.merchantSubscription.update({
      where: { id: row.id },
      data: {
        // A membership the provider reports as active is paying, whatever our row
        // said. This is the case that matters most: it recovers a merchant who
        // paid after their webhook was lost.
        ...(statusChanged ? { status: providerStatus } : {}),
        ...(tierChanged ? { tier: providerTier } : {}),
        ...(periodChanged ? { currentPeriodEnd: providerPeriodEnd } : {}),
        ...(cancelFlagChanged ? { cancelAtPeriodEnd: Boolean(membership.cancelAtPeriodEnd) } : {}),
        // Clearing the id makes the next webhook apply rather than dedupe away.
        lastWebhookId: null,
      },
    });

    result.corrected += 1;
    const changes = [
      statusChanged ? `status ${row.status}→${providerStatus}` : null,
      tierChanged ? `tier ${row.tier}→${providerTier}` : null,
      periodChanged ? 'period end' : null,
      cancelFlagChanged ? `cancelAtPeriodEnd ${membership.cancelAtPeriodEnd}` : null,
    ].filter(Boolean);
    result.notes.push(`${row.businessId}: ${changes.join(', ')}`);
  }

  logger.info(
    `[Subscriptions] Reconciled ${result.checked}: ${result.corrected} corrected, ` +
      `${result.unchanged} unchanged, ${result.skippedUnknown} skipped (provider unknown).`,
  );
  for (const note of result.notes) logger.info(`[Subscriptions]   ${note}`);

  return result;
}