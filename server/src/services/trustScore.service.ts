import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { trustAuditWriter } from './trustAuditWriter';

export interface TrustInputs {
  reliability: { completed: number; noShows: number; cancellations: number };
  osint: { breachCount: number; domainAgeDays: number; voipLikelihood: number };
  social: { witnessCount: number; vouchScore: number };
  behavior: { avgResponseMinutes: number; prepayCompliance: number };
}

export class TrustScoreService {
  /**
   * Adaptive Bayesian-inspired scoring logic.
   * Gets smarter and shifts weights based on the density of positive/negative outcomes.
   */
  public calculateCompositeScore(inputs: TrustInputs): { score: number, weights: any } {
    // 1. Adaptive Weights based on data density
    const reliabilityWeight = inputs.reliability.completed > 10 ? 0.40 : 0.25;
    const osintWeight = 0.25;
    const socialWeight = inputs.social.witnessCount > 3 ? 0.20 : 0.10;
    
    // Remaining weight goes to behavior
    const behaviorWeight = 1.0 - (reliabilityWeight + osintWeight + socialWeight);

    // 2. Score calculations (0-100 scales)
    
    // Reliability Score
    let rScore = 75; // baseline
    if (inputs.reliability.completed > 0 || inputs.reliability.noShows > 0) {
      const total = inputs.reliability.completed + inputs.reliability.noShows + inputs.reliability.cancellations;
      const successRate = inputs.reliability.completed / total;
      rScore = successRate * 100;
      if (inputs.reliability.noShows > 0) {
        rScore -= (inputs.reliability.noShows * 15); // heavy penalty for no-shows
      }
    }
    
    // OSINT Score
    let oScore = 80; // baseline
    if (inputs.osint.breachCount > 0) oScore -= (inputs.osint.breachCount * 10);
    if (inputs.osint.voipLikelihood > 0.5) oScore -= 20;
    if (inputs.osint.domainAgeDays < 30) oScore -= 15;
    if (inputs.osint.domainAgeDays > 365) oScore += 10;
    
    // Social Score
    let sScore = 50; // neutral baseline
    if (inputs.social.witnessCount > 0) {
      sScore = Math.min(100, 50 + (inputs.social.vouchScore * inputs.social.witnessCount));
    }
    
    // Behavior Score
    let bScore = 60;
    if (inputs.behavior.avgResponseMinutes < 60) bScore += 15;
    if (inputs.behavior.prepayCompliance > 0.8) bScore += 15;
    
    // 3. Composite weighted sum
    let composite = (rScore * reliabilityWeight) + (oScore * osintWeight) + (sScore * socialWeight) + (bScore * behaviorWeight);
    
    // Clamp between 0 and 100
    composite = Math.max(0, Math.min(100, composite));
    
    return {
      score: Math.round(composite * 10) / 10,
      weights: { reliabilityWeight, osintWeight, socialWeight, behaviorWeight }
    };
  }

  /**
   * Computes the "Trust Velocity" over the last 30 days.
   */
  public async computeVelocity(userId: string) {
    const audits = await prisma.trustAuditTrail.findMany({
      where: { 
        userId, 
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
      },
      orderBy: { createdAt: 'asc' }
    });

    if (audits.length === 0) {
      return { slope30d: 0, streak: 0, label: 'STABLE' };
    }

    const firstScore = audits[0].previousScore;
    const lastScore = audits[audits.length - 1].newScore;
    const slope30d = lastScore - firstScore;

    let streak = 0;
    for (let i = audits.length - 1; i >= 0; i--) {
      if (audits[i].newScore >= audits[i].previousScore) {
        streak++;
      } else {
        break; // Streak broken
      }
    }

    let label = 'STABLE';
    if (slope30d > 5) label = 'RISING_STAR';
    else if (slope30d < -5) label = 'DECLINING';
    else if (streak > 5) label = 'STEADY_CHAMPION';

    return { slope30d, streak, label };
  }

  /**
   * Process a new event, recalculate score, and write to audit trail.
   */
  public async processEvent(userId: string, event: {
    component: string,
    reason: string,
    severity: 'positive' | 'neutral' | 'negative',
    osintData?: any
  }) {
    // 1. Load user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        reservations: true,
      }
    });

    if (!user) return;

    // Build inputs for Bayesian engine (Stubbing some of this for now based on available DB models)
    const completed = user.reservations.filter(r => r.status === 'COMPLETED').length;
    const noShows = user.reservations.filter(r => r.status === 'NO_SHOW').length;
    const cancellations = user.reservations.filter(r => r.status === 'CANCELLED').length;

    // Mocking other inputs based on event.osintData for the demo
    const breachCount = event.osintData?.breachCount || 0;
    const domainAgeDays = event.osintData?.domainAgeDays || 365;
    const voipLikelihood = event.osintData?.voipLikelihood || 0;

    const inputs: TrustInputs = {
      reliability: { completed, noShows, cancellations },
      osint: { breachCount, domainAgeDays, voipLikelihood },
      social: { witnessCount: 0, vouchScore: 0 },
      behavior: { avgResponseMinutes: 120, prepayCompliance: 1.0 }
    };

    // 2. Calculate New Score
    const previousScore = user.trustScore;
    const { score: newScore, weights } = this.calculateCompositeScore(inputs);

    // If score didn't change and it's not a severe event, we might skip logging to save space,
    // but for the demo we log it so the user sees the timeline.
    
    // 3. Queue Audit Log
    await trustAuditWriter.enqueue({
      userId,
      previousScore,
      newScore,
      changeReason: event.reason,
      component: event.component,
      severity: event.severity,
      weightUsed: weights.osintWeight, // Can dynamically log which weight was dominant
      methodology: '1.0.0',
      metadata: event.osintData
    });

    // 4. Determine Verification Tier
    let newTier = 'BASIC';
    if (newScore >= 80) newTier = 'ENHANCED';
    if (newScore < 50) newTier = 'CONDITIONAL';
    if (newScore < 20) newTier = 'RESTRICTED';

    // 5. Update User Record
    await prisma.user.update({
      where: { id: userId },
      data: {
        trustScore: newScore,
        verificationTier: newTier
      }
    });

    logger.info(`[TrustScoreService] User ${userId} score updated from ${previousScore} to ${newScore}`);
  }
}

export const trustScoreService = new TrustScoreService();
