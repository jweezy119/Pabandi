import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { pabStakingService } from './pab-staking.service';

const VESTING_DAYS = 90;

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
        vestingStart: new Date(),
        vestingDurationDays: VESTING_DAYS,
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
      data: { refereeId, status: 'VESTING' },
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

    const vestingStart = referral.vestingStart || referral.createdAt;
    const vestingEnd = new Date(vestingStart.getTime() + (referral.vestingDurationDays || VESTING_DAYS) * 24 * 60 * 60 * 1000);
    const now = new Date();
    const isVested = now >= vestingEnd;

    const wallet = await prisma.pabWallet.findUnique({
      where: { userId: recipientId },
    });

    if (!wallet) {
      await prisma.pabWallet.create({
        data: { userId: recipientId, balance: isVested ? bonus : 0 },
      });
    } else {
      await prisma.pabWallet.update({
        where: { userId: recipientId },
        data: { balance: isVested ? { increment: bonus } : undefined, totalEarned: { increment: bonus } },
      });
    }

    await prisma.pabTransaction.create({
      data: {
        walletId: (await prisma.pabWallet.findUnique({ where: { userId: recipientId } }))!.id,
        type: 'EARN',
        amount: bonus,
        action: isVested ? 'referral_bonus' : 'referral_bonus_vesting',
        description: isVested ? `Referral bonus: ${bonus} PAB` : `Referral bonus vesting: ${bonus} PAB (unlocks ${vestingEnd.toLocaleDateString()})`,
        balanceAfter: (await prisma.pabWallet.findUnique({ where: { userId: recipientId } }))!.balance,
      },
    });

    if (type === 'referrer') {
      await prisma.pabReferral.update({
        where: { id: referralId },
        data: { status: isVested ? 'EARNED' : 'VESTING', vestedAt: isVested ? new Date() : null },
      });
    } else {
      await prisma.pabReferral.update({
        where: { id: referralId },
        data: { status: isVested ? 'EARNED' : 'VESTING' },
      });
    }

    logger.info(`[PabReferral] Granted ${bonus} PAB to ${type} for referral ${referralId} (vested=${isVested})`);
  }

  async claimVested(referralId: string) {
    const referral = await prisma.pabReferral.findUnique({
      where: { id: referralId },
    });

    if (!referral || referral.status !== 'VESTING') {
      throw new Error('Referral not found or not in vesting status');
    }

    const vestingStart = referral.vestingStart || referral.createdAt;
    const vestingEnd = new Date(vestingStart.getTime() + (referral.vestingDurationDays || VESTING_DAYS) * 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now < vestingEnd) {
      throw new Error(`Bonus still vesting. Unlocks on ${vestingEnd.toLocaleDateString()}`);
    }

    const bonus = referral.referrerBonus;
    const recipientId = referral.referrerId;

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
        data: { balance: { increment: bonus } },
      });
    }

    await prisma.pabTransaction.create({
      data: {
        walletId: (await prisma.pabWallet.findUnique({ where: { userId: recipientId } }))!.id,
        type: 'EARN',
        amount: bonus,
        action: 'referral_bonus_claimed',
        description: `Referral bonus claimed: ${bonus} PAB`,
        balanceAfter: (await prisma.pabWallet.findUnique({ where: { userId: recipientId } }))!.balance,
      },
    });

    await prisma.pabReferral.update({
      where: { id: referralId },
      data: { status: 'EARNED', vestedAt: new Date() },
    });

    logger.info(`[PabReferral] Claimed vested bonus for referral ${referralId}`);

    return { bonus, vestedAt: new Date() };
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
      vestingReferrals: referrals.filter(r => r.status === 'VESTING').length,
    };
  }
}

export const pabReferralService = new PabReferralService();
