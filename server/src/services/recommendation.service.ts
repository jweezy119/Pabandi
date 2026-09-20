import { prisma } from '../utils/database';
import { getPoolInfo } from './raydiumPool.service';

const TYPESAFE_API_KEY = process.env.TYPESAFE_API_KEY || '';
const TYPESAFE_BASE_URL = 'https://api.typesafe.dev';
const MODEL = 'jev-latest';

interface JevQuestion {
  type: 'choice' | 'score' | 'noul';
  instructions: string;
  criteria?: any;
}

interface JevRequest {
  model: string;
  state: Record<string, any>;
  questions: Record<string, JevQuestion>;
}

interface JevResponse {
  model: string;
  answers: Record<string, any>;
}

/**
 * Pabandi Recommendation Engine
 * ==============================
 * 
 * Uses Jev to power all site recommendations.
 * Jev is 400x cheaper than LLMs for decision-making.
 * 
 * Recommendation types:
 * - Property recommendations (which property to show)
 * - Trust tier recommendation (which tier to target)
 * - Payment method recommendation (USDC vs PAB)
 * - Staking amount recommendation (how much to stake)
 * - Feature recommendations (what to show next)
 */
export class RecommendationService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = TYPESAFE_API_KEY;
    this.baseUrl = TYPESAFE_BASE_URL;
    this.model = MODEL;
  }

  private async callJev(request: JevRequest): Promise<JevResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/decisions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  // ── PROPERTY RECOMMENDATIONS ──────────────────────────

  async recommendProperties(userId: string, availableProperties: any[]): Promise<{
    recommended: any[];
    reasoning: string;
    confidence: number;
  }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { recommended: [], reasoning: 'User not found', confidence: 0 };

    const request: JevRequest = {
      model: this.model,
      state: {
        user_trust_score: user.trustScore,
        user_pab_staked: user.pabStaked ?? 0,
        user_usdc_balance: user.usdcBalance ?? 0,
        user_pab_balance: user.pabBalance ?? 0,
        property_count: availableProperties.length,
        avg_price: availableProperties.reduce((s: number, p: any) => s + (p.monthlyRent || 0), 0) / Math.max(1, availableProperties.length),
        min_price: Math.min(...availableProperties.map((p: any) => p.monthlyRent || Infinity)),
        max_price: Math.max(...availableProperties.map((p: any) => p.monthlyRent || 0)),
      },
      questions: {
        price_sensitivity: {
          type: 'choice',
          instructions: 'What price range should we recommend?',
          criteria: {
            budget: 'Recommend lower-priced properties — user has limited balance',
            mid_range: 'Recommend mid-range properties — user has moderate balance',
            premium: 'Recommend premium properties — user has high balance',
          },
        },
        trust_requirement: {
          type: 'noul',
          instructions: 'Should we only recommend properties that match the user trust tier?',
        },
      },
    };

    const response = await this.callJev(request);
    if (!response) {
      // Fallback: return first 3 properties
      return { recommended: availableProperties.slice(0, 3), reasoning: 'Default ordering', confidence: 0.5 };
    }

    const answers = response.answers;
    const priceRange = answers.price_sensitivity?.choice ?? 'mid_range';
    const trustRequired = (answers.trust_requirement?.noul ?? 0) > 0.5;

    // Filter properties based on Jev decision
    let filtered = availableProperties.filter((p: any) => {
      if (trustRequired && user.trustScore < (p.minTrustScore || 0)) return false;
      if (priceRange === 'budget' && p.monthlyRent > 1000) return false;
      if (priceRange === 'premium' && p.monthlyRent < 2000) return false;
      return true;
    });

    if (filtered.length === 0) filtered = availableProperties.slice(0, 3);

    return {
      recommended: filtered.slice(0, 5),
      reasoning: `Price range: ${priceRange}, Trust filter: ${trustRequired}`,
      confidence: Math.min(answers.price_sensitivity?.confidence ?? 0, answers.trust_requirement?.confidence ?? 0),
    };
  }

  // ── TRUST TIER RECOMMENDATION ─────────────────────────

  async recommendTrustTier(userId: string): Promise<{
    currentTier: string;
    recommendedTier: string;
    pabNeeded: number;
    apy: number;
    benefits: string[];
    confidence: number;
  }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { currentTier: 'BRONZE', recommendedTier: 'BRONZE', pabNeeded: 0, apy: 0, benefits: [], confidence: 0 };
    }

    const pabStaked = user.pabStaked ?? 0;
    const currentTier = pabStaked >= 2000 ? 'PLATINUM' : pabStaked >= 500 ? 'GOLD' : pabStaked >= 100 ? 'SILVER' : 'BRONZE';

    const request: JevRequest = {
      model: this.model,
      state: {
        current_tier: currentTier,
        pab_staked: pabStaked,
        pab_balance: user.pabBalance ?? 0,
        usdc_balance: user.usdcBalance ?? 0,
        trust_score: user.trustScore,
        account_age_days: Math.floor((Date.now() - user.createdAt.getTime()) / 86400000),
      },
      questions: {
        recommended_tier: {
          type: 'choice',
          instructions: 'Which trust tier should this user target next?',
          criteria: {
            bronze: 'Stay at Bronze — user is new or has low balance',
            silver: 'Target Silver — user has 100+ PAB and moderate activity',
            gold: 'Target Gold — user has 500+ PAB and high activity',
            platinum: 'Target Platinum — user has 2000+ PAB and excellent history',
          },
        },
      },
    };

    const response = await this.callJev(request);
    const recommendedTier = response?.answers?.recommended_tier?.choice ?? currentTier;

    const tiers: Record<string, { pabNeeded: number; apy: number; benefits: string[] }> = {
      BRONZE: { pabNeeded: 0, apy: 0, benefits: ['Basic access', 'Standard support'] },
      SILVER: { pabNeeded: 100, apy: 5, benefits: ['Priority support', '5% booking discount', 'Early access'] },
      GOLD: { pabNeeded: 500, apy: 8, benefits: ['VIP support', '10% booking discount', 'Free cancellations', 'Agent priority'] },
      PLATINUM: { pabNeeded: 2000, apy: 12, benefits: ['Concierge support', '15% booking discount', 'Free upgrades', 'Guaranteed availability'] },
    };

    return {
      currentTier,
      recommendedTier,
      pabNeeded: tiers[recommendedTier]?.pabNeeded ?? 0,
      apy: tiers[recommendedTier]?.apy ?? 0,
      benefits: tiers[recommendedTier]?.benefits ?? [],
      confidence: response?.answers?.recommended_tier?.confidence ?? 0,
    };
  }

  // ── PAYMENT METHOD RECOMMENDATION ─────────────────────

  async recommendPaymentMethod(userId: string, amountUsd: number): Promise<{
    method: 'usdc' | 'pab' | 'split';
    pabPercent: number;
    savings: number;
    reasoning: string;
    confidence: number;
  }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { method: 'usdc', pabPercent: 0, savings: 0, reasoning: 'User not found', confidence: 0 };

    const request: JevRequest = {
      model: this.model,
      state: {
        user_pab_balance: user.pabBalance ?? 0,
        user_usdc_balance: user.usdcBalance ?? 0,
        user_pab_staked: user.pabStaked ?? 0,
        payment_amount: amountUsd,
        pab_price: 0.000178,
        trust_score: user.trustScore,
      },
      questions: {
        payment_method: {
          type: 'choice',
          instructions: 'What payment method should we recommend?',
          criteria: {
            usdc: 'Pay with USDC — user has no PAB or prefers stability',
            pab: 'Pay with PAB — user has PAB and wants the 5% discount',
            split: 'Split payment — user has some PAB but not enough for full amount',
          },
        },
      },
    };

    const response = await this.callJev(request);
    const method = (response?.answers?.payment_method?.choice ?? 'usdc') as 'usdc' | 'pab' | 'split';

    let pabPercent = 0;
    let savings = 0;

    if (method === 'pab') {
      pabPercent = 100;
      savings = amountUsd * 0.05;
    } else if (method === 'split') {
      const pabValue = (user.pabBalance ?? 0) * 0.000178;
      pabPercent = Math.min(100, Math.round((pabValue / amountUsd) * 100));
      savings = (amountUsd * pabPercent / 100) * 0.05;
    }

    return {
      method,
      pabPercent,
      savings,
      reasoning: `Based on PAB balance: ${user.pabBalance ?? 0}, USDC balance: ${user.usdcBalance ?? 0}`,
      confidence: response?.answers?.payment_method?.confidence ?? 0,
    };
  }

  // ── FEATURE RECOMMENDATION (Onboarding) ────────────────

  async recommendNextFeature(userId: string): Promise<{
    feature: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
    confidence: number;
  }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { feature: 'complete_profile', reason: 'New user', priority: 'high', confidence: 0 };

    const accountAge = Math.floor((Date.now() - user.createdAt.getTime()) / 86400000);
    const hasStaked = (user.pabStaked ?? 0) > 0;
    const hasPab = (user.pabBalance ?? 0) > 0;
    const hasMadePayment = await prisma.bookingPabRecord.count({ where: { userId } }) > 0;

    const request: JevRequest = {
      model: this.model,
      state: {
        account_age_days: accountAge,
        has_staked: hasStaked,
        has_pab: hasPab,
        has_made_payment: hasMadePayment,
        trust_score: user.trustScore,
        pab_balance: user.pabBalance ?? 0,
        usdc_balance: user.usdcBalance ?? 0,
      },
      questions: {
        next_feature: {
          type: 'choice',
          instructions: 'What should we guide the user to do next?',
          criteria: {
            complete_profile: 'User has incomplete profile — guide to setup',
            make_first_booking: 'User is ready — guide to first booking',
            stake_pab: 'User has PAB but not staking — guide to staking',
            pay_rent_with_pab: 'User has balance — guide to PAB payment discount',
            invite_friends: 'User is active — guide to referrals',
          },
        },
      },
    };

    const response = await this.callJev(request);
    const feature = response?.answers?.next_feature?.choice ?? 'complete_profile';

    const featureReasons: Record<string, string> = {
      complete_profile: 'Complete your profile to boost trust score',
      make_first_booking: 'Book your first table and earn PAB rewards',
      stake_pab: 'Stake PAB for higher trust and better deals',
      pay_rent_with_pab: 'Save 5% on rent by paying with PAB',
      invite_friends: 'Invite friends and earn PAB bonuses',
    };

    return {
      feature,
      reason: featureReasons[feature] ?? 'Explore Pabandi',
      priority: feature === 'complete_profile' ? 'high' : 'medium',
      confidence: response?.answers?.next_feature?.confidence ?? 0,
    };
  }
}

export const recommendationEngine = new RecommendationService();
