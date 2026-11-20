import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import {
  buildPriorHierarchy,
  evaluateBookingDepositPolicy,
  loadModelWeights,
  predictRiskPoint,
  type DrpeDepositDecision,
  type RiskPrediction,
  type WorkOrderFeatures,
} from './predictiveEngine.service';

function complexityFor(serviceType: string): number {
  const value = serviceType.toLowerCase();
  if (/\b(repair|install|replace|emergency|leak|roof|hvac)\b/.test(value)) return 0.8;
  if (/\b(clean|maintain|service|tune|inspect)\b/.test(value)) return 0.35;
  return 0.5;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 86_400_000);
}

export async function assessBookingRisk(params: {
  bookingId: string;
  businessId: string;
  slotStart: Date;
  serviceType: string;
}) {
  const weights = loadModelWeights();
  const dayStart = new Date(params.slotStart);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const sameDayCount = await prisma.booking.count({
    where: {
      businessId: params.businessId,
      slotStart: { gte: dayStart, lt: dayEnd },
      status: { in: ['pending', 'confirmed', 'COMPLETED'] },
    },
  });

  const features: WorkOrderFeatures = {
    schedule_density: sameDayCount,
    lead_time_days: daysBetween(new Date(), params.slotStart),
    issue_type_complexity: complexityFor(params.serviceType),
    technician_skill_match: 1,
    technician_experience_years: 0,
  };

  const prior = buildPriorHierarchy({
    global: weights.globalCounts,
    vertical: weights.verticalCounts['general'] ?? weights.globalCounts,
    technician: { onTime: 0, wentWrong: 0 },
  });

  const prediction = predictRiskPoint({
    features,
    weights,
    baselineRisk: prior.technician.posteriorRisk,
  });

  const risk = await prisma.bookingRisk.create({
    data: {
      bookingId: params.bookingId,
      riskScore: prediction.riskScore,
      confidence: prediction.confidence,
      band: prediction.band,
      policy: prediction.policy,
      factors: prediction.factors as any,
      features: features as any,
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
  prediction: RiskPrediction;
  drpe: DrpeDepositDecision;
}> {
  const weights = loadModelWeights();
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
    sameDayCount = 0;
  }

  const features: WorkOrderFeatures = {
    schedule_density: sameDayCount,
    lead_time_days: daysBetween(new Date(), params.slotStart),
    issue_type_complexity: complexityFor(params.serviceType),
    technician_skill_match: 1,
    technician_experience_years: 0,
  };

  const prior = buildPriorHierarchy({
    global: weights.globalCounts,
    vertical: weights.verticalCounts['general'] ?? weights.globalCounts,
    technician: { onTime: 0, wentWrong: 0 },
  });

  const prediction = predictRiskPoint({
    features,
    weights,
    baselineRisk: prior.technician.posteriorRisk,
  });

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
