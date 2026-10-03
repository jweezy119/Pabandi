import { describe, it, expect } from 'vitest';
import {
  normalizeTier,
  tierAtLeast,
  isPaidTier,
  tierLimit,
  TIER_ORDER,
} from './subscriptionTier';

/**
 * The regression: OutreachCRMPage computed
 *
 *   const isPro = user?.tier === 'PRO' || user?.subscriptionTier === 'PRO';
 *
 * so a paying customer was treated as free — the login payload carries neither field,
 * and the casing was wrong besides. These tests pin the replacement.
 */

describe('normalizeTier', () => {
  it('accepts the canonical lowercase names', () => {
    expect(normalizeTier('free')).toBe('free');
    expect(normalizeTier('starter')).toBe('starter');
    expect(normalizeTier('pro')).toBe('pro');
    expect(normalizeTier('business')).toBe('business');
  });

  it('is case-insensitive, which the old PRO check was not', () => {
    // CrmServiceBusiness.subscriptionTier defaults to "FREE" (uppercase) in the schema
    // while the tier config is lowercase. Both must land on the same tier.
    for (const raw of ['PRO', 'pro', 'Pro', '  pRo  ']) {
      expect(normalizeTier(raw)).toBe('pro');
    }
    for (const raw of ['STARTER', 'Starter']) {
      expect(normalizeTier(raw)).toBe('starter');
    }
  });

  it('defaults to free for anything it does not recognise', () => {
    // Free is the safe default: not knowing what someone paid for must not grant
    // paid capabilities. Matches tierDefinition() on the server.
    for (const raw of [undefined, null, '', 'enterprise', 'platinum', 42, {}, []]) {
      expect(normalizeTier(raw)).toBe('free');
    }
  });
});

describe('tierAtLeast', () => {
  it('orders the ladder ascending', () => {
    // The whole point of the $29 rung: a $29 account is a paying account, and must not
    // read as free.
    expect(TIER_ORDER).toEqual(['free', 'starter', 'pro', 'business']);
  });

  it('treats starter as paying and pro as above it', () => {
    expect(isPaidTier('starter')).toBe(true);
    expect(isPaidTier('pro')).toBe(true);
    expect(isPaidTier('business')).toBe(true);
    expect(isPaidTier('free')).toBe(false);
    expect(isPaidTier(undefined)).toBe(false);
  });

  it('compares by rank, not by name', () => {
    expect(tierAtLeast('business', 'pro')).toBe(true);
    expect(tierAtLeast('pro', 'business')).toBe(false);
    expect(tierAtLeast('starter', 'starter')).toBe(true);
    expect(tierAtLeast('starter', 'pro')).toBe(false);
    // An unrecognised tier normalises to free, so it satisfies only 'free'.
    expect(tierAtLeast('nonsense', 'free')).toBe(true);
    expect(tierAtLeast('nonsense', 'starter')).toBe(false);
  });
});

describe('tierLimit', () => {
  it('returns null for unlimited rather than 0', () => {
    // The dangerous version of this helper returns 0 for null, and a caller doing
    // `limit - usage` then blocks everything.
    expect(tierLimit({ maxClients: null }, 'maxClients')).toBeNull();
    expect(tierLimit({ maxClients: 50 }, 'maxClients')).toBe(50);
    expect(tierLimit({}, 'maxClients')).toBeNull();
    expect(tierLimit(null, 'maxClients')).toBeNull();
  });

  it('treats a non-numeric limit as unlimited', () => {
    expect(tierLimit({ maxUsers: '5' }, 'maxUsers')).toBeNull();
  });
});
