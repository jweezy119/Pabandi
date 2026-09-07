import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

import { solanaEscrowService } from './solana_escrow.service';
import { TrustSignals } from '../services/trustSignal.service';
import { TreasuryBucket } from '../services/treasury.service';

export const PAB_REWARD_RULES = {
  customer: {
    CHECK_IN: 50,
    GOOGLE_REVIEW: 200,
    REFERRAL: 100,
    STREAK_BONUS: 25,
  },
  business: {
    HONORED_BOOKING: 25,
    NO_SHOW_DEPOSIT_KEPT: 40,
    LOW_NO_SHOW_MONTH: 75,
    CUSTOMER_REFERRAL: 150,
    PAYOUT_TO_SOLANA: true,
  },
} as const;

export type RewardType =
  | 'RESERVATION_COMPLETION'
  | 'GOOGLE_REVIEW'
  | 'REFERRAL'
  | 'STREAK_BONUS'
  | 'BUSINESS_RESERVATION_HONORED'
  | 'BUSINESS_NO_SHOW_PROTECTED'
  | 'BUSINESS_RELIABILITY_BONUS'
  | 'BUSINESS_REFERRAL'
  | 'VERIFICATION_BOUNTY';


export class CryptoService {
  private async creditPab(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    userId: string,
    amount: number,
    type: RewardType,
    reservationId?: string,
    metadata?: any
  ) {
    await tx.cryptoReward.create({
      data: {
        userId,
        reservationId,
        amount,
        type,
        status: 'CLAIMABLE',
        metadata: metadata || null,
      },
    });

    await tx.wallet.upsert({
      where: { userId },
      update: { balance: { increment: amount } },
      create: { userId, balance: amount, currency: 'PAB' },
    });

    const treasuryBucket = this.getTreasuryBucket(type);

    if (treasuryBucket) {
      await tx.treasuryPosition.create({
        data: {
          bucket: treasuryBucket,
          amount: Number(amount) * 0.08,
          status: 'PENDING',
          meta: { source: 'CRYPTO_SERVICE_TRIBUTE', rewardType: type, reservationId: reservationId || null },
        },
      });
    }
  }

  async rewardReservationCompletion(userId: string, reservationId: string): Promise<void> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { riskScore: true, customer: { select: { reliabilityScore: true } } }
      });
      if (!reservation) return;

      let amount: number = PAB_REWARD_RULES.customer.CHECK_IN;
      const rScore = reservation.customer.reliabilityScore || 100;
      const reliabilityMultiplier = rScore / 100.0;
      const aiRisk = reservation.riskScore || 0;
      let aiBonus = 0;
      if (aiRisk >= 60) {
        aiBonus = PAB_REWARD_RULES.customer.CHECK_IN * ((aiRisk - 60) / 100.0) * 2;
      }
      const trustSignals = (reservation as any)?.trustSignals as TrustSignals | undefined;
      const trustBonus = (trustSignals?.riskDelta || 0) * (PAB_REWARD_RULES.customer.CHECK_IN / 100);
      amount = Math.floor((amount * reliabilityMultiplier) + aiBonus + trustBonus);

      logger.info(`PAB +${amount} customer ${userId} reservation ${reservationId}`);

      await prisma.$transaction(async (tx) => {
        const existing = await tx.cryptoReward.findFirst({
          where: { userId, reservationId, type: 'RESERVATION_COMPLETION' },
        });
        if (existing) return;

        await this.creditPab(tx, userId, amount, 'RESERVATION_COMPLETION', reservationId, {
          baseAmount: PAB_REWARD_RULES.customer.CHECK_IN,
          reliabilityMultiplier,
          aiBonus
        });
        await tx.reservation.update({
          where: { id: reservationId },
          data: { rewardEarned: { increment: amount } },
        });
      });
    } catch (error) {
      logger.error('Error rewarding reservation completion:', error);
      throw error;
    }
  }

  async triggerConciergeCashback(userId: string, reservationId: string): Promise<void> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { depositAmount: true, isConcierge: true }
      });
      if (!reservation || !reservation.isConcierge || !reservation.depositAmount) return;
      const amount = Math.floor(reservation.depositAmount * 0.01);
      if (amount <= 0) return;

      logger.info(`PAB +${amount} (1% Cashback) customer ${userId} via AI Concierge`);
      await prisma.$transaction(async (tx) => {
        await this.creditPab(tx, userId, amount, 'RESERVATION_COMPLETION', reservationId, {
          note: 'Concierge Cashback',
          depositAmount: reservation.depositAmount
        });
      });
    } catch (error) {
      logger.error('Error triggering concierge cashback:', error);
      throw error;
    }
  }

  async rewardBusinessForCompletion(businessId: string, reservationId: string): Promise<void> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { riskScore: true, trustSignals: true }
      });
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, ownerId: true },
      });
      if (!business) return;

      let amount: number = PAB_REWARD_RULES.business.HONORED_BOOKING;
      const aiRisk = reservation?.riskScore || 0;
      let aiBonus = 0;
      if (aiRisk >= 60) {
        aiBonus = PAB_REWARD_RULES.business.HONORED_BOOKING * ((aiRisk - 50) / 100.0) * 1.5;
      }
      amount = Math.floor(amount + aiBonus);

      await prisma.$transaction(async (tx) => {
        if (business.ownerId) {
          const existing = await tx.cryptoReward.findFirst({
            where: { userId: business.ownerId, reservationId, type: 'BUSINESS_RESERVATION_HONORED' },
          });
          if (!existing) {
            await this.creditPab(tx, business.ownerId, amount, 'BUSINESS_RESERVATION_HONORED', reservationId);
          }
        }
      });
    } catch (error) {
      logger.error('Error rewarding business completion:', error);
      throw error;
    }
  }

  async rewardBusinessNoShowProtected(businessId: string, reservationId: string): Promise<void> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { depositRequired: true, depositStatus: true, trustSignals: true },
      });
      if (!reservation?.depositRequired) return;
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { ownerId: true },
      });
      if (!business) return;

      const amount = PAB_REWARD_RULES.business.NO_SHOW_DEPOSIT_KEPT;
      await prisma.$transaction(async (tx) => {
        if (business.ownerId) {
          const existing = await tx.cryptoReward.findFirst({
            where: { userId: business.ownerId, reservationId, type: 'BUSINESS_NO_SHOW_PROTECTED' },
          });
          if (!existing) {
            await this.creditPab(tx, business.ownerId, amount, 'BUSINESS_NO_SHOW_PROTECTED', reservationId);
          }
        }
      });
    } catch (error) {
      logger.error('Error rewarding business no-show protection:', error);
      throw error;
    }
  }

  async rewardGoogleReview(userId: string, _businessId: string, _googleReviewId: string): Promise<void> {
    try {
      const amount = PAB_REWARD_RULES.customer.GOOGLE_REVIEW;
      await prisma.$transaction(async (tx) => {
        await this.creditPab(tx, userId, amount, 'GOOGLE_REVIEW');
      });
    } catch (error) {
      logger.error('Error rewarding Google review:', error);
      throw error;
    }
  }

  async connectSolanaWallet(userId: string, address: string) {
    return prisma.wallet.upsert({
      where: { userId },
      update: { address, currency: 'SOL' },
      create: { userId, address, balance: 0, currency: 'SOL' },
    });
  }

  async withdrawToSolana(userId: string, amount: number): Promise<{ txHash?: string, success: boolean, message: string }> {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < amount) throw new Error("Insufficient local PAB balance");
    if (!wallet.address || wallet.currency !== 'SOL') throw new Error("No Solana wallet connected");

    await prisma.wallet.update({
      where: { userId },
      data: { balance: { decrement: amount } }
    });

    try {
      if (!process.env.SOLANA_PRIVATE_KEY) {
        await prisma.cryptoReward.create({
          data: { userId, amount: -amount, type: 'BUSINESS_RELIABILITY_BONUS', status: 'CLAIMABLE', metadata: { note: "Simulated on-chain withdrawal" } }
        });
        return { success: true, message: "Simulated withdrawal successful" };
      }

      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      const payer = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
      const mintPublicKey = new PublicKey(process.env.SOLANA_PAB_MINT_ADDRESS!);
      const recipientPublicKey = new PublicKey(wallet.address);

      const fromAta = await getOrCreateAssociatedTokenAccount(connection, payer, mintPublicKey, payer.publicKey);
      const toAta = await getOrCreateAssociatedTokenAccount(connection, payer, mintPublicKey, recipientPublicKey);
      const amountRaw = amount * 10 ** 9;

      const txSignature = await transfer(connection, payer, fromAta.address, toAta.address, payer.publicKey, amountRaw);

      await prisma.cryptoReward.create({
        data: { userId, amount: -amount, type: 'BUSINESS_RELIABILITY_BONUS', status: 'CLAIMABLE', metadata: { note: "On-chain withdrawal", txHash: txSignature } }
      });

      return { success: true, txHash: txSignature, message: "Withdrawal successful" };
    } catch (e) {
      await prisma.wallet.update({ where: { userId }, data: { balance: { increment: amount } } });
      throw e;
    }
  }

  async getWalletData(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const rewards = await prisma.cryptoReward.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { reservation: { select: { id: true, business: { select: { name: true } } } } },
    });
    const totalEarned = await prisma.cryptoReward.aggregate({ where: { userId }, _sum: { amount: true } });

    return {
      balance: wallet?.balance || 0,
      currency: 'PAB',
      solanaAddress: wallet?.currency === 'SOL' ? wallet.address : wallet?.address,
      chain: wallet?.currency === 'SOL' ? 'solana' : wallet?.address ? 'other' : null,
      totalEarned: totalEarned._sum.amount || 0,
      recentRewards: rewards.map((r) => ({
        id: r.id, type: r.type, amount: r.amount, status: r.status,
        createdAt: r.createdAt, metadata: r.metadata,
        businessName: r.reservation?.business?.name, reservationId: r.reservationId,
      })),
    };
  }

  async getBusinessRewardsSummary(ownerId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId: ownerId } });
    const byType = await prisma.cryptoReward.groupBy({
      by: ['type'],
      where: { userId: ownerId, type: { startsWith: 'BUSINESS_' } },
      _sum: { amount: true }, _count: true,
    });
    const totalBusinessPab = byType.reduce((sum, row) => sum + (row._sum.amount || 0), 0);

    return {
      balance: wallet?.balance || 0, currency: 'PAB', totalBusinessPab,
      solanaConnected: !!(wallet?.address && wallet.currency === 'SOL'),
      solanaAddress: wallet?.currency === 'SOL' ? wallet.address : null,
      rules: PAB_REWARD_RULES.business,
      breakdown: byType.map((row) => ({ type: row.type, count: row._count, total: row._sum.amount || 0 })),
    };
  }

  getPublicRewardRules() { return PAB_REWARD_RULES; }

  signAttestationData(dataBuffer: Uint8Array): { signature: string, pubkey: string } {
    if (!process.env.SOLANA_PRIVATE_KEY) {
      return { signature: 'mock_signature_ed25519_' + Date.now(), pubkey: 'mock_public_key' };
    }
    const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
    const signature = nacl.sign.detached(dataBuffer, keypair.secretKey);
    return { signature: bs58.encode(signature), pubkey: keypair.publicKey.toBase58() };
  }

  verifyAttestationSignature(dataBuffer: Uint8Array, signatureBase58: string, pubkeyBase58: string): boolean {
    if (pubkeyBase58 === 'mock_public_key') return true;
    try {
      const signature = bs58.decode(signatureBase58);
      const pubkey = bs58.decode(pubkeyBase58);
      return nacl.sign.detached.verify(dataBuffer, signature, pubkey);
    } catch {
      return false;
    }
  }

  // DISABLED: BSC proof-of-visit (Solana-only now)
  async mintProofOfVisit(_customerWallet: string, _businessId: string, _businessName: string): Promise<{ txHash: string; tokenId: string } | null> {
    return null;
  }

  async hasVisited(_customerWallet: string, _businessId: string): Promise<boolean> {
    return false;
  }

  private getTreasuryBucket(type: RewardType) {
    const buckets: Partial<Record<RewardType, TreasuryBucket>> = {
      RESERVATION_COMPLETION: 'OPERATING',
      BUSINESS_RESERVATION_HONORED: 'OPERATING',
      BUSINESS_NO_SHOW_PROTECTED: 'OPERATING',
      GOOGLE_REVIEW: 'OPERATING',
      VERIFICATION_BOUNTY: 'TREASURY',
      BUSINESS_RELIABILITY_BONUS: 'OPERATING',
      BUSINESS_REFERRAL: 'OPERATING',
      REFERRAL: 'OPERATING',
      STREAK_BONUS: 'OPERATING',
    } as const;
    return buckets[type];
  }

  async creditTreasury(amount: number, bucket: 'OPERATING' | 'LP_PROVISION' | 'YIELD_REINVEST' | 'EMERGENCY') {
    const normalized = Number(amount || 0);
    if (!normalized || normalized <= 0) return;
    await prisma.treasuryPosition.create({
      data: { bucket, amount: normalized, status: 'PENDING', meta: { source: 'CRYPTO_SERVICE_TRIBUTE' } },
    });
  }

  calculateEscrowFee(businessTrustScore: number): number {
    if (businessTrustScore < 50) return 300;
    if (businessTrustScore <= 80) return 150;
    return 50;
  }

  // DISABLED: EVM signature generation (Solana-only now)
  async generateDynamicFeeSignature(reservationId: string, businessAddress: string, trustScore: number): Promise<{ feeBps: number, signature: string }> {
    const feeBps = this.calculateEscrowFee(trustScore);
    return { feeBps, signature: '0x' };
  }
}

export const cryptoService = new CryptoService();
