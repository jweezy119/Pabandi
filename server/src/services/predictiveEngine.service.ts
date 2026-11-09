import { evaluateHitlPolicy, confidenceFromProbability, type HitlAction } from './hitlPolicy';
import { logger } from '../utils/logger';

/**
 * The predictive engine — §7.
 *
 * WHY THERE IS NO ML LIBRARY HERE
 * --------------------------------
 * The spec's §7.2 talks about running "the GBDT", but the repo has no ML
 * dependency (no xgboost, lightgbm, onnx or shap) and `predictive.routes.ts`
 * states the house convention outright: "pure Postgres aggregates, no external
 * ML dependency". This module keeps that convention. The base model is a
 * logistic regression fitted in this file, and because it is additive the
 * Shapley values are exact rather than approximated — see `explainFactors`.
 *
 * WHAT IS PURE AND WHAT TOUCHES THE DATABASE
 * ------------------------------------------
 * Everything down to `predictRiskPoint`, `simulateRiskRange`, `calibrateWeights`
 * and the prior math is pure: plain numbers in, plain numbers out. That is
 * deliberate — it is what makes the engine testable without a database, and
 * the database is not reachable from a laptop. Only the two functions at the
 * bottom read Prisma, and they contain no math.
 *
 * THE SCORE MEANS "CHANCE THIS JOB GOES WRONG"
 * -------------------------------------------
 * Higher is worse. §5's matrix only makes sense that way, and §4.1's
 * "71% · High risk" agrees.
 */

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface WorkOrderFeatures {
  /** Jobs already scheduled for the same day as this one. */
  schedule_density: number;
  /** Days between the job being created and its scheduled start. */
  lead_time_days: number;
  /** 0–1 complexity of the issue type. */
  issue_type_complexity: number;
  /** 0–1 how well the assigned technician's skills match the issue. */
  technician_skill_match: number;
  /** Years of trade experience. 0 means unknown. */
  technician_experience_years: number;
}

export const FEATURE_NAMES = [
  'schedule_density',
  'lead_time_days',
  'issue_type_complexity',
  'technician_skill_match',
  'technician_experience_years',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

export interface RiskFactor {
  factor: string;
  /** Signed contribution to the risk log-odds. Positive raises the risk. */
  impact: number;
  plain_language: string;
}

export interface RiskPrediction {
  riskScore: number;
  confidence: number;
  band: 'low' | 'medium' | 'high';
  policy: HitlAction;
  needsEvidenceBundle: boolean;
  factors: RiskFactor[];
  /**
   * The feature values this score was computed from, in their own units.
   * Supplied so the what-if strip can place its sliders; without them a slider
   * would have no defined starting point and the client would have to guess.
   */
  features: WorkOrderFeatures;
  /** Counterfactual range (§7.2). Absent on the point-only list endpoint. */
  p10?: number;
  p50?: number;
  p90?: number;
  outOfRange?: boolean;
  /** True when the weights have been calibrated from real history. */
  calibrated: boolean;
}

export interface TrainingSample {
  features: WorkOrderFeatures;
  /** 1 = the job went wrong (cancelled or finished late), 0 = finished on time. */
  label: number;
}

export interface ModelWeights {
  intercept: number;
  schedule_density: number;
  lead_time_days: number;
  issue_type_complexity: number;
  technician_skill_match: number;
  technician_experience_years: number;
  /** Training-set means, used to centre features so SHAP contributions are exact. */
  trainingMeans: WorkOrderFeatures;
  /** Training-set standard deviations, used for the out-of-range test. */
  trainingStd: WorkOrderFeatures;
  /** Standard errors of each weight, from the logistic fit's Hessian. */
  standardErrors: WorkOrderFeatures & { intercept: number };
  /**
   * Outcome counts for the top two levels of the prior hierarchy, aggregated
   * across businesses by the offline calibration.
   *
   * They are counts rather than fitted probabilities so the shrinkage formula
   * stays the same at every level, and so a vertical with no history falls
   * back to the global counts by looking up a missing key.
   */
  globalCounts: PriorCounts;
  verticalCounts: Record<string, PriorCounts>;
  trainedAt: string;
  sampleSize: number;
}

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

/* ── Feature extraction ─────────────────────────────────────────────────── */

export interface WorkOrderLike {
  id: string;
  issueType: string;
  priority: string;
  scheduledFor: Date | string | null;
  createdAt: Date | string;
  status: string;
  completedAt: Date | string | null;
  technician: {
    id: string;
    name: string;
    skills: string[];
    experienceYears?: number | null;
  } | null;
}

export interface FeatureContext {
  /** How many jobs are already scheduled for the same day as this one. */
  sameDayJobCount: number;
  /** Skills the issue type calls for. Defaults to a permissive set. */
  expectedSkills?: string[];
}

/**
 * Which skills each kind of job calls for. Kept here rather than in the
 * database because it is model vocabulary, not business data — changing it
 * changes what the model looks for, not what the business stores.
 */
const SKILL_EXPECTATIONS: Array<[keywords: string[], skills: string[]]> = [
  [['leak', 'water', 'drip'], ['leak_repair', 'commercial_roofing']],
  [['inspect', 'survey', 'assessment'], ['inspection', 'commercial_roofing']],
  [['hvac', 'ac', 'air condition', 'furnace', 'heating', 'ventilation'], ['hvac', 'preventive_maintenance']],
  [['gutter', 'downspout'], ['gutters', 'exterior_maintenance']],
  [['maintain', 'service', 'tune', 'filter'], ['preventive_maintenance', 'hvac']],
  [['repair', 'fix', 'patch', 'seal'], ['commercial_roofing', 'leak_repair']],
  [['replac', 'install', 'new roof'], ['commercial_roofing', 'sheet_metal']],
  [['clean', 'wash'], ['exterior_maintenance']],
];

const COMPLEXITY_BY_KEYWORD: Array<[keywords: string[], complexity: number]> = [
  [['emergency', 'active leak', 'pouring', 'collapse', 'fire'], 0.95],
  [['leak', 'water', 'puncture', 'tear', 'flashing'], 0.8],
  [['repair', 'replace', 'install', 're-roof'], 0.65],
  [['inspect', 'assessment', 'survey'], 0.35],
  [['maintain', 'service', 'tune', 'clean', 'gutter'], 0.25],
];

function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Deterministic complexity for an issue type, defaulting to "moderately involved". */
export function issueTypeComplexity(issueType: string): number {
  const lower = issueType.toLowerCase();
  for (const [keywords, complexity] of COMPLEXITY_BY_KEYWORD) {
    if (keywords.some((keyword) => lower.includes(keyword))) return complexity;
  }
  return 0.5;
}

function expectedSkillsFor(issueType: string): string[] {
  const lower = issueType.toLowerCase();
  for (const [keywords, skills] of SKILL_EXPECTATIONS) {
    if (keywords.some((keyword) => lower.includes(keyword))) return skills;
  }
  return ['commercial_roofing'];
}

/**
 * Fraction of the expected skills the technician actually holds. An
 * unassigned job scores 0 — nobody is a match for the work — which is the
 * honest answer rather than an invented middle value.
 */
export function skillMatch(skills: string[], expected: string[]): number {
  if (expected.length === 0) return 0;
  const held = new Set(skills.map((skill) => skill.toLowerCase()));
  const matched = expected.filter((skill) => {
    const needle = skill.toLowerCase();
    return [...held].some((have) => have.includes(needle) || needle.includes(have));
  });
  return matched.length / expected.length;
}

export function extractFeatures(workOrder: WorkOrderLike, context: FeatureContext): WorkOrderFeatures {
  const created = toDate(workOrder.createdAt);
  const scheduled = toDate(workOrder.scheduledFor);

  const leadTimeDays =
    created && scheduled
      ? Math.max(0, (scheduled.getTime() - created.getTime()) / 86_400_000)
      : 0;

  const expected = context.expectedSkills ?? expectedSkillsFor(workOrder.issueType);

  return {
    schedule_density: Math.max(0, context.sameDayJobCount),
    lead_time_days: leadTimeDays,
    issue_type_complexity: issueTypeComplexity(workOrder.issueType),
    technician_skill_match: workOrder.technician
      ? skillMatch(workOrder.technician.skills ?? [], expected)
      : 0,
    technician_experience_years: Math.max(0, workOrder.technician?.experienceYears ?? 0),
  };
}

/* ── Hierarchical priors ────────────────────────────────────────────────── */

/**
 * Shrink a child's Beta posterior toward its parent's.
 *
 * `w = n / (n + k)` is the empirical-Bayes weight: with no observations the
 * child is entirely the parent, and as n grows the child's own data takes over.
 * k is how many observations it takes for the child to be halfway trusted —
 * the spec's k_v = 50 and k_t = 20.
 *
 * Both α and β are shrunk, not just the mean, so the posterior's spread is
 * shrunk too. Shrinking only the mean would leave a technician with two
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

export interface PriorHierarchyInput {
  global: PriorCounts;
  vertical: PriorCounts;
  technician: PriorCounts;
}

/**
 * Global → vertical → technician. The global prior starts from a uniform
 * Beta(1,1), which is the least assumptive place to begin; the vertical and
 * technician levels are then shrunk toward their parent.
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

function zeroFeatures(): WorkOrderFeatures {
  return {
    schedule_density: 0,
    lead_time_days: 0,
    issue_type_complexity: 0,
    technician_skill_match: 0,
    technician_experience_years: 0,
  };
}

/**
 * Weights used before the offline calibration has run.
 *
 * These are NOT fitted. They are a documented starting point so the code path
 * is exercisable, and every response carries `calibrated: false` until
 * `scripts/calibrate-predictive-engine.ts` writes a real set. Treating them as
 * predictions would be treating a placeholder as data.
 */
export const DEFAULT_WEIGHTS: ModelWeights = {
  intercept: 0,
  schedule_density: 0.25,
  lead_time_days: 0.04,
  issue_type_complexity: 0.9,
  technician_skill_match: -1.1,
  technician_experience_years: -0.06,
  trainingMeans: zeroFeatures(),
  trainingStd: {
    schedule_density: 1,
    lead_time_days: 1,
    issue_type_complexity: 1,
    technician_skill_match: 1,
    technician_experience_years: 1,
  },
  standardErrors: {
    intercept: 0.5,
    schedule_density: 0.1,
    lead_time_days: 0.02,
    issue_type_complexity: 0.2,
    technician_skill_match: 0.2,
    technician_experience_years: 0.02,
  },
  trainedAt: 'uncalibrated',
  sampleSize: 0,
  // Zero counts shrink every level back to the uniform Beta(1,1), i.e. a coin
  // flip. That is the honest prior when there is no history to draw on.
  globalCounts: { onTime: 0, wentWrong: 0 },
  verticalCounts: {},
};

function centred(features: WorkOrderFeatures, means: WorkOrderFeatures): WorkOrderFeatures {
  return {
    schedule_density: features.schedule_density - means.schedule_density,
    lead_time_days: features.lead_time_days - means.lead_time_days,
    issue_type_complexity: features.issue_type_complexity - means.issue_type_complexity,
    technician_skill_match: features.technician_skill_match - means.technician_skill_match,
    technician_experience_years:
      features.technician_experience_years - means.technician_experience_years,
  };
}

/**
 * Reads the five feature coefficients. Takes `WorkOrderFeatures` rather than
 * `ModelWeights` so the same accessor works on the standard errors, which are
 * shaped identically.
 */
function weightsVector(weights: WorkOrderFeatures): number[] {
  return [
    weights.schedule_density,
    weights.lead_time_days,
    weights.issue_type_complexity,
    weights.technician_skill_match,
    weights.technician_experience_years,
  ];
}

function featuresVector(features: WorkOrderFeatures): number[] {
  return [
    features.schedule_density,
    features.lead_time_days,
    features.issue_type_complexity,
    features.technician_skill_match,
    features.technician_experience_years,
  ];
}

/**
 * The point prediction.
 *
 * `z = logit(baselineRisk) + Σ βi (xi − mean_i)`
 *
 * Centring the features is what makes the SHAP values exact rather than
 * approximated: each feature's contribution becomes βi(xi − mean_i), and those
 * contributions sum to the model's departure from the baseline. The baseline
 * itself comes from the hierarchical prior, so a technician with no history
 * inherits the vertical, and a vertical with no history inherits the global
 * rate.
 */
export function predictRiskPoint(params: {
  features: WorkOrderFeatures;
  weights: ModelWeights;
  baselineRisk: number;
}): RiskPrediction {
  const { features, weights, baselineRisk } = params;
  const centredFeatures = centred(features, weights.trainingMeans);
  const betas = weightsVector(weights);

  let z = logit(baselineRisk);
  for (let index = 0; index < betas.length; index++) {
    z += betas[index] * featuresVector(centredFeatures)[index];
  }

  const riskScore = logistic(z);
  const confidence = confidenceFromProbability(riskScore);
  const band = riskScore < 0.35 ? 'low' : riskScore > 0.7 ? 'high' : 'medium';
  const decision = evaluateHitlPolicy(riskScore, confidence);

  return {
    riskScore,
    confidence,
    band,
    policy: decision.action,
    needsEvidenceBundle: decision.needsEvidenceBundle,
    factors: explainFactors(centredFeatures, betas, weights, baselineRisk),
    features,
    calibrated: weights.sampleSize > 0,
  };
}

/* ── Explanation ────────────────────────────────────────────────────────── */

function formatCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * One plain-language sentence per factor, plus the technician's track record.
 *
 * §7.3 wants these generated by an LLM with a specific prompt, which
 * `enrichPlainLanguage` below does when a key is configured. These templates
 * are the deterministic fallback and the thing the LLM is asked to improve on,
 * so the product still explains itself offline.
 *
 * No template may use the words "feature", "coefficient", "attribution" or
 * "SHAP" — a business owner has no use for the model's vocabulary.
 */
export function explainFactors(
  centredFeatures: WorkOrderFeatures,
  betas: number[],
  weights: ModelWeights,
  baselineRisk: number,
  technicianName = 'the technician',
): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const values = featuresVector(centredFeatures);

  const templates: Record<FeatureName, (impact: number) => string> = {
    schedule_density: (impact) =>
      impact >= 0
        ? `Your crew already has ${formatCount(centredFeatures.schedule_density + weights.trainingMeans.schedule_density)} jobs booked for this day.`
        : `Only ${formatCount(centredFeatures.schedule_density + weights.trainingMeans.schedule_density)} jobs are booked for this day, so there is room to reach this one.`,
    lead_time_days: (impact) =>
      impact >= 0
        ? `This job was booked with ${formatCount(centredFeatures.lead_time_days + weights.trainingMeans.lead_time_days)} days of notice, which leaves less room to prepare.`
        : `This job was booked with ${formatCount(centredFeatures.lead_time_days + weights.trainingMeans.lead_time_days)} days of notice, so the crew has time to prepare.`,
    issue_type_complexity: (impact) =>
      impact >= 0
        ? 'This kind of job is more involved than routine work, which adds risk.'
        : 'This is routine work, which lowers the chance of a problem.',
    technician_skill_match: (impact) =>
      impact >= 0
        ? `${technicianName} is not a strong match for this kind of work.`
        : `${technicianName} has done this kind of work before.`,
    technician_experience_years: (impact) =>
      impact >= 0
        ? `${technicianName} is newer to this trade than most of your crew.`
        : `${technicianName} has ${formatCount(centredFeatures.technician_experience_years + weights.trainingMeans.technician_experience_years)} years of experience, which lowers the chance of a problem.`,
  };

  for (let index = 0; index < FEATURE_NAMES.length; index++) {
    const name = FEATURE_NAMES[index];
    const impact = betas[index] * values[index];
    if (Math.abs(impact) < 1e-6) continue;
    factors.push({ factor: name, impact, plain_language: templates[name](impact) });
  }

  // The track record is the part of the prediction that comes from the
  // hierarchical prior rather than from the features, so it gets its own line.
  const globalBaseline = 0.3;
  const trackRecord = logit(baselineRisk) - logit(globalBaseline);
  if (Math.abs(trackRecord) > 1e-6) {
    factors.push({
      factor: 'technician_track_record',
      impact: trackRecord,
      plain_language:
        trackRecord >= 0
          ? `${technicianName}'s past jobs have gone wrong more often than average.`
          : `${technicianName}'s past jobs have gone better than average.`,
    });
  }

  return factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

/**
 * Rewrites the deterministic templates with an LLM, one sentence each, cached
 * per (factor, direction) so a repeated factor set does not re-call the model.
 *
 * §7.3 fixes the prompt and the banned vocabulary. The model's output is
 * untrusted and goes through the same sanitiser every other LLM string in this
 * codebase passes through before it reaches a client.
 *
 * The template is sent as the thing to rewrite, not as a style guide, so the
 * LLM has a concrete sentence to improve and cannot drift into explaining the
 * model itself.
 */
const plainLanguageCache = new Map<string, string>();

/** Test seam: the cache is module-level on purpose, so tests need a way to reset it. */
export function clearPlainLanguageCache(): void {
  plainLanguageCache.clear();
}

export const PLAIN_LANGUAGE_PROMPT = [
  'You are explaining a dispatch prediction to a small-business owner who has never used dispatch software.',
  'Rewrite the factor below as ONE plain sentence that tells them what it means for this specific job.',
  'Do not use the words "feature", "coefficient", "attribution", "SHAP", "model", "logistic" or "probability".',
  'Maximum 25 words. Do not add a heading, a bullet or a number.',
  '',
  'Factor: {plainLanguage}',
  'Technician: {technicianName}',
  'Business: {businessName}',
].join('\n');

export async function enrichPlainLanguage(
  factors: RiskFactor[],
  context: { technicianName: string; businessName: string },
  generator: (prompt: string) => Promise<string>,
  sanitize: (value: string) => string,
): Promise<RiskFactor[]> {
  const enriched: RiskFactor[] = [];

  for (const factor of factors) {
    const direction = factor.impact >= 0 ? 'raises' : 'lowers';
    const cacheKey = `${factor.factor}:${direction}`;
    const cached = plainLanguageCache.get(cacheKey);
    if (cached) {
      enriched.push({ ...factor, plain_language: cached });
      continue;
    }

    try {
      const prompt = PLAIN_LANGUAGE_PROMPT.replace('{plainLanguage}', factor.plain_language)
        .replace('{technicianName}', context.technicianName)
        .replace('{businessName}', context.businessName);
      const raw = await generator(prompt);
      const cleaned = sanitize(raw).trim();
      if (cleaned.length > 0) {
        plainLanguageCache.set(cacheKey, cleaned);
        enriched.push({ ...factor, plain_language: cleaned });
        continue;
      }
    } catch (error) {
      logger.warn(`[PredictiveEngine] plain-language enrichment failed: ${String(error)}`);
    }

    // Any failure falls back to the deterministic template, never to nothing.
    enriched.push(factor);
  }

  return enriched;
}

/* ── Counterfactual range (§7.2) ────────────────────────────────────────── */

/** Deterministic PRNG so a given work order and perturbation always yields the same range. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalSample(random: () => number): number {
  // Box–Muller.
  const u1 = Math.max(1e-12, random());
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[index];
}

export interface RangeSimulation {
  p10: number;
  p50: number;
  p90: number;
  outOfRange: boolean;
  pointEstimate: number;
  /** Which features moved further than two standard deviations from the training mean. */
  outOfRangeFeatures: FeatureName[];
}

/**
 * Bootstrapped counterfactual range.
 *
 * §7.2 asks for 100 bootstrapped resamples of the perturbed feature vector
 * plus 100 near-neighbour training samples. With an additive model the two
 * sources of uncertainty are separate and both are cheap:
 *
 *  - model uncertainty: draw 100 weight vectors from N(β̂, SE²) and recompute;
 *  - neighbourhood uncertainty: take the 100 closest historical jobs and
 *    bootstrap their outcomes, which is the empirical spread of what actually
 *    happened to jobs like this one.
 *
 * The two distributions are pooled and the 10th/50th/90th percentiles taken
 * from the pool. A point estimate is never reported on its own.
 */
export function simulateRiskRange(params: {
  features: WorkOrderFeatures;
  perturbation: Partial<WorkOrderFeatures>;
  weights: ModelWeights;
  trainingSamples: TrainingSample[];
  baselineRisk: number;
  seed: string;
  draws?: number;
}): RangeSimulation {
  const { weights, trainingSamples, baselineRisk, seed } = params;
  const draws = params.draws ?? 100;
  const random = mulberry32(seedFromString(seed));

  const perturbed: WorkOrderFeatures = {
    schedule_density: Math.max(0, params.features.schedule_density + (params.perturbation.schedule_density ?? 0)),
    lead_time_days: Math.max(0, params.features.lead_time_days + (params.perturbation.lead_time_days ?? 0)),
    issue_type_complexity: Math.min(1, Math.max(0, params.features.issue_type_complexity + (params.perturbation.issue_type_complexity ?? 0))),
    technician_skill_match: Math.min(1, Math.max(0, params.features.technician_skill_match + (params.perturbation.technician_skill_match ?? 0))),
    technician_experience_years: Math.max(0, params.features.technician_experience_years + (params.perturbation.technician_experience_years ?? 0)),
  };

  // §7.2: flag any feature pushed more than two standard deviations from the
  // training mean, and grey the result in the UI.
  const outOfRangeFeatures: FeatureName[] = [];
  const perturbedValues = featuresVector(perturbed);
  const means = featuresVector(weights.trainingMeans);
  const stds = featuresVector(weights.trainingStd);
  for (let index = 0; index < FEATURE_NAMES.length; index++) {
    const std = stds[index] > 1e-9 ? stds[index] : 1;
    if (Math.abs(perturbedValues[index] - means[index]) > 2 * std) {
      outOfRangeFeatures.push(FEATURE_NAMES[index]);
    }
  }

  const betas = weightsVector(weights);
  const standardErrors = weightsVector(weights.standardErrors);
  const modelDraws: number[] = [];

  for (let draw = 0; draw < draws; draw++) {
    let z = logit(baselineRisk);
    for (let index = 0; index < betas.length; index++) {
      const sampled = betas[index] + standardErrors[index] * normalSample(random);
      z += sampled * perturbedValues[index];
    }
    modelDraws.push(logistic(z));
  }

  // Nearest historical jobs, then bootstrap their outcomes.
  const neighbours = nearestSamples(perturbed, trainingSamples, draws);
  const neighbourhoodDraws: number[] = [];
  for (let draw = 0; draw < draws; draw++) {
    let sum = 0;
    for (let pick = 0; pick < 10; pick++) {
      sum += neighbours[Math.floor(random() * neighbours.length)]?.label ?? 0;
    }
    neighbourhoodDraws.push(sum / 10);
  }

  const pooled = [...modelDraws, ...neighbourhoodDraws].sort((a, b) => a - b);

  return {
    p10: percentile(pooled, 0.1),
    p50: percentile(pooled, 0.5),
    p90: percentile(pooled, 0.9),
    outOfRange: outOfRangeFeatures.length > 0,
    outOfRangeFeatures,
    pointEstimate: logistic(
      logit(baselineRisk) + betas.reduce((sum, beta, index) => sum + beta * perturbedValues[index], 0),
    ),
  };
}

/** Standardised Euclidean distance, so a day of lead time and a skill point are comparable. */
function distance(a: WorkOrderFeatures, b: WorkOrderFeatures, std: WorkOrderFeatures): number {
  const av = featuresVector(a);
  const bv = featuresVector(b);
  const sv = featuresVector(std);
  let sum = 0;
  for (let index = 0; index < av.length; index++) {
    const scale = sv[index] > 1e-9 ? sv[index] : 1;
    sum += ((av[index] - bv[index]) / scale) ** 2;
  }
  return Math.sqrt(sum);
}

export function nearestSamples(
  features: WorkOrderFeatures,
  samples: TrainingSample[],
  count: number,
  std?: WorkOrderFeatures,
): TrainingSample[] {
  if (samples.length === 0) return [];
  const scale = std ?? {
    schedule_density: 1,
    lead_time_days: 1,
    issue_type_complexity: 1,
    technician_skill_match: 1,
    technician_experience_years: 1,
  };
  return [...samples]
    .sort((a, b) => distance(features, a.features, scale) - distance(features, b.features, scale))
    .slice(0, count);
}

/* ── Calibration ────────────────────────────────────────────────────────── */

function meanAndStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 1 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length - 1);
  const std = Math.sqrt(variance);
  return { mean, std: std > 1e-9 ? std : 1 };
}

/** Gauss–Jordan inverse with partial pivoting. The Hessian is 6×6 and fixed. */
function invertMatrix(matrix: number[][]): number[][] {
  const size = matrix.length;
  const augmented = matrix.map((row, rowIndex) => [
    ...row,
    ...Array.from({ length: size }, (_, columnIndex) => (columnIndex === rowIndex ? 1 : 0)),
  ]);

  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-12) continue;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];

    const divisor = augmented[column][column];
    for (let index = 0; index < size * 2; index++) augmented[column][index] /= divisor;

    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let index = 0; index < size * 2; index++) {
        augmented[row][index] -= factor * augmented[column][index];
      }
    }
  }

  return augmented.map((row) => row.slice(size));
}

/**
 * Fit the logistic weights from historical outcomes by IRLS.
 *
 * Runs offline (the calibration script), never in a request. Features are
 * standardised for the fit so a day of lead time and a skill point contribute
 * on comparable scales, then converted back to raw units so the SHAP formula
 * in §2.1 holds exactly.
 *
 * IRLS rather than gradient descent: each iteration solves the weighted least
 * squares problem the logistic model implies, so it converges in a handful of
 * steps to machine precision instead of needing thousands of slow steps. That
 * matters because the calibration script re-fits on every run and the
 * standard errors come from the same Hessian the solver uses.
 *
 * Standard errors are the square roots of the diagonal of (XᵀWX)⁻¹, the usual
 * large-sample covariance estimate for a logistic fit. A small ridge is added
 * to the diagonal so a pair of near-collinear features cannot make the
 * Hessian singular.
 */
export function calibrateWeights(
  samples: TrainingSample[],
  options: {
    iterations?: number;
    ridge?: number;
    /**
     * Outcome counts per hierarchy level. The script supplies these because it
     * is the only place that sees which business and vertical each row came
     * from; the samples carry features and labels alone.
     */
    counts?: { global: PriorCounts; vertical: Record<string, PriorCounts> };
  } = {},
): ModelWeights {
  const iterations = options.iterations ?? 25;
  const ridge = options.ridge ?? 1e-6;

  const raw = FEATURE_NAMES.map((name) => samples.map((sample) => sample.features[name]));
  const stats = raw.map((values) => meanAndStd(values));

  const trainingMeans = zeroFeatures();
  const trainingStd = zeroFeatures();
  FEATURE_NAMES.forEach((name, index) => {
    trainingMeans[name] = stats[index].mean;
    trainingStd[name] = stats[index].std;
  });

  // Standardise: x' = (x - mean) / std
  const standardised = samples.map((sample) => ({
    x: FEATURE_NAMES.map((name, index) => (sample.features[name] - stats[index].mean) / stats[index].std),
    y: sample.label,
  }));

  const size = 6;
  let coefficients = [0, 0, 0, 0, 0, 0]; // intercept first
  let inverse: number[][] = Array.from({ length: size }, () => Array(size).fill(0));

  for (let iteration = 0; iteration < iterations; iteration++) {
    const hessian: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
    const score: number[] = Array(size).fill(0);

    for (const sample of standardised) {
      let z = coefficients[0];
      for (let index = 0; index < 5; index++) z += coefficients[index + 1] * sample.x[index];
      const probability = logistic(z);
      const weight = Math.max(1e-6, probability * (1 - probability));
      const row = [1, ...sample.x];

      for (let i = 0; i < size; i++) {
        score[i] += row[i] * (sample.y - probability);
        for (let j = 0; j < size; j++) hessian[i][j] += weight * row[i] * row[j];
      }
    }

    for (let i = 0; i < size; i++) hessian[i][i] += ridge;

    inverse = invertMatrix(hessian);
    const step = multiplyMatrixVector(inverse, score);
    for (let i = 0; i < size; i++) coefficients[i] += step[i];

    const largest = Math.max(...step.map((value) => Math.abs(value)));
    if (largest < 1e-10) break;
  }

  const standardError = (index: number) =>
    inverse[index]?.[index] > 0 ? Math.sqrt(inverse[index][index]) : 0;

  // Raw-unit coefficients: β_j = γ_j / std_j
  const rawCoefficients = coefficients.slice(1).map((gamma, index) => gamma / stats[index].std);
  const rawStandardErrors = coefficients.slice(1).map((_, index) => standardError(index + 1) / stats[index].std);

  return {
    // The intercept is replaced per prediction by the technician's shrunk
    // baseline, so what matters is the *centred* intercept, which is carried
    // in trainingMeans.
    intercept: coefficients[0],
    schedule_density: rawCoefficients[0],
    lead_time_days: rawCoefficients[1],
    issue_type_complexity: rawCoefficients[2],
    technician_skill_match: rawCoefficients[3],
    technician_experience_years: rawCoefficients[4],
    trainingMeans,
    trainingStd,
    standardErrors: {
      intercept: standardError(0),
      schedule_density: rawStandardErrors[0],
      lead_time_days: rawStandardErrors[1],
      issue_type_complexity: rawStandardErrors[2],
      technician_skill_match: rawStandardErrors[3],
      technician_experience_years: rawStandardErrors[4],
    },
    trainedAt: new Date().toISOString(),
    sampleSize: samples.length,
    globalCounts:
      options.counts?.global ??
      samples.reduce<PriorCounts>(
        (counts, sample) => ({
          onTime: counts.onTime + (sample.label === 0 ? 1 : 0),
          wentWrong: counts.wentWrong + (sample.label === 1 ? 1 : 0),
        }),
        { onTime: 0, wentWrong: 0 },
      ),
    verticalCounts: options.counts?.vertical ?? {},
  };
}

function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

/* ── Calibration input from history ─────────────────────────────────────── */

/**
 * Turns work-order history into the two things calibration needs: the
 * training samples for the logistic fit, and the outcome counts per level for
 * the hierarchical prior.
 *
 * The label is the on-time completion proxy the product chose: finished inside
 * the scheduled window is a success; cancelled, or finished late, is a failure.
 * Jobs still open are excluded — they have no outcome yet, and calling an
 * unfinished job a failure would poison the prior.
 */
export interface HistoricalWorkOrder {
  id: string;
  businessId: string;
  vertical: string | null;
  issueType: string;
  priority: string;
  status: string;
  scheduledFor: Date | string | null;
  createdAt: Date | string;
  completedAt: Date | string | null;
  technicianId: string | null;
  technicianExperienceYears: number | null;
  technicianSkills: string[];
  sameDayJobCount: number;
}

export interface CalibrationResult {
  samples: TrainingSample[];
  global: PriorCounts;
  vertical: Record<string, PriorCounts>;
  technician: Record<string, PriorCounts>;
  excluded: number;
}

/** How late a job may finish past its scheduled start and still count as on time. */
export const ON_TIME_GRACE_HOURS = Number(process.env.PREDICTIVE_ON_TIME_GRACE_HOURS ?? 2);

export function isOnTime(workOrder: HistoricalWorkOrder): boolean | null {
  if (workOrder.status === 'CANCELLED') return false;
  if (!['COMPLETED'].includes(workOrder.status)) return null;

  const scheduled = workOrder.scheduledFor
    ? workOrder.scheduledFor instanceof Date
      ? workOrder.scheduledFor
      : new Date(workOrder.scheduledFor)
    : null;
  const completed = workOrder.completedAt
    ? workOrder.completedAt instanceof Date
      ? workOrder.completedAt
      : new Date(workOrder.completedAt)
    : null;

  if (!scheduled || !completed) return null;

  const graceMs = ON_TIME_GRACE_HOURS * 3_600_000;
  return completed.getTime() <= scheduled.getTime() + graceMs;
}

export function buildCalibrationInput(
  workOrders: HistoricalWorkOrder[],
): CalibrationResult {
  const samples: TrainingSample[] = [];
  const global: PriorCounts = { onTime: 0, wentWrong: 0 };
  const vertical: Record<string, PriorCounts> = {};
  const technician: Record<string, PriorCounts> = {};
  let excluded = 0;

  for (const workOrder of workOrders) {
    const onTime = isOnTime(workOrder);
    if (onTime === null) {
      excluded += 1;
      continue;
    }

    const features = extractFeatures(
      {
        id: workOrder.id,
        issueType: workOrder.issueType,
        priority: workOrder.priority,
        scheduledFor: workOrder.scheduledFor,
        createdAt: workOrder.createdAt,
        status: workOrder.status,
        completedAt: workOrder.completedAt,
        technician: workOrder.technicianId
          ? {
              id: workOrder.technicianId,
              name: workOrder.technicianId,
              skills: workOrder.technicianSkills,
              experienceYears: workOrder.technicianExperienceYears,
            }
          : null,
      },
      { sameDayJobCount: workOrder.sameDayJobCount },
    );

    const label = onTime ? 0 : 1;
    samples.push({ features, label });

    const verticalKey = (workOrder.vertical ?? 'general').toLowerCase();
    vertical[verticalKey] ??= { onTime: 0, wentWrong: 0 };
    technician[workOrder.technicianId ?? 'unassigned'] ??= { onTime: 0, wentWrong: 0 };

    if (onTime) {
      global.onTime += 1;
      vertical[verticalKey].onTime += 1;
      technician[workOrder.technicianId ?? 'unassigned'].onTime += 1;
    } else {
      global.wentWrong += 1;
      vertical[verticalKey].wentWrong += 1;
      technician[workOrder.technicianId ?? 'unassigned'].wentWrong += 1;
    }
  }

  return { samples, global, vertical, technician, excluded };
}

/* ── Database-facing service ────────────────────────────────────────────── */

import { prisma } from '../lib/prisma';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const MODEL_PATH = process.env.PREDICTIVE_MODEL_PATH ?? path.join(process.cwd(), 'config', 'predictive-engine.json');

/** Training samples are cached so the list endpoint does not recompute them per request. */
let cachedTrainingSamples: TrainingSample[] | null = null;

export function setTrainingSamples(samples: TrainingSample[]): void {
  cachedTrainingSamples = samples;
}

export function getTrainingSamples(): TrainingSample[] {
  return cachedTrainingSamples ?? [];
}

/**
 * Loads calibrated weights from disk. Falls back to the documented defaults
 * when the calibration has not run, and says so via `calibrated: false` on
 * every prediction.
 */
export function loadModelWeights(): ModelWeights {
  try {
    if (!existsSync(MODEL_PATH)) return DEFAULT_WEIGHTS;
    const parsed = JSON.parse(readFileSync(MODEL_PATH, 'utf8')) as ModelWeights;
    if (!parsed?.trainingMeans || parsed.sampleSize <= 0) return DEFAULT_WEIGHTS;
    return parsed;
  } catch (error) {
    logger.warn(`[PredictiveEngine] could not load model weights: ${String(error)}`);
    return DEFAULT_WEIGHTS;
  }
}

/**
 * Live, tenant-scoped inputs for the prior hierarchy.
 *
 * The global and vertical levels come from the offline calibration, not from
 * these queries. §1 requires every request-path query to be scoped by
 * businessId, and a per-business "global" would be a tautology — it would make
 * the top two levels of the hierarchy the same number. The calibration script
 * is an admin job rather than a client request, so it is the right place to
 * aggregate across businesses, and it stores only outcome counts.
 */
async function loadLivePriorInputs(businessId: string): Promise<{
  technician: Record<string, PriorCounts>;
  sameDayCounts: Map<string, number>;
}> {
  const [technicianRows, sameDayRows] = await Promise.all([
    prisma.$queryRaw<Array<{ technicianId: string; status: string; count: number }>>`
      SELECT t."technicianId" AS "technicianId", wo."status" AS status, COUNT(*)::int AS count
      FROM "WorkOrder" wo
      JOIN "WorkOrderAssignment" t ON t."workOrderId" = wo."id"
      WHERE wo."businessId" = ${businessId}
        AND wo."status" IN ('COMPLETED', 'CANCELLED')
      GROUP BY 1, 2`,
    prisma.$queryRaw<Array<{ day: string; count: number }>>`
      SELECT to_char(date_trunc('day', COALESCE("scheduledFor", "createdAt")), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count
      FROM "WorkOrder"
      WHERE "businessId" = ${businessId}
      GROUP BY 1`,
  ]);

  const technician: Record<string, PriorCounts> = {};
  for (const row of technicianRows) {
    technician[row.technicianId] ??= { onTime: 0, wentWrong: 0 };
    if (row.status === 'CANCELLED') technician[row.technicianId].wentWrong += Number(row.count);
    else technician[row.technicianId].onTime += Number(row.count);
  }

  const sameDayCounts = new Map<string, number>();
  for (const row of sameDayRows) sameDayCounts.set(row.day, Number(row.count));

  return { technician, sameDayCounts };
}

function dayKey(value: Date | string | null): string {
  const date = value ? (value instanceof Date ? value : new Date(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function technicianPriorFor(
  technicianId: string | null,
  live: Record<string, PriorCounts>,
): PriorCounts {
  if (!technicianId) return { onTime: 0, wentWrong: 0 };
  return live[technicianId] ?? { onTime: 0, wentWrong: 0 };
}

/** Resolve the baseline risk for one work order from the three-level prior. */
function baselineRiskFor(params: {
  workOrder: WorkOrderLike;
  weights: ModelWeights;
  liveTechnician: Record<string, PriorCounts>;
  vertical: string | null;
}): number {
  const { weights, liveTechnician, vertical } = params;
  const technicianId = params.workOrder.technician?.id ?? null;

  const globalCounts = weights.globalCounts;
  const verticalCounts =
    (vertical && weights.verticalCounts[vertical.toLowerCase()]) || globalCounts;

  return buildPriorHierarchy({
    global: globalCounts,
    vertical: verticalCounts,
    technician: technicianPriorFor(technicianId, liveTechnician),
  }).technician.posteriorRisk;
}

/**
 * Point predictions for a set of work orders.
 *
 * The list endpoint returns up to 100 rows. Loading each one's same-day load
 * and technician history separately would be two queries per row, so the live
 * inputs are loaded once for the whole page.
 */
export async function predictRiskForWorkOrders(
  workOrders: WorkOrderLike[],
  businessId: string,
  vertical: string | null,
): Promise<Map<string, RiskPrediction>> {
  const { technician, sameDayCounts } = await loadLivePriorInputs(businessId);
  const weights = loadModelWeights();
  const results = new Map<string, RiskPrediction>();

  for (const workOrder of workOrders) {
    const features = extractFeatures(workOrder, {
      sameDayJobCount:
        sameDayCounts.get(dayKey(workOrder.scheduledFor ?? workOrder.createdAt)) ?? 0,
    });

    results.set(
      workOrder.id,
      predictRiskPoint({
        features,
        weights,
        baselineRisk: baselineRiskFor({
          workOrder,
          weights,
          liveTechnician: technician,
          vertical,
        }),
      }),
    );
  }

  return results;
}

/** Maps the work orders the list endpoint already fetched into the shape the engine takes. */
export function toWorkOrderLike(workOrder: any, technician: any): WorkOrderLike {
  return {
    id: workOrder.id,
    issueType: workOrder.issueType,
    priority: workOrder.priority,
    scheduledFor: workOrder.scheduledFor,
    createdAt: workOrder.createdAt,
    status: workOrder.status,
    completedAt: workOrder.completedAt,
    technician: technician
      ? {
          id: technician.id,
          name: technician.name,
          skills: technician.skills ?? [],
          experienceYears: technician.experienceYears ?? 0,
        }
      : null,
  };
}

/**
 * Point prediction for one work order. Cheap enough to call from the inspector;
 * the bootstrapped range is only computed on demand.
 */
export async function predictWorkOrderRisk(
  workOrderId: string,
  businessId: string,
): Promise<RiskPrediction | null> {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, businessId },
    include: {
      assignments: { include: { technician: true }, orderBy: { assignedAt: 'desc' } },
      business: { include: { settings: true } },
    },
  });
  if (!workOrder) return null;

  const technician = workOrder.assignments[0]?.technician ?? null;
  const results = await predictRiskForWorkOrders(
    [toWorkOrderLike(workOrder, technician)],
    businessId,
    workOrder.business?.settings?.vertical ?? null,
  );

  return results.get(workOrderId) ?? null;
}

/**
 * Counterfactual prediction for the what-if strip. The perturbation is a
 * per-feature delta in the same units as the feature, so "move the start time
 * three hours later" is `{ lead_time_days: +0.125 }`.
 */
export async function simulateWorkOrderRisk(
  workOrderId: string,
  businessId: string,
  perturbation: Partial<WorkOrderFeatures>,
): Promise<(RiskPrediction & { outOfRangeFeatures: FeatureName[] }) | null> {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, businessId },
    include: {
      assignments: { include: { technician: true }, orderBy: { assignedAt: 'desc' } },
      business: { include: { settings: true } },
    },
  });
  if (!workOrder) return null;

  const technician = workOrder.assignments[0]?.technician ?? null;
  const vertical = workOrder.business?.settings?.vertical ?? null;
  const workOrderLike = toWorkOrderLike(workOrder, technician);

  const { technician: liveTechnician, sameDayCounts } = await loadLivePriorInputs(businessId);

  const features = extractFeatures(workOrderLike, {
    sameDayJobCount:
      sameDayCounts.get(dayKey(workOrder.scheduledFor ?? workOrder.createdAt)) ?? 0,
  });

  const weights = loadModelWeights();
  const baselineRisk = baselineRiskFor({
    workOrder: workOrderLike,
    weights,
    liveTechnician,
    vertical,
  });
  const range = simulateRiskRange({
    features,
    perturbation,
    weights,
    trainingSamples: getTrainingSamples(),
    baselineRisk,
    seed: `${workOrderId}:${JSON.stringify(perturbation)}`,
  });

  const point = predictRiskPoint({
    features: {
      schedule_density: features.schedule_density + (perturbation.schedule_density ?? 0),
      lead_time_days: features.lead_time_days + (perturbation.lead_time_days ?? 0),
      issue_type_complexity: features.issue_type_complexity + (perturbation.issue_type_complexity ?? 0),
      technician_skill_match: features.technician_skill_match + (perturbation.technician_skill_match ?? 0),
      technician_experience_years:
        features.technician_experience_years + (perturbation.technician_experience_years ?? 0),
    },
    weights,
    baselineRisk,
  });

  return {
    ...point,
    p10: range.p10,
    p50: range.p50,
    p90: range.p90,
    outOfRange: range.outOfRange,
    outOfRangeFeatures: range.outOfRangeFeatures,
  };
}
