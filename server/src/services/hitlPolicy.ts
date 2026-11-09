/**
 * HITL policy — the deterministic matrix from §5.
 *
 * This is deliberately NOT a learned classifier. A learned policy would change
 * its behaviour as data accumulated, which means the same work order could be
 * auto-dispatched one week and held for review the next with nothing in the
 * audit trail explaining why. A matrix cannot do that: the inputs, the
 * thresholds and the outcome are all visible in this file.
 *
 * The matrix:
 *
 *   | risk_score | confidence | action                          |
 *   |------------|------------|---------------------------------|
 *   | < 0.35     | >= 0.90    | AUTONOMOUS — execute and log    |
 *   | < 0.35     | 0.70–0.90  | ASSISTED — agent drafts, 1-click|
 *   | < 0.35     | < 0.70     | HUMAN_MANDATORY                 |
 *   | 0.35–0.70  | any        | ASSISTED                        |
 *   | > 0.70     | any        | HUMAN_MANDATORY + evidence bundle|
 *
 * Confidence is the distance from the decision boundary:
 * `1 - |p - 0.5| * 2`. At p = 0.5 the model has no idea; at p = 0 or 1 it is
 * maximally certain. Note this is confidence in the *prediction*, not the
 * risk score itself — a high-confidence prediction of a low-risk outcome and
 * a high-confidence prediction of a high-risk outcome are equally confident.
 */

export type HitlAction = 'AUTONOMOUS' | 'ASSISTED' | 'HUMAN_MANDATORY';

export interface HitlConfig {
  /** Below this risk score the model may act alone when confident enough. */
  riskLow: number;
  /** Above this risk score a human must decide, and gets an evidence bundle. */
  riskHigh: number;
  /** Minimum confidence for ASSISTED rather than HUMAN_MANDATORY when risk is low. */
  confidenceMin: number;
}

export interface HitlDecision {
  action: HitlAction;
  /** §5: only the high-risk branch carries an evidence bundle. */
  needsEvidenceBundle: boolean;
  /** Plain-language reason, written for the audit trail rather than for a UI. */
  reason: string;
}

/**
 * Fixed by the matrix. The spec exposes three thresholds as env vars and this
 * is not one of them, so it is a constant here — changing it changes the
 * product's definition of "confident enough to act alone", which is a
 * decision for the spec, not a deployment knob.
 */
export const HITL_CONFIDENCE_HIGH = 0.9;

function parseThreshold(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * The matrix as text, for audit logs and for any UI that needs to explain the
 * policy. Exists so the prose description and the code cannot drift apart —
 * if someone edits the thresholds, this string is the thing that goes stale
 * first and the test that reads it is the thing that notices.
 */
export function hitlPolicyMatrixDoc(config: HitlConfig = hitlConfig): string {
  return [
    `risk < ${config.riskLow} and confidence >= ${HITL_CONFIDENCE_HIGH} -> AUTONOMOUS`,
    `risk < ${config.riskLow} and confidence >= ${config.confidenceMin} -> ASSISTED`,
    `risk < ${config.riskLow} and confidence < ${config.confidenceMin} -> HUMAN_MANDATORY`,
    `${config.riskLow} <= risk <= ${config.riskHigh} -> ASSISTED`,
    `risk > ${config.riskHigh} -> HUMAN_MANDATORY + evidence bundle`,
  ].join('\n');
}

/**
 * Read once at startup.
 *
 * Reading `process.env` inside the request path would let a runtime env change
 * alter dispatch policy mid-flight, and would do it per request with no audit
 * record of when it happened. Capturing at module load means the policy is
 * fixed for the life of the process.
 */
export const hitlConfig: HitlConfig = {
  riskLow: parseThreshold(process.env.HITL_RISK_LOW, 0.35),
  riskHigh: parseThreshold(process.env.HITL_RISK_HIGH, 0.7),
  confidenceMin: parseThreshold(process.env.HITL_CONFIDENCE_MIN, 0.7),
};

/**
 * Distance from the decision boundary: 0 at p = 0.5, 1 at p = 0 or 1.
 *
 * §5 states this as `1 - |p - 0.5| * 2` and then glosses it as "distance from
 * decision boundary". Those are opposites: `|p - 0.5| * 2` is the distance, and
 * `1 - ` that is the *closeness* to the boundary. Taken literally, the formula
 * would score confidence 1 when the model has no idea (p = 0.5) and 0 when it
 * is certain — which would auto-dispatch exactly the jobs the model is least
 * sure about, inverting the whole matrix.
 *
 * The matrix and the gloss both require the distance form, so that is what is
 * implemented. Flipping it back is a one-character change here, but it is a
 * policy change, not a refactor.
 *
 * Clamped to [0, 1] so an out-of-range input cannot produce a negative
 * confidence that would then be compared against the thresholds.
 */
export function confidenceFromProbability(probability: number): number {
  if (!Number.isFinite(probability)) return 0;
  return Math.min(1, Math.max(0, Math.abs(probability - 0.5) * 2));
}

/**
 * Evaluate the matrix.
 *
 * Fail-safe: a non-finite risk score or confidence is treated as the most
 * conservative input possible. A missing prediction must never result in an
 * auto-dispatch.
 */
export function evaluateHitlPolicy(
  riskScore: number,
  confidence: number,
  config: HitlConfig = hitlConfig,
): HitlDecision {
  if (!Number.isFinite(riskScore) || !Number.isFinite(confidence)) {
    return {
      action: 'HUMAN_MANDATORY',
      needsEvidenceBundle: false,
      reason: 'Risk score or confidence was missing or not a number, so the policy cannot clear this job for autonomous action.',
    };
  }

  const risk = Math.min(1, Math.max(0, riskScore));
  const conf = Math.min(1, Math.max(0, confidence));

  if (risk > config.riskHigh) {
    return {
      action: 'HUMAN_MANDATORY',
      needsEvidenceBundle: true,
      reason: `Risk ${risk.toFixed(2)} is above ${config.riskHigh.toFixed(2)}, so a person decides and gets the evidence bundle.`,
    };
  }

  if (risk >= config.riskLow) {
    return {
      action: 'ASSISTED',
      needsEvidenceBundle: false,
      reason: `Risk ${risk.toFixed(2)} sits in the ${config.riskLow.toFixed(2)}–${config.riskHigh.toFixed(2)} band, so the AI drafts and a person confirms.`,
    };
  }

  if (conf >= HITL_CONFIDENCE_HIGH) {
    return {
      action: 'AUTONOMOUS',
      needsEvidenceBundle: false,
      reason: `Risk ${risk.toFixed(2)} is below ${config.riskLow.toFixed(2)} and confidence ${conf.toFixed(2)} is at least ${HITL_CONFIDENCE_HIGH.toFixed(2)}, so the action proceeds and is logged.`,
    };
  }

  if (conf >= config.confidenceMin) {
    return {
      action: 'ASSISTED',
      needsEvidenceBundle: false,
      reason: `Risk ${risk.toFixed(2)} is low but confidence ${conf.toFixed(2)} is below ${HITL_CONFIDENCE_HIGH.toFixed(2)}, so the AI drafts and a person confirms.`,
    };
  }

  return {
    action: 'HUMAN_MANDATORY',
    needsEvidenceBundle: false,
    reason: `Risk ${risk.toFixed(2)} is low but confidence ${conf.toFixed(2)} is below ${config.confidenceMin.toFixed(2)}, so a person decides.`,
  };
}
