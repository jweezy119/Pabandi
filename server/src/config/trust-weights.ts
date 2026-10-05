/**
 * trust-weights.ts — the canonical definition of what a reliability score IS.
 *
 * WHY THIS FILE EXISTS
 *
 * `reliabilityScore` had seven writers on three mutually incompatible scales:
 *
 *   - 0–100   (`crm-reliability.service.ts`, `reliability.service.ts`, badge UI)
 *   - 0–1000  (`passport.service.ts` clamps, passport tier boundaries, schema
 *              default of 750)
 *   - 0–5     (`reviewService.ts` wrote a Google rating blend straight into the
 *              field)
 *
 * A field with three scales is not a field, it is three fields that happen to
 * share a column. Every threshold that read it inherited whichever scale its
 * author had in mind, so `>= 90` and `>= 700` were both live comparisons
 * against the same stored number, and both were wrong for half the rows.
 *
 * The lock: ONE scale (0–100), ONE writer (`trust-core.service.ts`). Every other
 * module reads. That invariant is asserted mechanically in
 * `server/src/services/__tests__/reliabilityScore.invariant.test.ts` — not by
 * convention, by a test that greps for a writer outside trust-core and fails.
 *
 * WHY CONFIG AND NOT CODE
 *
 * The weights below are parameters, not logic. Changing one must not require
 * touching the scoring function, and a scoring function that reads its
 * coefficients from a literal in its own body cannot be reasoned about by
 * anyone reading a score. A future learned expert has to beat THIS, so the
 * thing it has to beat has to be readable in one place.
 */

// ─── The scale ───────────────────────────────────────────────────────────────
//
// Locked. 0–100. Anything that produces a number outside this range is a bug,
// not a rounding question. `clampReliabilityScore` is the only sanctioned way
// to bring a value into range, and it is called on every persist.
export const RELIABILITY_MIN = 0;
export const RELIABILITY_MAX = 100;

/**
 * Cold-start baseline.
 *
 * WHY 50 AND NOT NULL
 *
 * `null` is arguably more honest — "we have no opinion yet" is literally true
 * of a user who signed up four seconds ago. We do not do it, for one reason:
 * every consumer of this field (badge payloads, deposit policy, passport
 * eligibility, CRM risk columns) would need a null branch, and the first one
 * written would be an `|| 50` that silently reintroduces this constant in six
 * places. That is the exact failure this refactor exists to remove. A named
 * constant with a documented rationale is auditable; a null-handling convention
 * spread across six call sites is not.
 *
 * WHY 50 AND NOT 0 OR 100
 *
 * 0 is a claim, and it is a false one: "this person is maximally untrustworthy"
 * is not something we know about someone who has never booked. Publishing 0 for
 * a new account means a real person opens the app to a red badge they did not
 * earn, which is the same class of harm as the 750 we are removing.
 *
 * 100 is the same lie pointed the other way — it hands out full trust before
 * any trust has been observed, and it is what makes deposit-waiver logic
 * unsafe.
 *
 * 50 is the honest midpoint: neutral, unremarkable, and it moves in both
 * directions the moment real signal arrives. A new user's score is a
 * statement of ignorance, not a verdict.
 *
 * It is also the value `calculateClientScore` and the `null` fallbacks already
 * converged on independently, which is mild evidence it was the intended
 * answer all along.
 */
export const COLD_START_SCORE = 50;

/**
 * Tiers, on the 0–100 scale.
 *
 * Previously 850/700/500/300 against a field that also held 0–100 values, so a
 * legitimately good 0–100 user read as BRONZE. Boundaries are now evenly
 * spaced and the names mean what a customer expects them to mean.
 */
export const RELIABILITY_TIERS = {
  EXCELLENT: 80,
  AVERAGE: 50,
  RISKY: 0,
} as const;

export type ReliabilityTier = 'EXCELLENT' | 'AVERAGE' | 'RISKY';

/**
 * Referral graph effect, in POINTS on the 0–100 scale.
 *
 * Previously ±5/±10 read against a 0–1000 field, i.e. an invisible nudge — and
 * against a 0–100 field it would have been a 10% swing, which is a different
 * and much stronger claim. Scaled to sit either side of the tier boundary so
 * it can move a borderline account across it without dominating the score.
 */
export const REFERRAL_GRAPH_TRUST = {
  HIGH_REFERRER_BONUS: 5,
  HIGH_REFERRER_THRESHOLD: 80,
  LOW_REFERRER_PENALTY: 5,
  LOW_REFERRER_THRESHOLD: 30,
} as const;

// ─── Persistence guard ───────────────────────────────────────────────────────

/**
 * The single sanctioned way to bring any computed value into the canonical
 * range. Called by `trust-core.service.ts` on every write, and used by the
 * readers that must not assume the stored value is already sane (it might not
 * be — the column held 750 and 4.6 for years before this file existed).
 *
 * Non-finite input (NaN, Infinity) becomes the cold-start baseline rather than
 * propagating: a NaN in a trust score is not a small problem, it poisons every
 * comparison downstream, and the honest response to "we could not compute this"
 * is "we have no opinion", which is what 50 means.
 */
export function clampReliabilityScore(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return COLD_START_SCORE;
  }
  return Math.max(RELIABILITY_MIN, Math.min(RELIABILITY_MAX, value));
}

/**
 * Round-and-clamp, for the integer scores that get rendered to customers.
 *
 * `Math.round` on a clamped value keeps the value inside range — rounding
 * cannot push 99.6 to 100.1 — so this is safe to call in either order.
 */
export function normalizeReliabilityScore(value: number | null | undefined): number {
  return Math.round(clampReliabilityScore(value));
}

export function reliabilityTier(score: number | null | undefined): ReliabilityTier {
  const s = clampReliabilityScore(score);
  if (s >= RELIABILITY_TIERS.EXCELLENT) return 'EXCELLENT';
  if (s >= RELIABILITY_TIERS.AVERAGE) return 'AVERAGE';
  return 'RISKY';
}

// ─── The weighted ensemble ───────────────────────────────────────────────────
//
// ADDED IN COMMIT 2. Documented here from the start so the file reads as one
// thing rather than two generations of scoring bolted together.
//
//   reliabilityScore =
//       w1 · punctuality
//     + w2 · paymentBehaviour
//     + w3 · (1 − disputeRate)
//     − w4 · normalizedCancellations
//
// This is the BASELINE, and that is the load-bearing word. It is the thing a
// learned expert has to beat on a held-out set before it is allowed to touch a
// real customer's score. It is deliberately simple: every term is a signal the
// platform already emits, every weight is a number a person can read, and the
// whole computation can be reproduced by hand from an audit-log row.
//
// A model whose entire job is to tell a customer why their trust score changed
// is a liability in a product where you cannot explain it. So the baseline ships
// first, and any expert that cannot beat it in a way we can still explain does
// not ship at all.

export interface TrustSignals {
  /** Share of deliveries completed on time, 0–100. */
  punctuality: number;
  /** Share of invoices paid on time, 0–100. */
  paymentBehaviour: number;
  /** Disputes filed against this subject ÷ transactions, 0–1. */
  disputeRate: number;
  /** Cancellation events, normalised to 0–1 by `CANCELLATION_SATURATION`. */
  cancellations: number;
}

export interface TrustWeights {
  w1: number;
  w2: number;
  w3: number;
  w4: number;
}

/**
 * Default weights. Documented individually because these are the numbers a
 * customer, an auditor or a regulator will ask about.
 *
 *   w1 0.40  punctuality — the platform's core promise is "they show up".
 *               Weighted highest because it is the signal the product is named
 *               for and the one a customer most recognises as fair.
 *   w2 0.30  paymentBehaviour — money is the second promise. Slightly below
 *               punctuality: paying late is usually a systems failure (an
 *               invoice went to the wrong inbox) as often as a character one.
 *   w3 0.20  (1 − disputeRate) — disputes are weighted for SEVERITY not
 *               frequency. A single upheld fraud dispute should matter more
 *               than three dismissed ones, which a raw rate cannot express;
 *               the `disputeWeighting` note in trust-core handles that and it
 *               is a known limitation, stated rather than hidden.
 *   w4 0.10  cancellations — the weakest signal and the most context-dependent
 *               (a cancellation with a hospital in the reason field is not a
 *               reliability failure). Deliberately small.
 *
 * The positives sum to 0.90, not 1.00: the residual 0.10 is headroom for the
 * negative term, so a subject with perfect signals and no negative signal
 * scores 90 rather than 100. We do not award the top of the scale to somebody
 * we have merely never caught doing anything wrong. 100 stays reachable, but
 * only by a history that is flawless AND long enough to have been tested.
 */
export const DEFAULT_TRUST_WEIGHTS: TrustWeights = {
  w1: 0.40,
  w2: 0.30,
  w3: 0.20,
  w4: 0.10,
};

/**
 * Cancellations at which the cancellation term is fully applied.
 *
 * A raw count is not a signal: the fifth cancellation should not cost five
 * times what the first did. We saturate linearly to 1.0 at this count. Six
 * cancellations is high for a customer who is otherwise reliable and is where
 * "this person is unreliable" and "this person had a bad month" stop being
 * distinguishable.
 */
export const CANCELLATION_SATURATION = 6;

export const METHODOLOGY_VERSION = '2.0.0-ensemble';