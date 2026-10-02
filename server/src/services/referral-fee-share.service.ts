import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { PAB_USD_PRICE } from '../config/tokenomics';

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

      // The earning is recorded here as PENDING and nothing is credited to the
      // wallet yet.
      //
      // It used to increment PabWallet.balance right here, AND
      // processMonthlyPayouts incremented the same rows again when flipping
      // pending -> paid. Nothing debits in between, so referrers were paid the
      // fee share twice: 10% of invoice value instead of 5%. The monthly cron
      // at index.ts made this monthly and compounding.
      //
      // Crediting only on payout is the model the field names already describe —
      // status 'pending' with a paidAt implies money is not available until the
      // payout runs, and the two distinct PabTransaction actions
      // ('referral_fee_share' vs 'referral_fee_share_payout') only make sense
      // as accrue-then-pay.
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

      logger.info(
        `[ReferralFeeShare] Accrued ${feePab} PAB for referrer ${referral.referrerId} on invoice ${invoiceId}. ` +
          'Credited to the wallet when the monthly payout runs.',
      );

      return earning;
    } catch (err: any) {
      logger.error(`[ReferralFeeShare] Error crediting referrer for invoice ${invoiceId}: ${err.message}`);
      return null;
    }
  }

  private convertToPab(usdAmount: number): number {
    return Math.round((usdAmount / PAB_USD_PRICE) * 100) / 100;
  }

  async processMonthlyPayouts() {
    const pendingEarnings = await prisma.referralEarning.findMany({
      where: { status: 'pending' },
      include: { referral: true },
    });

    logger.info(`[ReferralFeeShare] Processing ${pendingEarnings.length} pending earnings`);

    for (const earning of pendingEarnings) {
      try {
        // Claim the row first, atomically. updateMany on the status predicate
        // means a concurrent cron run gets count 0 and skips it — the same
        // compare-and-set pattern the reconciliation idempotency guard uses.
        // Without this, two overlapping runs would both pay the same earning.
        const claimed = await prisma.referralEarning.updateMany({
          where: { id: earning.id, status: 'pending' },
          data: { status: 'paid', paidAt: new Date() },
        });

        if (claimed.count === 0) {
          logger.info(`[ReferralFeeShare] Earning ${earning.id} already claimed by another run; skipping`);
          continue;
        }

        // This is now the only place a referral fee share reaches a wallet.
        const wallet = await prisma.pabWallet.upsert({
          where: { userId: earning.referrerId },
          create: {
            userId: earning.referrerId,
            balance: earning.amountPab,
            totalEarned: earning.amountPab,
          },
          update: {
            balance: { increment: earning.amountPab },
            totalEarned: { increment: earning.amountPab },
          },
        });

        await prisma.pabTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'EARN',
            amount: earning.amountPab,
            action: 'referral_fee_share_payout',
            description: `Monthly payout: ${earning.amountPab} PAB from invoice ${earning.invoiceId}`,
            balanceAfter: wallet.balance,
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
