import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export class ReliabilityService {
  private readonly SCORE_MAX = 100;
  private readonly SCORE_MIN = 0;
  
  private readonly REWARD_COMPLETION = 5;
  private readonly PENALTY_NO_SHOW = -15;
  private readonly PENALTY_LATE_CANCEL = -5;

  /**
   * Update a user's reliability score when a reservation concludes
   */
  async updateScoreForReservationActivity(
    userId: string, 
    status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED',
    isLateCancel: boolean = false
  ): Promise<number | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, reliabilityScore: true }
      });

      if (!user) {
        logger.warn(`Cannot update reliability for unknown user: ${userId}`);
        return null;
      }

      let adjustment = 0;
      switch (status) {
        case 'COMPLETED':
          adjustment = this.REWARD_COMPLETION;
          break;
        case 'NO_SHOW':
          adjustment = this.PENALTY_NO_SHOW;
          break;
        case 'CANCELLED':
          adjustment = isLateCancel ? this.PENALTY_LATE_CANCEL : 0;
          break;
      }

      if (adjustment === 0) return user.reliabilityScore;

      let newScore = user.reliabilityScore + adjustment;
      newScore = Math.max(this.SCORE_MIN, Math.min(this.SCORE_MAX, newScore));

      await prisma.user.update({
        where: { id: userId },
        data: { reliabilityScore: newScore }
      });

      logger.info(`Updated reliability score for user ${userId}: ${user.reliabilityScore} -> ${newScore}`);
      
      return newScore;
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
}

export const reliabilityService = new ReliabilityService();
