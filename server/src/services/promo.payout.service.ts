import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { blockchainService } from './blockchain.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ── Promo Payout & On-Chain Mint Service ───────────────────────────────────
// Brands fund jobs → ambassadors earn on completion → Pabandi takes 1% rake
// $PAB rewards minted on Solana when ambassadors earn reviews

const PABANDI_RAKE_BPS = 100; // 1% = 100 bps
const PAB_DECIMALS = 9;
const PAB_REVIEW_REWARD = 5; // $PAB for a verified review
const PAB_REVIEW_ZK_BONUS = 2; // extra $PAB for ZK-verified review

export const promoPayoutService = {
  // ── Job funding (brand deposits funds) ───────────────────────────────────
  async fundJob(jobId: string, brandId: string) {
    const job = await prisma.promoJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');
    if (job.brandId !== brandId) throw new Error('Not your job');
    if (job.status !== 'OPEN') throw new Error('Job not open');

    await prisma.promoJob.update({
      where: { id: jobId },
      data: { status: 'IN_PROGRESS' },
    });

    return { success: true, jobId, amount: job.budgetUsd, status: 'IN_PROGRESS' };
  },

  // ── Submit work (ambassador completes job) ────────────────────────────────
  async submitWork(data: {
    jobId: string;
    ambassadorId: string;
    contentUrl?: string;
    description?: string;
    workHash: string;
  }) {
    const job = await prisma.promoJob.findUnique({ where: { id: data.jobId } });
    if (!job) throw new Error('Job not found');
    if (job.status !== 'IN_PROGRESS') throw new Error('Job not in progress');

    const proofId = `promo_${crypto.randomBytes(8).toString('hex')}`;
    const commitment = crypto.createHash('sha256').update(`${data.ambassadorId}:${data.jobId}:${data.workHash}:pabandi-work`).digest('hex');

    const submission = await prisma.promoSubmission.create({
      data: {
        jobId: data.jobId,
        ambassadorId: data.ambassadorId,
        contentUrl: data.contentUrl || null,
        description: data.description || null,
        zkProofId: proofId,
        status: 'SUBMITTED',
      },
      include: { job: true, ambassador: true },
    });

    return { success: true, submission, proofId, commitment };
  },

  // ── Accept submission & release payout ────────────────────────────────────
  async acceptAndPay(submissionId: string, brandId: string) {
    const submission = await prisma.promoSubmission.findUnique({
      where: { id: submissionId },
      include: { job: true, ambassador: true },
    });
    if (!submission) throw new Error('Submission not found');
    if (submission.job.brandId !== brandId) throw new Error('Not your submission');

    const budget = submission.job.budgetUsd;
    const rake = (budget * PABANDI_RAKE_BPS) / 10000;
    const ambassadorEarns = budget - rake;

    await prisma.promoSubmission.update({
      where: { id: submissionId },
      data: { status: 'ACCEPTED', reviewedAt: new Date(), payoutAmount: ambassadorEarns, rakeAmount: rake },
    });

    await prisma.promoAmbassador.update({
      where: { id: submission.ambassadorId },
      data: {
        completedJobs: { increment: 1 },
        totalEarnings: { increment: ambassadorEarns },
        reputationScore: { increment: 2 },
      },
    });

    const totalAccepted = await prisma.promoSubmission.count({
      where: { jobId: submission.jobId, status: 'ACCEPTED' },
    });
    if (totalAccepted >= submission.job.maxAmbassadors) {
      await prisma.promoJob.update({
        where: { id: submission.jobId },
        data: { status: 'COMPLETED' },
      });
    }

    return {
      success: true,
      submissionId,
      ambassadorEarns,
      rake,
      jobId: submission.jobId,
    };
  },

  // ── Submit review with ZK proof + on-chain $PAB mint ──────────────────────
  async submitReview(data: {
    submissionId: string;
    ambassadorId: string;
    rating: number;
    text?: string;
    workType: string;
    zkSecret: string;
  }) {
    const submission = await prisma.promoSubmission.findUnique({
      where: { id: data.submissionId },
      include: { job: true },
    });
    if (!submission) throw new Error('Submission not found');

    const zkCommitment = crypto.createHash('sha256').update(`${data.ambassadorId}:${data.zkSecret}:pabandi-promo`).digest('hex');
    const zkProofId = `promo_zk_${crypto.randomBytes(8).toString('hex')}`;

    const review = await prisma.promoReview.create({
      data: {
        submissionId: data.submissionId,
        ambassadorId: data.ambassadorId,
        rating: data.rating,
        text: data.text || null,
        zkProofId,
        zkCommitment,
        workType: data.workType,
        verified: true,
      },
    });

    // Reward ambassador with on-chain $PAB
    const mintResult = await this.rewardReview(data.ambassadorId, true);

    return { success: true, review, zkCommitment, zkProofId, mintResult };
  },

  // ── $PAB reward: credit wallet + mint on Solana ───────────────────────────
  async rewardReview(ambassadorId: string, zkVerified: boolean) {
    const ambassador = await prisma.promoAmbassador.findUnique({ where: { id: ambassadorId } });
    if (!ambassador || !ambassador.userId) return { skipped: true };

    const amount = PAB_REVIEW_REWARD + (zkVerified ? PAB_REVIEW_ZK_BONUS : 0);

    // Credit PabWallet (off-chain accounting)
    const wallet = await prisma.pabWallet.findUnique({ where: { userId: ambassador.userId } });
    if (wallet) {
      await prisma.pabTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'EARN',
          amount,
          action: 'promo_review',
          description: `Promo review reward (${zkVerified ? 'ZK-verified' : 'standard'})`,
          refType: 'promo_review',
          refId: ambassadorId,
          balanceAfter: wallet.balance + amount,
        },
      });
      await prisma.pabWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount }, totalEarned: { increment: amount } },
      });
    }

    // Mint real $PAB on Solana if ambassador has a connected wallet
    let mintResult: any = { skipped: true };
    if (ambassador.userId) {
      const userWallet = await prisma.wallet.findUnique({ where: { userId: ambassador.userId } });
      if (userWallet?.address && userWallet.currency === 'SOL') {
        mintResult = await this.mintPabOnSolana(userWallet.address, amount, 'promo_review');
      }
    }

    return { success: true, amount, mintResult };
  },

  // ── Mint $PAB on Solana (real on-chain) ───────────────────────────────────
  async mintPabOnSolana(walletAddress: string, amount: number, rewardType: string) {
    try {
      const result = await blockchainService.executeSolanaTransfer(walletAddress, amount);
      if (result.txHash) {
        logger.info(`[Promo] Minted ${amount} PAB → ${walletAddress} (${rewardType}) tx:${result.txHash}`);
        return { success: true, txHash: result.txHash, amount };
      }
      return { success: false, error: result.error };
    } catch (e: any) {
      logger.error(`[Promo] Solana mint failed: ${e.message}`);
      return { success: false, error: e.message };
    }
  },

  // ── Verify a ZK commitment (public endpoint) ──────────────────────────────
  verifyCommitment(ambassadorId: string, secret: string, commitment: string): boolean {
    const expected = crypto.createHash('sha256').update(`${ambassadorId}:${secret}:pabandi-promo`).digest('hex');
    return expected === commitment;
  },

  // ── Get ambassador earnings ───────────────────────────────────────────────
  async getEarnings(ambassadorId: string) {
    const ambassador = await prisma.promoAmbassador.findUnique({
      where: { id: ambassadorId },
      include: {
        submissions: { where: { status: 'ACCEPTED' }, include: { job: true } },
        reviews: { where: { verified: true } },
      },
    });
    if (!ambassador) throw new Error('Ambassador not found');

    const totalEarnings = ambassador.submissions.reduce((sum: number, s: any) => sum + (s.payoutAmount || s.job?.budgetUsd || 0), 0);
    const totalReviews = ambassador.reviews.length;
    const totalPabRewards = totalReviews * (PAB_REVIEW_REWARD + PAB_REVIEW_ZK_BONUS);

    return {
      totalEarnings,
      totalReviews,
      totalPabRewards,
      completedJobs: ambassador.completedJobs,
      reputationScore: ambassador.reputationScore,
    };
  },
};
