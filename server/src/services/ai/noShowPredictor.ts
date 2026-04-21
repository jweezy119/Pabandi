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
  };
}

export class NoShowPredictor {
  private model: tf.LayersModel | null = null;
  private isModelLoaded = false;

  /**
   * Predict no-show probability for a reservation
   */
  async predict(features: ReservationFeatures): Promise<{
    probability: number;
    riskScore: number;
    factors: Record<string, number>;
  }> {
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

      return { probability, riskScore, factors };
    } catch (error) {
      logger.error('Error in AI prediction, falling back to rule-based', error);
      return this.ruleBasedPrediction(features);
    }
  }

  /**
   * Rule-based prediction as fallback
   */
  private ruleBasedPrediction(features: ReservationFeatures): {
    probability: number;
    riskScore: number;
    factors: Record<string, number>;
  } {
    let riskScore = 30; // Base risk
    const factors: Record<string, number> = {};

    // Customer history factors
    if (features.customerHistory) {
      const { totalReservations, noShowCount, averageNoShowRate } =
        features.customerHistory;

      if (totalReservations === 0) {
        riskScore += 15; // New customer
        factors.isNewCustomer = 15;
      } else if (averageNoShowRate) {
        riskScore += averageNoShowRate * 40;
        factors.customerHistory = averageNoShowRate * 40;
      }

      if (noShowCount > 0) {
        const noShowRate = noShowCount / totalReservations;
        riskScore += noShowRate * 30;
        factors.pastNoShows = noShowRate * 30;
      }
    } else {
      riskScore += 20; // Unknown customer
      factors.unknownCustomer = 20;
    }

    // Time factors
    if (features.timeFactors) {
      const { dayOfWeek, hour, isWeekend } = features.timeFactors;

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

    // Booking factors
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

    // Business factors
    if (features.businessFactors) {
      const { averageNoShowRate, businessRating } = features.businessFactors;
      riskScore += averageNoShowRate * 20;
      factors.businessAverage = averageNoShowRate * 20;

      // Adjust risk based on business rating/reliability
      if (businessRating && businessRating < 3.5) {
        riskScore += 10;
        factors.lowBusinessRating = 10;
      }
    }

    // Cap risk score between 0 and 100
    riskScore = Math.max(0, Math.min(100, riskScore));
    const probability = riskScore / 100;

    return { probability, riskScore, factors };
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
}

export const noShowPredictor = new NoShowPredictor();
