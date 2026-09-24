"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unstakeTokens = exports.stakeTokens = exports.mintBadge = exports.requestSolanaTransfer = exports.connectSolanaWallet = exports.getContractAddresses = exports.getRewardRules = exports.getBusinessRewards = exports.getMyWallet = void 0;
const cryptoService_1 = require("../services/cryptoService");
const blockchain_service_1 = require("../services/blockchain.service");
const badge_service_1 = require("../services/badge.service");
const dashscope_service_1 = require("../services/ai/dashscope.service");
const errorHandler_1 = require("../middleware/errorHandler");
const database_1 = require("../utils/database");
const getMyWallet = async (req, res, next) => {
    try {
        const data = await cryptoService_1.cryptoService.getWalletData(req.user.id);
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyWallet = getMyWallet;
const getBusinessRewards = async (req, res, next) => {
    try {
        if (req.user.role !== 'BUSINESS_OWNER' && req.user.role !== 'ADMIN') {
            throw new errorHandler_1.CustomError('Business account required', 403);
        }
        const data = await cryptoService_1.cryptoService.getBusinessRewardsSummary(req.user.id);
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.getBusinessRewards = getBusinessRewards;
const getRewardRules = async (_req, res) => {
    res.json({ success: true, data: cryptoService_1.cryptoService.getPublicRewardRules() });
};
exports.getRewardRules = getRewardRules;
const getContractAddresses = async (_req, res) => {
    res.json({
        success: true,
        data: {
            pabToken: process.env.PAB_TOKEN_ADDRESS || null,
            escrow: process.env.ESCROW_CONTRACT_ADDRESS || null,
            soulbound: process.env.SOULBOUND_CONTRACT_ADDRESS || null,
            chainId: process.env.BLOCKCHAIN_CHAIN_ID || '56',
            network: process.env.BLOCKCHAIN_NETWORK || 'bscMainnet',
            deployed: !!(process.env.PAB_TOKEN_ADDRESS),
        },
    });
};
exports.getContractAddresses = getContractAddresses;
const connectSolanaWallet = async (req, res, next) => {
    try {
        const { address } = req.body;
        if (!address || typeof address !== 'string' || address.length < 32) {
            throw new errorHandler_1.CustomError('Valid Solana wallet address is required', 400);
        }
        const wallet = await cryptoService_1.cryptoService.connectSolanaWallet(req.user.id, address.trim());
        res.json({
            success: true,
            message: 'Solana wallet connected for $PAB payouts',
            data: { address: wallet.address, chain: 'solana' },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.connectSolanaWallet = connectSolanaWallet;
const requestSolanaTransfer = async (req, res, next) => {
    try {
        const { amount } = req.body;
        const wallet = await database_1.prisma.wallet.findUnique({ where: { userId: req.user.id }, include: { user: true } });
        // Identity verification can be enforced before withdrawals depending on policy.
        // if (!wallet?.user?.isEmailVerified || !wallet?.user?.isPhoneVerified) {
        //   throw new CustomError('Identity Verification (Phone & Email) is required before withdrawing funds to Solana to comply with AML laws.', 403);
        // }
        if (!wallet?.address || wallet.currency !== 'SOL') {
            throw new errorHandler_1.CustomError('Connect a Phantom (Solana) wallet first', 400);
        }
        const transferAmount = Number(amount) || wallet.balance;
        if (transferAmount <= 0 || transferAmount > wallet.balance) {
            throw new errorHandler_1.CustomError('Invalid transfer amount', 400);
        }
        const rewardRecord = await database_1.prisma.cryptoReward.create({
            data: {
                userId: req.user.id,
                amount: -transferAmount,
                type: 'SOLANA_TRANSFER_REQUEST',
                status: 'PENDING',
                txHash: null,
            },
        });
        const transferResult = await blockchain_service_1.blockchainService.executeSolanaTransfer(wallet.address, transferAmount);
        if (transferResult.error) {
            await database_1.prisma.cryptoReward.update({
                where: { id: rewardRecord.id },
                data: { status: 'FAILED' }
            });
            throw new errorHandler_1.CustomError('Failed to transfer $PAB to Solana: ' + transferResult.error, 500);
        }
        // Update the reward to completed and deduct the balance from internal DB
        await database_1.prisma.$transaction([
            database_1.prisma.cryptoReward.update({
                where: { id: rewardRecord.id },
                data: {
                    status: 'COMPLETED',
                    txHash: transferResult.txHash
                }
            }),
            database_1.prisma.wallet.update({
                where: { userId: req.user.id },
                data: { balance: { decrement: transferAmount } }
            })
        ]);
        res.json({
            success: true,
            message: 'Transfer successful! $PAB has been minted to your Solana wallet.',
            data: {
                to: wallet.address,
                amount: transferAmount,
                chain: 'solana',
                status: 'completed',
                txHash: transferResult.txHash
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.requestSolanaTransfer = requestSolanaTransfer;
/**
 * POST /api/v1/crypto/mint-badge
 * Mints a Soulbound NFT badge for the authenticated user's connected wallet.
 * Computes eligible tier from user's reservation history + reliability score.
 */
const mintBadge = async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Get user's wallet address
        const wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
        if (!wallet?.address) {
            throw new errorHandler_1.CustomError('Connect a wallet first (Phantom or MetaMask) before minting badges', 400);
        }
        // Compute badge status
        const badge = await badge_service_1.badgeService.computeBadgeStatus(userId);
        const showRate = badge.totalBookings > 0 ? badge.attendanceRate : 100;
        // Generate AI Trust Profile
        const aiTrustProfile = await dashscope_service_1.dashscopeService.generateTrustProfile(userId);
        const mintResult = await blockchain_service_1.blockchainService.checkAndMintEligibleBadge(wallet.address, badge.pseudonymousId, badge.reliabilityScore, badge.totalBookings, showRate, aiTrustProfile);
        if (!mintResult) {
            throw new errorHandler_1.CustomError('Complete at least 1 booking with 70%+ show rate to earn your first badge', 400);
        }
        res.json({
            success: true,
            data: {
                ...mintResult,
                badge: {
                    score: badge.reliabilityScore,
                    tier: badge.tier,
                    totalBookings: badge.totalBookings,
                    attendanceRate: badge.attendanceRate,
                    aiTrustProfile: aiTrustProfile,
                },
                contractAddresses: {
                    soulbound: process.env.SOULBOUND_CONTRACT_ADDRESS || null,
                    network: process.env.BLOCKCHAIN_NETWORK || 'bscMainnet',
                },
            },
            message: mintResult.success
                ? `${mintResult.tierName} Soulbound Badge ${mintResult.chain === 'solana' ? 'ready to mint' : 'minted'} successfully!`
                : 'Badge minting queued — will be processed shortly.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.mintBadge = mintBadge;
const stakeTokens = async (req, res, next) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0)
            throw new errorHandler_1.CustomError('Invalid deposit amount', 400);
        const user = await database_1.prisma.user.findUnique({ where: { id: req.user.id }, include: { wallet: true } });
        if (!user || !user.wallet)
            throw new errorHandler_1.CustomError('Wallet not found', 404);
        if (user.wallet.balance < amount)
            throw new errorHandler_1.CustomError('Insufficient liquid balance', 400);
        await database_1.prisma.$transaction(async (tx) => {
            // Deduct from balance, add to loyalty pool
            await tx.wallet.update({
                where: { id: user.wallet.id },
                data: {
                    balance: { decrement: amount },
                    totalStaked: { increment: amount }
                }
            });
            // Record transaction
            await tx.stakeTransaction.create({
                data: {
                    userId: user.id,
                    amount: amount,
                    type: 'STAKE', // Internal type
                    apyAtTime: 0 // No APY in Hibah
                }
            });
        });
        res.json({ success: true, message: `Successfully deposited ${amount} $PAB into the Community Loyalty Pool.` });
    }
    catch (error) {
        next(error);
    }
};
exports.stakeTokens = stakeTokens;
const unstakeTokens = async (req, res, next) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0)
            throw new errorHandler_1.CustomError('Invalid withdrawal amount', 400);
        const user = await database_1.prisma.user.findUnique({ where: { id: req.user.id }, include: { wallet: true } });
        if (!user || !user.wallet)
            throw new errorHandler_1.CustomError('Wallet not found', 404);
        if (user.wallet.totalStaked < amount)
            throw new errorHandler_1.CustomError('Insufficient loyalty pool balance', 400);
        // Hibah (Gift) Calculation based purely on Reliability Score, NOT time-locked interest
        let hibahBonusMultiplier = 0;
        if (user.reliabilityScore >= 95)
            hibahBonusMultiplier = 0.05; // 5% flat bonus
        else if (user.reliabilityScore >= 85)
            hibahBonusMultiplier = 0.02; // 2% flat bonus
        else if (user.reliabilityScore >= 70)
            hibahBonusMultiplier = 0.01; // 1% flat bonus
        const hibahGift = Number((amount * hibahBonusMultiplier).toFixed(2));
        await database_1.prisma.$transaction(async (tx) => {
            await tx.wallet.update({
                where: { id: user.wallet.id },
                data: {
                    balance: { increment: amount + hibahGift },
                    totalStaked: { decrement: amount }
                }
            });
            // Record withdrawal
            await tx.stakeTransaction.create({
                data: {
                    userId: user.id,
                    amount: amount,
                    type: 'UNSTAKE',
                    apyAtTime: 0
                }
            });
            // Record Hibah
            if (hibahGift > 0) {
                await tx.stakeTransaction.create({
                    data: {
                        userId: user.id,
                        amount: hibahGift,
                        type: 'YIELD_PAYOUT', // Keeping internal DB enum for compatibility
                        apyAtTime: 0
                    }
                });
            }
        });
        res.json({
            success: true,
            message: `Withdrew ${amount} $PAB. The Treasury gifted you a Hibah bonus of ${hibahGift} $PAB for your ${user.reliabilityScore} Reliability Score!`,
            data: { yieldEarned: hibahGift }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.unstakeTokens = unstakeTokens;
//# sourceMappingURL=crypto.controller.js.map