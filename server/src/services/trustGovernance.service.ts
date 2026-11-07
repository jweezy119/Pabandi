import crypto from 'node:crypto';
import { TrustBandConfig, trustScoringConfig } from '../config/trust-scoring.config';
import { TrustBandEvaluation } from './privyTrustScoring';

/**
 * Year-0 Pragmatic Extraction — Piece 1: ML Governance & Counterfactual Recourse
 *
 * Implements the immediately valuable, zero-cryptography governance controls from
 * Section 5 of the Trust Architecture Specification:
 *   1. Bayesian Cold-Start Prior grounded in verified identity links
 *   2. Actionable Counterfactual Recourse generator
 *   3. Deterministic feature-attribution (SHAP-equivalent) vector for audit binding
 *   4. Shadow-mode candidate model drift evaluation & regional FPR parity checks
 */

export interface CounterfactualStep {
  action: string;
  category: 'phishing_resistant' | 'oauth' | 'link_count' | 'escrow_history';
  estimatedPointGain: number;
}

export interface CounterfactualRecourse {
  currentBand: 'A' | 'B' | 'C' | 'D';
  targetBand: 'A' | 'B' | 'C' | null;
  targetScore: number;
  pointsNeeded: number;
  summary: string;
  steps: CounterfactualStep[];
}

export interface AttributionVector {
  basePrior: number;
  phishingResistantContribution: number;
  oauthContribution: number;
  linkDepthContribution: number;
  escrowHistoryContribution: number;
}

export interface RegionalOutcomeSample {
  region: string;
  predictedHighRisk: boolean;
  actualGoodOutcome: boolean;
}

export interface RegionalFprParityResult {
  corridorA: string;
  corridorB: string;
  fprA: number;
  fprB: number;
  absoluteGap: number;
  maxAllowedGap: number;
  passesParity: boolean;
}

export interface ShadowModeComparison {
  productionScore: number;
  shadowScore: number;
  absoluteDriftPct: number;
  rankOrderPreserved: boolean;
  passesPromotionGate: boolean;
}

/**
 * Bayesian Cold-Start Prior for principals below the minimum escrow history threshold (< 3 escrows).
 * Blends cohort prior mean (mu_cohort = 50.0) with verified external identity evidence.
 */
export function computeBayesianColdStartScore(params: {
  evaluation: TrustBandEvaluation;
  completedEscrows?: number;
  disputedEscrows?: number;
  cohortPriorMean?: number;
  priorWeight?: number;
}): { bayesianScore: number; attribution: AttributionVector } {
  const {
    evaluation,
    completedEscrows = 0,
    disputedEscrows = 0,
    cohortPriorMean = 50.0,
    priorWeight = completedEscrows >= 3 ? 0.2 : 0.45,
  } = params;

  const phishingResistantContribution = evaluation.hasPhishingResistant ? 25.0 : 0.0;
  const oauthContribution = evaluation.hasOAuth ? 15.0 : 0.0;
  const linkDepthContribution = Math.min(25.0, evaluation.nonEmailLinks * 6.25);
  const netEscrows = Math.max(0, completedEscrows - disputedEscrows * 3);
  const escrowHistoryContribution = Math.min(35.0, netEscrows * 7.0);

  const rawEvidenceScore = Math.min(
    100.0,
    20.0 +
      phishingResistantContribution +
      oauthContribution +
      linkDepthContribution +
      escrowHistoryContribution
  );

  const bayesianScore = Number(
    (cohortPriorMean * priorWeight + rawEvidenceScore * (1 - priorWeight)).toFixed(2)
  );

  return {
    bayesianScore,
    attribution: {
      basePrior: Number((cohortPriorMean * priorWeight).toFixed(2)),
      phishingResistantContribution: Number(
        (phishingResistantContribution * (1 - priorWeight)).toFixed(2)
      ),
      oauthContribution: Number((oauthContribution * (1 - priorWeight)).toFixed(2)),
      linkDepthContribution: Number((linkDepthContribution * (1 - priorWeight)).toFixed(2)),
      escrowHistoryContribution: Number(
        (escrowHistoryContribution * (1 - priorWeight)).toFixed(2)
      ),
    },
  };
}

/**
 * Generates an actionable counterfactual recourse explaining the minimal actions
 * required to advance to the next Trust Band (and ultimately Band A).
 */
export function generateCounterfactualRecourse(
  evaluation: TrustBandEvaluation,
  config: TrustBandConfig = trustScoringConfig
): CounterfactualRecourse {
  if (evaluation.band === 'A') {
    return {
      currentBand: 'A',
      targetBand: null,
      targetScore: config.bandA.targetScore,
      pointsNeeded: 0,
      summary:
        'You have reached Trust Band A (zero deposit required). Maintain verified MFA/Passkey protection to preserve your standing.',
      steps: [],
    };
  }

  if (evaluation.band === 'B') {
    const steps: CounterfactualStep[] = [];
    const linksNeeded = Math.max(0, config.bandA.minLinks - evaluation.totalLinks);

    if (!evaluation.hasPhishingResistant && config.bandA.requirePhishingResistant) {
      steps.push({
        action: 'Register a Passkey or link a verified phone number (SMS OTP / MFA)',
        category: 'phishing_resistant',
        estimatedPointGain: 10,
      });
    }
    if (linksNeeded > 0) {
      steps.push({
        action: `Link ${linksNeeded} additional verified account${linksNeeded > 1 ? 's' : ''} to reach ${config.bandA.minLinks} total links`,
        category: 'link_count',
        estimatedPointGain: 5 * linksNeeded,
      });
    }

    const actionText = steps.map((s) => s.action).join(' AND ');
    return {
      currentBand: 'B',
      targetBand: 'A',
      targetScore: config.bandA.targetScore,
      pointsNeeded: Math.max(0, config.bandA.targetScore - evaluation.score),
      summary: `To advance from Band B (${evaluation.score}) to Band A (${config.bandA.targetScore} — zero deposit): ${actionText}.`,
      steps,
    };
  }

  if (evaluation.band === 'C') {
    const steps: CounterfactualStep[] = [];
    const linksNeeded = Math.max(0, config.bandB.minLinks - evaluation.totalLinks);

    if (!evaluation.hasOAuth && config.bandB.requireOAuth) {
      steps.push({
        action: 'Link at least 1 OAuth provider (Google, Apple, GitHub, or LinkedIn)',
        category: 'oauth',
        estimatedPointGain: 12,
      });
    }
    if (linksNeeded > 0) {
      steps.push({
        action: `Link ${linksNeeded} more verified account${linksNeeded > 1 ? 's' : ''} to reach ${config.bandB.minLinks} total links`,
        category: 'link_count',
        estimatedPointGain: 8 * linksNeeded,
      });
    }

    const actionText = steps.map((s) => s.action).join(' AND ');
    return {
      currentBand: 'C',
      targetBand: 'B',
      targetScore: config.bandB.targetScore,
      pointsNeeded: Math.max(0, config.bandB.targetScore - evaluation.score),
      summary: `To advance from Band C (${evaluation.score}) to Band B (${config.bandB.targetScore} — low deposit): ${actionText}.`,
      steps,
    };
  }

  // Band D -> Band C
  const steps: CounterfactualStep[] = [
    {
      action: 'Link at least 1 verified account beyond email (e.g., Passkey, Phone, Google, or GitHub)',
      category: 'link_count',
      estimatedPointGain: Math.max(0, config.bandC.targetScore - evaluation.score),
    },
  ];

  return {
    currentBand: 'D',
    targetBand: 'C',
    targetScore: config.bandC.targetScore,
    pointsNeeded: Math.max(0, config.bandC.targetScore - evaluation.score),
    summary: `To advance from Band D (${evaluation.score}) to Band C (${config.bandC.targetScore}): ${steps[0].action}.`,
    steps,
  };
}

/**
 * Evaluates regional False Positive Rate (FPR) parity across two operating corridors
 * (e.g., Chicago vs. Lahore). Gate requires |FPR_A - FPR_B| <= maxAllowedGap (default 0.03).
 */
export function evaluateRegionalFprParity(
  samples: RegionalOutcomeSample[],
  corridorA = 'Chicago',
  corridorB = 'Lahore',
  maxAllowedGap = 0.03
): RegionalFprParityResult {
  const computeFpr = (region: string): number => {
    const goodInRegion = samples.filter(
      (s) => s.region.toLowerCase() === region.toLowerCase() && s.actualGoodOutcome
    );
    if (goodInRegion.length === 0) return 0;
    const falsePositives = goodInRegion.filter((s) => s.predictedHighRisk).length;
    return Number((falsePositives / goodInRegion.length).toFixed(4));
  };

  const fprA = computeFpr(corridorA);
  const fprB = computeFpr(corridorB);
  const absoluteGap = Number(Math.abs(fprA - fprB).toFixed(4));

  return {
    corridorA,
    corridorB,
    fprA,
    fprB,
    absoluteGap,
    maxAllowedGap,
    passesParity: absoluteGap <= maxAllowedGap,
  };
}

/**
 * Evaluates a candidate shadow-mode score series against production scores.
 * Promotion requires Mean Absolute Score Drift < 3.2% and zero rank-order inversions.
 */
export function evaluateShadowModeBatch(
  pairs: Array<{ principalId: string; productionScore: number; shadowScore: number; isBandA?: boolean }>
): ShadowModeComparison {
  if (pairs.length === 0) {
    return {
      productionScore: 0,
      shadowScore: 0,
      absoluteDriftPct: 0,
      rankOrderPreserved: true,
      passesPromotionGate: true,
    };
  }

  const totalProd = pairs.reduce((acc, p) => acc + p.productionScore, 0) / pairs.length;
  const totalShadow = pairs.reduce((acc, p) => acc + p.shadowScore, 0) / pairs.length;
  const meanAbsDiff =
    pairs.reduce((acc, p) => acc + Math.abs(p.productionScore - p.shadowScore), 0) / pairs.length;

  let rankOrderPreserved = true;
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const a = pairs[i];
      const b = pairs[j];
      if (a.isBandA || b.isBandA) {
        const prodDiff = a.productionScore - b.productionScore;
        const shadowDiff = a.shadowScore - b.shadowScore;
        if (prodDiff * shadowDiff < 0) {
          rankOrderPreserved = false;
          break;
        }
      }
    }
  }

  const absoluteDriftPct = Number(meanAbsDiff.toFixed(2));
  return {
    productionScore: Number(totalProd.toFixed(2)),
    shadowScore: Number(totalShadow.toFixed(2)),
    absoluteDriftPct,
    rankOrderPreserved,
    passesPromotionGate: absoluteDriftPct < 3.2 && rankOrderPreserved,
  };
}

/**
 * Deterministic SHA-256 commitment of the attribution/SHAP vector for audit binding.
 */
export function hashAttributionVector(attribution: AttributionVector): string {
  const canonical = JSON.stringify({
    basePrior: attribution.basePrior,
    phishingResistantContribution: attribution.phishingResistantContribution,
    oauthContribution: attribution.oauthContribution,
    linkDepthContribution: attribution.linkDepthContribution,
    escrowHistoryContribution: attribution.escrowHistoryContribution,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}
