"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pabStakingService = void 0;
exports.stakePab = stakePab;
exports.unstakePab = unstakePab;
exports.getStakingStatus = getStakingStatus;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const LOCK_PERIOD_DAYS = 7;
const STAKE_TIERS = {
    BRONZE: { minAmount: 0, trustBoost: 0, apy: 0 },
    SILVER: { minAmount: 100, trustBoost: 100, apy: 5 },
    GOLD: { minAmount: 500, trustBoost: 300, apy: 8 },
    PLATINUM: { minAmount: 2000, trustBoost: 1000, apy: 12 },
};
function getConnection() {
    const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    return new web3_js_1.Connection(url, 'confirmed');
}
function getPlatformKeypair() {
    const privateKey = process.env.PLATFORM_PRIVATE_KEY;
    if (!privateKey) {
        logger_1.logger.error('PLATFORM_PRIVATE_KEY not set');
        return null;
    }
    try {
        const secretKey = bs58_1.default.decode(privateKey);
        return web3_js_1.Keypair.fromSecretKey(secretKey);
    }
    catch (err) {
        logger_1.logger.error('Invalid PLATFORM_PRIVATE_KEY:', err.message);
        return null;
    }
}
function getPabMint() {
    return process.env.PAB_MINT_ADDRESS || 'G811FHWiZrqY1DZKz6dQySpJFPTDfe21B8LRnDqa1z5Y';
}
async function stakePab(userId, tier) {
    const tierConfig = STAKE_TIERS[tier];
    if (!tierConfig) {
        return { success: false, error: 'Invalid tier. Choose BRONZE, SILVER, GOLD, or PLATINUM.' };
    }
    const amount = tierConfig.minAmount;
    const connection = getConnection();
    const platformKey = getPlatformKeypair();
    if (!platformKey)
        return { success: false, error: 'Platform wallet not configured' };
    const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        return { success: false, error: 'User not found' };
    // Check if user already has an active stake at this tier
    const existingStake = await database_1.prisma.stakingRecord.findFirst({
        where: { userId, tier, status: 'ACTIVE' },
    });
    if (existingStake) {
        return { success: false, error: `Already staked at ${tier} tier` };
    }
    // Get user wallet
    const wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < amount) {
        return { success: false, error: `Insufficient PAB balance. Need ${amount} PAB, have ${wallet?.balance || 0}` };
    }
    const mintKey = new web3_js_1.PublicKey(getPabMint());
    const fromKey = new web3_js_1.PublicKey(wallet.address || '');
    const toKey = platformKey.publicKey;
    const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, fromKey);
    const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, toKey);
    const { Transaction } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
    const transaction = new Transaction();
    const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!toAccountInfo) {
        const { createAssociatedTokenAccountInstruction } = await Promise.resolve().then(() => __importStar(require('@solana/spl-token')));
        transaction.add(createAssociatedTokenAccountInstruction(fromKey, toTokenAccount, toKey, mintKey));
    }
    const amountRaw = Math.round(amount * Math.pow(10, 9));
    transaction.add((0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], spl_token_1.TOKEN_PROGRAM_ID));
    const { blockhash } = await connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKey;
    // Note: In production, the user signs client-side and sends signed tx
    // For now, we record the intent and update balances
    const unlockAt = new Date(Date.now() + LOCK_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const stakingRecord = await database_1.prisma.stakingRecord.create({
        data: {
            userId,
            tier,
            amountPab: amount,
            trustBoost: tierConfig.trustBoost,
            status: 'ACTIVE',
            unlockAt,
        },
    });
    // Update user's staked amount and trust score
    await database_1.prisma.user.update({
        where: { id: userId },
        data: {
            pabStaked: { increment: amount },
            trustScore: { increment: tierConfig.trustBoost },
        },
    });
    // Deduct from wallet
    await database_1.prisma.wallet.update({
        where: { userId },
        data: { balance: { decrement: amount } },
    });
    logger_1.logger.info(`[PabStaking] User ${userId} staked ${amount} PAB at ${tier} tier`);
    return {
        success: true,
        stakingRecord,
        tier,
        amount,
        trustBoost: tierConfig.trustBoost,
        apy: tierConfig.apy,
        unlockAt,
    };
}
async function unstakePab(userId, stakingId) {
    const stakingRecord = await database_1.prisma.stakingRecord.findFirst({
        where: { id: stakingId, userId, status: 'ACTIVE' },
    });
    if (!stakingRecord) {
        return { success: false, error: 'Active staking record not found' };
    }
    if (new Date() < stakingRecord.unlockAt) {
        return {
            success: false,
            error: `PAB is locked until ${stakingRecord.unlockAt.toISOString()}`,
            lockedUntil: stakingRecord.unlockAt,
        };
    }
    const connection = getConnection();
    const platformKey = getPlatformKeypair();
    if (!platformKey)
        return { success: false, error: 'Platform wallet not configured' };
    const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        return { success: false, error: 'User not found' };
    const wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
    // Transfer PAB back to user
    const mintKey = new web3_js_1.PublicKey(getPabMint());
    const fromKey = platformKey.publicKey;
    const toKey = new web3_js_1.PublicKey(wallet?.address || user.walletAddress || '');
    const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, fromKey);
    const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, toKey);
    const { Transaction } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
    const transaction = new Transaction();
    const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!toAccountInfo) {
        const { createAssociatedTokenAccountInstruction } = await Promise.resolve().then(() => __importStar(require('@solana/spl-token')));
        transaction.add(createAssociatedTokenAccountInstruction(fromKey, toTokenAccount, toKey, mintKey));
    }
    const amountRaw = Math.round(stakingRecord.amountPab * Math.pow(10, 9));
    transaction.add((0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], spl_token_1.TOKEN_PROGRAM_ID));
    const { blockhash } = await connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKey;
    transaction.sign(platformKey);
    // Update records
    await database_1.prisma.stakingRecord.update({
        where: { id: stakingId },
        data: { status: 'UNSTAKED', unstakedAt: new Date() },
    });
    await database_1.prisma.user.update({
        where: { id: userId },
        data: {
            pabStaked: { decrement: stakingRecord.amountPab },
            trustScore: { decrement: stakingRecord.trustBoost },
        },
    });
    await database_1.prisma.wallet.update({
        where: { userId },
        data: { balance: { increment: stakingRecord.amountPab } },
    });
    logger_1.logger.info(`[PabStaking] User ${userId} unstaked ${stakingRecord.amountPab} PAB`);
    return {
        success: true,
        amount: stakingRecord.amountPab,
        tier: stakingRecord.tier,
    };
}
async function getStakingStatus(userId) {
    const records = await database_1.prisma.stakingRecord.findMany({
        where: { userId },
        orderBy: { stakedAt: 'desc' },
    });
    const activeStakes = records.filter(r => r.status === 'ACTIVE');
    const totalStaked = activeStakes.reduce((sum, r) => sum + r.amountPab, 0);
    const totalTrustBoost = activeStakes.reduce((sum, r) => sum + r.trustBoost, 0);
    const tiers = Object.entries(STAKE_TIERS).map(([name, config]) => ({
        tier: name,
        ...config,
        active: activeStakes.some(r => r.tier === name),
    }));
    return {
        records,
        totalStaked,
        totalTrustBoost,
        activeCount: activeStakes.length,
        tiers,
    };
}
exports.pabStakingService = {
    stakePab,
    unstakePab,
    getStakingStatus,
    STAKE_TIERS,
};
//# sourceMappingURL=pabStaking.service.js.map