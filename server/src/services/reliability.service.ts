import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { blockchainService } from './blockchain.service';
import { writeReliabilityScore } from './trust-core.service';
import {
  COLD_START_SCORE,
  REFERRAL_GRAPH_TRUST,
  RELIABILITY_MAX,
  RELIABILITY_MIN,
  clampReliabilityScore,
  reliabilityTier,
} from '../config/trust-weights';

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
  // Bounds now come from the shared config rather than being redeclared here.
  // They were `100`/`0` in this file, `1000`/`0` in `passport.service`, and
  // unbounded in `reviewService`. Two identical-looking private constants in
  // two files with different values is how a scale rots.
  private readonly SCORE_MAX = RELIABILITY_MAX;
  private readonly SCORE_MIN = RELIABILITY_MIN;
  
  // Elo K-factor: Maximum point swing base per interaction
  private readonly K_FACTOR = 25;

  /**
   * Determine the Context Weight (C) based on the business category (Scarcity Multiplier)
   */
  private getContextWeight(category?: string): number {
    switch (category) {
      case 'CLINIC':
        return 3.0; // High stakes medical, scarce time slots
      case 'EVENT_VENUE':
        return 2.0; // High stakes
      case 'RESTAURANT':
        return 1.5; // Restaurants have scarce tables during peak hours
      case 'SALON':
      case 'SPA':
        return 1.2; 
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
   * Determine the Actual Outcome (A) based on the event status and cancel reason
   */
  private getActualOutcome(status: string, isLateCancel: boolean, cancelReason?: string): number {
    if (status === 'COMPLETED') return 1.0;
    if (status === 'CANCELLED') {
      if (!isLateCancel) return 0.8; // Early cancel is fine
      
      // Contextual Forgiveness Analysis
      const reasonLower = (cancelReason || '').toLowerCase();
      const emergencyKeywords = ['emergency', 'hospital', 'accident', 'sick', 'medical', 'car broke'];
      const isEmergency = emergencyKeywords.some(kw => reasonLower.includes(kw));

      if (isEmergency) return 0.7; // Forgiven late cancel due to emergency
      return 0.4; // Late cancel heavily penalized
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
    reservationValue?: number,
    cancelReason?: string
  ): Promise<{ newScore: number, receipt: ScoreChangeReceipt } | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, reliabilityScore: true, firstOffenseGraceUsed: true }
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
      //
      // `S` is clamped on read, not trusted. The column's default is 750 and
      // every account created before the cold-start fix still holds it, so an
      // unclamped read fed `E = 7.5` into an Elo expectation — every legacy
      // user was treated as certain to ghost, which is precisely how the
      // high-score penalty branch (`A < E && S > 80`) came to fire for people
      // who had done nothing wrong.
      const S = clampReliabilityScore(user.reliabilityScore);
      const E = S / 100.0;
      const A = this.getActualOutcome(status, isLateCancel, cancelReason);
      
      // Asymmetric K-Factor (Easier to lose trust than gain it back if score is high)
      let dynamicK = this.K_FACTOR;
      if (A < E && S > 80) dynamicK = this.K_FACTOR * 1.5; // High tier users punished harder for ghosting
      if (A > E && S < 50) dynamicK = this.K_FACTOR * 0.8; // Low tier users climb slower

      // New Score = S + (K * C * V) * (A - E)
      const mathSwing = (dynamicK * contextWeight * valueMultiplier) * (A - E);
      let totalChange = mathSwing + streakBonus;
      let usedGracePeriod = false;

      // Determine reasoning for receipt
      let reasoning = '';
      if (status === 'COMPLETED') {
        reasoning = E > 0.8 ? 'Attendance expected due to Elite status.' : 'Great job improving your score!';
        if (streakBonus > 0) reasoning += ` Included +${streakBonus} streak bonus.`;
      } else if (status === 'NO_SHOW') {
        reasoning = `Ghosting a ${contextWeight > 1.0 ? 'high-stakes ' : ''}reservation severely drops your score.`;
      } else if (status === 'CANCELLED') {
        if (isLateCancel) {
          // Check for First-Offense Grace (6 month rolling window)
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          if (!user.firstOffenseGraceUsed || user.firstOffenseGraceUsed < sixMonthsAgo) {
            totalChange = 0; // Forgive completely
            usedGracePeriod = true;
            reasoning = 'First late cancellation in 6 months. Forgiven under the Grace Period policy.';
          } else if (A === 0.7) {
            reasoning = 'Late cancellation penalty reduced due to valid emergency reason.';
          } else {
            reasoning = 'Late cancellation penalized, but better than ghosting.';
          }
        } else {
          reasoning = 'Early cancellation acknowledged. Minor impact.';
        }
      }

      // Cap boundaries. These now delegate to the shared clamp rather than
      // re-deriving the range locally, so there is one definition of the scale.
      let newScore = S + totalChange;
      newScore = clampReliabilityScore(newScore);
      // Re-calculate actual applied change (due to caps)
      const actualAppliedChange = newScore - S;

      const receipt: ScoreChangeReceipt = {
        previousScore: S,
        newScore: Number(newScore.toFixed(1)),
        basePoints: dynamicK,
        contextWeight,
        valueMultiplier,
        expectedProbability: E,
        actualOutcome: A,
        streakBonus,
        totalChange: Number(actualAppliedChange.toFixed(1)),
        reasoning
      };

      // Persist through the single writer.
      //
      // This used to be `prisma.user.update({ data: { reliabilityScore } })`,
      // which made this the third file to write the column on a different
      // assumption about its range. `writeReliabilityScore` is the only function
      // permitted to do it, and it records an audit row carrying the Elo inputs
      // — so a customer asking "why did my score drop 4 points" gets an
      // answer derived from the same numbers that produced it.
      const persistedScore = await writeReliabilityScore('user', userId, receipt.newScore, {
        reason: reasoning,
        component: 'ELO',
        severity: receipt.totalChange < 0 ? 'negative' : receipt.totalChange > 0 ? 'positive' : 'neutral',
        metadata: {
          outcome: status,
          actualOutcome: A,
          expectedProbability: E,
          kFactor: dynamicK,
          contextWeight,
          valueMultiplier,
          streakBonus,
          reservationId: reservationId ?? null,
          usedGracePeriod,
        },
      });

      // The grace-period flag rides alongside the score. It is not a score
      // field, so it does not belong in the writer — but splitting it into a
      // second update after the score write would mean a crash between them
      // grants the grace period twice.
      if (usedGracePeriod) {
        await prisma.user.update({
          where: { id: userId },
          data: { firstOffenseGraceUsed: new Date() }
        });
      }

      logger.info(`Global Trust Update | User ${userId} | ${S} -> ${persistedScore} | Outcome: ${A}`);
      
      // Log cryptographic attestation on Solana (EAS Equivalent)
      let action: any = status === 'COMPLETED' ? 'COMPLETED_BOOKING' : (status === 'NO_SHOW' ? 'NO_SHOW' : 'LATE_CANCELLATION');
      if (reservationId) {
        const attestation = await blockchainService.logTrustAttestationOnSolana(userId, reservationId, action, { totalChange: receipt.totalChange });
        if (attestation.txHash) {
          await prisma.reservation.update({
            where: { id: reservationId },
            data: { solanaAttestationId: attestation.txHash }
          });
        }
      }
      
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
      select: { 
        reliabilityScore: true,
        referredBy: {
          select: { id: true, reliabilityScore: true }
        }
      }
    });

    if (!user) return null;

    const stats = await prisma.reservation.groupBy({
      by: ['status'],
      where: { customerId: userId },
      _count: { id: true }
    });

    const completionCount = stats.find(s => s.status === 'COMPLETED')?._count.id || 0;
    const noShowCount = stats.find(s => s.status === 'NO_SHOW')?._count.id || 0;

    let baseScore = clampReliabilityScore(user.reliabilityScore);
    let graphTrustEffect = 0;
    let graphTrustReason = '';

    // Calculate Graph Trust (Sybil Resistance / Referral Bonus)
    //
    // Thresholds shared with `badge.service` via REFERRAL_GRAPH_TRUST. These two
    // blocks were duplicated with the same numbers and the same 750-scale bug:
    // `750 >= 90` fired the bonus for every legacy referrer.
    if (user.referredBy) {
      const referrerScore = clampReliabilityScore(user.referredBy.reliabilityScore);
      if (referrerScore >= REFERRAL_GRAPH_TRUST.HIGH_REFERRER_THRESHOLD) {
        graphTrustEffect = REFERRAL_GRAPH_TRUST.HIGH_REFERRER_BONUS;
        graphTrustReason = `Referred by a Highly Reliable user (+${graphTrustEffect} Boost)`;
      } else if (referrerScore < REFERRAL_GRAPH_TRUST.LOW_REFERRER_THRESHOLD) {
        graphTrustEffect = -REFERRAL_GRAPH_TRUST.LOW_REFERRER_PENALTY;
        graphTrustReason = `Guilt by Association: Referred by an unreliable user (${graphTrustEffect} Penalty)`;
      }
    }

    const finalScore = clampReliabilityScore(baseScore + graphTrustEffect);

    return {
      score: finalScore,
      baseScore: baseScore,
      tier: reliabilityTier(finalScore),
      totalCompleted: completionCount,
      totalNoShows: noShowCount,
      graphTrust: user.referredBy ? {
        referrerScore: clampReliabilityScore(user.referredBy.reliabilityScore),
        effect: graphTrustEffect,
        reason: graphTrustReason
      } : null
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
        // Asymmetric Decay: Bad scores recover slowly (forgiveness), good scores drift faster (reversion)
        //
        // `S` is clamped before the decay is applied. Unclamped, a legacy 750
        // read as "high tier" and decayed by 2.0 forever without ever
        // approaching the target — the row could not reach the neutral band the
        // query was filtering for, so every scheduled run re-selected it.
        const S = clampReliabilityScore(user.reliabilityScore);
        let newScore = S;
        
        if (S > 80) newScore -= 2.0; // High tier decays faster if inactive
        else if (S > 50) newScore -= 1.0;
        else if (S < 30) newScore += 0.5; // Very bad scores slowly inch back to neutral
        else if (S < 50) newScore += 1.0;

        await writeReliabilityScore('user', user.id, newScore, {
          reason: 'Inactivity decay toward neutral',
          component: 'DECAY',
          // Decay is neither a reward nor a punishment; it is the absence of
          // recent evidence moving the score back toward "we do not know".
          severity: 'neutral',
          metadata: { previousUnclamped: user.reliabilityScore, decayTarget: COLD_START_SCORE },
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

// ─── CRM Client Scoring ───────────────────────────────────────────────────────
//
// Scoring used to be implemented here, in `crm-reliability.service.ts` AND in
// `trust-core.service.ts` — three copies that had already drifted apart, and two
// of which returned hardcoded constants. All three are now empty of maths; the
// single implementation lives in `trust-core.service.ts`.
//
// Re-exported so existing import paths keep working. Note `calculateClientScore`
// and `updateClientScore` are NOT re-exported: both are gone, deliberately.
// `calculateClientScore` was the fourth scoring variant (0–100, baseline 50,
// different penalties again) and `updateClientScore` had no callers — it was
// imported by `revenue.controller` and never invoked. Keeping their names
// exported would keep the appearance of a supported path.
export { refreshClientTrust, getClientStage } from './crm-reliability.service';
