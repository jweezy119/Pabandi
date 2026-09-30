import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export class ReferralFeeShareService {
  async creditReferrer({
    businessId,
    invoiceId,
    amount,
  }: {
    businessId: string;
    invoiceId: string;
    amount: number;
  }) {
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, ownerId: true, name: true },
      });

      if (!business?.ownerId) {
        logger.warn(`[ReferralFeeShare] Business ${businessId} has no owner, skipping`);
        return null;
      }

      const referral = await prisma.pabReferral.findFirst({
        where: {
          refereeId: business.ownerId,
          status: { in: ['REGISTERED', 'VESTING', 'EARNED', 'PAID'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!referral) {
        logger.info(`[ReferralFeeShare] No referral found for business owner ${business.ownerId}`);
        return null;
      }

      const referralAgeMs = Date.now() - referral.createdAt.getTime();
      const referralAgeMonths = referralAgeMs / (1000 * 60 * 60 * 24 * 30);
      const feeShareMonths = referral.feeShareMonths || 12;

      if (referralAgeMonths > feeShareMonths) {
        logger.info(`[ReferralFeeShare] Referral ${referral.id} expired after ${referralAgeMonths.toFixed(1)} months`);
        return null;
      }

      const feeSharePct = referral.feeSharePct || 5;
      const feeAmount = amount * (feeSharePct / 100);
      const feePab = this.convertToPab(feeAmount);

      if (feePab <= 0) {
        logger.warn(`[ReferralFeeShare] Calculated 0 PAB for invoice ${invoiceId}`);
        return null;
      }

      const existingEarning = await prisma.referralEarning.findFirst({
        where: { invoiceId, referralId: referral.id, status: 'pending' },
      });

      if (existingEarning) {
        logger.info(`[ReferralFeeShare] Already credited for invoice ${invoiceId}`);
        return existingEarning;
      }

      const referrerWallet = await prisma.pabWallet.findUnique({
        where: { userId: referral.referrerId },
      });

      if (!referrerWallet) {
        await prisma.pabWallet.create({
          data: { userId: referral.referrerId, balance: feePab, totalEarned: feePab },
        });
      } else {
        await prisma.pabWallet.update({
          where: { userId: referral.referrerId },
          data: { balance: { increment: feePab }, totalEarned: { increment: feePab } },
        });
      }

      const earning = await prisma.referralEarning.create({
        data: {
          referralId: referral.id,
          referrerId: referral.referrerId,
          invoiceId,
          amountPab: feePab,
          amountUsd: amount,
          feeSharePct,
          status: 'pending',
        },
      });

      await prisma.pabTransaction.create({
        data: {
          walletId: (await prisma.pabWallet.findUnique({ where: { userId: referral.referrerId } }))!.id,
          type: 'EARN',
          amount: feePab,
          action: 'referral_fee_share',
          description: `5% fee share from invoice ${invoiceId} (${business.name})`,
          balanceAfter: (await prisma.pabWallet.findUnique({ where: { userId: referral.referrerId } }))!.balance,
        },
      });

      logger.info(`[ReferralFeeShare] Credited ${feePab} PAB to referrer ${referral.referrerId} for invoice ${invoiceId}`);

      return earning;
    } catch (err: any) {
      logger.error(`[ReferralFeeShare] Error crediting referrer for invoice ${invoiceId}: ${err.message}`);
      return null;
    }
  }

  private convertToPab(usdAmount: number): number {
    const PAB_PRICE_USD = 0.01;
    return Math.round((usdAmount / PAB_PRICE_USD) * 100) / 100;
  }

  async processMonthlyPayouts() {
    const pendingEarnings = await prisma.referralEarning.findMany({
      where: { status: 'pending' },
      include: { referral: true },
    });

    logger.info(`[ReferralFeeShare] Processing ${pendingEarnings.length} pending earnings`);

    for (const earning of pendingEarnings) {
      try {
        const referrerWallet = await prisma.pabWallet.findUnique({
          where: { userId: earning.referrerId },
        });

        if (!referrerWallet) {
          await prisma.pabWallet.create({
            data: { userId: earning.referrerId, balance: earning.amountPab, totalEarned: earning.amountPab },
          });
        } else {
          await prisma.pabWallet.update({
            where: { userId: earning.referrerId },
            data: { balance: { increment: earning.amountPab }, totalEarned: { increment: earning.amountPab } },
          });
        }

        await prisma.referralEarning.update({
          where: { id: earning.id },
          data: { status: 'paid', paidAt: new Date() },
        });

        await prisma.pabTransaction.create({
          data: {
            walletId: (await prisma.pabWallet.findUnique({ where: { userId: earning.referrerId } }))!.id,
            type: 'EARN',
            amount: earning.amountPab,
            action: 'referral_fee_share_payout',
            description: `Monthly payout: ${earning.amountPab} PAB from invoice ${earning.invoiceId}`,
            balanceAfter: (await prisma.pabWallet.findUnique({ where: { userId: earning.referrerId } }))!.balance,
          },
        });

        logger.info(`[ReferralFeeShare] Paid out ${earning.amountPab} PAB for earning ${earning.id}`);
      } catch (err: any) {
        logger.error(`[ReferralFeeShare] Failed to payout earning ${earning.id}: ${err.message}`);
      }
    }
  }
}

export const referralFeeShareService = new ReferralFeeShareService();
