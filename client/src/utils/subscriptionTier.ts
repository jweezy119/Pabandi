/**
 * Which subscription tier is this account on?
 *
 * WHY THIS EXISTS
 * ---------------
 * `OutreachCRMPage` decided whether to treat the user as paying with:
 *
 *   const isPro = user?.tier === 'PRO' || user?.subscriptionTier === 'PRO';
 *
 * That is wrong three ways, and a paying customer was being treated as free:
 *
 *   1. Case. It compares against 'PRO' while the tier config and `tierDefinition()`
 *      use lowercase, and `CrmServiceBusiness.subscriptionTier` defaults to "FREE" in
 *      the schema. So the same account reads as 'PRO' in one place and 'pro' in another.
 *   2. Source. The login payload never includes `tier` or `subscriptionTier` at all, so
 *      both sides were `undefined` and `isPro` was permanently false — including for a
 *      genuine Pro subscriber.
 *   3. Exhaustiveness. With a $29 rung added, a boolean named `isPro` can no longer
 *      express "is this a paying account", which is what the caller actually needs.
 *      Comparing against one tier name means every future tier silently reads as free.
 *
 * The authoritative answer is `GET /api/v1/subscriptions/me`. This module only
 * interprets a value once it has been fetched — it never invents one.
 *
 * Every comparison here goes through `tierAtLeast`, so adding a rung later cannot
 * require hunting down boolean flags named after the old top tier.
 */

/** Ascending. Index is the rank, which is why the order is the contract. */
export const TIER_ORDER = ['free', 'starter', 'pro', 'business'] as const;

export type ClientTier = (typeof TIER_ORDER)[number];

/**
 * Coerce anything into a known tier, defaulting to 'free'.
 *
 * Defaults to free rather than throwing or picking a middle rung: an unrecognised
 * value means we do not know what they paid for, and the safe assumption is that they
 * paid nothing. That mirrors `tierDefinition()` on the server, so the two agree.
 */
export function normalizeTier(raw: unknown): ClientTier {
  if (typeof raw !== 'string') return 'free';
  const key = raw.trim().toLowerCase();
  return (TIER_ORDER as readonly string[]).includes(key) ? (key as ClientTier) : 'free';
}

/** True when `tier` is at least as high as `minimum` in TIER_ORDER. */
export function tierAtLeast(tier: unknown, minimum: ClientTier): boolean {
  return TIER_ORDER.indexOf(normalizeTier(tier)) >= TIER_ORDER.indexOf(minimum);
}

/** Any paying tier. For gates that mean "this account pays us something". */
export function isPaidTier(tier: unknown): boolean {
  return tierAtLeast(tier, 'starter');
}

/** Does this tier include the given capability flag, e.g. 'smsReminders'? */
export function tierHas(
  limits: Record<string, unknown> | null | undefined,
  flag: string,
): boolean {
  return limits?.[flag] === true;
}

/**
 * Picks the value of a numeric limit, treating null as unlimited.
 *
 * Returns null for unlimited so a caller cannot accidentally do arithmetic on it — the
 * failure mode where `null` becomes 0 and a limit reads as "none allowed".
 */
export function tierLimit(
  limits: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const raw = limits?.[key];
  return typeof raw === 'number' ? raw : null;
}
