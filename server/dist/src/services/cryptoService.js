"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cryptoService = exports.CryptoService = exports.PAB_REWARD_RULES = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
exports.PAB_REWARD_RULES = {
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
};
class CryptoService {
    async creditPab(tx, userId, amount, type, reservationId, metadata) {
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
    async rewardReservationCompletion(userId, reservationId) {
        try {
            const reservation = await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
                select: { riskScore: true, customer: { select: { reliabilityScore: true } } }
            });
            if (!reservation)
                return;
            let amount = exports.PAB_REWARD_RULES.customer.CHECK_IN;
            const rScore = reservation.customer.reliabilityScore || 100;
            const reliabilityMultiplier = rScore / 100.0;
            const aiRisk = reservation.riskScore || 0;
            let aiBonus = 0;
            if (aiRisk >= 60) {
                aiBonus = exports.PAB_REWARD_RULES.customer.CHECK_IN * ((aiRisk - 60) / 100.0) * 2;
            }
            const trustSignals = reservation?.trustSignals;
            const trustBonus = (trustSignals?.riskDelta || 0) * (exports.PAB_REWARD_RULES.customer.CHECK_IN / 100);
            amount = Math.floor((amount * reliabilityMultiplier) + aiBonus + trustBonus);
            logger_1.logger.info(`PAB +${amount} customer ${userId} reservation ${reservationId}`);
            await database_1.prisma.$transaction(async (tx) => {
                const existing = await tx.cryptoReward.findFirst({
                    where: { userId, reservationId, type: 'RESERVATION_COMPLETION' },
                });
                if (existing)
                    return;
                await this.creditPab(tx, userId, amount, 'RESERVATION_COMPLETION', reservationId, {
                    baseAmount: exports.PAB_REWARD_RULES.customer.CHECK_IN,
                    reliabilityMultiplier,
                    aiBonus
                });
                await tx.reservation.update({
                    where: { id: reservationId },
                    data: { rewardEarned: { increment: amount } },
                });
            });
        }
        catch (error) {
            logger_1.logger.error('Error rewarding reservation completion:', error);
            throw error;
        }
    }
    async triggerConciergeCashback(userId, reservationId) {
        try {
            const reservation = await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
                select: { depositAmount: true, isConcierge: true }
            });
            if (!reservation || !reservation.isConcierge || !reservation.depositAmount)
                return;
            const amount = Math.floor(reservation.depositAmount * 0.01);
            if (amount <= 0)
                return;
            logger_1.logger.info(`PAB +${amount} (1% Cashback) customer ${userId} via AI Concierge`);
            await database_1.prisma.$transaction(async (tx) => {
                await this.creditPab(tx, userId, amount, 'RESERVATION_COMPLETION', reservationId, {
                    note: 'Concierge Cashback',
                    depositAmount: reservation.depositAmount
                });
            });
        }
        catch (error) {
            logger_1.logger.error('Error triggering concierge cashback:', error);
            throw error;
        }
    }
    async rewardBusinessForCompletion(businessId, reservationId) {
        try {
            const reservation = await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
                select: { riskScore: true, trustSignals: true }
            });
            const business = await database_1.prisma.business.findUnique({
                where: { id: businessId },
                select: { id: true, ownerId: true },
            });
            if (!business)
                return;
            let amount = exports.PAB_REWARD_RULES.business.HONORED_BOOKING;
            const aiRisk = reservation?.riskScore || 0;
            let aiBonus = 0;
            if (aiRisk >= 60) {
                aiBonus = exports.PAB_REWARD_RULES.business.HONORED_BOOKING * ((aiRisk - 50) / 100.0) * 1.5;
            }
            amount = Math.floor(amount + aiBonus);
            await database_1.prisma.$transaction(async (tx) => {
                if (business.ownerId) {
                    const existing = await tx.cryptoReward.findFirst({
                        where: { userId: business.ownerId, reservationId, type: 'BUSINESS_RESERVATION_HONORED' },
                    });
                    if (!existing) {
                        await this.creditPab(tx, business.ownerId, amount, 'BUSINESS_RESERVATION_HONORED', reservationId);
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error rewarding business completion:', error);
            throw error;
        }
    }
    async rewardBusinessNoShowProtected(businessId, reservationId) {
        try {
            const reservation = await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
                select: { depositRequired: true, depositStatus: true, trustSignals: true },
            });
            if (!reservation?.depositRequired)
                return;
            const business = await database_1.prisma.business.findUnique({
                where: { id: businessId },
                select: { ownerId: true },
            });
            if (!business)
                return;
            const amount = exports.PAB_REWARD_RULES.business.NO_SHOW_DEPOSIT_KEPT;
            await database_1.prisma.$transaction(async (tx) => {
                if (business.ownerId) {
                    const existing = await tx.cryptoReward.findFirst({
                        where: { userId: business.ownerId, reservationId, type: 'BUSINESS_NO_SHOW_PROTECTED' },
                    });
                    if (!existing) {
                        await this.creditPab(tx, business.ownerId, amount, 'BUSINESS_NO_SHOW_PROTECTED', reservationId);
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error rewarding business no-show protection:', error);
            throw error;
        }
    }
    async rewardGoogleReview(userId, _businessId, _googleReviewId) {
        try {
            const amount = exports.PAB_REWARD_RULES.customer.GOOGLE_REVIEW;
            await database_1.prisma.$transaction(async (tx) => {
                await this.creditPab(tx, userId, amount, 'GOOGLE_REVIEW');
            });
        }
        catch (error) {
            logger_1.logger.error('Error rewarding Google review:', error);
            throw error;
        }
    }
    async connectSolanaWallet(userId, address) {
        return database_1.prisma.wallet.upsert({
            where: { userId },
            update: { address, currency: 'SOL' },
            create: { userId, address, balance: 0, currency: 'SOL' },
        });
    }
    async withdrawToSolana(userId, amount) {
        const wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
        if (!wallet || wallet.balance < amount)
            throw new Error("Insufficient local PAB balance");
        if (!wallet.address || wallet.currency !== 'SOL')
            throw new Error("No Solana wallet connected");
        await database_1.prisma.wallet.update({
            where: { userId },
            data: { balance: { decrement: amount } }
        });
        try {
            if (!process.env.SOLANA_PRIVATE_KEY) {
                await database_1.prisma.cryptoReward.create({
                    data: { userId, amount: -amount, type: 'BUSINESS_RELIABILITY_BONUS', status: 'CLAIMABLE', metadata: { note: "Simulated on-chain withdrawal" } }
                });
                return { success: true, message: "Simulated withdrawal successful" };
            }
            const connection = new web3_js_1.Connection("https://api.mainnet-beta.solana.com", "confirmed");
            const payer = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(process.env.SOLANA_PRIVATE_KEY));
            const mintPublicKey = new web3_js_1.PublicKey(process.env.SOLANA_PAB_MINT_ADDRESS);
            const recipientPublicKey = new web3_js_1.PublicKey(wallet.address);
            const fromAta = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, payer, mintPublicKey, payer.publicKey);
            const toAta = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, payer, mintPublicKey, recipientPublicKey);
            const amountRaw = amount * 10 ** 9;
            const txSignature = await (0, spl_token_1.transfer)(connection, payer, fromAta.address, toAta.address, payer.publicKey, amountRaw);
            await database_1.prisma.cryptoReward.create({
                data: { userId, amount: -amount, type: 'BUSINESS_RELIABILITY_BONUS', status: 'CLAIMABLE', metadata: { note: "On-chain withdrawal", txHash: txSignature } }
            });
            return { success: true, txHash: txSignature, message: "Withdrawal successful" };
        }
        catch (e) {
            await database_1.prisma.wallet.update({ where: { userId }, data: { balance: { increment: amount } } });
            throw e;
        }
    }
    async getWalletData(userId) {
        const wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
        const rewards = await database_1.prisma.cryptoReward.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { reservation: { select: { id: true, business: { select: { name: true } } } } },
        });
        const totalEarned = await database_1.prisma.cryptoReward.aggregate({ where: { userId }, _sum: { amount: true } });
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
    async getBusinessRewardsSummary(ownerId) {
        const wallet = await database_1.prisma.wallet.findUnique({ where: { userId: ownerId } });
        const byType = await database_1.prisma.cryptoReward.groupBy({
            by: ['type'],
            where: { userId: ownerId, type: { startsWith: 'BUSINESS_' } },
            _sum: { amount: true }, _count: true,
        });
        const totalBusinessPab = byType.reduce((sum, row) => sum + (row._sum.amount || 0), 0);
        return {
            balance: wallet?.balance || 0, currency: 'PAB', totalBusinessPab,
            solanaConnected: !!(wallet?.address && wallet.currency === 'SOL'),
            solanaAddress: wallet?.currency === 'SOL' ? wallet.address : null,
            rules: exports.PAB_REWARD_RULES.business,
            breakdown: byType.map((row) => ({ type: row.type, count: row._count, total: row._sum.amount || 0 })),
        };
    }
    getPublicRewardRules() { return exports.PAB_REWARD_RULES; }
    signAttestationData(dataBuffer) {
        if (!process.env.SOLANA_PRIVATE_KEY) {
            return { signature: 'mock_signature_ed25519_' + Date.now(), pubkey: 'mock_public_key' };
        }
        const keypair = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(process.env.SOLANA_PRIVATE_KEY));
        const signature = tweetnacl_1.default.sign.detached(dataBuffer, keypair.secretKey);
        return { signature: bs58_1.default.encode(signature), pubkey: keypair.publicKey.toBase58() };
    }
    verifyAttestationSignature(dataBuffer, signatureBase58, pubkeyBase58) {
        if (pubkeyBase58 === 'mock_public_key')
            return true;
        try {
            const signature = bs58_1.default.decode(signatureBase58);
            const pubkey = bs58_1.default.decode(pubkeyBase58);
            return tweetnacl_1.default.sign.detached.verify(dataBuffer, signature, pubkey);
        }
        catch {
            return false;
        }
    }
    // DISABLED: BSC proof-of-visit (Solana-only now)
    async mintProofOfVisit(_customerWallet, _businessId, _businessName) {
        return null;
    }
    async hasVisited(_customerWallet, _businessId) {
        return false;
    }
    // DISABLED: Escrow operations (Solana-only now)
    async refundEscrowToCustomer(reservationId) {
        logger_1.logger.info(`[Escrow] Refund requested for ${reservationId} (disabled - Solana-only)`);
        return null;
    }
    async releaseEscrowToBusiness(reservationId) {
        logger_1.logger.info(`[Escrow] Release requested for ${reservationId} (disabled - Solana-only)`);
        return null;
    }
    getTreasuryBucket(type) {
        const buckets = {
            RESERVATION_COMPLETION: 'OPERATING',
            BUSINESS_RESERVATION_HONORED: 'OPERATING',
            BUSINESS_NO_SHOW_PROTECTED: 'OPERATING',
            GOOGLE_REVIEW: 'OPERATING',
            VERIFICATION_BOUNTY: 'TREASURY',
            BUSINESS_RELIABILITY_BONUS: 'OPERATING',
            BUSINESS_REFERRAL: 'OPERATING',
            REFERRAL: 'OPERATING',
            STREAK_BONUS: 'OPERATING',
        };
        return buckets[type];
    }
    async creditTreasury(amount, bucket) {
        const normalized = Number(amount || 0);
        if (!normalized || normalized <= 0)
            return;
        await database_1.prisma.treasuryPosition.create({
            data: { bucket, amount: normalized, status: 'PENDING', meta: { source: 'CRYPTO_SERVICE_TRIBUTE' } },
        });
    }
    calculateEscrowFee(businessTrustScore) {
        if (businessTrustScore < 50)
            return 300;
        if (businessTrustScore <= 80)
            return 150;
        return 50;
    }
    // DISABLED: EVM signature generation (Solana-only now)
    async generateDynamicFeeSignature(reservationId, businessAddress, trustScore) {
        const feeBps = this.calculateEscrowFee(trustScore);
        return { feeBps, signature: '0x' };
    }
}
exports.CryptoService = CryptoService;
exports.cryptoService = new CryptoService();
//# sourceMappingURL=cryptoService.js.map