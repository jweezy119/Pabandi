import { prisma } from '../utils/database';

export class TrustCoreService {
  // ── PASSPORT ─────────────────────────────────────────

  async getPassport(userId: string) {
    let passport = await prisma.trustPassport.findUnique({
      where: { userId },
    });

    if (!passport) {
      passport = await prisma.trustPassport.create({
        data: {
          userId,
          score: 50,
          level: 'bronze',
          verified: false,
        },
      });
    }

    return passport;
  }

  async calculateScore(userId: string): Promise<number> {
    const passport = await this.getPassport(userId);
    return passport.score;
  }

  async updateScore(userId: string, delta: number, reason: string) {
    const passport = await this.getPassport(userId);
    const newScore = Math.max(0, Math.min(100, passport.score + delta));
    const level = this.getLevel(newScore);

    const updated = await prisma.trustPassport.update({
      where: { userId },
      data: {
        score: newScore,
        level,
      },
    });

    // Emit event for cross-module updates
    await this.emitEvent('trust.score.changed', { userId, newScore, delta, reason });

    return updated;
  }

  // ── RISK ASSESSMENT ─────────────────────────────────

  async checkRisk(userId: string): Promise<'low' | 'medium' | 'high'> {
    const score = await this.calculateScore(userId);
    if (score >= 70) return 'low';
    if (score >= 40) return 'medium';
    return 'high';
  }

  // ── REWARDS ─────────────────────────────────────────

  async awardPAB(userId: string, amount: number, reason: string) {
    // In production: mint/transfer PAB tokens on Solana
    console.log(`[TrustCore] Awarding ${amount} PAB to ${userId} for: ${reason}`);
    return { success: true, amount, reason };
  }

  // ── ESCROW ──────────────────────────────────────────

  async getEscrowAvailable(userId: string): Promise<boolean> {
    const score = await this.calculateScore(userId);
    return score >= 30; // Minimum score for escrow
  }

  async getDiscountTier(userId: string): Promise<number> {
    const score = await this.calculateScore(userId);
    if (score >= 90) return 0.15; // 15% discount
    if (score >= 70) return 0.10; // 10% discount
    if (score >= 50) return 0.05; // 5% discount
    return 0;
  }

  // ── CROSS-MODULE LINKS ──────────────────────────────

  async linkToPipeline(passportId: string) {
    const passport = await prisma.trustPassport.findUnique({
      where: { id: passportId },
    });
    if (!passport) return null;

    // In production: enrich lead with trust data
    return {
      passportId: passport.id,
      score: passport.score,
      level: passport.level,
      verified: passport.verified,
    };
  }

  async linkToLedger(passportId: string) {
    const passport = await prisma.trustPassport.findUnique({
      where: { id: passportId },
    });
    if (!passport) return null;

    // In production: suggest credit terms based on trust
    return {
      passportId: passport.id,
      score: passport.score,
      suggestedTerms: passport.score >= 80 ? 'net-30' : passport.score >= 50 ? 'net-15' : 'prepayment',
      creditLimit: passport.score * 100, // $100 per point
    };
  }

  // ── EVENTS ──────────────────────────────────────────

  private async emitEvent(event: string, data: any) {
    // In production: publish to event bus (Redis, RabbitMQ, etc.)
    console.log(`[TrustCore] Event: ${event}`, data);
  }

  // ── HELPERS ─────────────────────────────────────────

  private getLevel(score: number): string {
    if (score >= 90) return 'platinum';
    if (score >= 70) return 'gold';
    if (score >= 50) return 'silver';
    return 'bronze';
  }
}

export const trustCore = new TrustCoreService();
