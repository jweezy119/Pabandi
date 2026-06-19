import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export interface ScoreChangeReceipt {
  previousScore: number;
  newScore: number;
  basePoints: number;
  contextWeight: number;
  valueMultiplier: number;
  expectedProbability: number;
  actualOutcome: number;
  streakBonus: number;
  totalChange: number;
  reasoning: string;
}

export class ReliabilityService {
  private readonly SCORE_MAX = 100;
  private readonly SCORE_MIN = 0;
  
  // Elo K-factor: Maximum point swing base per interaction
  private readonly K_FACTOR = 25;

  /**
   * Determine the Context Weight (C) based on the business category
   */
  private getContextWeight(category?: string): number {
    switch (category) {
      case 'CLINIC':
        return 2.0; // High stakes medical
      case 'EVENT_VENUE':
        return 1.2; // Slightly higher stakes
      case 'RESTAURANT':
      case 'SALON':
      case 'SPA':
      case 'FITNESS_CENTER':
      default:
        return 1.0; // Standard context
    }
  }

  /**
   * Determine the Value Multiplier based on financial context (Skin in the Game)
   */
  private calculateValueMultiplier(reservationValue?: number): number {
    if (reservationValue === undefined || reservationValue <= 0) return 1.0;
    
    if (reservationValue < 20) return 0.8; // Low stakes
    if (reservationValue < 100) return 1.0; // Standard stakes
    if (reservationValue < 500) return 1.5; // Medium stakes
    if (reservationValue < 1000) return 2.0; // High stakes
    if (reservationValue < 5000) return 3.0; // Very high stakes
    return 5.0; // Whale stakes
  }

  /**
   * Determine the Actual Outcome (A) based on the event status
   */
  private getActualOutcome(status: string, isLateCancel: boolean): number {
    if (status === 'COMPLETED') return 1.0;
    if (status === 'CANCELLED') {
      return isLateCancel ? 0.4 : 0.8; // Early cancel is fine, late cancel is heavily penalized but better than ghosting
    }
    return 0.0; // NO_SHOW
  }

  /**
   * The Global Trust Protocol: Update a user's reliability score using the Elo algorithm
   */
  async updateScoreForReservationActivity(
    userId: string, 
    status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED',
    isLateCancel: boolean = false,
    reservationId?: string,
    reservationValue?: number
  ): Promise<{ newScore: number, receipt: ScoreChangeReceipt } | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, reliabilityScore: true }
      });

      if (!user) {
        logger.warn(`Cannot update reliability for unknown user: ${userId}`);
        return null;
      }

      // Fetch Context
      let contextWeight = 1.0;
      let streakBonus = 0;
      let valueMultiplier = this.calculateValueMultiplier(reservationValue);
      
      if (reservationId) {
        const reservation = await prisma.reservation.findUnique({
          where: { id: reservationId },
          include: { business: true }
        });
        if (reservation?.business?.category) {
          contextWeight = this.getContextWeight(reservation.business.category);
        }

        // Calculate Streak (consecutive completed)
        if (status === 'COMPLETED') {
          const pastRes = await prisma.reservation.findMany({
            where: { customerId: userId, status: { in: ['COMPLETED', 'NO_SHOW'] } },
            orderBy: { reservationDate: 'desc' },
            take: 5
          });
          
          let streak = 0;
          for (const res of pastRes) {
            if (res.status === 'COMPLETED') streak++;
            else break;
          }
          if (streak >= 3) streakBonus = 2; // Flat +2 for being on a streak
        }
      }

      // Elo Math
      const S = user.reliabilityScore;
      const E = S / 100.0;
      const A = this.getActualOutcome(status, isLateCancel);
      
      // New Score = S + (K * C * V) * (A - E)
      const mathSwing = (this.K_FACTOR * contextWeight * valueMultiplier) * (A - E);
      let totalChange = mathSwing + streakBonus;

      // Determine reasoning for receipt
      let reasoning = '';
      if (status === 'COMPLETED') {
        reasoning = E > 0.8 ? 'Attendance expected due to Elite status.' : 'Great job improving your score!';
        if (streakBonus > 0) reasoning += ` Included +${streakBonus} streak bonus.`;
      } else if (status === 'NO_SHOW') {
        reasoning = `Ghosting a ${contextWeight > 1.0 ? 'high-stakes ' : ''}reservation severely drops your score.`;
      } else if (status === 'CANCELLED') {
        reasoning = isLateCancel 
          ? 'Late cancellation penalized, but better than ghosting.' 
          : 'Early cancellation acknowledged. Minor impact.';
      }

      // Cap boundaries
      let newScore = S + totalChange;
      newScore = Math.max(this.SCORE_MIN, Math.min(this.SCORE_MAX, newScore));
      // Re-calculate actual applied change (due to caps)
      const actualAppliedChange = newScore - S;

      const receipt: ScoreChangeReceipt = {
        previousScore: S,
        newScore: Number(newScore.toFixed(1)),
        basePoints: this.K_FACTOR,
        contextWeight,
        valueMultiplier,
        expectedProbability: E,
        actualOutcome: A,
        streakBonus,
        totalChange: Number(actualAppliedChange.toFixed(1)),
        reasoning
      };

      await prisma.user.update({
        where: { id: userId },
        data: { reliabilityScore: receipt.newScore }
      });

      logger.info(`Global Trust Update | User ${userId} | ${S} -> ${receipt.newScore} | Outcome: ${A}`);
      
      return { newScore: receipt.newScore, receipt };
    } catch (error) {
      logger.error('Error updating user reliability score:', error);
      throw error;
    }
  }

  /**
   * Fetches the formatted reliability profile of a user
   */
  async getUserReliabilityProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reliabilityScore: true }
    });

    if (!user) return null;

    const stats = await prisma.reservation.groupBy({
      by: ['status'],
      where: { customerId: userId },
      _count: { id: true }
    });

    const completionCount = stats.find(s => s.status === 'COMPLETED')?._count.id || 0;
    const noShowCount = stats.find(s => s.status === 'NO_SHOW')?._count.id || 0;

    return {
      score: user.reliabilityScore,
      tier: user.reliabilityScore >= 80 ? 'EXCELLENT' : (user.reliabilityScore >= 50 ? 'AVERAGE' : 'RISKY'),
      totalCompleted: completionCount,
      totalNoShows: noShowCount
    };
  }

  /**
   * Run periodically to apply velocity decay to user reliability scores.
   * If a user hasn't made a booking in a long time, their score decays towards 50.
   */
  async applyTimeDecay() {
    try {
      // Find users whose last reservation was more than 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const usersToDecay = await prisma.user.findMany({
        where: {
          role: 'CUSTOMER',
          // Only decay if their score is significantly different from 50
          NOT: {
            reliabilityScore: {
              gte: 48,
              lte: 52
            }
          },
          reservations: {
            none: {
              createdAt: {
                gte: thirtyDaysAgo
              }
            }
          }
        },
        select: { id: true, reliabilityScore: true }
      });

      let updatedCount = 0;
      for (const user of usersToDecay) {
        // Decay by 1 point towards 50
        const S = user.reliabilityScore;
        let newScore = S;
        if (S > 50) newScore -= 1;
        else if (S < 50) newScore += 1;

        await prisma.user.update({
          where: { id: user.id },
          data: { reliabilityScore: newScore }
        });
        updatedCount++;
      }

      logger.info(`Velocity Decay Processed: Decayed scores for ${updatedCount} inactive users.`);
      return updatedCount;
    } catch (error) {
      logger.error('Error applying time decay:', error);
      throw error;
    }
  }
}

export const reliabilityService = new ReliabilityService();
