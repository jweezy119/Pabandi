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
exports.leasePabService = void 0;
exports.createLeaseWithPabDeposit = createLeaseWithPabDeposit;
exports.returnLeaseDeposit = returnLeaseDeposit;
exports.getLeaseDepositStatus = getLeaseDepositStatus;
exports.processPabPayment = processPabPayment;
exports.getPaymentHistory = getPaymentHistory;
exports.rewardAgentForTask = rewardAgentForTask;
exports.getAgentPabEarnings = getAgentPabEarnings;
exports.setAutoConvertPreference = setAutoConvertPreference;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const PAB_MINT = 'G811FHWiZrqY1DZKz6dQySpJFPTDfe21B8LRnDqa1z5Y';
const PAB_DISCOUNT_RATE = 0.05;
const AUTO_STAKE_RATE = 0.10;
const LEASE_DEPOSIT_APY = 0.02;
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
async function logPaymentFlow(params) {
    return database_1.prisma.paymentFlowLog.create({
        data: {
            flowType: params.flowType,
            referenceId: params.referenceId,
            referenceType: params.referenceType,
            amount: params.amount,
            token: params.token,
            fromAddress: params.fromAddress,
            toAddress: params.toAddress,
            txHash: params.txHash,
            status: params.status || 'INITIATED',
            metadata: params.metadata,
        },
    });
}
// ═══════════════════════════════════════════════════════════════════════════════
// LEASE PAB INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════
async function createLeaseWithPabDeposit(params) {
    const { leaseId, tenantEmail, depositAmount, userId } = params;
    const lease = await database_1.prisma.propertyLease.findUnique({ where: { id: leaseId } });
    if (!lease)
        return { success: false, error: 'Lease not found' };
    // Check if deposit already exists
    const existing = await database_1.prisma.leaseDeposit.findUnique({ where: { leaseId } });
    if (existing)
        return { success: false, error: 'Lease deposit already exists' };
    // Create deposit record
    const deposit = await database_1.prisma.leaseDeposit.create({
        data: {
            leaseId,
            tenantEmail,
            depositAmount,
            interestRate: LEASE_DEPOSIT_APY,
            status: 'HELD',
        },
    });
    await logPaymentFlow({
        flowType: 'LEASE_DEPOSIT',
        referenceId: leaseId,
        referenceType: 'PropertyLease',
        amount: depositAmount,
        token: 'PAB',
        status: 'COMPLETED',
        metadata: { tenantEmail, depositId: deposit.id },
    });
    // If userId provided, deduct PAB from wallet
    if (userId) {
        const wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
        if (wallet && wallet.balance >= depositAmount) {
            await database_1.prisma.wallet.update({
                where: { userId },
                data: { balance: { decrement: depositAmount } },
            });
        }
    }
    return { success: true, deposit, depositAmount };
}
async function returnLeaseDeposit(params) {
    const { leaseId, userId, earlyTermination } = params;
    const deposit = await database_1.prisma.leaseDeposit.findUnique({ where: { leaseId } });
    if (!deposit)
        return { success: false, error: 'Lease deposit not found' };
    if (deposit.status !== 'HELD') {
        return { success: false, error: `Deposit already ${deposit.status}` };
    }
    const lease = await database_1.prisma.propertyLease.findUnique({ where: { id: leaseId } });
    if (!lease)
        return { success: false, error: 'Lease not found' };
    // Calculate interest (simple: APY * deposit * years held)
    const heldMs = Date.now() - deposit.heldAt.getTime();
    const heldYears = heldMs / (365.25 * 24 * 60 * 60 * 1000);
    const interest = earlyTermination ? 0 : deposit.depositAmount * deposit.interestRate * heldYears;
    let returnAmount;
    let releaseType;
    if (earlyTermination) {
        // 50% slash
        returnAmount = deposit.depositAmount * 0.5;
        releaseType = 'SLASHED';
    }
    else {
        returnAmount = deposit.depositAmount + interest;
        releaseType = 'FULL';
    }
    // Update deposit record
    const updated = await database_1.prisma.leaseDeposit.update({
        where: { leaseId },
        data: {
            status: earlyTermination ? 'SLASHED' : 'RETURNED',
            interestEarned: interest,
            releasedAt: new Date(),
            releaseType,
        },
    });
    // Return PAB to user wallet
    if (userId && returnAmount > 0) {
        await database_1.prisma.wallet.update({
            where: { userId },
            data: { balance: { increment: returnAmount } },
        });
    }
    await logPaymentFlow({
        flowType: 'LEASE_END',
        referenceId: leaseId,
        referenceType: 'PropertyLease',
        amount: returnAmount,
        token: 'PAB',
        status: 'COMPLETED',
        metadata: {
            earlyTermination,
            depositAmount: deposit.depositAmount,
            interest,
            releaseType,
        },
    });
    return {
        success: true,
        deposit: updated,
        returnAmount,
        interest,
        releaseType,
    };
}
async function getLeaseDepositStatus(leaseId) {
    const deposit = await database_1.prisma.leaseDeposit.findUnique({ where: { leaseId } });
    if (!deposit)
        return null;
    // Calculate current interest
    const heldMs = Date.now() - deposit.heldAt.getTime();
    const heldDays = Math.floor(heldMs / (24 * 60 * 60 * 1000));
    const currentInterest = deposit.depositAmount * deposit.interestRate * (heldDays / 365.25);
    return {
        ...deposit,
        heldDays,
        currentInterest,
        totalValue: deposit.depositAmount + currentInterest,
    };
}
// ═══════════════════════════════════════════════════════════════════════════════
// PAB PAYMENT FLOW
// ═══════════════════════════════════════════════════════════════════════════════
async function processPabPayment(params) {
    const { rentPaymentId, tenantEmail, propertyId, unitId, amountUsdc, tokenUsed, userId } = params;
    const rentPayment = await database_1.prisma.rentPayment.findUnique({ where: { id: rentPaymentId } });
    if (!rentPayment)
        return { success: false, error: 'Rent payment not found' };
    const existing = await database_1.prisma.pabPayment.findUnique({ where: { rentPaymentId } });
    if (existing)
        return { success: false, error: 'Payment already processed' };
    let amountPab = 0;
    let discountApplied = 0;
    let stakedAmount = 0;
    let finalUsdc = amountUsdc;
    let status = 'PENDING';
    let txHash;
    if (tokenUsed === 'PAB') {
        // 5% discount
        discountApplied = amountUsdc * PAB_DISCOUNT_RATE;
        finalUsdc = amountUsdc - discountApplied;
        amountPab = finalUsdc; // 1 PAB = 1 USDC
        stakedAmount = amountPab * AUTO_STAKE_RATE;
        // Deduct PAB from user wallet
        if (userId) {
            const wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
            if (!wallet || wallet.balance < amountPab) {
                return { success: false, error: `Insufficient PAB balance. Need ${amountPab} PAB` };
            }
            const connection = getConnection();
            const platformKey = getPlatformKeypair();
            if (platformKey) {
                const mintKey = new web3_js_1.PublicKey(PAB_MINT);
                const fromKey = new web3_js_1.PublicKey(wallet.address || '');
                const toKey = platformKey.publicKey;
                const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, fromKey);
                const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, toKey);
                const { Transaction } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
                const transaction = new Transaction();
                const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
                if (!toAccountInfo) {
                    transaction.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(fromKey, toTokenAccount, toKey, mintKey));
                }
                const amountRaw = Math.round(amountPab * Math.pow(10, 9));
                transaction.add((0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], spl_token_1.TOKEN_PROGRAM_ID));
                const { blockhash } = await connection.getRecentBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = fromKey;
                try {
                    // In production, user signs client-side
                    // For simulation, we just record the intent
                    txHash = `pab_payment:${rentPaymentId}:${Date.now()}`;
                    status = 'CONFIRMED';
                }
                catch (err) {
                    logger_1.logger.error(`[PabPayment] Transfer failed: ${err.message}`);
                }
            }
            // Deduct from wallet
            await database_1.prisma.wallet.update({
                where: { userId },
                data: { balance: { decrement: amountPab } },
            });
            // Auto-stake portion for trust score
            if (stakedAmount > 0) {
                const existingStake = await database_1.prisma.stakingRecord.findFirst({
                    where: { userId, status: 'ACTIVE' },
                });
                if (existingStake) {
                    await database_1.prisma.stakingRecord.update({
                        where: { id: existingStake.id },
                        data: { amountPab: { increment: stakedAmount } },
                    });
                }
                else {
                    await database_1.prisma.stakingRecord.create({
                        data: {
                            userId,
                            tier: 'BRONZE',
                            amountPab: stakedAmount,
                            trustBoost: Math.round(stakedAmount / 10),
                            status: 'ACTIVE',
                            unlockAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        },
                    });
                }
                // Update user trust score
                await database_1.prisma.user.update({
                    where: { id: userId },
                    data: { trustScore: { increment: Math.round(stakedAmount / 10) } },
                });
            }
        }
    }
    else {
        // USDC payment - just record
        status = 'CONFIRMED';
        txHash = `usdc_payment:${rentPaymentId}:${Date.now()}`;
    }
    // Create PAB payment record
    const pabPayment = await database_1.prisma.pabPayment.create({
        data: {
            rentPaymentId,
            tenantEmail,
            propertyId,
            unitId,
            amountUsdc: finalUsdc,
            amountPab,
            tokenUsed,
            discountApplied,
            stakedAmount,
            txHash,
            status,
            confirmedAt: status === 'CONFIRMED' ? new Date() : undefined,
        },
    });
    // Update rent payment status
    if (status === 'CONFIRMED') {
        await database_1.prisma.rentPayment.update({
            where: { id: rentPaymentId },
            data: { status: 'PAID', paidAt: new Date() },
        });
    }
    await logPaymentFlow({
        flowType: 'RENT_PAYMENT',
        referenceId: rentPaymentId,
        referenceType: 'RentPayment',
        amount: tokenUsed === 'PAB' ? amountPab : amountUsdc,
        token: tokenUsed,
        status: status === 'CONFIRMED' ? 'COMPLETED' : 'FAILED',
        txHash,
        metadata: {
            tenantEmail,
            propertyId,
            discountApplied,
            stakedAmount,
        },
    });
    return {
        success: status === 'CONFIRMED',
        pabPayment,
        amountPab,
        discountApplied,
        stakedAmount,
        txHash,
    };
}
async function getPaymentHistory(tenantEmail) {
    const usdcPayments = await database_1.prisma.rentPayment.findMany({
        where: { tenantEmail },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    const pabPayments = await database_1.prisma.pabPayment.findMany({
        where: { tenantEmail },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    return {
        usdcPayments: usdcPayments.map((p) => ({
            id: p.id,
            date: p.paidAt || p.dueDate,
            amount: p.amount,
            token: 'USDC',
            status: p.status,
            method: p.method,
        })),
        pabPayments: pabPayments.map((p) => ({
            id: p.id,
            date: p.confirmedAt || p.createdAt,
            amount: p.amountPab,
            token: 'PAB',
            status: p.status,
            discountApplied: p.discountApplied,
            stakedAmount: p.stakedAmount,
            txHash: p.txHash,
        })),
    };
}
// ═══════════════════════════════════════════════════════════════════════════════
// AGENT PAB EARNINGS
// ═══════════════════════════════════════════════════════════════════════════════
async function rewardAgentForTask(params) {
    const agent = await database_1.prisma.agentProfile.findUnique({ where: { id: params.agentId } });
    if (!agent)
        return { success: false, error: 'Agent not found' };
    // Create task reward record
    const reward = await database_1.prisma.agentPabTaskReward.create({
        data: {
            agentId: params.agentId,
            taskType: params.taskType,
            taskDescription: params.taskDescription,
            propertyId: params.propertyId,
            unitId: params.unitId,
            tenantEmail: params.tenantEmail,
            rewardAmount: params.rewardAmount,
            autoConvert: params.autoConvert || false,
            usdcEquivalent: params.autoConvert ? params.rewardAmount : undefined,
            status: 'PENDING',
        },
    });
    // Update agent balance
    await database_1.prisma.agentProfile.update({
        where: { id: params.agentId },
        data: { balancePab: { increment: params.rewardAmount } },
    });
    // If auto-convert, deduct PAB and credit USDC
    if (params.autoConvert) {
        await database_1.prisma.agentProfile.update({
            where: { id: params.agentId },
            data: {
                balancePab: { decrement: params.rewardAmount },
                balanceUsdc: { increment: params.rewardAmount },
            },
        });
        await database_1.prisma.agentPabTaskReward.update({
            where: { id: reward.id },
            data: { status: 'CONVERTED', distributedAt: new Date() },
        });
    }
    else {
        await database_1.prisma.agentPabTaskReward.update({
            where: { id: reward.id },
            data: { status: 'DISTRIBUTED', distributedAt: new Date() },
        });
    }
    await logPaymentFlow({
        flowType: 'AGENT_REWARD',
        referenceId: reward.id,
        referenceType: 'AgentPabTaskReward',
        amount: params.rewardAmount,
        token: 'PAB',
        status: 'COMPLETED',
        metadata: {
            agentId: params.agentId,
            taskType: params.taskType,
            autoConvert: params.autoConvert,
        },
    });
    return {
        success: true,
        reward: { ...reward, status: params.autoConvert ? 'CONVERTED' : 'DISTRIBUTED' },
        agentBalance: agent.balancePab + params.rewardAmount,
    };
}
async function getAgentPabEarnings(agentId) {
    const agent = await database_1.prisma.agentProfile.findUnique({ where: { id: agentId } });
    if (!agent)
        return { success: false, error: 'Agent not found' };
    const rewards = await database_1.prisma.agentPabTaskReward.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
    });
    const totalEarned = rewards
        .filter(r => r.status === 'DISTRIBUTED' || r.status === 'CONVERTED')
        .reduce((s, r) => s + r.rewardAmount, 0);
    const pendingRewards = rewards.filter(r => r.status === 'PENDING');
    const totalPending = pendingRewards.reduce((s, r) => s + r.rewardAmount, 0);
    const convertedRewards = rewards.filter(r => r.status === 'CONVERTED');
    const totalConverted = convertedRewards.reduce((s, r) => s + r.rewardAmount, 0);
    return {
        agent: {
            id: agent.id,
            name: agent.name,
            balancePab: agent.balancePab,
            balanceUsdc: agent.balanceUsdc,
            reputation: agent.reputation,
        },
        rewards,
        totalEarned,
        totalPending,
        totalConverted,
        rewardCount: rewards.length,
    };
}
async function setAutoConvertPreference(agentId, autoConvert) {
    await database_1.prisma.agentProfile.update({
        where: { id: agentId },
        data: {},
    });
    return { success: true, autoConvert };
}
exports.leasePabService = {
    createLeaseWithPabDeposit,
    returnLeaseDeposit,
    getLeaseDepositStatus,
    processPabPayment,
    getPaymentHistory,
    rewardAgentForTask,
    getAgentPabEarnings,
    setAutoConvertPreference,
    PAB_DISCOUNT_RATE,
    AUTO_STAKE_RATE,
    LEASE_DEPOSIT_APY,
};
//# sourceMappingURL=leasePab.service.js.map