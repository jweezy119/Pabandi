import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import type { BusinessCategory } from '@prisma/client';

/**
 * Subscriptions — the fixed monthly tier, and its effect on the usage fee.
 *
 * Three things are under test and they pull against each other:
 *
 *   THE MERCHANT CAN CHECK THE PRICE. A quoted fee must decompose into facts that
 *   match the pricing page. "SALON x0.75, PRO x0.5" is checkable; a merged 0.375
 *   is not, and a merchant who cannot reconcile a charge will not renew.
 *
 *   A PAID TIER ACTUALLY PAYS. A BUSINESS subscriber must be charged zero. If the
 *   profitability floor quietly lifts a zero back to the processing cost, they are
 *   billed a fee the pricing page says is waived — the single worst thing this
 *   feature can do.
 *
 *   NOBODY GETS A DISCOUNT THEY DID NOT BUY. A lapsed or cancelled subscription
 *   falls back to the standard rate, because "not paying" is not the same as
 *   "on the free plan".
 */

vi.mock('../src/utils/database', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    merchantSubscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../src/utils/database';
import {
  SUBSCRIPTION_TIERS,
  PAID_TIERS,
  tierDefinition,
  tierLimits,
  checkLimits,
  publicPricing,
  BILLING_PERIOD_DAYS,
  type SubscriptionTier,
} from '../src/config/subscriptions';
import {
  quoteFee,
  FIRST_TRANSACTION_FREE_LIMIT,
  processingCostCents,
} from '../src/config/fees';
import {
  verifyWebhookDelivery,
  decodeWebhookSecret,
  createSubscriptionCheckout,
  isActiveStatus,
  WEBHOOK_TOLERANCE_SECONDS,
} from '../src/services/whop.service';
import {
  getSubscription,
  applyMembershipEvent,
  monthlyRecurringRevenueCents,
} from '../src/services/subscription.service';

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const ESTABLISHED = FIRST_TRANSACTION_FREE_LIMIT;

function quote(amountDollars: number, subscriptionMultiplier: number, category: BusinessCategory = 'CLEANING') {
  return quoteFee({
    amountCents: Math.round(amountDollars * 100),
    category,
    settledTransactions: ESTABLISHED,
    subscriptionMultiplier,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('tier definitions', () => {
  it('matches the pricing a merchant has been quoted', () => {
    // Free / $49 / $149, positioned against Square Appointments ($29-69),
    // Jobber ($39-249) and Housecall Pro ($49-199).
    expect(SUBSCRIPTION_TIERS.pro.monthlyPrice).toBe(49);
    expect(SUBSCRIPTION_TIERS.business.monthlyPrice).toBe(149);
    expect(SUBSCRIPTION_TIERS.free.monthlyPrice).toBeNull();
  });

  it('carries no usage-fee multiplier any more', () => {
    // The discount was removed because the profitability floor ate most of it —
    // at $200 subscribers saved 32% rather than the advertised 50%. The tier now
    // buys product features and the fee is one flat rate for everyone.
    //
    // This is the guard: reintroducing a fee discount means the pricing page is
    // promising something the engine cannot deliver.
    for (const t of ['free', 'pro', 'business'] as SubscriptionTier[]) {
      expect((SUBSCRIPTION_TIERS[t] as Record<string, unknown>).usageFeeMultiplier, t).toBeUndefined();
    }
  });

  it('sets the advertised feature limits', () => {
    expect(SUBSCRIPTION_TIERS.free.limits).toMatchObject({
      maxClients: 50,
      maxInvoicesPerMonth: 100,
      maxUsers: 1,
    });
    expect(SUBSCRIPTION_TIERS.pro.limits).toMatchObject({
      maxClients: null,
      maxInvoicesPerMonth: null,
      maxUsers: 5,
      emailReminders: true,
      smsReminders: true,
    });
    expect(SUBSCRIPTION_TIERS.business.limits).toMatchObject({
      maxUsers: 20,
      apiAccess: true,
      webhooks: true,
      customFields: true,
      whiteLabel: true,
    });
  });

  it('gives every tier deposits, a booking page and trust scoring', () => {
    // These are what someone signs up for. Putting them behind a paywall means
    // charging for the reason the customer arrived.
    for (const t of ['free', 'pro', 'business'] as SubscriptionTier[]) {
      expect(SUBSCRIPTION_TIERS[t].limits.depositsEnabled, t).toBe(true);
      expect(SUBSCRIPTION_TIERS[t].limits.bookingPageEnabled, t).toBe(true);
      expect(SUBSCRIPTION_TIERS[t].limits.trustScoringEnabled, t).toBe(true);
    }
  });

  it('never promises more users on a cheaper tier', () => {
    expect(SUBSCRIPTION_TIERS.free.limits.maxUsers)
      .toBeLessThan(SUBSCRIPTION_TIERS.pro.limits.maxUsers!);
    expect(SUBSCRIPTION_TIERS.pro.limits.maxUsers)
      .toBeLessThan(SUBSCRIPTION_TIERS.business.limits.maxUsers!);
  });

  it('falls back to free for an unknown tier', () => {
    // Never throw on a tier string from a webhook, and never let an unrecognised
    // plan inherit paid features.
    expect(tierDefinition('enterprise-plus').tier).toBe('free');
    expect(tierDefinition(null).tier).toBe('free');
    expect(tierLimits('nonsense').maxClients).toBe(50);
  });

  it('bills monthly', () => {
    expect(BILLING_PERIOD_DAYS).toBe(30);
  });

  it('publishes a pricing table with no discount language', () => {
    const pricing = publicPricing();
    const serialised = JSON.stringify(pricing);
    // The single most important assertion in this file. "50% off" anywhere in the
    // published pricing is a promise the fee engine does not keep.
    expect(serialised).not.toMatch(/50%\\s*off/i);
    expect(serialised).not.toMatch(/discount/i);
    expect(serialised).not.toMatch(/usageFeeMultiplier/);
    expect(pricing.tiers.map((t) => t.monthlyPrice)).toEqual([49, 149]);
    expect(pricing.free.monthlyPrice).toBeNull();
  });
});

describe('the platform fee does not vary by tier', () => {
  it('quotes the same rate whatever tier a merchant is on', () => {
    // The whole point of the restructure: there is no tier argument to pass, so a
    // quote cannot depend on one.
    const a = quoteFee({ amountCents: 20_000, category: 'CLEANING', settledTransactions: ESTABLISHED });
    const b = quoteFee({ amountCents: 20_000, category: 'CLEANING', settledTransactions: ESTABLISHED });
    expect(b.feeCents).toBe(a.feeCents);
  });

  it('says nothing about a subscription on the quote', () => {
    const q = quoteFee({ amountCents: 20_000, category: 'CLEANING', settledTransactions: ESTABLISHED });
    expect(q.applied.join(' ')).not.toMatch(/subscription/i);
  });
});

describe('limits are reported, not enforced silently', () => {
  it('allows a business inside its tier', () => {
    expect(checkLimits('free', { clients: 10, invoicesThisMonth: 20 })).toEqual({
      allowed: true,
      violations: [],
    });
  });

  it('explains a breach rather than just refusing', () => {
    // A merchant who crosses 50 clients should be told what upgrading costs, not
    // have their booking page break.
    const result = checkLimits('free', { clients: 60, invoicesThisMonth: 150 });
    expect(result.allowed).toBe(false);
    expect(result.violations).toHaveLength(2);
    expect(result.violations[0]).toMatch(/60 clients/);
    expect(result.violations[0]).toMatch(/50/);
  });

  it('does not limit a paid tier', () => {
    expect(checkLimits('pro', { clients: 9_999, invoicesThisMonth: 9_999 }).allowed).toBe(true);
    expect(checkLimits('business', { clients: 9_999, invoicesThisMonth: 9_999 }).allowed).toBe(true);
  });
});

describe('subscription state', () => {
  it('treats a business with no row as free', () => {
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue(null);
    // Every business starts free; "no row" must not become "unknown tier".
  });

  it('returns free for a merchant with no subscription', async () => {
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue(null);
    const sub = await getSubscription('biz_1');
    expect(sub.tier).toBe('free');
    expect(sub.isPaying).toBe(false);
  });

  it('reports the tier while a subscription is active', async () => {
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue({
      tier: 'business', status: 'active', priceCents: 14900, currency: 'USD',
      currentPeriodEnd: new Date('2026-11-01'), cancelAtPeriodEnd: false,
    });
    const sub = await getSubscription('biz_1');
    expect(sub.isPaying).toBe(true);
    expect(sub.tier).toBe('business');
    expect(sub.priceCents).toBe(14900);
  });

  it('counts a trial as paying', async () => {
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue({
      tier: 'pro', status: 'trialing', priceCents: 4900, currency: 'USD',
      currentPeriodEnd: new Date(), cancelAtPeriodEnd: false,
    });
    expect((await getSubscription('biz_1')).tier).toBe('pro');
  });

  it('keeps the tier on record when payment lapses but stops counting it as paid', async () => {
    // A merchant whose card failed is not "on the free plan" — they paid and
    // something went wrong. The tier is still pro, so support can see what they
    // were on; only isPaying flips, which is what gates the features.
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue({
      tier: 'pro', status: 'past_due', priceCents: 4900, currency: 'USD',
      currentPeriodEnd: new Date(), cancelAtPeriodEnd: false,
    });
    const sub = await getSubscription('biz_1');
    expect(sub.isPaying).toBe(false);
    expect(sub.tier).toBe('pro');
  });

  it('keeps the tier through a cancel-at-period-end', async () => {
    // They paid for this month. Treating the cancellation as immediate would
    // remove features they have paid for.
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue({
      tier: 'pro', status: 'active', priceCents: 4900, currency: 'USD',
      currentPeriodEnd: new Date('2026-10-15'), cancelAtPeriodEnd: true,
    });
    const sub = await getSubscription('biz_1');
    expect(sub.isPaying).toBe(true);
    expect(sub.tier).toBe('pro');
    expect(sub.cancelAtPeriodEnd).toBe(true);
  });

  it('sums only paying subscriptions as MRR', async () => {
    mock(prisma.merchantSubscription.aggregate).mockResolvedValue({ _sum: { priceCents: 24_900 } });
    // 3 pro ($147) + 1 business ($149) = $296. Lapsed ones are excluded by the
    // status filter, which is asserted below.
    expect(await monthlyRecurringRevenueCents()).toBe(24_900);
    expect(mock(prisma.merchantSubscription.aggregate).mock.calls[0][0].where.status).toEqual({
      in: ['active', 'trialing'],
    });
  });
});

describe('membership events', () => {
  const baseEvent = {
    webhookId: 'wh_1',
    businessId: 'biz_1',
    tier: 'pro',
    status: 'active' as const,
    whopMembershipId: 'mem_1',
    currentPeriodEnd: new Date('2026-11-01'),
  };

  it('creates the record on a first subscription', async () => {
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue(null);
    mock(prisma.merchantSubscription.create).mockResolvedValue({});

    const result = await applyMembershipEvent(baseEvent);
    expect(result.applied).toBe(true);

    const data = mock(prisma.merchantSubscription.create).mock.calls[0][0].data;
    expect(data.tier).toBe('pro');
    // Price snapshotted from the tier definition, so a later price change does not
    // rewrite what this merchant agreed to.
    expect(data.priceCents).toBe(4900);
  });

  it('updates rather than stacking a second row', async () => {
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue({
      id: 'sub_1',
      lastWebhookId: 'wh_0',
    });
    mock(prisma.merchantSubscription.update).mockResolvedValue({});

    await applyMembershipEvent({ ...baseEvent, webhookId: 'wh_2' });
    expect(mock(prisma.merchantSubscription.update).mock.calls[0][0].where).toEqual({ id: 'sub_1' });
    expect(mock(prisma.merchantSubscription.create)).not.toHaveBeenCalled();
  });

  it('ignores a redelivered webhook', async () => {
    // Whop retries. Applying membership.activated twice would restart the period —
    // a merchant paying once and getting two months.
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue({
      id: 'sub_1',
      lastWebhookId: 'wh_1',
    });

    const result = await applyMembershipEvent(baseEvent);
    expect(result.applied).toBe(false);
    expect(result.reason).toMatch(/duplicate/i);
    expect(mock(prisma.merchantSubscription.update)).not.toHaveBeenCalled();
  });

  it('stores an unknown tier as free rather than as-is', async () => {
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue(null);
    mock(prisma.merchantSubscription.create).mockResolvedValue({});

    await applyMembershipEvent({ ...baseEvent, tier: 'enterprise-plus' });
    // An unrecognised plan must not become an unrecognised discount.
    expect(mock(prisma.merchantSubscription.create).mock.calls[0][0].data.tier).toBe('free');
  });

  it('records cancellation', async () => {
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue({ id: 'sub_1', lastWebhookId: 'wh_0' });
    mock(prisma.merchantSubscription.update).mockResolvedValue({});

    await applyMembershipEvent({ ...baseEvent, webhookId: 'wh_3', status: 'canceled' });
    expect(mock(prisma.merchantSubscription.update).mock.calls[0][0].data.canceledAt).toBeTruthy();
  });

  it('remembers a cancel-at-period-end without ending the term', async () => {
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue({ id: 'sub_1', lastWebhookId: 'wh_0' });
    mock(prisma.merchantSubscription.update).mockResolvedValue({});

    await applyMembershipEvent({ ...baseEvent, webhookId: 'wh_4', cancelAtPeriodEnd: true });
    const data = mock(prisma.merchantSubscription.update).mock.calls[0][0].data;
    expect(data.cancelAtPeriodEnd).toBe(true);
    expect(data.status).toBe('active');
    // Still serving, so no canceledAt.
    expect(data.canceledAt).toBeUndefined();
  });

  it('recovers from a concurrent create', async () => {
    mock(prisma.merchantSubscription.findUnique).mockResolvedValue(null);
    mock(prisma.merchantSubscription.create).mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002' }),
    );
    mock(prisma.merchantSubscription.updateMany).mockResolvedValue({ count: 1 });

    const result = await applyMembershipEvent(baseEvent);
    expect(result.applied).toBe(true);
    expect(mock(prisma.merchantSubscription.updateMany)).toHaveBeenCalled();
  });
});

describe('Standard Webhooks verification', () => {
  // Whop does not sign the raw body the way Square does. The signed content is
  // `webhook-id.webhook-timestamp.body`, keyed by the base64 part of a whsec_
  // secret, signature base64-encoded. Copying Square's verifier rejects every
  // delivery.
  const secret = `whsec_${Buffer.from('super-secret-key-for-tests').toString('base64')}`;
  const body = JSON.stringify({ type: 'membership.activated', data: { id: 'mem_1' } });
  const id = 'msg_test';
  const timestamp = String(Math.floor(Date.now() / 1000));

  function sign(opts: { key?: string; id?: string; ts?: string; payload?: string } = {}) {
    const key = Buffer.from(opts.key ?? 'super-secret-key-for-tests');
    const content = `${opts.id ?? id}.${opts.ts ?? timestamp}.${opts.payload ?? body}`;
    return `v1,${crypto.createHmac('sha256', key).update(content, 'utf8').digest('base64')}`;
  }

  const headers = (signature: string) => ({
    'webhook-id': id,
    'webhook-timestamp': timestamp,
    'webhook-signature': signature,
  });

  it('accepts a correctly signed delivery', () => {
    expect(verifyWebhookDelivery({ headers: headers(sign()), rawBody: body, secret })).toBe(true);
  });

  it('rejects a tampered body', () => {
    // The signature covers the payload, so any change to it invalidates.
    const tampered = body.replace('membership.activated', 'membership.deactivated');
    expect(verifyWebhookDelivery({ headers: headers(sign()), rawBody: tampered, secret })).toBe(false);
  });

  it('rejects a swapped webhook id', () => {
    // Without the id in the signed content, an attacker could pair a real body
    // with a fresh id.
    expect(verifyWebhookDelivery({ headers: headers(sign()), rawBody: body, secret, now: new Date() }) &&
      verifyWebhookDelivery({
        headers: { ...headers(sign()), 'webhook-id': 'msg_other' },
        rawBody: body,
        secret,
      })).toBe(false);
  });

  it('rejects a stale timestamp', () => {
    // The replay defence. This endpoint decides what a merchant is charged, so a
    // captured delivery must not stay valid.
    const old = String(Math.floor(Date.now() / 1000) - WEBHOOK_TOLERANCE_SECONDS - 60);
    expect(verifyWebhookDelivery({ headers: headers(sign({ ts: old })), rawBody: body, secret })).toBe(false);
  });

  it('accepts a signature from either key during rotation', () => {
    // The header is space-delimited precisely so a sender can sign with both the
    // current and previous secret. Treating it as one signature breaks rotation.
    const previous = Buffer.from('the-old-secret');
    const rotated = `whsec_${Buffer.from('the-old-secret').toString('base64')}`;
    expect(
      verifyWebhookDelivery({
        headers: headers(`${sign({ key: 'the-new-secret' })} ${sign({ key: 'the-old-secret' })}`),
        rawBody: body,
        secret: rotated,
      }),
    ).toBe(true);
  });

  it('rejects when no secret is configured', () => {
    // Fails closed. Accepting here would let anyone grant themselves a tier.
    const original = process.env.WHOP_WEBHOOK_SECRET;
    delete process.env.WHOP_WEBHOOK_SECRET;
    expect(verifyWebhookDelivery({ headers: headers(sign()), rawBody: body })).toBe(false);
    if (original) process.env.WHOP_WEBHOOK_SECRET = original;
  });

  it('rejects missing headers', () => {
    expect(verifyWebhookDelivery({ headers: { 'webhook-id': id }, rawBody: body, secret })).toBe(false);
    expect(verifyWebhookDelivery({ headers: {}, rawBody: body, secret })).toBe(false);
  });

  it('ignores an asymmetric signature identifier', () => {
    // v1a is ed25519 and requires a different verification path. Accepting it as
    // if it were v1 would be a hole.
    const key = Buffer.from('super-secret-key-for-tests');
    const content = `${id}.${timestamp}.${body}`;
    const v1a = `v1a,${crypto.createHmac('sha256', key).update(content).digest('base64')}`;
    expect(verifyWebhookDelivery({ headers: headers(v1a), rawBody: body, secret })).toBe(false);
  });

  it('decodes the whsec_ prefix rather than using it as the key', () => {
    // Passing the whole string to HMAC produces a signature that never matches,
    // which presents as "webhooks are broken" rather than as a bug.
    const decoded = decodeWebhookSecret(secret);
    expect(decoded).toEqual(Buffer.from('super-secret-key-for-tests'));
    expect(decodeWebhookSecret(secret)).not.toBeNull();
    expect(decodeWebhookSecret('whsec_')).toBeNull();
    expect(decodeWebhookSecret('')).toBeNull();
  });

  it('tolerates a secret pasted without base64 padding', () => {
    const unpadded = `whsec_${Buffer.from('super-secret-key-for-tests').toString('base64').replace(/=+$/, '')}`;
    expect(verifyWebhookDelivery({ headers: headers(sign()), rawBody: body, secret: unpadded })).toBe(true);
  });
});

describe('checkout creation', () => {
  beforeEach(() => {
    process.env.WHOP_API_KEY = 'test-key';
    delete process.env.WHOP_PLAN_PRO;
  });

  it('reports missing configuration rather than throwing', async () => {
    delete process.env.WHOP_API_KEY;
    // A merchant being unable to subscribe must not take down the pricing page.
    const result = await createSubscriptionCheckout({
      tier: 'pro', businessId: 'biz_1', businessName: 'Salon', monthlyPrice: 49,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/WHOP_API_KEY/);
  });

  it('sends an inline plan when none is configured', async () => {
    const calls: any[] = [];
    global.fetch = vi.fn(async (_url: string, init: any) => {
      calls.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ id: 'chk_1', purchase_url: 'https://whop.com/checkout' }) } as any;
    }) as any;

    const result = await createSubscriptionCheckout({
      tier: 'pro', businessId: 'biz_1', businessName: 'Salon', monthlyPrice: 49,
    });

    expect(result.ok).toBe(true);
    expect(calls[0].plan.renewal_price).toBe(49);
    // The business id rides along so a membership is traceable without a lookup.
    expect(calls[0].metadata.pabandiBusinessId).toBe('biz_1');
  });

  it('prefers a configured plan id over an inline plan', async () => {
    process.env.WHOP_PLAN_PRO = 'plan_abc';
    const calls: any[] = [];
    global.fetch = vi.fn(async (_url: string, init: any) => {
      calls.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ id: 'chk_1', purchase_url: 'https://whop.com/checkout' }) } as any;
    }) as any;

    await createSubscriptionCheckout({ tier: 'pro', businessId: 'biz_1', businessName: 'Salon', monthlyPrice: 49 });
    // Whop rejects both together, so exactly one is sent.
    expect(calls[0].plan_id).toBe('plan_abc');
    expect(calls[0].plan).toBeUndefined();
  });

  it('does not report success without a purchase URL', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ id: 'chk_1' }),
    })) as any;
    const result = await createSubscriptionCheckout({
      tier: 'pro', businessId: 'biz_1', businessName: 'Salon', monthlyPrice: 49,
    });
    expect(result.ok).toBe(false);
  });

  it('never throws when the network fails', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('ENOTFOUND');
    }) as any;
    const result = await createSubscriptionCheckout({
      tier: 'pro', businessId: 'biz_1', businessName: 'Salon', monthlyPrice: 49,
    });
    expect(result.ok).toBe(false);
  });
});

describe('active status', () => {
  it('treats only active and trialing as paying', () => {
    expect(isActiveStatus('active')).toBe(true);
    expect(isActiveStatus('trialing')).toBe(true);
    for (const s of ['past_due', 'canceled', 'unpaid', 'inactive', null, undefined]) {
      expect(isActiveStatus(s as any), String(s)).toBe(false);
    }
  });
});
