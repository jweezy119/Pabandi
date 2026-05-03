import * as tf from '@tensorflow/tfjs';
import { logger } from '../../utils/logger';
import { prisma } from '../../utils/database';

interface ReservationFeatures {
  customerHistory?: {
    totalReservations: number;
    noShowCount: number;
    cancellationCount: number;
    lastReservationDate?: Date;
    averageNoShowRate?: number;
  };
  timeFactors?: {
    dayOfWeek: number;
    hour: number;
    isWeekend: boolean;
    isHoliday: boolean;
  };
  bookingFactors?: {
    advanceBookingDays: number;
    isSameDay: boolean;
    groupSize: number;
    hasSpecialRequests: boolean;
  };
  businessFactors?: {
    averageNoShowRate: number;
    businessRating?: number;
    requiresDeposit: boolean;
    businessCategory?: string;
  };
  /** Salon / Spa specific */
  serviceFactors?: {
    serviceType?: string;       // e.g. "Hair Coloring", "Bridal Makeup"
    serviceDurationMinutes?: number;
    estimatedValuePKR?: number;
  };
  /** Event / VIP specific */
  eventFactors?: {
    eventCapacity?: number;
    isVIP?: boolean;
    ticketPricePKR?: number;
  };
}

export interface PredictionResult {
  probability: number;
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  factors: Record<string, number>;
  depositRecommendation: {
    required: boolean;
    amountPKR: number;
    strategy: 'FLAT' | 'PERCENTAGE' | 'AI_DYNAMIC';
    reason: string;
    /** Deposit is applied toward the total purchase */
    creditedTowardPurchase: true;
  };
  overbookingAdvice?: {
    predictedNoShowPercent: number;
    safeOverbookMargin: number;
    recommendedCapacity: number;
  };
}

// ── Pakistan Market Deposit Constants ──────────────────────────
const DEPOSIT_CONFIG = {
  RESTAURANT: {
    perPersonMin: 500,
    perPersonMax: 2000,
    baseFlatPKR: 1000,
  },
  SALON: {
    percentageMin: 0.20,
    percentageMax: 0.30,
    baseFlatPKR: 800,
  },
  SPA: {
    percentageMin: 0.20,
    percentageMax: 0.30,
    baseFlatPKR: 1000,
  },
  EVENT_VENUE: {
    perTicketMin: 1000,
    perTicketMax: 5000,
    baseFlatPKR: 2000,
  },
  OTHER: {
    baseFlatPKR: 500,
  },
} as const;

export class NoShowPredictor {
  private model: tf.LayersModel | null = null;
  private isModelLoaded = false;

  /**
   * Predict no-show probability for a reservation
   */
  async predict(features: ReservationFeatures): Promise<PredictionResult> {
    try {
      // If model is not available, use rule-based prediction
      if (!this.isModelLoaded) {
        return this.ruleBasedPrediction(features);
      }

      // Normalize features
      const normalizedFeatures = this.normalizeFeatures(features);

      // Make prediction using ML model
      const prediction = this.model!.predict(
        tf.tensor2d([normalizedFeatures])
      );

      const predictionTensor = Array.isArray(prediction)
        ? (prediction[0] as tf.Tensor)
        : (prediction as tf.Tensor);

      const data = await predictionTensor.data();
      const probability = (data as Float32Array)[0] ?? 0;
      const riskScore = Math.round(probability * 100);
      const factors = this.extractFactors(features);
      const riskLevel = this.getRiskLevel(riskScore);
      const depositRecommendation = this.calculateDynamicDeposit(features, riskScore);

      return { probability, riskScore, riskLevel, factors, depositRecommendation };
    } catch (error) {
      logger.error('Error in AI prediction, falling back to rule-based', error);
      return this.ruleBasedPrediction(features);
    }
  }

  /**
   * Rule-based prediction with industry-specific modifiers
   */
  private ruleBasedPrediction(features: ReservationFeatures): PredictionResult {
    let riskScore = 30; // Base risk
    const factors: Record<string, number> = {};

    // ── Customer history factors ──
    if (features.customerHistory) {
      const { totalReservations, noShowCount, averageNoShowRate } =
        features.customerHistory;

      if (totalReservations === 0) {
        riskScore += 15; // New customer
        factors.isNewCustomer = 15;
      } else if (averageNoShowRate) {
        riskScore += averageNoShowRate * 40;
        factors.customerHistory = Math.round(averageNoShowRate * 40);
      }

      if (noShowCount > 0) {
        const noShowRate = noShowCount / totalReservations;
        riskScore += noShowRate * 30;
        factors.pastNoShows = Math.round(noShowRate * 30);
      }

      // Loyal customer discount: lots of completed, few no-shows
      if (totalReservations > 10 && (noShowCount / totalReservations) < 0.05) {
        riskScore -= 15;
        factors.loyalCustomerBonus = -15;
      }
    } else {
      riskScore += 20; // Unknown customer
      factors.unknownCustomer = 20;
    }

    // ── Time factors ──
    if (features.timeFactors) {
      const { hour, isWeekend } = features.timeFactors;

      if (isWeekend) {
        riskScore += 5;
        factors.weekendBooking = 5;
      }

      // Late night or very early bookings might have higher no-show
      if (hour < 9 || hour > 21) {
        riskScore += 10;
        factors.unusualTime = 10;
      }
    }

    // ── Booking factors ──
    if (features.bookingFactors) {
      const { advanceBookingDays, isSameDay, groupSize } = features.bookingFactors;

      if (isSameDay) {
        riskScore += 15;
        factors.sameDayBooking = 15;
      } else if (advanceBookingDays > 14) {
        riskScore += 10;
        factors.advancedBooking = 10;
      }

      if (groupSize > 8) {
        riskScore += 8;
        factors.largeGroup = 8;
      }
    }

    // ── Business factors ──
    if (features.businessFactors) {
      const { averageNoShowRate, businessRating } = features.businessFactors;
      riskScore += averageNoShowRate * 20;
      factors.businessAverage = Math.round(averageNoShowRate * 20);

      // Adjust risk based on business rating/reliability
      if (businessRating && businessRating < 3.5) {
        riskScore += 10;
        factors.lowBusinessRating = 10;
      }

      // ── INDUSTRY-SPECIFIC MODIFIERS ──
      const category = features.businessFactors.businessCategory;
      if (category) {
        const industryAdjustment = this.industrySpecificPrediction(features, category);
        riskScore += industryAdjustment.totalAdjustment;
        Object.assign(factors, industryAdjustment.factors);
      }
    }

    // ── Deposit deterrence factor ──
    // If a deposit is already required, risk drops (people who pay are more likely to show)
    if (features.businessFactors?.requiresDeposit) {
      riskScore -= 12;
      factors.depositDeterrent = -12;
    }

    // Cap risk score between 0 and 100
    riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));
    const probability = riskScore / 100;
    const riskLevel = this.getRiskLevel(riskScore);
    const depositRecommendation = this.calculateDynamicDeposit(features, riskScore);

    // Overbooking advice for events
    const overbookingAdvice = features.businessFactors?.businessCategory === 'EVENT_VENUE'
      ? this.calculateOverbookingAdvice(features, riskScore)
      : undefined;

    return { probability, riskScore, riskLevel, factors, depositRecommendation, overbookingAdvice };
  }

  /**
   * Industry-specific risk adjustments
   */
  private industrySpecificPrediction(
    features: ReservationFeatures,
    category: string
  ): { totalAdjustment: number; factors: Record<string, number> } {
    const factors: Record<string, number> = {};
    let totalAdjustment = 0;

    switch (category) {
      case 'RESTAURANT': {
        const dayOfWeek = features.timeFactors?.dayOfWeek;
        const groupSize = features.bookingFactors?.groupSize || 1;
        const hour = features.timeFactors?.hour || 12;

        // Friday night large groups are highest no-show risk in restaurants
        if (dayOfWeek === 5 && hour >= 19 && groupSize >= 6) {
          totalAdjustment += 12;
          factors.fridayNightLargeGroup = 12;
        }

        // Tuesday couples tend to be reliable
        if (dayOfWeek === 2 && groupSize <= 2) {
          totalAdjustment -= 5;
          factors.weekdayCoupleReliable = -5;
        }

        // Prime dinner hours (7-9 PM) on weekends = higher demand = higher no-show
        if (features.timeFactors?.isWeekend && hour >= 19 && hour <= 21) {
          totalAdjustment += 7;
          factors.primeTimeDinner = 7;
        }

        // Very large groups (10+) in restaurants have notoriously high no-show
        if (groupSize >= 10) {
          totalAdjustment += 10;
          factors.veryLargeGroupRestaurant = 10;
        }
        break;
      }

      case 'SALON':
      case 'SPA': {
        const duration = features.serviceFactors?.serviceDurationMinutes || 60;
        const serviceValue = features.serviceFactors?.estimatedValuePKR || 2000;

        // Multi-hour services (2+ hours) are higher risk: more commitment, more likely to bail
        if (duration >= 120) {
          totalAdjustment += 10;
          factors.multiHourService = 10;
        }

        // High-value services (>PKR 5000) = higher risk without deposit
        if (serviceValue > 5000) {
          totalAdjustment += 8;
          factors.highValueService = 8;
        }

        // Peak hours for salons (Thursday/Friday before weekend)
        const dayOfWeek = features.timeFactors?.dayOfWeek;
        if (dayOfWeek === 4 || dayOfWeek === 5) {
          totalAdjustment += 5;
          factors.salonPeakDay = 5;
        }

        // Time slot fragility: a single missed appointment affects the stylist's entire day
        if (duration >= 90) {
          totalAdjustment += 5;
          factors.timeSlotFragility = 5;
        }
        break;
      }

      case 'EVENT_VENUE': {
        const isVIP = features.eventFactors?.isVIP || false;
        const ticketPrice = features.eventFactors?.ticketPricePKR || 3000;

        // VIP bookings have moderate no-show (people book speculatively)
        if (isVIP) {
          totalAdjustment += 8;
          factors.vipSpeculativeBooking = 8;
        }

        // High ticket price can actually reduce no-show (sunk cost)
        if (ticketPrice > 10000) {
          totalAdjustment -= 5;
          factors.highTicketCommitment = -5;
        }

        // Free or very cheap events have highest no-show
        if (ticketPrice < 1000) {
          totalAdjustment += 15;
          factors.lowPriceHighNoShow = 15;
        }

        // Long advance bookings for events decay more
        const advanceDays = features.bookingFactors?.advanceBookingDays || 0;
        if (advanceDays > 30) {
          totalAdjustment += 8;
          factors.eventAdvanceDecay = 8;
        }
        break;
      }

      case 'CLINIC':
      case 'FITNESS_CENTER':
      default:
        // Generic adjustments for other categories
        break;
    }

    return { totalAdjustment, factors };
  }

  /**
   * Calculate dynamic deposit based on risk, industry, and service value.
   * All deposits are credited toward the total purchase.
   */
  private calculateDynamicDeposit(
    features: ReservationFeatures,
    riskScore: number
  ): PredictionResult['depositRecommendation'] {
    const category = features.businessFactors?.businessCategory || 'OTHER';
    const groupSize = features.bookingFactors?.groupSize || 1;

    // Trusted customers (score < 25 OR loyal history) get deposit waived
    const isLoyalCustomer = features.customerHistory
      && features.customerHistory.totalReservations > 10
      && (features.customerHistory.noShowCount / features.customerHistory.totalReservations) < 0.05;

    if (riskScore < 25 || isLoyalCustomer) {
      return {
        required: false,
        amountPKR: 0,
        strategy: 'AI_DYNAMIC',
        reason: isLoyalCustomer
          ? 'Trusted returning customer — deposit waived as loyalty reward'
          : 'Low risk — no deposit needed',
        creditedTowardPurchase: true,
      };
    }

    // Risk multiplier: scales deposit proportionally (0.5 at risk 30, up to 1.5 at risk 100)
    const riskMultiplier = 0.3 + (riskScore / 100) * 1.2;
    let amountPKR = 0;
    let reason = '';

    switch (category) {
      case 'RESTAURANT': {
        const perPerson = Math.round(
          DEPOSIT_CONFIG.RESTAURANT.perPersonMin +
          (DEPOSIT_CONFIG.RESTAURANT.perPersonMax - DEPOSIT_CONFIG.RESTAURANT.perPersonMin) * (riskScore / 100)
        );
        amountPKR = perPerson * groupSize;
        reason = `PKR ${perPerson}/person × ${groupSize} guests (risk-adjusted)`;
        break;
      }

      case 'SALON':
      case 'SPA': {
        const serviceValue = features.serviceFactors?.estimatedValuePKR || 3000;
        const config = category === 'SPA' ? DEPOSIT_CONFIG.SPA : DEPOSIT_CONFIG.SALON;
        const percentage = config.percentageMin +
          (config.percentageMax - config.percentageMin) * (riskScore / 100);
        amountPKR = Math.round(serviceValue * percentage);
        amountPKR = Math.max(amountPKR, config.baseFlatPKR);
        reason = `${Math.round(percentage * 100)}% of PKR ${serviceValue.toLocaleString()} service value`;
        break;
      }

      case 'EVENT_VENUE': {
        const ticketPrice = features.eventFactors?.ticketPricePKR || 3000;
        amountPKR = Math.round(
          Math.min(
            ticketPrice * 0.5, // Cap at 50% of ticket
            DEPOSIT_CONFIG.EVENT_VENUE.perTicketMin +
            (DEPOSIT_CONFIG.EVENT_VENUE.perTicketMax - DEPOSIT_CONFIG.EVENT_VENUE.perTicketMin) * (riskScore / 100)
          )
        );
        amountPKR = Math.max(amountPKR, DEPOSIT_CONFIG.EVENT_VENUE.perTicketMin);
        reason = `Event booking deposit (risk-adjusted, capped at 50% of ticket)`;
        break;
      }

      default: {
        amountPKR = Math.round(DEPOSIT_CONFIG.OTHER.baseFlatPKR * riskMultiplier);
        reason = `Standard deposit (AI risk: ${riskScore}%)`;
        break;
      }
    }

    // Round to nearest 50 PKR for cleanliness
    amountPKR = Math.round(amountPKR / 50) * 50;
    amountPKR = Math.max(amountPKR, 500); // Minimum PKR 500

    return {
      required: riskScore >= 35,
      amountPKR,
      strategy: 'AI_DYNAMIC',
      reason,
      creditedTowardPurchase: true,
    };
  }

  /**
   * Overbooking advice for event venues
   */
  private calculateOverbookingAdvice(
    features: ReservationFeatures,
    riskScore: number
  ): PredictionResult['overbookingAdvice'] {
    const capacity = features.eventFactors?.eventCapacity || 100;
    const predictedNoShowPercent = Math.min(riskScore * 0.8, 30); // Cap at 30%
    const safeOverbookMargin = Math.round(predictedNoShowPercent * 0.7); // Conservative: 70% of predicted
    const recommendedCapacity = Math.round(capacity * (1 + safeOverbookMargin / 100));

    return {
      predictedNoShowPercent: Math.round(predictedNoShowPercent * 10) / 10,
      safeOverbookMargin: Math.round(safeOverbookMargin),
      recommendedCapacity,
    };
  }

  /**
   * Map score to risk level
   */
  private getRiskLevel(score: number): PredictionResult['riskLevel'] {
    if (score >= 75) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MODERATE';
    return 'LOW';
  }

  /**
   * Normalize features for ML model input
   */
  private normalizeFeatures(features: ReservationFeatures): number[] {
    // Feature vector: [totalReservations, noShowRate, dayOfWeek, hour, advanceDays, groupSize, ...]
    const normalized: number[] = [];

    // Customer history
    if (features.customerHistory) {
      normalized.push(features.customerHistory.totalReservations / 100); // Normalize
      normalized.push(
        features.customerHistory.averageNoShowRate || 0
      );
    } else {
      normalized.push(0, 0);
    }

    // Time factors
    if (features.timeFactors) {
      normalized.push(features.timeFactors.dayOfWeek / 7);
      normalized.push(features.timeFactors.hour / 24);
      normalized.push(features.timeFactors.isWeekend ? 1 : 0);
    } else {
      normalized.push(0, 0, 0);
    }

    // Booking factors
    if (features.bookingFactors) {
      normalized.push(
        Math.min(features.bookingFactors.advanceBookingDays / 30, 1)
      );
      normalized.push(features.bookingFactors.groupSize / 20);
      normalized.push(features.bookingFactors.hasSpecialRequests ? 1 : 0);
    } else {
      normalized.push(0, 0, 0);
    }

    return normalized;
  }

  /**
   * Extract factor contributions for explanation
   */
  private extractFactors(features: ReservationFeatures): Record<string, number> {
    const factors: Record<string, number> = {};

    if (features.customerHistory?.averageNoShowRate) {
      factors.customerHistory = features.customerHistory.averageNoShowRate;
    }

    if (features.bookingFactors?.isSameDay) {
      factors.sameDayBooking = 0.15;
    }

    if (features.timeFactors?.isWeekend) {
      factors.weekendBooking = 0.05;
    }

    return factors;
  }

  /**
   * Load ML model (placeholder for actual model loading)
   */
  async loadModel(): Promise<void> {
    try {
      // In production, load a trained TensorFlow.js model
      // For now, use rule-based prediction
      this.isModelLoaded = false;
      logger.info('Using rule-based no-show prediction');
    } catch (error) {
      logger.warn('Could not load ML model, using rule-based prediction', error);
      this.isModelLoaded = false;
    }
  }

  /**
   * Get customer reservation history for prediction
   */
  async getCustomerHistory(
    customerId: string,
    businessId?: string
  ): Promise<{
    totalReservations: number;
    noShowCount: number;
    cancellationCount: number;
    lastReservationDate?: Date;
    averageNoShowRate: number;
  }> {
    const whereClause: any = { customerId };
    if (businessId) {
      whereClause.businessId = businessId;
    }

    const [total, noShows, cancellations, lastReservation] = await Promise.all([
      prisma.reservation.count({ where: whereClause }),
      prisma.reservation.count({
        where: { ...whereClause, status: 'NO_SHOW' },
      }),
      prisma.reservation.count({
        where: { ...whereClause, status: 'CANCELLED' },
      }),
      prisma.reservation.findFirst({
        where: whereClause,
        orderBy: { reservationDate: 'desc' },
        select: { reservationDate: true },
      }),
    ]);

    const averageNoShowRate =
      total > 0 ? noShows / total : 0;

    return {
      totalReservations: total,
      noShowCount: noShows,
      cancellationCount: cancellations,
      lastReservationDate: lastReservation?.reservationDate,
      averageNoShowRate,
    };
  }

  /**
   * Get business average no-show rate
   */
  async getBusinessNoShowRate(businessId: string): Promise<number> {
    const [total, noShows] = await Promise.all([
      prisma.reservation.count({
        where: {
          businessId,
          status: { in: ['NO_SHOW', 'COMPLETED', 'CANCELLED'] },
        },
      }),
      prisma.reservation.count({
        where: { businessId, status: 'NO_SHOW' },
      }),
    ]);

    return total > 0 ? noShows / total : 0.15; // Default 15% if no data
  }

  /**
   * Get aggregated no-show analytics by day of week for a business
   */
  async getNoShowByDayOfWeek(businessId: string): Promise<{ day: number; total: number; noShows: number; rate: number }[]> {
    const reservations = await prisma.reservation.findMany({
      where: {
        businessId,
        status: { in: ['COMPLETED', 'NO_SHOW'] },
      },
      select: {
        reservationDate: true,
        status: true,
      },
    });

    const dayStats: Record<number, { total: number; noShows: number }> = {};
    for (let d = 0; d <= 6; d++) {
      dayStats[d] = { total: 0, noShows: 0 };
    }

    for (const r of reservations) {
      const day = new Date(r.reservationDate).getDay();
      dayStats[day].total++;
      if (r.status === 'NO_SHOW') dayStats[day].noShows++;
    }

    return Object.entries(dayStats).map(([day, stats]) => ({
      day: Number(day),
      total: stats.total,
      noShows: stats.noShows,
      rate: stats.total > 0 ? Math.round((stats.noShows / stats.total) * 100) : 0,
    }));
  }

  /**
   * Get no-show analytics by hour of day for heatmap
   */
  async getNoShowByHour(businessId: string): Promise<{ hour: number; total: number; noShows: number; rate: number }[]> {
    const reservations = await prisma.reservation.findMany({
      where: {
        businessId,
        status: { in: ['COMPLETED', 'NO_SHOW'] },
      },
      select: {
        reservationTime: true,
        status: true,
      },
    });

    const hourStats: Record<number, { total: number; noShows: number }> = {};
    for (let h = 0; h <= 23; h++) {
      hourStats[h] = { total: 0, noShows: 0 };
    }

    for (const r of reservations) {
      const hour = parseInt(r.reservationTime.split(':')[0], 10);
      if (!isNaN(hour)) {
        hourStats[hour].total++;
        if (r.status === 'NO_SHOW') hourStats[hour].noShows++;
      }
    }

    return Object.entries(hourStats).map(([hour, stats]) => ({
      hour: Number(hour),
      total: stats.total,
      noShows: stats.noShows,
      rate: stats.total > 0 ? Math.round((stats.noShows / stats.total) * 100) : 0,
    }));
  }
}

export const noShowPredictor = new NoShowPredictor();
