import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { pabStakingService } from './pab-staking.service';

export class PabReferralService {
  async createReferral(referrerId: string, refereeEmail: string) {
    const existing = await prisma.pabReferral.findFirst({
      where: { refereeEmail, status: { not: 'PAID' } },
    });

    if (existing) {
      return existing;
    }

    return prisma.pabReferral.create({
      data: {
        referrerId,
        refereeEmail,
        status: 'PENDING',
        referrerBonus: 200,
        refereeBonus: 500,
        feeSharePct: 5,
        feeShareMonths: 12,
      } as any,
    });
  }

  async completeRegistration(refereeId: string, refereeEmail: string) {
    const referral = await prisma.pabReferral.findFirst({
      where: { refereeEmail, status: 'PENDING' },
    });

    if (!referral) {
      return null;
    }

    const updated = await prisma.pabReferral.update({
      where: { id: referral.id },
      data: { refereeId, status: 'REGISTERED' },
    });

    await this.grantBonus(updated.id, 'referee');

    logger.info(`[PabReferral] Referee ${refereeEmail} registered via referrer ${updated.referrerId}`);

    return updated;
  }

  async grantBonus(referralId: string, type: 'referrer' | 'referee') {
    const referral = await prisma.pabReferral.findUnique({
      where: { id: referralId },
    });

    if (!referral) return;

    const bonus = type === 'referrer' ? referral.referrerBonus : referral.refereeBonus;
    const recipientId = type === 'referrer' ? referral.referrerId : referral.refereeId;

    if (!recipientId) return;

    const wallet = await prisma.pabWallet.findUnique({
      where: { userId: recipientId },
    });

    if (!wallet) {
      await prisma.pabWallet.create({
        data: { userId: recipientId, balance: bonus },
      });
    } else {
      await prisma.pabWallet.update({
        where: { userId: recipientId },
        data: { balance: { increment: bonus }, totalEarned: { increment: bonus } },
      });
    }

    await prisma.pabTransaction.create({
      data: {
        walletId: (await prisma.pabWallet.findUnique({ where: { userId: recipientId } }))!.id,
        type: 'EARN',
        amount: bonus,
        action: 'referral_bonus',
        description: `Referral bonus: ${bonus} PAB`,
        balanceAfter: (await prisma.pabWallet.findUnique({ where: { userId: recipientId } }))!.balance,
      },
    });

    if (type === 'referrer') {
      await prisma.pabReferral.update({
        where: { id: referralId },
        data: { status: 'EARNED', vestedAt: new Date() },
      });
    } else {
      await prisma.pabReferral.update({
        where: { id: referralId },
        data: { status: 'REGISTERED' },
      });
    }

    logger.info(`[PabReferral] Granted ${bonus} PAB to ${type} for referral ${referralId}`);
  }

  async getReferrals(userId: string) {
    return prisma.pabReferral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReferralStats(userId: string) {
    const referrals = await prisma.pabReferral.findMany({
      where: { referrerId: userId },
    });

    const totalEarned = referrals.reduce((sum, r) => {
      return sum + (r.status === 'EARNED' || r.status === 'PAID' ? r.referrerBonus : 0);
    }, 0);

    const activeReferrals = referrals.filter(r => r.status === 'EARNED' || r.status === 'PAID').length;

    return {
      totalReferrals: referrals.length,
      activeReferrals,
      totalEarned,
      pendingReferrals: referrals.filter(r => r.status === 'PENDING').length,
    };
  }
}

export const pabReferralService = new PabReferralService();
