import { trustScoringConfig, TrustBandConfig } from '../config/trust-scoring.config';

export interface PrivyLinkedAccount {
  type: string;
  verified?: boolean;
  verifiedAt?: string | number | Date | null;
  [key: string]: unknown;
}

export interface PrivyUserPayload {
  id: string;
  linkedAccounts?: PrivyLinkedAccount[];
  linked_accounts?: PrivyLinkedAccount[];
  mfaMethods?: Array<{ type: string; verified?: boolean }>;
  mfa_methods?: Array<{ type: string; verified?: boolean }>;
  [key: string]: unknown;
}

export interface TrustBandEvaluation {
  band: 'A' | 'B' | 'C' | 'D';
  score: number;
  totalLinks: number;
  hasPhishingResistant: boolean;
  hasOAuth: boolean;
  nonEmailLinks: number;
  hasMfa: boolean;
  reason: string;
}

/**
 * Pure function to evaluate a user's Trust Band based on linked accounts and MFA status.
 *
 * Scoring Rules:
 * - Band A (zero deposit): at least 4 verified links, including at least one phishing-resistant method (passkey or verified phone) or active MFA.
 * - Band B (low deposit): at least 3 verified links, including at least one OAuth provider (Google, Apple, GitHub, etc.).
 * - Band C (medium deposit): at least 1 verified link beyond email.
 * - Band D (high deposit): email-only or anonymous.
 */
export function evaluatePrivyTrustBand(
  user: PrivyUserPayload,
  config: TrustBandConfig = trustScoringConfig
): TrustBandEvaluation {
  const accounts = user.linkedAccounts || user.linked_accounts || [];
  const mfaList = user.mfaMethods || user.mfa_methods || [];
  const hasMfa = mfaList.length > 0;

  const totalLinks = accounts.length;

  let hasPhishingResistant = false;
  let hasOAuth = false;
  let nonEmailLinks = 0;

  for (const acc of accounts) {
    const rawType = (acc.type || '').toLowerCase();

    // Check phishing-resistant methods: passkey or verified phone
    if (rawType === 'passkey') {
      hasPhishingResistant = true;
      nonEmailLinks++;
    } else if (rawType === 'phone') {
      // Phone is phishing-resistant when verified
      hasPhishingResistant = true;
      nonEmailLinks++;
    } else if (
      rawType.includes('oauth') ||
      ['google', 'apple', 'github', 'twitter', 'discord', 'linkedin'].includes(rawType)
    ) {
      hasOAuth = true;
      nonEmailLinks++;
    } else if (rawType === 'wallet') {
      nonEmailLinks++;
    } else if (rawType !== 'email') {
      nonEmailLinks++;
    }
  }

  // MFA (authenticator / TOTP / SMS) also bolsters phishing resistance
  if (hasMfa) {
    hasPhishingResistant = true;
  }

  // Band A: at least 4 verified links, including at least one phishing-resistant method
  if (
    totalLinks >= config.bandA.minLinks &&
    (!config.bandA.requirePhishingResistant || hasPhishingResistant)
  ) {
    return {
      band: 'A',
      score: config.bandA.targetScore,
      totalLinks,
      hasPhishingResistant,
      hasOAuth,
      nonEmailLinks,
      hasMfa,
      reason: `Band A achieved: ${totalLinks} linked accounts with phishing-resistant authentication (Passkey / Phone / MFA). Zero deposit required.`,
    };
  }

  // Band B: at least 3 verified links, including at least one OAuth provider
  if (
    totalLinks >= config.bandB.minLinks &&
    (!config.bandB.requireOAuth || hasOAuth)
  ) {
    return {
      band: 'B',
      score: config.bandB.targetScore,
      totalLinks,
      hasPhishingResistant,
      hasOAuth,
      nonEmailLinks,
      hasMfa,
      reason: `Band B achieved: ${totalLinks} linked accounts with verified OAuth identity. Low deposit applied.`,
    };
  }

  // Band C: at least 1 verified link beyond email
  if (nonEmailLinks >= config.bandC.minLinks) {
    return {
      band: 'C',
      score: config.bandC.targetScore,
      totalLinks,
      hasPhishingResistant,
      hasOAuth,
      nonEmailLinks,
      hasMfa,
      reason: `Band C: ${nonEmailLinks} verified link(s) beyond email. Standard deposit applied.`,
    };
  }

  // Band D: email-only or anonymous
  return {
    band: 'D',
    score: config.bandD.targetScore,
    totalLinks,
    hasPhishingResistant,
    hasOAuth,
    nonEmailLinks,
    hasMfa,
    reason: 'Band D: Email-only or unlinked account. Full deposit required.',
  };
}
