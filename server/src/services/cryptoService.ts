import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export class CryptoService {
    private readonly REWARD_AMOUNT_RESERVATION = 10; // 10 PAB tokens for customer
    private readonly REWARD_AMOUNT_BUSINESS_RESERVATION = 15; // 15 PAB tokens for business
    private readonly REWARD_AMOUNT_REVIEW = 5;       // 5 PAB tokens

    /**
     * Reward user for completing a reservation
     */
    async rewardReservationCompletion(userId: string, reservationId: string): Promise<void> {
        try {
            logger.info(`Rewarding user ${userId} for reservation ${reservationId}`);

            await prisma.$transaction(async (tx) => {
                // Create reward record
                await tx.cryptoReward.create({
                    data: {
                        userId,
                        reservationId,
                        amount: this.REWARD_AMOUNT_RESERVATION,
                        type: 'RESERVATION_COMPLETION',
                    },
                });

                // Update wallet balance
                await tx.wallet.upsert({
                    where: { userId },
                    update: { balance: { increment: this.REWARD_AMOUNT_RESERVATION } },
                    create: { userId, balance: this.REWARD_AMOUNT_RESERVATION },
                });

                // Update reservation to record reward
                await tx.reservation.update({
                    where: { id: reservationId },
                    data: { rewardEarned: { increment: this.REWARD_AMOUNT_RESERVATION } },
                });
            });
        } catch (error) {
            logger.error('Error rewarding reservation completion:', error);
            throw error;
        }
    }

    /**
     * Reward a business owner for successfully honoring a reservation
     */
    async rewardBusinessForCompletion(businessId: string, reservationId: string): Promise<void> {
        try {
            const business = await prisma.business.findUnique({
                where: { id: businessId },
                select: { ownerId: true }
            });

            if (!business) return;

            logger.info(`Rewarding business owner ${business.ownerId} for reservation ${reservationId}`);

            await prisma.$transaction(async (tx) => {
                await tx.cryptoReward.create({
                    data: {
                        userId: business.ownerId,
                        reservationId,
                        amount: this.REWARD_AMOUNT_BUSINESS_RESERVATION,
                        type: 'BUSINESS_RESERVATION_HONORED',
                    },
                });

                await tx.wallet.upsert({
                    where: { userId: business.ownerId },
                    update: { balance: { increment: this.REWARD_AMOUNT_BUSINESS_RESERVATION } },
                    create: { userId: business.ownerId, balance: this.REWARD_AMOUNT_BUSINESS_RESERVATION },
                });
            });
        } catch (error) {
            logger.error('Error rewarding business completion:', error);
            throw error;
        }
    }

    /**
     * Reward user for leaving a Google review
     */
    async rewardGoogleReview(userId: string, businessId: string, googleReviewId: string): Promise<void> {
        try {
            logger.info(`Rewarding user ${userId} for Google review ${googleReviewId}`);

            await prisma.$transaction(async (tx) => {
                await tx.cryptoReward.create({
                    data: {
                        userId,
                        amount: this.REWARD_AMOUNT_REVIEW,
                        type: 'GOOGLE_REVIEW',
                    },
                });

                await tx.wallet.upsert({
                    where: { userId },
                    update: { balance: { increment: this.REWARD_AMOUNT_REVIEW } },
                    create: { userId, balance: this.REWARD_AMOUNT_REVIEW },
                });
            });
        } catch (error) {
            logger.error('Error rewarding Google review:', error);
            throw error;
        }
    }

    /**
     * Get user wallet balance and rewards
     */
    async getWalletData(userId: string) {
        const wallet = await prisma.wallet.findUnique({
            where: { userId },
        });

        const rewards = await prisma.cryptoReward.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        return {
            balance: wallet?.balance || 0,
            currency: wallet?.currency || 'PAB',
            address: wallet?.address,
            recentRewards: rewards,
        };
    }
}

export const cryptoService = new CryptoService();
