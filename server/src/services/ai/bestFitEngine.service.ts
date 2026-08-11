import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';

export interface GigOutcomeInput {
  passportId: string;
  gigId?: string;
  title: string;
  description?: string;
  scheduledDate: Date;
  locationHash?: string;
  zipCode?: string;
  status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  clientRating?: number;
  leadTimeHours?: number;
  cancellationReason?: string;
}

export interface BestFitMatch {
  passportId: string;
  handle: string;
  displayName: string;
  trustScore: number;
  gigFitness: number;
  breakdown: {
    baseTrust: number;
    behavioralSimilarity: number;
    skillMatch: number;
  };
}

export class BestFitEngineService {
  /**
   * Ingests a completed or cancelled gig, records it, and updates the provider's behavior vector.
   */
  public async ingestGigOutcome(input: GigOutcomeInput): Promise<void> {
    logger.info(`[BestFitEngine] Ingesting gig outcome for Passport ${input.passportId}`);

    const hour = input.scheduledDate.getHours();
    let timeBucket = '0-6';
    if (hour >= 6 && hour < 12) timeBucket = '6-12';
    else if (hour >= 12 && hour < 18) timeBucket = '12-18';
    else if (hour >= 18) timeBucket = '18-24';

    const dayOfWeek = input.scheduledDate.getDay();

    // 1. Save the Gig History record
    await prisma.passportGigHistory.create({
      data: {
        passportId: input.passportId,
        gigId: input.gigId,
        title: input.title,
        description: input.description,
        scheduledDate: input.scheduledDate,
        locationHash: input.locationHash,
        zipCode: input.zipCode,
        timeBucket,
        dayOfWeek,
        status: input.status,
        clientRating: input.clientRating,
        leadTimeHours: input.leadTimeHours,
        cancellationReason: input.cancellationReason,
      },
    });

    // 2. Recompute the behavior vector for this passport
    await this.recomputeVector(input.passportId);
  }

  /**
   * Recomputes the behavior vector based on all historical gigs.
   */
  private async recomputeVector(passportId: string): Promise<void> {
    const history = await prisma.passportGigHistory.findMany({
      where: { passportId },
    });

    if (history.length === 0) return;

    let timeBuckets = { '0-6': 0, '6-12': 0, '12-18': 0, '18-24': 0 };
    let daysOfWeek = [0, 0, 0, 0, 0, 0, 0];
    let totalCompleted = 0;
    let totalRated = 0;
    let sumRating = 0;
    let totalLeadTimeGigs = 0;
    let sumLeadTime = 0;

    for (const gig of history) {
      if (gig.status === 'COMPLETED') {
        totalCompleted++;
        timeBuckets[gig.timeBucket as keyof typeof timeBuckets]++;
        daysOfWeek[gig.dayOfWeek]++;
        
        if (gig.clientRating) {
          totalRated++;
          sumRating += gig.clientRating;
        }
        
        if (gig.leadTimeHours !== null) {
          totalLeadTimeGigs++;
          sumLeadTime += gig.leadTimeHours;
        }
      }
    }

    const completionRate = totalCompleted / history.length;
    const avgRating = totalRated > 0 ? (sumRating / totalRated) / 5 : 0.8; // default to 0.8 (4 stars)
    const avgLeadTimeHours = totalLeadTimeGigs > 0 ? sumLeadTime / totalLeadTimeGigs : 24;
    const normalizedLeadTime = 1 / (1 + avgLeadTimeHours); // Closer to 1 means short lead time

    // Normalize counts to percentages (0 to 1)
    const tbArray = [
      totalCompleted > 0 ? timeBuckets['0-6'] / totalCompleted : 0,
      totalCompleted > 0 ? timeBuckets['6-12'] / totalCompleted : 0,
      totalCompleted > 0 ? timeBuckets['12-18'] / totalCompleted : 0,
      totalCompleted > 0 ? timeBuckets['18-24'] / totalCompleted : 0,
    ];

    const dowArray = daysOfWeek.map(d => totalCompleted > 0 ? d / totalCompleted : 0);

    // Vector format: [ ...TimeBuckets(4), ...DaysOfWeek(7), LeadTime(1), Rating(1), CompletionRate(1) ]
    // Total 14 dimensions
    const vector = [
      ...tbArray,
      ...dowArray,
      normalizedLeadTime,
      avgRating,
      completionRate
    ];

    await prisma.passportVector.upsert({
      where: { passportId },
      create: {
        passportId,
        behaviorVector: vector,
        sampleCount: history.length
      },
      update: {
        behaviorVector: vector,
        sampleCount: history.length
      }
    });

    logger.info(`[BestFitEngine] Recomputed vector for ${passportId}. Samples: ${history.length}`);
  }

  /**
   * Predicts the best fit providers for an open gig.
   */
  public async predictBestFit(req: {
    scheduledDate: Date;
    skills: string[]; // required skills
    limit?: number;
    weights?: { baseTrust: number; temporal: number; skill: number };
  }): Promise<BestFitMatch[]> {
    const W = req.weights || { baseTrust: 0.4, temporal: 0.4, skill: 0.2 };
    
    // Construct the ideal target gig vector
    const hour = req.scheduledDate.getHours();
    let timeBucket = [0, 0, 0, 0];
    if (hour >= 6 && hour < 12) timeBucket = [0, 1, 0, 0];
    else if (hour >= 12 && hour < 18) timeBucket = [0, 0, 1, 0];
    else if (hour >= 18) timeBucket = [0, 0, 0, 1];
    else timeBucket = [1, 0, 0, 0];

    const dow = req.scheduledDate.getDay();
    const dayBucket = [0, 0, 0, 0, 0, 0, 0];
    dayBucket[dow] = 1;

    // Ideal gig target vector: matches exact time, day, fast lead time, 5 star rating, 100% completion
    const targetVector = [
      ...timeBucket,
      ...dayBucket,
      0.8, // assume ideal provider accepts ~short lead times
      1.0, // 5 star rating
      1.0  // 100% completion rate
    ];

    // Query all passports with vectors (in a real app we'd filter by category/location first)
    // We include endorsements to calculate skill match
    const passports = await prisma.trustPassport.findMany({
      where: { visibility: 'PUBLIC' },
      include: {
        vector: true,
        endorsements: true
      }
    });

    const matches: BestFitMatch[] = [];

    for (const p of passports) {
      if (!p.vector) continue;

      const providerVector = p.vector.behaviorVector as number[];
      if (!Array.isArray(providerVector) || providerVector.length !== 14) continue;

      // 1. Calculate Temporal/Behavioral Similarity
      const behavioralSimilarity = this.cosineSimilarity(targetVector, providerVector);

      // 2. Calculate Skill Match
      let skillMatch = 0;
      if (req.skills.length > 0) {
        let matchingSkills = 0;
        for (const reqSkill of req.skills) {
          const hasSkill = p.endorsements.find(e => e.skillName.toLowerCase() === reqSkill.toLowerCase());
          if (hasSkill) matchingSkills++;
        }
        skillMatch = matchingSkills / req.skills.length;
      } else {
        skillMatch = 1.0; // If no skills required, perfect match
      }

      // 3. Base Trust Score (normalize 0-1000 to 0-1)
      const baseTrust = p.riskScore ? p.riskScore / 1000 : 0.7; // default to 0.7 if unrated

      // 4. Composite Fitness
      const gigFitness = (W.baseTrust * baseTrust) + 
                         (W.temporal * behavioralSimilarity) + 
                         (W.skill * skillMatch);

      matches.push({
        passportId: p.id,
        handle: p.handle,
        displayName: p.displayName,
        trustScore: p.riskScore || 700,
        gigFitness: Math.round(gigFitness * 1000) / 1000,
        breakdown: {
          baseTrust: Math.round(baseTrust * 1000) / 1000,
          behavioralSimilarity: Math.round(behavioralSimilarity * 1000) / 1000,
          skillMatch: Math.round(skillMatch * 1000) / 1000
        }
      });
    }

    // Sort by descending fitness
    matches.sort((a, b) => b.gigFitness - a.gigFitness);

    return matches.slice(0, req.limit || 5);
  }

  // ── Utilities ─────────────────────────────────────────────────────────

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += (a[i] || 0) * (b[i] || 0);
      normA += (a[i] || 0) ** 2;
      normB += (b[i] || 0) ** 2;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

export const bestFitEngineService = new BestFitEngineService();
