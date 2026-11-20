import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import {
  predictAdditiveRisk,
  shrinkPrior,
  type AdditivePrediction,
  type PriorCounts,
  type ShrunkPrior,
} from './riskModel';
import { evaluateBookingDepositPolicy, type DrpeDepositDecision } from './bookingDepositPolicy.service';

/**
 * Booking risk — will this client show up?
 *
 * WHY THIS NO LONGER IMPORTS THE COORDINATOR ENGINE
 * ------------------------------------------------
 * This service used to call `predictRiskPoint` from
 * `predictiveEngine.service.ts`, which meant scoring a booking with a model
 * fitted to work-order outcomes, and with two features that do not exist for a
 * booking at all (`technician_skill_match`, `technician_experience_years` — a
 * booking has no assigned technician).
 *
 * The additive maths is shared and lives in `riskModel.ts`. The FEATURES and the
 * WEIGHTS are domain-specific, so this module owns its own.
 */

/** The features a booking actually has. */
export const BOOKING_FEATURE_NAMES = [
  'schedule_density',
  'lead_time_days',
  'issue_type_complexity',
  'service_value',
] as const;

export type BookingFeatureName = (typeof BOOKING_FEATURE_NAMES)[number];

export interface BookingFeatures {
  /** Other bookings the business already has that day. */
  schedule_density: number;
  /** Days between now and the slot. */
  lead_time_days: number;
  /** 0–1 complexity of the service type. */
  issue_type_complexity: number;
  /** Server-side catalog price of the service. */
  service_value: number;
}

export interface BookingModelWeights {
  intercept: number;
  schedule_density: number;
  lead_time_days: number;
  issue_type_complexity: number;
  service_value: number;
  trainingMeans: BookingFeatures;
  trainingStd: BookingFeatures;
  standardErrors: BookingFeatures;
  globalCounts: PriorCounts;
  verticalCounts: Record<string, PriorCounts>;
  trainedAt: string;
  sampleSize: number;
}

/**
 * Weights used until the offline calibration has run.
 *
 * NOT FITTED. Every prediction carries `calibrated: false` and the API surfaces
 * it, for the same reason the coordinator engine does: placeholder weights must
 * not be presented as a considered score.
 */
export const DEFAULT_BOOKING_WEIGHTS: BookingModelWeights = {
  intercept: 0,
  schedule_density: 0.12,
  lead_time_days: -0.03,
  issue_type_complexity: 0.75,
  service_value: 0.001,
  trainingMeans: {
    schedule_density: 2,
    lead_time_days: 3,
    issue_type_complexity: 0.5,
    service_value: 100,
  },
  trainingStd: {
    schedule_density: 1,
    lead_time_days: 1,
    issue_type_complexity: 1,
    service_value: 1,
  },
  standardErrors: {
    schedule_density: 0.1,
    lead_time_days: 0.02,
    issue_type_complexity: 0.2,
    service_value: 0.0005,
  },
  globalCounts: { onTime: 0, wentWrong: 0 },
  verticalCounts: {},
  trainedAt: 'uncalibrated',
  sampleSize: 0,
};

/**
 * Resolved at call time rather than at module load, so a deployment can point
 * the model elsewhere without a restart and so the fallback is testable.
 */
function bookingModelPath(): string {
  return (
    process.env.BOOKING_RISK_MODEL_PATH ??
    path.join(process.cwd(), 'config', 'booking-risk-model.json')
  );
}

/** Loads calibrated booking weights from disk, falling back to the defaults. */
export function loadBookingModelWeights(): BookingModelWeights {
  try {
    const modelPath = bookingModelPath();
    if (!existsSync(modelPath)) return DEFAULT_BOOKING_WEIGHTS;
    const parsed = JSON.parse(readFileSync(modelPath, 'utf8')) as BookingModelWeights;
    if (!parsed?.trainingMeans || parsed.sampleSize <= 0) return DEFAULT_BOOKING_WEIGHTS;
    return parsed;
  } catch (error) {
    logger.warn(`[BookingRisk] could not load model weights: ${String(error)}`);
    return DEFAULT_BOOKING_WEIGHTS;
  }
}

export interface BookingRiskFactor {
  factor: string;
  impact: number;
  plain_language: string;
}

export interface BookingRiskPrediction extends AdditivePrediction {
  factors: BookingRiskFactor[];
  features: BookingFeatures;
  calibrated: boolean;
}

function complexityFor(serviceType: string): number {
  const value = serviceType.toLowerCase();
  if (/\b(repair|install|replace|emergency|leak|roof|hvac)\b/.test(value)) return 0.8;
  if (/\b(clean|maintain|service|tune|inspect)\b/.test(value)) return 0.35;
  return 0.5;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * One plain-language sentence per contributing feature.
 *
 * Same rule as the coordinator's explanations: no model vocabulary. A client
 * reading about their deposit should never see the word "coefficient".
 */
function explainBookingFactors(
  features: BookingFeatures,
  contributions: AdditivePrediction['contributions'],
): BookingRiskFactor[] {
  const byName = new Map(contributions.map((item) => [item.name, item.impact]));
  const factors: BookingRiskFactor[] = [];

  const push = (name: BookingFeatureName, sentence: (impact: number) => string) => {
    const impact = byName.get(name);
    if (impact === undefined) return;
    factors.push({ factor: name, impact, plain_language: sentence(impact) });
  };

  push('schedule_density', (impact) =>
    impact >= 0
      ? `This business already has ${Math.round(features.schedule_density)} bookings that day.`
      : `That day is fairly open for this business, with ${Math.round(features.schedule_density)} bookings so far.`,
  );
  push('lead_time_days', (impact) =>
    impact >= 0
      ? `The slot is only ${Math.round(features.lead_time_days)} days away, which leaves little room to recover if plans change.`
      : `The slot was booked ${Math.round(features.lead_time_days)} days ahead, which makes a no-show less likely.`,
  );
  push('issue_type_complexity', (impact) =>
    impact >= 0
      ? 'This kind of appointment is more involved than a routine visit.'
      : 'This is a routine appointment.',
  );
  push('service_value', (impact) =>
    impact >= 0
      ? `The appointment costs $${features.service_value.toFixed(2)}, which raises the stakes of a no-show.`
      : `The appointment value of $${features.service_value.toFixed(2)} is modest.`,
  );

  return factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

/**
 * The single prediction path.
 *
 * `assessBookingRisk` and `quoteBookingRiskAndDeposit` used to each build the
 * feature vector and call a model separately, so the two could drift. Both go
 * through here now.
 */
async function predictBookingRisk(params: {
  businessId: string;
  slotStart: Date;
  serviceType: string;
  serviceValue: number;
}): Promise<BookingRiskPrediction> {
  const weights = loadBookingModelWeights();

  const dayStart = new Date(params.slotStart);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  let sameDayCount = 0;
  try {
    sameDayCount = await prisma.booking.count({
      where: {
        businessId: params.businessId,
        slotStart: { gte: dayStart, lt: dayEnd },
        status: { in: ['pending', 'confirmed', 'COMPLETED'] },
      },
    });
  } catch {
    // A failed count must not block a booking; it only removes one feature.
    sameDayCount = 0;
  }

  const features: BookingFeatures = {
    schedule_density: sameDayCount,
    lead_time_days: daysBetween(new Date(), params.slotStart),
    issue_type_complexity: complexityFor(params.serviceType),
    service_value: Math.max(0, params.serviceValue),
  };

  // Two levels for a booking: the platform base rate, then the segment.
  const globalPrior: ShrunkPrior = shrinkPrior(weights.globalCounts, { alpha: 1, beta: 1 }, 1);
  const segmentPrior: ShrunkPrior = shrinkPrior(
    weights.verticalCounts['general'] ?? weights.globalCounts,
    globalPrior,
    50,
  );

  const prediction = predictAdditiveRisk({
    names: BOOKING_FEATURE_NAMES,
    values: [
      features.schedule_density,
      features.lead_time_days,
      features.issue_type_complexity,
      features.service_value,
    ],
    coefficients: [
      weights.schedule_density,
      weights.lead_time_days,
      weights.issue_type_complexity,
      weights.service_value,
    ],
    trainingMeans: [
      weights.trainingMeans.schedule_density,
      weights.trainingMeans.lead_time_days,
      weights.trainingMeans.issue_type_complexity,
      weights.trainingMeans.service_value,
    ],
    baselineRisk: segmentPrior.posteriorRisk,
  });

  return {
    ...prediction,
    factors: explainBookingFactors(features, prediction.contributions),
    features,
    calibrated: weights.sampleSize > 0,
  };
}

export async function assessBookingRisk(params: {
  bookingId: string;
  businessId: string;
  slotStart: Date;
  serviceType: string;
  serviceValue?: number;
}) {
  const prediction = await predictBookingRisk({
    businessId: params.businessId,
    slotStart: params.slotStart,
    serviceType: params.serviceType,
    // Without a value the model scores on the remaining three features rather
    // than inventing a price.
    serviceValue: params.serviceValue ?? 0,
  });

  const weights = loadBookingModelWeights();
  const risk = await prisma.bookingRisk.create({
    data: {
      bookingId: params.bookingId,
      riskScore: prediction.riskScore,
      confidence: prediction.confidence,
      band: prediction.band,
      policy: prediction.policy,
      factors: prediction.factors as any,
      features: prediction.features as any,
      modelVersion: weights.trainedAt || 'uncalibrated',
      calibrated: weights.sampleSize > 0,
    },
  });

  logger.info(
    `[BookingRisk] booking=${params.bookingId} score=${prediction.riskScore.toFixed(3)} band=${prediction.band} policy=${prediction.policy}`,
  );
  return risk;
}

export async function quoteBookingRiskAndDeposit(params: {
  businessId: string;
  slotStart: Date;
  serviceType: string;
  serviceValue: number;
  trustScore?: number | null;
}): Promise<{
  prediction: BookingRiskPrediction;
  drpe: DrpeDepositDecision;
}> {
  const prediction = await predictBookingRisk(params);

  const drpe = evaluateBookingDepositPolicy({
    trustScore: params.trustScore,
    serviceValue: params.serviceValue,
    predictedRiskScore: prediction.riskScore,
  });

  return { prediction, drpe };
}

export async function recordBookingRiskOutcome(bookingId: string, status: string) {
  const outcome =
    status === 'COMPLETED' || status === 'completed'
      ? 'on_time'
      : status === 'NO_SHOW' || status === 'no_show'
        ? 'no_show'
        : status === 'CANCELLED' || status === 'cancelled'
          ? 'cancelled'
          : null;
  if (!outcome) return;

  await prisma.bookingRisk.updateMany({
    where: { bookingId },
    data: { outcome, outcomeAt: new Date() },
  });
}
