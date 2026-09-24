"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promoPayoutService = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const blockchain_service_1 = require("./blockchain.service");
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
// ── Promo Payout & On-Chain Mint Service ───────────────────────────────────
// Brands fund jobs → ambassadors earn on completion → Pabandi takes 1% rake
// $PAB rewards minted on Solana when ambassadors earn reviews
const PABANDI_RAKE_BPS = 100; // 1% = 100 bps
const PAB_DECIMALS = 9;
const PAB_REVIEW_REWARD = 5; // $PAB for a verified review
const PAB_REVIEW_ZK_BONUS = 2; // extra $PAB for ZK-verified review
exports.promoPayoutService = {
    // ── Job funding (brand deposits funds) ───────────────────────────────────
    async fundJob(jobId, brandId) {
        const job = await prisma.promoJob.findUnique({ where: { id: jobId } });
        if (!job)
            throw new Error('Job not found');
        if (job.brandId !== brandId)
            throw new Error('Not your job');
        if (job.status !== 'OPEN')
            throw new Error('Job not open');
        await prisma.promoJob.update({
            where: { id: jobId },
            data: { status: 'IN_PROGRESS' },
        });
        return { success: true, jobId, amount: job.budgetUsd, status: 'IN_PROGRESS' };
    },
    // ── Submit work (ambassador completes job) ────────────────────────────────
    async submitWork(data) {
        const job = await prisma.promoJob.findUnique({ where: { id: data.jobId } });
        if (!job)
            throw new Error('Job not found');
        if (job.status !== 'IN_PROGRESS')
            throw new Error('Job not in progress');
        const proofId = `promo_${crypto_1.default.randomBytes(8).toString('hex')}`;
        const commitment = crypto_1.default.createHash('sha256').update(`${data.ambassadorId}:${data.jobId}:${data.workHash}:pabandi-work`).digest('hex');
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
    async acceptAndPay(submissionId, brandId) {
        const submission = await prisma.promoSubmission.findUnique({
            where: { id: submissionId },
            include: { job: true, ambassador: true },
        });
        if (!submission)
            throw new Error('Submission not found');
        if (submission.job.brandId !== brandId)
            throw new Error('Not your submission');
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
    async submitReview(data) {
        const submission = await prisma.promoSubmission.findUnique({
            where: { id: data.submissionId },
            include: { job: true },
        });
        if (!submission)
            throw new Error('Submission not found');
        const zkCommitment = crypto_1.default.createHash('sha256').update(`${data.ambassadorId}:${data.zkSecret}:pabandi-promo`).digest('hex');
        const zkProofId = `promo_zk_${crypto_1.default.randomBytes(8).toString('hex')}`;
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
    async rewardReview(ambassadorId, zkVerified) {
        const ambassador = await prisma.promoAmbassador.findUnique({ where: { id: ambassadorId } });
        if (!ambassador || !ambassador.userId)
            return { skipped: true };
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
        let mintResult = { skipped: true };
        if (ambassador.userId) {
            const userWallet = await prisma.wallet.findUnique({ where: { userId: ambassador.userId } });
            if (userWallet?.address && userWallet.currency === 'SOL') {
                mintResult = await this.mintPabOnSolana(userWallet.address, amount, 'promo_review');
            }
        }
        return { success: true, amount, mintResult };
    },
    // ── Mint $PAB on Solana (real on-chain) ───────────────────────────────────
    async mintPabOnSolana(walletAddress, amount, rewardType) {
        try {
            const result = await blockchain_service_1.blockchainService.executeSolanaTransfer(walletAddress, amount);
            if (result.txHash) {
                logger_1.logger.info(`[Promo] Minted ${amount} PAB → ${walletAddress} (${rewardType}) tx:${result.txHash}`);
                return { success: true, txHash: result.txHash, amount };
            }
            return { success: false, error: result.error };
        }
        catch (e) {
            logger_1.logger.error(`[Promo] Solana mint failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    },
    // ── Verify a ZK commitment (public endpoint) ──────────────────────────────
    verifyCommitment(ambassadorId, secret, commitment) {
        const expected = crypto_1.default.createHash('sha256').update(`${ambassadorId}:${secret}:pabandi-promo`).digest('hex');
        return expected === commitment;
    },
    // ── Get ambassador earnings ───────────────────────────────────────────────
    async getEarnings(ambassadorId) {
        const ambassador = await prisma.promoAmbassador.findUnique({
            where: { id: ambassadorId },
            include: {
                submissions: { where: { status: 'ACCEPTED' }, include: { job: true } },
                reviews: { where: { verified: true } },
            },
        });
        if (!ambassador)
            throw new Error('Ambassador not found');
        const totalEarnings = ambassador.submissions.reduce((sum, s) => sum + (s.payoutAmount || s.job?.budgetUsd || 0), 0);
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
//# sourceMappingURL=promo.payout.service.js.map