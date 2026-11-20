import { confidenceFromProbability, evaluateHitlPolicy, type HitlAction } from './hitlPolicy';

/**
 * Shared additive-risk math.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two domains need the same thing: the Service Coordinator forecasts whether a
 * work order goes wrong, and booking risk forecasts whether a client no-shows.
 * Both are additive logistic models over their own features, and both need the
 * same prior shrinkage and the same exact-contribution arithmetic.
 *
 * The arithmetic used to live in `predictiveEngine.service.ts` and booking risk
 * reached into it — importing the coordinator's `WorkOrderFeatures` and its
 * calibrated weights to price a booking. Two of those features
 * (`technician_skill_match`, `technician_experience_years`) do not exist for a
 * booking at all, so a booking was being scored on a model fitted to a
 * different question.
 *
 * The math is domain-free; the FEATURES and the WEIGHTS are not. So the math
 * lives here and each domain brings its own.
 */

/* ── Hierarchical priors ────────────────────────────────────────────────── */

export interface PriorCounts {
  onTime: number;
  wentWrong: number;
}

export interface ShrunkPrior {
  alpha: number;
  beta: number;
  /** Posterior mean of finishing on time, after shrinkage. */
  posteriorOnTime: number;
  posteriorRisk: number;
  sampleSize: number;
  /** w — how much the child's own data was trusted over the parent. */
  weight: number;
}

export interface PriorConfig {
  kVertical: number;
  kTechnician: number;
}

export const DEFAULT_PRIOR_CONFIG: PriorConfig = {
  kVertical: Number(process.env.HITL_K_VERTICAL ?? 50),
  kTechnician: Number(process.env.HITL_K_TECHNICIAN ?? 20),
};

export interface PriorHierarchyInput {
  global: PriorCounts;
  vertical: PriorCounts;
  technician: PriorCounts;
}

/**
 * Shrink a child's Beta posterior toward its parent's.
 *
 * `w = n / (n + k)` is the empirical-Bayes weight: with no observations the
 * child is entirely the parent, and as n grows the child's own data takes over.
 * k is how many observations it takes for the child to be halfway trusted.
 *
 * Both α and β are shrunk, not just the mean, so the posterior's spread is
 * shrunk too. Shrinking only the mean would leave a child with two
 * observations looking as certain as one with two hundred.
 */
export function shrinkPrior(
  child: PriorCounts,
  parent: { alpha: number; beta: number },
  k: number,
): ShrunkPrior {
  const n = child.onTime + child.wentWrong;
  const childAlpha = 1 + child.onTime;
  const childBeta = 1 + child.wentWrong;
  const weight = n / (n + k);

  const alpha = weight * childAlpha + (1 - weight) * parent.alpha;
  const beta = weight * childBeta + (1 - weight) * parent.beta;
  const posteriorOnTime = alpha / (alpha + beta);

  return {
    alpha,
    beta,
    posteriorOnTime,
    posteriorRisk: 1 - posteriorOnTime,
    sampleSize: n,
    weight,
  };
}

/**
 * Global → vertical → entity. The global prior starts from a uniform Beta(1,1),
 * the least assumptive place to begin; the lower levels shrink toward their
 * parent.
 */
export function buildPriorHierarchy(
  input: PriorHierarchyInput,
  config: PriorConfig = DEFAULT_PRIOR_CONFIG,
): { global: ShrunkPrior; vertical: ShrunkPrior; technician: ShrunkPrior } {
  const globalPrior = shrinkPrior(input.global, { alpha: 1, beta: 1 }, 1);
  const verticalPrior = shrinkPrior(input.vertical, globalPrior, config.kVertical);
  const technicianPrior = shrinkPrior(input.technician, verticalPrior, config.kTechnician);

  return { global: globalPrior, vertical: verticalPrior, technician: technicianPrior };
}

/* ── The model ──────────────────────────────────────────────────────────── */

export function logistic(z: number): number {
  // Clamped so a large |z| cannot overflow exp and produce NaN.
  if (z > 40) return 1;
  if (z < -40) return 0;
  return 1 / (1 + Math.exp(-z));
}

export function logit(p: number): number {
  const clamped = Math.min(1 - 1e-9, Math.max(1e-9, p));
  return Math.log(clamped / (1 - clamped));
}

export interface AdditiveRiskVerdict {
  riskScore: number;
  /** Distance from the decision boundary. */
  confidence: number;
  band: 'low' | 'medium' | 'high';
  policy: HitlAction;
  needsEvidenceBundle: boolean;
}

/**
 * Banding and the HITL decision, shared by every additive model so the two
 * domains cannot drift apart on what a score *means*.
 */
export function verdictForRisk(riskScore: number): AdditiveRiskVerdict {
  const confidence = confidenceFromProbability(riskScore);
  const band = riskScore < 0.35 ? 'low' : riskScore > 0.7 ? 'high' : 'medium';
  const decision = evaluateHitlPolicy(riskScore, confidence);

  return {
    riskScore,
    confidence,
    band,
    policy: decision.action,
    needsEvidenceBundle: decision.needsEvidenceBundle,
  };
}

export interface AdditiveContribution {
  name: string;
  /** Signed contribution to the risk log-odds: positive raises the risk. */
  impact: number;
}

export interface AdditivePrediction extends AdditiveRiskVerdict {
  z: number;
  contributions: AdditiveContribution[];
}

/**
 * The point prediction for any additive logistic model.
 *
 * `z = logit(baselineRisk) + Σ βi (xi − mean_i)`
 *
 * Centring the features is what makes each contribution exactly
 * `βi(xi − mean_i)`, and those contributions sum to the model's departure from
 * the baseline — which makes the explanation auditable rather than approximate.
 * No attribution library is involved, because for an additive model this *is*
 * the exact answer.
 *
 * Inputs are parallel arrays rather than a record so the caller owns the
 * feature names and ordering; nothing here needs to know what a "feature" is.
 */
export function predictAdditiveRisk(params: {
  names: readonly string[];
  values: readonly number[];
  coefficients: readonly number[];
  trainingMeans: readonly number[];
  baselineRisk: number;
}): AdditivePrediction {
  const { names, values, coefficients, trainingMeans, baselineRisk } = params;

  let z = logit(baselineRisk);
  const contributions: AdditiveContribution[] = [];

  for (let index = 0; index < names.length; index++) {
    const coefficient = Number(coefficients[index]) || 0;
    const centred = (Number(values[index]) || 0) - (Number(trainingMeans[index]) || 0);
    const impact = coefficient * centred;
    z += impact;
    if (Math.abs(impact) > 1e-12) contributions.push({ name: names[index], impact });
  }

  return { ...verdictForRisk(logistic(z)), z, contributions };
}
