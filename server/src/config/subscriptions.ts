/**
 * Pabandi subscription tiers — a plain SaaS price list.
 *
 * WHAT CHANGED, AND WHY IT MATTERED
 * These tiers once carried a `usageFeeMultiplier` — a $49 subscriber paid half the
 * per-booking fee. It was removed because the schedule could not honour it: the
 * profitability floor ate most of the discount, so at $200 the subscriber saved
 * 32% rather than the advertised 50%, and at $500 only 15%. A pricing page has to
 * say something it can keep.
 *
 * So the subscription is now purely the product, and the platform fee is one flat
 * rate for everyone. This is the model Square, Shopify and Toast use: predictable
 * subscription revenue, with a transaction fee that does the variable part.
 *
 *   merchant pays $49/month, and every booking costs the same 3.5% as everyone
 *   else's. No arithmetic to reconcile, nothing that varies by tier, and no
 *   possibility of discovering at month-end that the discount was smaller than
 *   advertised.
 *
 * WHY THIS IS BETTER FOR US, NOT JUST SIMPLER
 * Subscriptions are the number a merchant renews, and they are predictable enough
 * to plan against. Usage revenue only exists once a merchant is succeeding, which
 * means it arrives late and unpredictably. A tier that charges for access gets
 * paid whether or not the month went well.
 *
 * PRICING SOURCE
 * Free / $49 / $149, positioned against Square Appointments ($29–69), Jobber
 * ($39–249) and Housecall Pro ($49–199). These are the numbers a merchant has
 * been quoted, so they are the numbers to charge. If the pricing page and this
 * file ever disagree, that is a decision to make in both places deliberately.
 */

export type SubscriptionTier = 'free' | 'pro' | 'business';

export interface TierLimits {
  /** Clients a business may have before the tier blocks more. Null = unlimited. */
  maxClients: number | null;
  /** Invoices per calendar month. Null = unlimited. */
  maxInvoicesPerMonth: number | null;
  /** Team seats included in the monthly price. */
  maxUsers: number;
  /** Booking deposits — the commitment device that protects a merchant's time. */
  depositsEnabled: boolean;
  /** Public booking page. The thing they signed up for. */
  bookingPageEnabled: boolean;
  /** Trust scoring and the public trust profile. */
  trustScoringEnabled: boolean;
  emailReminders: boolean;
  smsReminders: boolean;
  analytics: boolean;
  apiAccess: boolean;
  webhooks: boolean;
  customFields: boolean;
  whiteLabel: boolean;
  support: 'community' | 'priority' | 'dedicated';
}

export interface TierDefinition {
  tier: SubscriptionTier;
  /** Monthly price in dollars. `null` for free — nothing is charged. */
  monthlyPrice: number | null;
  limits: TierLimits;
  /** Headline features, for the pricing page. */
  headline: string[];
  /** Env var holding the Whop plan id for this tier. */
  planEnvVar: string;
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierDefinition> = {
  free: {
    tier: 'free',
    monthlyPrice: null,
    limits: {
      maxClients: 50,
      maxInvoicesPerMonth: 100,
      maxUsers: 1,
      depositsEnabled: true,
      bookingPageEnabled: true,
      trustScoringEnabled: true,
      emailReminders: false,
      smsReminders: false,
      analytics: false,
      apiAccess: false,
      webhooks: false,
      customFields: false,
      whiteLabel: false,
      support: 'community',
    },
    headline: [
      'Up to 50 clients',
      '100 invoices a month',
      'Booking page',
      'Trust scoring',
      'Deposits and escrow',
    ],
    planEnvVar: 'WHOP_PLAN_FREE',
  },
  pro: {
    tier: 'pro',
    monthlyPrice: 49,
    limits: {
      maxClients: null,
      maxInvoicesPerMonth: null,
      maxUsers: 5,
      depositsEnabled: true,
      bookingPageEnabled: true,
      trustScoringEnabled: true,
      emailReminders: true,
      smsReminders: true,
      analytics: true,
      apiAccess: false,
      webhooks: false,
      customFields: false,
      whiteLabel: false,
      support: 'priority',
    },
    headline: [
      'Unlimited clients and invoices',
      '5 team members',
      'Email and SMS reminders',
      'Analytics',
      'Priority support',
    ],
    planEnvVar: 'WHOP_PLAN_PRO',
  },
  business: {
    tier: 'business',
    monthlyPrice: 149,
    limits: {
      maxClients: null,
      maxInvoicesPerMonth: null,
      maxUsers: 20,
      depositsEnabled: true,
      bookingPageEnabled: true,
      trustScoringEnabled: true,
      emailReminders: true,
      smsReminders: true,
      analytics: true,
      apiAccess: true,
      webhooks: true,
      customFields: true,
      whiteLabel: true,
      support: 'dedicated',
    },
    headline: [
      'Everything in Pro',
      '20 team members',
      'API access',
      'Webhooks',
      'Custom fields and white label',
      'Dedicated support',
    ],
    planEnvVar: 'WHOP_PLAN_BUSINESS',
  },
};

export const PAID_TIERS: SubscriptionTier[] = ['pro', 'business'];

/** Whop bills in days; monthly is 30. */
export const BILLING_PERIOD_DAYS = 30;

/**
 * Resolve a tier, defaulting to free.
 *
 * Free is the fallback rather than an error because every business starts free,
 * and a missing tier must never mean a merchant is charged a price they did not
 * agree to.
 */
export function tierDefinition(tier: string | null | undefined): TierDefinition {
  const key = (tier ?? 'free').toLowerCase() as SubscriptionTier;
  return SUBSCRIPTION_TIERS[key] ?? SUBSCRIPTION_TIERS.free;
}

export function tierLimits(tier: string | null | undefined): TierLimits {
  return tierDefinition(tier).limits;
}

/**
 * Check a business against its tier's limits.
 *
 * Deliberately reports rather than throws: callers decide whether to block, warn,
 * or grandfather. A merchant who crosses 50 clients should not have their booking
 * page break — they should be told what upgrading costs.
 */
export function checkLimits(
  tier: string | null | undefined,
  usage: { clients: number; invoicesThisMonth: number },
): { allowed: boolean; violations: string[] } {
  const limits = tierLimits(tier);
  const violations: string[] = [];

  if (limits.maxClients !== null && usage.clients > limits.maxClients) {
    violations.push(
      `${usage.clients} clients exceeds the ${limits.maxClients} included on the ${tierDefinition(tier).tier} plan`,
    );
  }
  if (limits.maxInvoicesPerMonth !== null && usage.invoicesThisMonth > limits.maxInvoicesPerMonth) {
    violations.push(
      `${usage.invoicesThisMonth} invoices this month exceeds the ${limits.maxInvoicesPerMonth} included`,
    );
  }

  return { allowed: violations.length === 0, violations };
}

/**
 * The public pricing table.
 *
 * Generated from the same definitions checkout is built from, so what a merchant
 * reads and what they are charged cannot differ. Deliberately contains no
 * discount language and no fee multiplier — the platform fee is quoted separately
 * and is the same for every tier, which is the point.
 */
export function publicPricing() {
  return {
    currency: 'USD',
    billingPeriodDays: BILLING_PERIOD_DAYS,
    tiers: PAID_TIERS.map((key) => {
      const t = SUBSCRIPTION_TIERS[key];
      return {
        tier: t.tier,
        monthlyPrice: t.monthlyPrice,
        headline: t.headline,
        limits: t.limits,
      };
    }),
    free: {
      tier: 'free' as const,
      monthlyPrice: null,
      headline: SUBSCRIPTION_TIERS.free.headline,
      limits: SUBSCRIPTION_TIERS.free.limits,
    },
    // Stated here so the pricing page has one source for it. The number itself
    // lives in config/fees.ts — this is a pointer, not a second copy that can
    // drift.
    platformFee: {
      note: 'Charged on every transaction, same for every plan.',
      seeAlso: 'config/fees.ts PLATFORM_FEE_RATE',
    },
  };
}
