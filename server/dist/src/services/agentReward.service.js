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
exports.agentRewardService = void 0;
exports.distributeAgentReward = distributeAgentReward;
exports.getAgentRewards = getAgentRewards;
exports.getUserRewards = getUserRewards;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const REWARD_RATE = 0.02; // 2% of task value
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
async function distributeAgentReward(params) {
    const { agentId, taskType, taskValue, userId } = params;
    const rewardAmount = taskValue * REWARD_RATE;
    const agent = await database_1.prisma.web3Agent.findUnique({ where: { id: agentId } });
    if (!agent)
        return { success: false, error: 'Agent not found' };
    const connection = getConnection();
    const platformKey = getPlatformKeypair();
    if (!platformKey)
        return { success: false, error: 'Platform wallet not configured' };
    const mintKey = new web3_js_1.PublicKey(getPabMint());
    const fromKey = platformKey.publicKey;
    const toKey = new web3_js_1.PublicKey(agent.walletAddress);
    const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, fromKey);
    const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, toKey);
    const { Transaction } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
    const transaction = new Transaction();
    const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!toAccountInfo) {
        transaction.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(fromKey, toTokenAccount, toKey, mintKey));
    }
    const amountRaw = Math.round(rewardAmount * Math.pow(10, 9));
    transaction.add((0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], spl_token_1.TOKEN_PROGRAM_ID));
    const { blockhash } = await connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKey;
    transaction.sign(platformKey);
    let txHash;
    try {
        txHash = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(txHash, 'confirmed');
    }
    catch (err) {
        logger_1.logger.error(`[AgentReward] On-chain transfer failed: ${err.message}`);
    }
    // Record the reward
    const reward = await database_1.prisma.agentReward.create({
        data: {
            agentId,
            userId,
            taskType,
            taskValue,
            rewardPab: rewardAmount,
            txHash: txHash || undefined,
            status: txHash ? 'DISTRIBUTED' : 'PENDING',
            distributedAt: txHash ? new Date() : undefined,
        },
    });
    // Update agent balance
    await database_1.prisma.web3Agent.update({
        where: { id: agentId },
        data: { balancePab: { increment: rewardAmount } },
    });
    // Update user's pabEarned if userId provided
    if (userId) {
        await database_1.prisma.user.update({
            where: { id: userId },
            data: { pabEarned: { increment: rewardAmount } },
        });
    }
    // Record in agent transaction ledger
    await database_1.prisma.agentTransaction.create({
        data: {
            agentId,
            type: 'BONUS',
            amount: rewardAmount,
            fromAddress: platformKey.publicKey.toBase58(),
            toAddress: agent.walletAddress,
            txHash: txHash || `reward:${agentId}:${Date.now()}`,
            metadata: { taskType, taskValue, rewardRate: REWARD_RATE },
        },
    });
    logger_1.logger.info(`[AgentReward] Distributed ${rewardAmount} PAB to agent ${agentId} for ${taskType}`);
    return {
        success: true,
        reward,
        rewardAmount,
        txHash,
    };
}
async function getAgentRewards(agentId) {
    const rewards = await database_1.prisma.agentReward.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
    });
    const totalEarned = rewards
        .filter(r => r.status === 'DISTRIBUTED')
        .reduce((sum, r) => sum + r.rewardPab, 0);
    const pendingRewards = rewards.filter(r => r.status === 'PENDING');
    const totalPending = pendingRewards.reduce((sum, r) => sum + r.rewardPab, 0);
    const agent = await database_1.prisma.web3Agent.findUnique({ where: { id: agentId } });
    return {
        rewards,
        totalEarned,
        totalPending,
        currentBalance: agent?.balancePab || 0,
        rewardCount: rewards.length,
    };
}
async function getUserRewards(userId) {
    const rewards = await database_1.prisma.agentReward.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });
    const totalEarned = rewards
        .filter(r => r.status === 'DISTRIBUTED')
        .reduce((sum, r) => sum + r.rewardPab, 0);
    return {
        rewards,
        totalEarned,
        rewardCount: rewards.length,
    };
}
exports.agentRewardService = {
    distributeAgentReward,
    getAgentRewards,
    getUserRewards,
    REWARD_RATE,
};
//# sourceMappingURL=agentReward.service.js.map