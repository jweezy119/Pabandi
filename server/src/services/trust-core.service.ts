import { prisma } from '../utils/database';
import { eventBus } from './event-bus.service';

export class TrustCoreService {
  // ── PASSPORT ─────────────────────────────────────────

  async getPassport(userId: string) {
    let passport = await prisma.walletPassport.findUnique({
      where: { userId },
    });

    if (!passport) {
      passport = await prisma.walletPassport.create({
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

    const updated = await prisma.walletPassport.update({
      where: { userId },
      data: {
        score: newScore,
        level,
      },
    });

    await eventBus.emitEvent('trust.score.changed', { userId, newScore, delta, reason });
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
    console.log(`[TrustCore] Awarding ${amount} PAB to ${userId} for: ${reason}`);
    return { success: true, amount, reason };
  }

  // ── ESCROW ──────────────────────────────────────────

  async getEscrowAvailable(userId: string): Promise<boolean> {
    const score = await this.calculateScore(userId);
    return score >= 30;
  }

  async getDiscountTier(userId: string): Promise<number> {
    const score = await this.calculateScore(userId);
    if (score >= 90) return 0.15;
    if (score >= 70) return 0.10;
    if (score >= 50) return 0.05;
    return 0;
  }

  // ── CROSS-MODULE LINKS ──────────────────────────────

  async linkToPipeline(passportId: string) {
    const passport = await prisma.walletPassport.findUnique({
      where: { id: passportId },
    });
    if (!passport) return null;

    return {
      passportId: passport.id,
      score: passport.score,
      level: passport.level,
      verified: passport.verified,
    };
  }

  async linkToLedger(passportId: string) {
    const passport = await prisma.walletPassport.findUnique({
      where: { id: passportId },
    });
    if (!passport) return null;

    return {
      passportId: passport.id,
      score: passport.score,
      suggestedTerms: passport.score >= 80 ? 'net-30' : passport.score >= 50 ? 'net-15' : 'prepayment',
      creditLimit: passport.score * 100,
    };
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
