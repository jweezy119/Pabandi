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
const ethers_1 = require("ethers");
const solana_escrow_service_1 = require("./solana_escrow.service");
// Pabandi Proof of Visit Contract (BSC Testnet)
const PABANDI_POV_BSC = '0x1A2b3C4d5E6f7G8h9I0j1K2l3M4n5O6p7Q8r9S0T'; // Dummy
const POV_ABI = [
    "function mintProofOfVisit(address to, string calldata businessId, string calldata businessName) external returns (uint256)",
    "function hasVisited(address user, string calldata businessId) external view returns (bool)"
];
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
const tweetnacl_1 = __importDefault(require("tweetnacl"));
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
    /**
     * Reward customer for completing a reservation (verified check-in).
     */
    async rewardReservationCompletion(userId, reservationId) {
        try {
            const reservation = await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
                select: { riskScore: true, customer: { select: { reliabilityScore: true } } }
            });
            if (!reservation)
                return;
            let amount = exports.PAB_REWARD_RULES.customer.CHECK_IN; // 50 base
            // 1. Reliability Multiplier
            const rScore = reservation.customer.reliabilityScore || 100;
            const reliabilityMultiplier = rScore / 100.0; // 0.0 to 1.0
            // 2. Proving AI Wrong Bonus
            const aiRisk = reservation.riskScore || 0;
            let aiBonus = 0;
            if (aiRisk >= 60) {
                // High risk but showed up! Give them up to 50% extra base reward
                aiBonus = exports.PAB_REWARD_RULES.customer.CHECK_IN * ((aiRisk - 60) / 100.0) * 2;
            }
            const trustSignals = reservation?.trustSignals;
            const trustBonus = (trustSignals?.riskDelta || 0) * (exports.PAB_REWARD_RULES.customer.CHECK_IN / 100);
            amount = Math.floor((amount * reliabilityMultiplier) + aiBonus + trustBonus);
            logger_1.logger.info(`PAB +${amount} customer ${userId} reservation ${reservationId} (Base: ${exports.PAB_REWARD_RULES.customer.CHECK_IN}, R-Score: ${rScore}, AI-Risk: ${aiRisk}, AI Bonus: ${aiBonus})`);
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
    /**
     * Reward customer with 1% cashback for booking via AI Concierge.
     */
    async triggerConciergeCashback(userId, reservationId) {
        try {
            const reservation = await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
                select: { depositAmount: true, isConcierge: true }
            });
            if (!reservation || !reservation.isConcierge || !reservation.depositAmount)
                return;
            // 1% of the deposit amount in PAB (or equivalent)
            const amount = Math.floor(reservation.depositAmount * 0.01);
            if (amount <= 0)
                return;
            logger_1.logger.info(`PAB +${amount} (1% Cashback) customer ${userId} via AI Concierge for reservation ${reservationId}`);
            await database_1.prisma.$transaction(async (tx) => {
                const existing = await tx.cryptoReward.findFirst({
                    where: { userId, reservationId, type: 'RESERVATION_COMPLETION', metadata: { equals: { note: 'Concierge Cashback' } } },
                });
                if (existing)
                    return;
                await this.creditPab(tx, userId, amount, 'RESERVATION_COMPLETION', reservationId, {
                    note: 'Concierge Cashback',
                    depositAmount: reservation.depositAmount
                });
                // Optionally immediately trigger withdrawal to Solana wallet if they have one connected
                try {
                    const wallet = await tx.wallet.findUnique({ where: { userId } });
                    if (wallet?.address && wallet.currency === 'SOL') {
                        // Process async withdrawal
                        setTimeout(() => {
                            this.withdrawToSolana(userId, amount).catch(e => logger_1.logger.error("Async cashback withdrawal failed", e));
                        }, 5000);
                    }
                }
                catch (e) {
                    logger_1.logger.error("Failed to check wallet for cashback auto-withdraw", e);
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error triggering concierge cashback:', error);
            throw error;
        }
    }
    /**
     * Reward business owner when they honor a completed booking.
     */
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
            let amount = exports.PAB_REWARD_RULES.business.HONORED_BOOKING; // 25 base
            // Risk Acceptance Bonus for Business
            const aiRisk = reservation?.riskScore || 0;
            let aiBonus = 0;
            if (aiRisk >= 60) {
                // Business took a chance on a high risk user and it paid off
                aiBonus = exports.PAB_REWARD_RULES.business.HONORED_BOOKING * ((aiRisk - 50) / 100.0) * 1.5;
            }
            amount = Math.floor(amount + aiBonus);
            logger_1.logger.info(`PAB +${amount} business owner ${business.ownerId} reservation ${reservationId} (Base: ${exports.PAB_REWARD_RULES.business.HONORED_BOOKING}, AI-Risk: ${aiRisk}, Risk Bonus: ${aiBonus})`);
            await database_1.prisma.$transaction(async (tx) => {
                if (business.ownerId) {
                    try {
                        const existingBusinessReward = await tx.cryptoReward.findFirst({
                            where: { userId: business.ownerId, reservationId, type: 'BUSINESS_RESERVATION_HONORED' },
                        });
                        if (!existingBusinessReward) {
                            await this.creditPab(tx, business.ownerId, amount, 'BUSINESS_RESERVATION_HONORED', reservationId, {
                                baseAmount: exports.PAB_REWARD_RULES.business.HONORED_BOOKING,
                                aiRisk,
                                aiBonus
                            });
                        }
                    }
                    catch (err) {
                        console.error(`Failed to reward business ${business.id}:`, err);
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error rewarding business completion:', error);
            throw error;
        }
    }
    /**
     * Reward business when a no-show occurs and deposit protection applies.
     */
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
            logger_1.logger.info(`PAB +${amount} business no-show protection ${businessId}`);
            await database_1.prisma.$transaction(async (tx) => {
                if (business.ownerId) {
                    const existing = await tx.cryptoReward.findFirst({
                        where: { userId: business.ownerId, reservationId, type: 'BUSINESS_NO_SHOW_PROTECTED' },
                    });
                    if (existing)
                        return;
                    await this.creditPab(tx, business.ownerId, amount, 'BUSINESS_NO_SHOW_PROTECTED', reservationId);
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error rewarding business no-show protection:', error);
            throw error;
        }
    }
    /**
     * Reward user for leaving a Google review.
     */
    async rewardGoogleReview(userId, _businessId, _googleReviewId) {
        try {
            const amount = exports.PAB_REWARD_RULES.customer.GOOGLE_REVIEW;
            logger_1.logger.info(`PAB +${amount} review reward user ${userId}`);
            await database_1.prisma.$transaction(async (tx) => {
                await this.creditPab(tx, userId, amount, 'GOOGLE_REVIEW');
            });
        }
        catch (error) {
            logger_1.logger.error('Error rewarding Google review:', error);
            throw error;
        }
    }
    /**
     * Connect or update Solana (Phantom) wallet for payouts.
     */
    async connectSolanaWallet(userId, address) {
        return database_1.prisma.wallet.upsert({
            where: { userId },
            update: { address, currency: 'SOL' },
            create: { userId, address, balance: 0, currency: 'SOL' },
        });
    }
    /**
     * Withdraw PAB to connected Solana wallet.
     */
    async withdrawToSolana(userId, amount) {
        const wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
        if (!wallet || wallet.balance < amount) {
            throw new Error("Insufficient local PAB balance");
        }
        if (!wallet.address || wallet.currency !== 'SOL') {
            throw new Error("No Solana wallet connected");
        }
        // Process in DB first to prevent double-spending race conditions
        await database_1.prisma.wallet.update({
            where: { userId },
            data: { balance: { decrement: amount } }
        });
        try {
            if (!process.env.SOLANA_PRIVATE_KEY) {
                logger_1.logger.warn(`Simulating Solana withdrawal of ${amount} PAB to ${wallet.address} (No private key found in .env)`);
                // Log a simulated reward event so it shows up in history
                await database_1.prisma.cryptoReward.create({
                    data: {
                        userId,
                        amount: -amount,
                        type: 'BUSINESS_RELIABILITY_BONUS', // fallback type or create a WITHDRAWAL type in schema if we had one
                        status: 'CLAIMABLE',
                        metadata: { note: "Simulated on-chain withdrawal" }
                    }
                });
                return { success: true, message: "Simulated withdrawal successful" };
            }
            const connection = new web3_js_1.Connection("https://api.mainnet-beta.solana.com", "confirmed");
            const payer = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(process.env.SOLANA_PRIVATE_KEY));
            const mintPublicKey = new web3_js_1.PublicKey(process.env.SOLANA_PAB_MINT_ADDRESS);
            const recipientPublicKey = new web3_js_1.PublicKey(wallet.address);
            // Get ATAs
            const fromAta = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, payer, mintPublicKey, payer.publicKey);
            const toAta = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, payer, mintPublicKey, recipientPublicKey);
            const amountRaw = amount * 10 ** 9; // 9 decimals
            const txSignature = await (0, spl_token_1.transfer)(connection, payer, fromAta.address, toAta.address, payer.publicKey, amountRaw);
            logger_1.logger.info(`Successfully withdrew ${amount} PAB to ${wallet.address}. Tx: ${txSignature}`);
            // Log the withdrawal event
            await database_1.prisma.cryptoReward.create({
                data: {
                    userId,
                    amount: -amount,
                    type: 'BUSINESS_RELIABILITY_BONUS', // Represents withdrawal
                    status: 'CLAIMABLE',
                    metadata: { note: "On-chain withdrawal", txHash: txSignature }
                }
            });
            return { success: true, txHash: txSignature, message: "Withdrawal successful" };
        }
        catch (e) {
            // Revert if on-chain fails
            logger_1.logger.error('Solana withdrawal failed, reverting balance.', e);
            await database_1.prisma.wallet.update({
                where: { userId },
                data: { balance: { increment: amount } }
            });
            throw e;
        }
    }
    /**
     * Get wallet + recent rewards for any user.
     */
    async getWalletData(userId) {
        const wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
        const rewards = await database_1.prisma.cryptoReward.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
                reservation: {
                    select: {
                        id: true,
                        business: { select: { name: true } },
                    },
                },
            },
        });
        const totalEarned = await database_1.prisma.cryptoReward.aggregate({
            where: { userId },
            _sum: { amount: true },
        });
        return {
            balance: wallet?.balance || 0,
            currency: 'PAB',
            solanaAddress: wallet?.currency === 'SOL' ? wallet.address : wallet?.address,
            chain: wallet?.currency === 'SOL' ? 'solana' : wallet?.address ? 'other' : null,
            totalEarned: totalEarned._sum.amount || 0,
            recentRewards: rewards.map((r) => ({
                id: r.id,
                type: r.type,
                amount: r.amount,
                status: r.status,
                createdAt: r.createdAt,
                metadata: r.metadata,
                businessName: r.reservation?.business?.name,
                reservationId: r.reservationId,
            })),
        };
    }
    /**
     * Business owner: PAB earnings breakdown and Solana payout readiness.
     */
    async getBusinessRewardsSummary(ownerId) {
        const wallet = await database_1.prisma.wallet.findUnique({ where: { userId: ownerId } });
        const businessRewards = await database_1.prisma.cryptoReward.findMany({
            where: {
                userId: ownerId,
                type: { startsWith: 'BUSINESS_' },
            },
            orderBy: { createdAt: 'desc' },
            take: 15,
        });
        const byType = await database_1.prisma.cryptoReward.groupBy({
            by: ['type'],
            where: { userId: ownerId, type: { startsWith: 'BUSINESS_' } },
            _sum: { amount: true },
            _count: true,
        });
        const totalBusinessPab = byType.reduce((sum, row) => sum + (row._sum.amount || 0), 0);
        return {
            balance: wallet?.balance || 0,
            currency: 'PAB',
            totalBusinessPab,
            solanaConnected: !!(wallet?.address && wallet.currency === 'SOL'),
            solanaAddress: wallet?.currency === 'SOL' ? wallet.address : null,
            rules: exports.PAB_REWARD_RULES.business,
            breakdown: byType.map((row) => ({
                type: row.type,
                count: row._count,
                total: row._sum.amount || 0,
            })),
            recentRewards: businessRewards,
        };
    }
    getPublicRewardRules() {
        return exports.PAB_REWARD_RULES;
    }
    // --- Trust Attestation Standard (TAS) ---
    /**
     * Generates a signature for a Trust Attestation using the platform's private key.
     */
    signAttestationData(dataBuffer) {
        if (!process.env.SOLANA_PRIVATE_KEY) {
            logger_1.logger.warn('No SOLANA_PRIVATE_KEY found. Mocking Ed25519 attestation signature.');
            return {
                signature: 'mock_signature_ed25519_' + Date.now(),
                pubkey: 'mock_public_key'
            };
        }
        const keypair = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(process.env.SOLANA_PRIVATE_KEY));
        const signature = tweetnacl_1.default.sign.detached(dataBuffer, keypair.secretKey);
        return {
            signature: bs58_1.default.encode(signature),
            pubkey: keypair.publicKey.toBase58()
        };
    }
    /**
     * Verify an Ed25519 signature.
     */
    verifyAttestationSignature(dataBuffer, signatureBase58, pubkeyBase58) {
        if (pubkeyBase58 === 'mock_public_key')
            return true;
        try {
            const signature = bs58_1.default.decode(signatureBase58);
            const pubkey = bs58_1.default.decode(pubkeyBase58);
            return tweetnacl_1.default.sign.detached.verify(dataBuffer, signature, pubkey);
        }
        catch (e) {
            return false;
        }
    }
    /**
     * Issue a Verification Bounty (PAB Airdrop)
     */
    async issueVerificationBounty(userId, amount) {
        await database_1.prisma.$transaction(async (tx) => {
            await this.creditPab(tx, userId, amount, 'VERIFICATION_BOUNTY');
        });
    }
    // --- Web3 Escrow Integration ---
    /**
     * Called when a reservation is COMPLETED or NO_SHOW.
     * Releases escrowed funds to the business minus the platform fee.
     */
    async releaseEscrowToBusiness(reservationId) {
        try {
            const reservation = await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
                include: { business: true }
            });
            if (!reservation)
                return;
            const customerWallet = await database_1.prisma.wallet.findUnique({ where: { userId: reservation.customerId } });
            const businessWallet = await database_1.prisma.wallet.findUnique({ where: { userId: reservation.business.ownerId } });
            if (!customerWallet?.address || !businessWallet?.address) {
                logger_1.logger.warn(`[Escrow] Missing wallet for release ${reservationId}`);
                return;
            }
            logger_1.logger.info(`[Escrow] Calling releaseEscrow on Solana for ${reservationId}`);
            const mintStr = process.env.SOLANA_PAB_MINT_ADDRESS || 'PAB1111111111111111111111111111111111111111';
            await solana_escrow_service_1.solanaEscrowService.triggerReleaseEscrow(reservationId, customerWallet.address, businessWallet.address, mintStr);
        }
        catch (e) {
            logger_1.logger.error(`[Escrow] Failed to release funds for ${reservationId}: ${e.message}`);
        }
    }
    /**
     * Called when a reservation is CANCELLED by business.
     * Refunds escrowed funds 100% back to customer.
     */
    async refundEscrowToCustomer(reservationId) {
        try {
            const reservation = await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
                include: { business: true }
            });
            if (!reservation)
                return;
            const customerWallet = await database_1.prisma.wallet.findUnique({ where: { userId: reservation.customerId } });
            if (!customerWallet?.address) {
                logger_1.logger.warn(`[Escrow] Missing customer wallet for refund ${reservationId}`);
                return;
            }
            logger_1.logger.info(`[Escrow] Calling refundEscrow on Solana for ${reservationId}`);
            const mintStr = process.env.SOLANA_PAB_MINT_ADDRESS || 'PAB1111111111111111111111111111111111111111';
            await solana_escrow_service_1.solanaEscrowService.triggerRefundEscrow(reservationId, customerWallet.address, mintStr);
        }
        catch (e) {
            logger_1.logger.error(`[Escrow] Failed to refund funds for ${reservationId}: ${e.message}`);
        }
    }
    /**
     * Mint a Proof of Visit (POV) Soulbound Token for a customer
     */
    async mintProofOfVisit(customerWallet, businessId, businessName) {
        try {
            if (!process.env.ESCROW_ORACLE_PRIVATE_KEY)
                return null;
            const provider = new ethers_1.ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
            const wallet = new ethers_1.ethers.Wallet(process.env.ESCROW_ORACLE_PRIVATE_KEY, provider);
            const contract = new ethers_1.ethers.Contract(PABANDI_POV_BSC, POV_ABI, wallet);
            const tx = await contract.mintProofOfVisit(customerWallet, businessId, businessName);
            await tx.wait();
            logger_1.logger.info(`[POV] Minted Proof of Visit for ${customerWallet} at ${businessName}. Tx: ${tx.hash}`);
            // In a real implementation we'd parse the receipt logs to get the tokenId.
            // For now, we return a mock token ID.
            return { txHash: tx.hash, tokenId: `POV-${Date.now()}` };
        }
        catch (e) {
            logger_1.logger.error(`[POV] Failed to mint Proof of Visit: ${e.message}`);
            return null;
        }
    }
    /**
     * Check if a user holds a Proof of Visit token for a specific business
     */
    async hasVisited(customerWallet, businessId) {
        try {
            const provider = new ethers_1.ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
            const contract = new ethers_1.ethers.Contract(PABANDI_POV_BSC, POV_ABI, provider);
            const visited = await contract.hasVisited(customerWallet, businessId);
            return visited;
        }
        catch (e) {
            logger_1.logger.error(`[POV] Failed to check Proof of Visit: ${e.message}`);
            return false; // Fail secure
        }
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
    // --- Dynamic Fee Signature (EVM) ---
    calculateEscrowFee(businessTrustScore) {
        if (businessTrustScore < 50)
            return 300; // 3%
        if (businessTrustScore <= 80)
            return 150; // 1.5%
        return 50; // 0.5%
    }
    async generateDynamicFeeSignature(reservationId, businessAddress, trustScore) {
        const feeBps = this.calculateEscrowFee(trustScore);
        if (!process.env.ESCROW_ORACLE_PRIVATE_KEY) {
            logger_1.logger.warn('No ESCROW_ORACLE_PRIVATE_KEY found. Generating dummy signature for dynamic fee.');
            return { feeBps, signature: '0x' };
        }
        const wallet = new ethers_1.ethers.Wallet(process.env.ESCROW_ORACLE_PRIVATE_KEY);
        // Equivalent to keccak256(abi.encodePacked(reservationId, feeBps, businessAddress))
        const messageHash = ethers_1.ethers.solidityPackedKeccak256(['string', 'uint256', 'address'], [reservationId, feeBps, businessAddress]);
        // Sign the hash (ethers signs the message hash with the '\x19Ethereum Signed Message:\n32' prefix)
        const signature = await wallet.signMessage(ethers_1.ethers.getBytes(messageHash));
        return { feeBps, signature };
    }
}
exports.CryptoService = CryptoService;
exports.cryptoService = new CryptoService();
//# sourceMappingURL=cryptoService.js.map