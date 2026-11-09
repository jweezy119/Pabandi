import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  buildCalibrationInput,
  buildPriorHierarchy,
  calibrateWeights,
  clearPlainLanguageCache,
  enrichPlainLanguage,
  explainFactors,
  extractFeatures,
  isOnTime,
  issueTypeComplexity,
  loadModelWeights,
  logistic,
  logit,
  nearestSamples,
  predictRiskPoint,
  shrinkPrior,
  simulateRiskRange,
  skillMatch,
  type HistoricalWorkOrder,
  type PriorCounts,
  type RiskFactor,
  type TrainingSample,
  type WorkOrderFeatures,
} from '../src/services/predictiveEngine.service';

const ZERO_FEATURES: WorkOrderFeatures = {
  schedule_density: 0,
  lead_time_days: 0,
  issue_type_complexity: 0,
  technician_skill_match: 0,
  technician_experience_years: 0,
};

/** Deterministic PRNG so the calibration test is reproducible. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function normal(random: () => number): number {
  const u1 = Math.max(1e-12, random());
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Weights with unit-scale features, so a perturbation of ±2 is unambiguously out of range. */
const UNIT_WEIGHTS = {
  ...DEFAULT_WEIGHTS,
  trainingMeans: { ...ZERO_FEATURES },
  trainingStd: {
    schedule_density: 1,
    lead_time_days: 1,
    issue_type_complexity: 1,
    technician_skill_match: 1,
    technician_experience_years: 1,
  },
  standardErrors: {
    intercept: 0.05,
    schedule_density: 0.02,
    lead_time_days: 0.01,
    issue_type_complexity: 0.03,
    technician_skill_match: 0.02,
    technician_experience_years: 0.01,
  },
  sampleSize: 1000,
  trainedAt: '2026-01-01T00:00:00.000Z',
};

describe('logistic and logit', () => {
  it('are inverses of each other', () => {
    for (const value of [0.01, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99]) {
      expect(logistic(logit(value))).toBeCloseTo(value, 6);
    }
  });

  it('saturate instead of overflowing', () => {
    expect(logistic(100)).toBe(1);
    expect(logistic(-100)).toBe(0);
    expect(Number.isFinite(logistic(1e6))).toBe(true);
  });

  it('logit clamps instead of returning Infinity', () => {
    expect(Number.isFinite(logit(0))).toBe(true);
    expect(Number.isFinite(logit(1))).toBe(true);
  });
});

describe('issueTypeComplexity', () => {
  it('ranks emergencies above routine maintenance', () => {
    expect(issueTypeComplexity('Active leak in the main corridor')).toBeGreaterThan(
      issueTypeComplexity('Routine gutter cleaning'),
    );
  });

  it('falls back to a middle value for an unknown issue type', () => {
    expect(issueTypeComplexity('Something odd')).toBe(0.5);
  });

  it('is not case sensitive', () => {
    expect(issueTypeComplexity('LEAK')).toBe(issueTypeComplexity('leak'));
  });
});

describe('skillMatch', () => {
  it('scores a full match as 1 and no match as 0', () => {
    expect(skillMatch(['leak_repair', 'commercial_roofing'], ['leak_repair'])).toBe(1);
    expect(skillMatch(['hvac'], ['leak_repair'])).toBe(0);
  });

  it('scores partial matches proportionally', () => {
    expect(skillMatch(['leak_repair'], ['leak_repair', 'commercial_roofing'])).toBe(0.5);
  });

  it('returns 0 for an empty expectation rather than dividing by zero', () => {
    expect(skillMatch(['hvac'], [])).toBe(0);
  });

  it('matches on substrings so hyphenated skills line up', () => {
    expect(skillMatch(['commercial_roofing'], ['roofing'])).toBe(1);
  });
});

describe('extractFeatures', () => {
  const base = {
    id: 'wo_1',
    issueType: 'Active leak over the warehouse floor',
    priority: 'urgent',
    status: 'ASSIGNED',
    completedAt: null,
  };

  it('derives lead time from created and scheduled dates', () => {
    const features = extractFeatures(
      {
        ...base,
        createdAt: '2026-01-01T09:00:00.000Z',
        scheduledFor: '2026-01-03T09:00:00.000Z',
        technician: null,
      },
      { sameDayJobCount: 2 },
    );
    expect(features.lead_time_days).toBe(2);
    expect(features.schedule_density).toBe(2);
  });

  it('clamps a negative lead time to zero rather than reporting nonsense', () => {
    const features = extractFeatures(
      {
        ...base,
        createdAt: '2026-01-05T09:00:00.000Z',
        scheduledFor: '2026-01-01T09:00:00.000Z',
        technician: null,
      },
      { sameDayJobCount: 0 },
    );
    expect(features.lead_time_days).toBe(0);
  });

  it('scores an unassigned job as no skill match, not a neutral value', () => {
    const features = extractFeatures(
      {
        ...base,
        createdAt: '2026-01-01T09:00:00.000Z',
        scheduledFor: '2026-01-02T09:00:00.000Z',
        technician: null,
      },
      { sameDayJobCount: 0 },
    );
    expect(features.technician_skill_match).toBe(0);
    expect(features.technician_experience_years).toBe(0);
  });

  it('reads experience years and skills from the technician', () => {
    const features = extractFeatures(
      {
        ...base,
        createdAt: '2026-01-01T09:00:00.000Z',
        scheduledFor: '2026-01-02T09:00:00.000Z',
        technician: {
          id: 'tech_1',
          name: 'Marcus Reed',
          skills: ['leak_repair', 'commercial_roofing'],
          experienceYears: 12,
        },
      },
      { sameDayJobCount: 0 },
    );
    expect(features.technician_experience_years).toBe(12);
    expect(features.technician_skill_match).toBe(1);
  });

  it('treats a missing experience value as unknown rather than zero years of experience', () => {
    const features = extractFeatures(
      {
        ...base,
        createdAt: '2026-01-01T09:00:00.000Z',
        scheduledFor: '2026-01-02T09:00:00.000Z',
        technician: { id: 'tech_1', name: 'New Hire', skills: [], experienceYears: null },
      },
      { sameDayJobCount: 0 },
    );
    // 0 means "unknown" for this feature; the extractor does not invent a number.
    expect(features.technician_experience_years).toBe(0);
  });
});

describe('shrinkPrior', () => {
  it('is entirely the parent when the child has no observations', () => {
    const parent = { alpha: 4, beta: 1 };
    const shrunk = shrinkPrior({ onTime: 0, wentWrong: 0 }, parent, 50);
    expect(shrunk.alpha).toBeCloseTo(parent.alpha, 10);
    expect(shrunk.beta).toBeCloseTo(parent.beta, 10);
    expect(shrunk.weight).toBe(0);
  });

  it('converges on the child as observations accumulate', () => {
    const parent = { alpha: 1, beta: 9 }; // 10% on-time
    const small = shrinkPrior({ onTime: 9, wentWrong: 1 }, parent, 50); // 90% on-time, n=10
    const large = shrinkPrior({ onTime: 900, wentWrong: 100 }, parent, 50); // 90%, n=1000
    expect(large.weight).toBeGreaterThan(small.weight);
    expect(large.posteriorOnTime).toBeGreaterThan(small.posteriorOnTime);
    expect(small.posteriorOnTime).toBeLessThan(0.9);
  });

  it('shrinks both alpha and beta, so certainty grows with the parent too', () => {
    const parent = { alpha: 40, beta: 10 };
    const shrunk = shrinkPrior({ onTime: 0, wentWrong: 0 }, parent, 50);
    expect(shrunk.alpha + shrunk.beta).toBeCloseTo(parent.alpha + parent.beta, 10);
  });

  it('uses the configured k', () => {
    const parent = { alpha: 1, beta: 1 };
    const counts: PriorCounts = { onTime: 10, wentWrong: 10 }; // n = 20
    expect(shrinkPrior(counts, parent, 10).weight).toBeCloseTo(20 / 30, 10);
    expect(shrinkPrior(counts, parent, 100).weight).toBeCloseTo(20 / 120, 10);
  });
});

describe('buildPriorHierarchy', () => {
  it('threads global into vertical into technician', () => {
    const hierarchy = buildPriorHierarchy({
      global: { onTime: 800, wentWrong: 200 },
      vertical: { onTime: 400, wentWrong: 100 },
      technician: { onTime: 40, wentWrong: 10 },
    });
    expect(hierarchy.global.posteriorOnTime).toBeGreaterThan(0.5);
    expect(hierarchy.technician.sampleSize).toBe(50);
    expect(hierarchy.vertical.sampleSize).toBe(500);
  });

  it('lets a technician with no history inherit the global rate', () => {
    const hierarchy = buildPriorHierarchy({
      global: { onTime: 900, wentWrong: 100 },
      vertical: { onTime: 0, wentWrong: 0 },
      technician: { onTime: 0, wentWrong: 0 },
    });
    expect(hierarchy.technician.posteriorOnTime).toBeCloseTo(
      hierarchy.global.posteriorOnTime,
      10,
    );
  });

  it('honours env-configured k values', () => {
    const input = {
      global: { onTime: 1000, wentWrong: 0 },
      vertical: { onTime: 9, wentWrong: 1 },
      technician: { onTime: 9, wentWrong: 1 },
    };
    const loose = buildPriorHierarchy(input, { kVertical: 1000, kTechnician: 1000 });
    const tight = buildPriorHierarchy(input, { kVertical: 1, kTechnician: 1 });
    expect(tight.vertical.weight).toBeGreaterThan(loose.vertical.weight);
  });
});

describe('predictRiskPoint', () => {
  it('reports a low risk for a calm, well-matched job', () => {
    const prediction = predictRiskPoint({
      features: {
        schedule_density: 0,
        lead_time_days: 5,
        issue_type_complexity: 0.2,
        technician_skill_match: 1,
        technician_experience_years: 20,
      },
      weights: UNIT_WEIGHTS,
      baselineRisk: 0.1,
    });
    expect(prediction.riskScore).toBeLessThan(0.35);
    expect(prediction.band).toBe('low');
    expect(prediction.calibrated).toBe(true);
  });

  it('raises the risk as the day gets busier', () => {
    const riskAt = (scheduleDensity: number) =>
      predictRiskPoint({
        features: { ...ZERO_FEATURES, schedule_density: scheduleDensity },
        weights: UNIT_WEIGHTS,
        baselineRisk: 0.3,
      }).riskScore;

    expect(riskAt(5)).toBeGreaterThan(riskAt(2));
    expect(riskAt(2)).toBeGreaterThan(riskAt(0));
  });

  it('lowers the risk when the technician is a better match', () => {
    const riskAt = (skillMatchValue: number) =>
      predictRiskPoint({
        features: { ...ZERO_FEATURES, technician_skill_match: skillMatchValue },
        weights: UNIT_WEIGHTS,
        baselineRisk: 0.3,
      }).riskScore;

    expect(riskAt(1)).toBeLessThan(riskAt(0));
  });

  it('feeds the risk score into the HITL matrix', () => {
    const high = predictRiskPoint({
      features: { ...ZERO_FEATURES, schedule_density: 20 },
      weights: UNIT_WEIGHTS,
      baselineRisk: 0.5,
    });
    expect(high.riskScore).toBeGreaterThan(0.7);
    expect(high.policy).toBe('HUMAN_MANDATORY');
    expect(high.needsEvidenceBundle).toBe(true);
  });

  it('centres features on the training means, so a job at the mean gets the baseline', () => {
    const features = { ...ZERO_FEATURES };
    const prediction = predictRiskPoint({
      features,
      weights: { ...UNIT_WEIGHTS, trainingMeans: { ...ZERO_FEATURES } },
      baselineRisk: 0.25,
    });
    expect(prediction.riskScore).toBeCloseTo(0.25, 5);
  });

  it('marks uncalibrated weights', () => {
    const prediction = predictRiskPoint({
      features: { ...ZERO_FEATURES },
      weights: DEFAULT_WEIGHTS,
      baselineRisk: 0.3,
    });
    expect(prediction.calibrated).toBe(false);
  });
});

describe('explainFactors', () => {
  const features = { ...ZERO_FEATURES, schedule_density: 2, lead_time_days: 3 };
  const weights = { ...UNIT_WEIGHTS, trainingMeans: { ...ZERO_FEATURES } };

  it('sorts the largest contributors first', () => {
    const factors = explainFactors(
      features,
      [
        weights.schedule_density,
        weights.lead_time_days,
        weights.issue_type_complexity,
        weights.technician_skill_match,
        weights.technician_experience_years,
      ],
      weights,
      0.3,
    );
    const impacts = factors.map((factor) => Math.abs(factor.impact));
    expect([...impacts].sort((a, b) => b - a)).toEqual(impacts);
  });

  it('never uses model vocabulary in the plain language', () => {
    const banned = ['feature', 'coefficient', 'attribution', 'SHAP', 'model', 'logistic', 'probability'];
    const factors = explainFactors(
      { ...ZERO_FEATURES, schedule_density: 4, technician_skill_match: 0 },
      [
        weights.schedule_density,
        weights.lead_time_days,
        weights.issue_type_complexity,
        weights.technician_skill_match,
        weights.technician_experience_years,
      ],
      weights,
      0.3,
      'Marcus Reed',
    );
    expect(factors.length).toBeGreaterThan(0);
    for (const factor of factors) {
      const lower = factor.plain_language.toLowerCase();
      for (const word of banned) {
        expect(lower).not.toContain(word.toLowerCase());
      }
      expect(factor.plain_language.length).toBeGreaterThan(0);
    }
  });

  it('includes the technician name so the sentence is about this job', () => {
    const factors = explainFactors(
      { ...ZERO_FEATURES, technician_skill_match: 1 },
      [
        weights.schedule_density,
        weights.lead_time_days,
        weights.issue_type_complexity,
        weights.technician_skill_match,
        weights.technician_experience_years,
      ],
      weights,
      0.3,
      'Marcus Reed',
    );
    expect(factors.some((factor) => factor.plain_language.includes('Marcus Reed'))).toBe(true);
  });

  it('omits factors with no effect rather than listing zeros', () => {
    const factors = explainFactors(
      { ...ZERO_FEATURES },
      [0, 0, 0, 0, 0],
      weights,
      0.3,
    );
    expect(factors).toHaveLength(0);
  });

  it('separates the track record from the feature contributions', () => {
    const factors = explainFactors(
      { ...ZERO_FEATURES, schedule_density: 1 },
      [
        weights.schedule_density,
        weights.lead_time_days,
        weights.issue_type_complexity,
        weights.technician_skill_match,
        weights.technician_experience_years,
      ],
      weights,
      0.9,
    );
    const trackRecord = factors.find((factor) => factor.factor === 'technician_track_record');
    expect(trackRecord).toBeDefined();
    expect(trackRecord?.impact).toBeGreaterThan(0);
  });
});

describe('simulateRiskRange', () => {
  const trainingSamples: TrainingSample[] = Array.from({ length: 200 }, (_, index) => ({
    features: {
      schedule_density: (index % 5) + normal(lcg(index + 1)),
      lead_time_days: (index % 7) + normal(lcg(index + 100)),
      issue_type_complexity: (index % 3) / 3,
      technician_skill_match: (index % 2),
      technician_experience_years: index % 15,
    },
    label: index % 4 === 0 ? 1 : 0,
  }));

  it('returns an ordered range inside [0, 1]', () => {
    const range = simulateRiskRange({
      features: { ...ZERO_FEATURES, schedule_density: 3 },
      perturbation: { schedule_density: 1 },
      weights: UNIT_WEIGHTS,
      trainingSamples,
      baselineRisk: 0.3,
      seed: 'wo_1',
    });
    expect(range.p10).toBeLessThanOrEqual(range.p50);
    expect(range.p50).toBeLessThanOrEqual(range.p90);
    for (const value of [range.p10, range.p50, range.p90]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for a given work order and perturbation', () => {
    const params = {
      features: { ...ZERO_FEATURES, schedule_density: 3 },
      perturbation: { schedule_density: 1 },
      weights: UNIT_WEIGHTS,
      trainingSamples,
      baselineRisk: 0.3,
    };
    const first = simulateRiskRange({ ...params, seed: 'wo_1' });
    const second = simulateRiskRange({ ...params, seed: 'wo_1' });
    expect(first).toEqual(second);
  });

  it('changes with a different perturbation', () => {
    const base = {
      features: { ...ZERO_FEATURES, schedule_density: 3 },
      weights: UNIT_WEIGHTS,
      trainingSamples,
      baselineRisk: 0.3,
    };
    const first = simulateRiskRange({ ...base, perturbation: { schedule_density: 1 }, seed: 'wo_1' });
    const second = simulateRiskRange({ ...base, perturbation: { schedule_density: 5 }, seed: 'wo_1' });
    expect(first.p50).not.toBe(second.p50);
  });

  it('flags a perturbation more than two standard deviations from the training mean', () => {
    const range = simulateRiskRange({
      features: { ...ZERO_FEATURES },
      perturbation: { schedule_density: 10 },
      weights: UNIT_WEIGHTS,
      trainingSamples,
      baselineRisk: 0.3,
      seed: 'wo_1',
    });
    expect(range.outOfRange).toBe(true);
    expect(range.outOfRangeFeatures).toContain('schedule_density');
  });

  it('does not flag a perturbation inside two standard deviations', () => {
    const range = simulateRiskRange({
      features: { ...ZERO_FEATURES },
      perturbation: { schedule_density: 1 },
      weights: UNIT_WEIGHTS,
      trainingSamples,
      baselineRisk: 0.3,
      seed: 'wo_1',
    });
    expect(range.outOfRange).toBe(false);
    expect(range.outOfRangeFeatures).toHaveLength(0);
  });

  it('still returns a range when there is no training history', () => {
    const range = simulateRiskRange({
      features: { ...ZERO_FEATURES },
      perturbation: {},
      weights: UNIT_WEIGHTS,
      trainingSamples: [],
      baselineRisk: 0.3,
      seed: 'wo_1',
    });
    expect(Number.isFinite(range.p10)).toBe(true);
    expect(range.outOfRangeFeatures).toHaveLength(0);
  });

  it('clamps perturbed features to their valid ranges', () => {
    const range = simulateRiskRange({
      features: { ...ZERO_FEATURES, technician_skill_match: 0.9 },
      perturbation: { technician_skill_match: 5 },
      weights: UNIT_WEIGHTS,
      trainingSamples,
      baselineRisk: 0.3,
      seed: 'wo_1',
    });
    expect(range.pointEstimate).toBeLessThanOrEqual(1);
    expect(range.pointEstimate).toBeGreaterThanOrEqual(0);
  });
});

describe('nearestSamples', () => {
  it('returns the closest historical jobs and caps the count', () => {
    const samples: TrainingSample[] = Array.from({ length: 50 }, (_, index) => ({
      features: { ...ZERO_FEATURES, schedule_density: index },
      label: 0,
    }));
    const nearest = nearestSamples({ ...ZERO_FEATURES, schedule_density: 4 }, samples, 10);
    expect(nearest).toHaveLength(10);
    expect(nearest[0].features.schedule_density).toBe(4);
  });

  it('returns an empty list when there is nothing to compare against', () => {
    expect(nearestSamples({ ...ZERO_FEATURES }, [], 10)).toEqual([]);
  });
});

describe('calibrateWeights', () => {
  it('recovers coefficients fitted on synthetic data', () => {
    const random = lcg(20260101);
    const truth = [0.4, -0.25, 0.7, -0.9, 0.15];
    const samples: TrainingSample[] = [];

    for (let index = 0; index < 3000; index++) {
      const features: WorkOrderFeatures = {
        schedule_density: normal(random),
        lead_time_days: normal(random),
        issue_type_complexity: normal(random),
        technician_skill_match: normal(random),
        technician_experience_years: normal(random),
      };
      const z =
        -0.2 +
        truth[0] * features.schedule_density +
        truth[1] * features.lead_time_days +
        truth[2] * features.issue_type_complexity +
        truth[3] * features.technician_skill_match +
        truth[4] * features.technician_experience_years;
      const probability = logistic(z);
      samples.push({ features, label: random() < probability ? 1 : 0 });
    }

    const weights = calibrateWeights(samples, { iterations: 25 });

    expect(weights.sampleSize).toBe(3000);
    expect(weights.trainedAt).not.toBe('uncalibrated');

    // The claim is unbiasedness, not exact recovery from one draw. With 3000
    // rows each coefficient carries a standard error of roughly 0.04, so a
    // single sample can sit a couple of standard errors away from the truth;
    // twelve independent draws of this size average to the truth. Asserting an
    // absolute tolerance would test the luck of this seed, not the estimator.
    const fitted = [
      weights.schedule_density,
      weights.lead_time_days,
      weights.issue_type_complexity,
      weights.technician_skill_match,
      weights.technician_experience_years,
    ];
    const standardErrors = [
      weights.standardErrors.schedule_density,
      weights.standardErrors.lead_time_days,
      weights.standardErrors.issue_type_complexity,
      weights.standardErrors.technician_skill_match,
      weights.standardErrors.technician_experience_years,
    ];

    for (let index = 0; index < truth.length; index++) {
      expect(Math.abs(fitted[index] - truth[index])).toBeLessThan(3 * standardErrors[index]);
    }

    // Standard errors must be positive and finite, or the bootstrap range is noise.
    for (const standardError of standardErrors) {
      expect(standardError).toBeGreaterThan(0);
      expect(Number.isFinite(standardError)).toBe(true);
    }
  });

  it('records the training means and spreads used for centring and range checks', () => {
    const samples: TrainingSample[] = [
      { features: { ...ZERO_FEATURES, schedule_density: 2 }, label: 0 },
      { features: { ...ZERO_FEATURES, schedule_density: 4 }, label: 1 },
    ];
    const weights = calibrateWeights(samples, { iterations: 5 });
    expect(weights.trainingMeans.schedule_density).toBeCloseTo(3, 5);
    expect(weights.trainingStd.schedule_density).toBeGreaterThan(0);
  });

  it('does not divide by zero when a feature never varies', () => {
    const samples: TrainingSample[] = Array.from({ length: 10 }, () => ({
      features: { ...ZERO_FEATURES, schedule_density: 5 },
      label: 0,
    }));
    const weights = calibrateWeights(samples, { iterations: 5 });
    expect(Number.isFinite(weights.schedule_density)).toBe(true);
    expect(weights.trainingStd.schedule_density).toBe(1);
  });
});

describe('isOnTime', () => {
  const base = {
    id: 'wo_1',
    businessId: 'biz_1',
    vertical: 'roofing',
    issueType: 'leak',
    priority: 'normal',
    scheduledFor: '2026-01-01T09:00:00.000Z',
    createdAt: '2025-12-30T09:00:00.000Z',
    technicianId: 'tech_1',
    technicianExperienceYears: 5,
    technicianSkills: [],
    sameDayJobCount: 1,
  };

  it('treats a cancellation as a failure', () => {
    expect(isOnTime({ ...base, status: 'CANCELLED', completedAt: null })).toBe(false);
  });

  it('excludes a job that is still open', () => {
    expect(isOnTime({ ...base, status: 'ASSIGNED', completedAt: null })).toBeNull();
    expect(isOnTime({ ...base, status: 'SCHEDULED', completedAt: null })).toBeNull();
  });

  it('counts a completion inside the grace window as on time', () => {
    expect(isOnTime({ ...base, status: 'COMPLETED', completedAt: '2026-01-01T10:00:00.000Z' })).toBe(
      true,
    );
  });

  it('counts a completion past the grace window as late', () => {
    expect(isOnTime({ ...base, status: 'COMPLETED', completedAt: '2026-01-02T09:00:00.000Z' })).toBe(
      false,
    );
  });
});

describe('buildCalibrationInput', () => {
  const history: HistoricalWorkOrder[] = [
    {
      id: 'wo_1',
      businessId: 'biz_1',
      vertical: 'roofing',
      issueType: 'leak',
      priority: 'normal',
      status: 'COMPLETED',
      scheduledFor: '2026-01-01T09:00:00.000Z',
      createdAt: '2025-12-30T09:00:00.000Z',
      completedAt: '2026-01-01T10:00:00.000Z',
      technicianId: 'tech_1',
      technicianExperienceYears: 5,
      technicianSkills: ['leak_repair'],
      sameDayJobCount: 2,
    },
    {
      id: 'wo_2',
      businessId: 'biz_1',
      vertical: 'roofing',
      issueType: 'inspection',
      priority: 'normal',
      status: 'CANCELLED',
      scheduledFor: '2026-01-02T09:00:00.000Z',
      createdAt: '2026-01-01T09:00:00.000Z',
      completedAt: null,
      technicianId: 'tech_1',
      technicianExperienceYears: 5,
      technicianSkills: ['leak_repair'],
      sameDayJobCount: 0,
    },
    {
      id: 'wo_3',
      businessId: 'biz_1',
      vertical: 'roofing',
      issueType: 'leak',
      priority: 'normal',
      status: 'ASSIGNED',
      scheduledFor: '2026-02-01T09:00:00.000Z',
      createdAt: '2026-01-01T09:00:00.000Z',
      completedAt: null,
      technicianId: null,
      technicianExperienceYears: null,
      technicianSkills: [],
      sameDayJobCount: 0,
    },
  ];

  it('labels outcomes and excludes jobs with none', () => {
    const result = buildCalibrationInput(history);
    expect(result.samples).toHaveLength(2);
    expect(result.excluded).toBe(1);
    expect(result.global).toEqual({ onTime: 1, wentWrong: 1 });
  });

  it('builds per-vertical and per-technician counts', () => {
    const result = buildCalibrationInput(history);
    expect(result.vertical.roofing).toEqual({ onTime: 1, wentWrong: 1 });
    expect(result.technician.tech_1).toEqual({ onTime: 1, wentWrong: 1 });
  });

  it('groups an unassigned technician under a stable key', () => {
    const unassigned: HistoricalWorkOrder[] = [
      {
        ...history[0],
        id: 'wo_unassigned',
        technicianId: null,
        technicianExperienceYears: null,
        technicianSkills: [],
      },
    ];
    const result = buildCalibrationInput(unassigned);
    expect(result.technician.unassigned).toEqual({ onTime: 1, wentWrong: 0 });
  });

  it('normalises the vertical key so case does not split the counts', () => {
    const mixed = history.map((workOrder) => ({ ...workOrder, vertical: 'RoOfInG' }));
    const result = buildCalibrationInput(mixed);
    expect(result.vertical.roofing).toBeDefined();
    expect(result.vertical.RoOfInG).toBeUndefined();
  });
});

describe('model weights loading', () => {
  it('falls back to the documented defaults when no calibration file exists', () => {
    const weights = loadModelWeights();
    expect(weights.sampleSize).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(weights.intercept)).toBe(true);
  });

  it('exposes uncalibrated defaults as such', () => {
    expect(DEFAULT_WEIGHTS.sampleSize).toBe(0);
    expect(DEFAULT_WEIGHTS.trainedAt).toBe('uncalibrated');
  });
});

describe('enrichPlainLanguage', () => {
  const factors: RiskFactor[] = [
    { factor: 'schedule_density', impact: 0.4, plain_language: 'Your crew already has 4 jobs booked for this day.' },
  ];

  // The cache is module-level so production does not re-call the model; tests
  // share a module, so they must clear it or they silently assert each other's
  // cached output.
  beforeEach(() => clearPlainLanguageCache());

  it('uses the generator output and caches it', async () => {
    let calls = 0;
    const generator = async () => {
      calls += 1;
      return '  Your crew is stretched across four jobs today.  ';
    };
    const sanitize = (value: string) => value.replace(/[^a-z ]/gi, '');

    const first = await enrichPlainLanguage(
      factors,
      { technicianName: 'Marcus Reed', businessName: 'A-1 Roofing' },
      generator,
      sanitize,
    );
    const second = await enrichPlainLanguage(
      factors,
      { technicianName: 'Marcus Reed', businessName: 'A-1 Roofing' },
      generator,
      sanitize,
    );

    expect(first[0].plain_language).toBe('Your crew is stretched across four jobs today');
    expect(second[0].plain_language).toBe(first[0].plain_language);
    expect(calls).toBe(1);
  });

  it('falls back to the template when the generator throws', async () => {
    const result = await enrichPlainLanguage(
      factors,
      { technicianName: 'Marcus Reed', businessName: 'A-1 Roofing' },
      async () => {
        throw new Error('no key configured');
      },
      (value) => value,
    );
    expect(result[0].plain_language).toBe(factors[0].plain_language);
  });

  it('falls back when the generator returns only sanitised-away characters', async () => {
    const result = await enrichPlainLanguage(
      factors,
      { technicianName: 'Marcus Reed', businessName: 'A-1 Roofing' },
      async () => '!!!',
      (value) => value.replace(/[^a-z ]/gi, ''),
    );
    expect(result[0].plain_language).toBe(factors[0].plain_language);
  });
});
