import { describe, expect, it } from 'vitest';
import {
  confidenceFromProbability,
  evaluateHitlPolicy,
  hitlPolicyMatrixDoc,
  type HitlConfig,
} from '../src/services/hitlPolicy';

/**
 * Every cell of the §5 matrix, plus every boundary.
 *
 * The boundaries are the point of this file. A matrix is only as good as its
 * edges: `risk < 0.35` and `0.35 <= risk <= 0.70` leave the value 0.35 to
 * whichever comparison got it right, and a typo there silently moves a whole
 * band of work orders from "AI drafts" to "AI decides".
 */
const CONFIG: HitlConfig = { riskLow: 0.35, riskHigh: 0.7, confidenceMin: 0.7 };

describe('evaluateHitlPolicy — matrix cells', () => {
  it('AUTONOMOUS: risk below the low threshold with high confidence', () => {
    expect(evaluateHitlPolicy(0.1, 0.95, CONFIG).action).toBe('AUTONOMOUS');
    expect(evaluateHitlPolicy(0.34, 0.9, CONFIG).action).toBe('AUTONOMOUS');
    expect(evaluateHitlPolicy(0.0, 1.0, CONFIG).action).toBe('AUTONOMOUS');
  });

  it('ASSISTED: risk below the low threshold with moderate confidence', () => {
    expect(evaluateHitlPolicy(0.1, 0.8, CONFIG).action).toBe('ASSISTED');
    expect(evaluateHitlPolicy(0.34, 0.7, CONFIG).action).toBe('ASSISTED');
  });

  it('HUMAN_MANDATORY: risk below the low threshold with low confidence', () => {
    expect(evaluateHitlPolicy(0.1, 0.69, CONFIG).action).toBe('HUMAN_MANDATORY');
    expect(evaluateHitlPolicy(0.1, 0.0, CONFIG).action).toBe('HUMAN_MANDATORY');
  });

  it('ASSISTED: risk anywhere in the middle band, regardless of confidence', () => {
    for (const confidence of [0, 0.25, 0.5, 0.75, 1]) {
      expect(evaluateHitlPolicy(0.5, confidence, CONFIG).action).toBe('ASSISTED');
    }
  });

  it('HUMAN_MANDATORY with an evidence bundle: risk above the high threshold', () => {
    for (const confidence of [0, 0.5, 1]) {
      const decision = evaluateHitlPolicy(0.85, confidence, CONFIG);
      expect(decision.action).toBe('HUMAN_MANDATORY');
      expect(decision.needsEvidenceBundle).toBe(true);
    }
  });

  it('only the high-risk branch asks for an evidence bundle', () => {
    expect(evaluateHitlPolicy(0.1, 0.5, CONFIG).needsEvidenceBundle).toBe(false);
    expect(evaluateHitlPolicy(0.5, 0.5, CONFIG).needsEvidenceBundle).toBe(false);
  });
});

describe('evaluateHitlPolicy — boundaries', () => {
  it('risk exactly at the low threshold belongs to the middle band', () => {
    // "0.35 <= risk <= 0.70 -> ASSISTED", so 0.35 is ASSISTED even at
    // perfect confidence — it must not fall into the AUTONOMOUS branch.
    expect(evaluateHitlPolicy(0.35, 1.0, CONFIG).action).toBe('ASSISTED');
    expect(evaluateHitlPolicy(0.35, 0.0, CONFIG).action).toBe('ASSISTED');
  });

  it('risk just below the low threshold stays in the low band', () => {
    expect(evaluateHitlPolicy(0.3499, 1.0, CONFIG).action).toBe('AUTONOMOUS');
    expect(evaluateHitlPolicy(0.3499, 0.6999, CONFIG).action).toBe('HUMAN_MANDATORY');
  });

  it('risk exactly at the high threshold is still the middle band', () => {
    // "risk > 0.70" is strict, so 0.70 exactly is ASSISTED.
    expect(evaluateHitlPolicy(0.7, 1.0, CONFIG).action).toBe('ASSISTED');
    expect(evaluateHitlPolicy(0.7, 0.0, CONFIG).action).toBe('ASSISTED');
    expect(evaluateHitlPolicy(0.7, 1.0, CONFIG).needsEvidenceBundle).toBe(false);
  });

  it('risk just above the high threshold triggers the evidence bundle', () => {
    const decision = evaluateHitlPolicy(0.7001, 1.0, CONFIG);
    expect(decision.action).toBe('HUMAN_MANDATORY');
    expect(decision.needsEvidenceBundle).toBe(true);
  });

  it('confidence exactly at the AUTONOMOUS threshold qualifies', () => {
    // ">= 0.90 -> AUTONOMOUS", so 0.90 exactly is enough.
    expect(evaluateHitlPolicy(0.2, 0.9, CONFIG).action).toBe('AUTONOMOUS');
    expect(evaluateHitlPolicy(0.2, 0.8999, CONFIG).action).toBe('ASSISTED');
  });

  it('confidence exactly at the ASSISTED floor qualifies', () => {
    // ">= 0.70 -> ASSISTED", so 0.70 exactly is assisted rather than mandatory.
    expect(evaluateHitlPolicy(0.2, 0.7, CONFIG).action).toBe('ASSISTED');
    expect(evaluateHitlPolicy(0.2, 0.6999, CONFIG).action).toBe('HUMAN_MANDATORY');
  });

  it('confidence exactly 0.5 is the least confident point and never autonomous', () => {
    expect(evaluateHitlPolicy(0.1, 0.5, CONFIG).action).toBe('HUMAN_MANDATORY');
  });
});

describe('evaluateHitlPolicy — fail-safe behaviour', () => {
  it('treats a non-finite risk score as the most conservative case', () => {
    expect(evaluateHitlPolicy(Number.NaN, 0.99, CONFIG).action).toBe('HUMAN_MANDATORY');
    expect(evaluateHitlPolicy(Number.POSITIVE_INFINITY, 0.99, CONFIG).action).toBe(
      'HUMAN_MANDATORY',
    );
  });

  it('treats a non-finite confidence as the most conservative case', () => {
    expect(evaluateHitlPolicy(0.05, Number.NaN, CONFIG).action).toBe('HUMAN_MANDATORY');
  });

  it('clamps out-of-range inputs instead of throwing', () => {
    expect(evaluateHitlPolicy(-5, 0.95, CONFIG).action).toBe('AUTONOMOUS');
    expect(evaluateHitlPolicy(5, 0.95, CONFIG).action).toBe('HUMAN_MANDATORY');
    expect(evaluateHitlPolicy(0.2, 5, CONFIG).action).toBe('AUTONOMOUS');
  });

  it('honours overridden thresholds rather than the defaults', () => {
    const strict: HitlConfig = { riskLow: 0.2, riskHigh: 0.5, confidenceMin: 0.8 };
    expect(evaluateHitlPolicy(0.3, 0.99, strict).action).toBe('ASSISTED');
    expect(evaluateHitlPolicy(0.1, 0.85, strict).action).toBe('ASSISTED');
    expect(evaluateHitlPolicy(0.1, 0.79, strict).action).toBe('HUMAN_MANDATORY');
    expect(evaluateHitlPolicy(0.6, 0.99, strict).needsEvidenceBundle).toBe(true);
  });
});

describe('confidenceFromProbability', () => {
  it('is 1 at the extremes and 0 at the decision boundary', () => {
    expect(confidenceFromProbability(0)).toBe(1);
    expect(confidenceFromProbability(1)).toBe(1);
    expect(confidenceFromProbability(0.5)).toBe(0);
  });

  it('is symmetric around the boundary', () => {
    expect(confidenceFromProbability(0.25)).toBeCloseTo(0.5, 10);
    expect(confidenceFromProbability(0.75)).toBeCloseTo(0.5, 10);
  });

  it('returns 0 for a non-finite input rather than NaN', () => {
    expect(confidenceFromProbability(Number.NaN)).toBe(0);
    expect(confidenceFromProbability(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('policy documentation', () => {
  it('exposes the matrix so the rest of the codebase cannot drift from it', () => {
    expect(hitlPolicyMatrixDoc()).toContain('0.35');
    expect(hitlPolicyMatrixDoc()).toContain('HUMAN_MANDATORY');
  });
});
