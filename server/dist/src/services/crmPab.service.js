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
exports.crmPabService = void 0;
exports.getManagerPabBalance = getManagerPabBalance;
exports.getStakingOverview = getStakingOverview;
exports.getRevenueAnalytics = getRevenueAnalytics;
exports.getTenantRiskWithPabScoring = getTenantRiskWithPabScoring;
exports.createBulkPabReward = createBulkPabReward;
exports.distributeBulkPabReward = distributeBulkPabReward;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const PAB_MINT = 'G811FHWiZrqY1DZKz6dQySpJFPTDfe21B8LRnDqa1z5Y';
const PAB_DISCOUNT_RATE = 0.05; // 5% discount for PAB payments
const AUTO_STAKE_RATE = 0.10; // 10% auto-stake for trust score
const PAB_PRICE_USDC = 1.0; // 1 PAB = 1 USDC (simplified; in production use oracle)
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
/**
 * Log payment flow for verification and audit trail
 */
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
async function getManagerPabBalance(managerId) {
    const tenants = await database_1.prisma.propertyTenant.findMany({
        where: { managerId },
        select: { id: true, email: true },
    });
    const tenantBalances = await Promise.all(tenants.map(async (t) => {
        const wallet = await database_1.prisma.wallet.findFirst({
            where: { user: { email: t.email } },
        });
        return { tenantId: t.id, email: t.email, balance: wallet?.balance || 0 };
    }));
    const totalPabBalance = tenantBalances.reduce((s, t) => s + t.balance, 0);
    // Get staked amounts from StakingRecord
    const stakedRecords = await database_1.prisma.stakingRecord.findMany({
        where: { status: 'ACTIVE' },
        include: { user: true },
    });
    // Filter by tenants belonging to this manager
    const tenantEmails = new Set(tenants.map(t => t.email));
    const tenantStakes = stakedRecords.filter(s => s.user?.email && tenantEmails.has(s.user.email));
    const totalPabStaked = tenantStakes.reduce((s, r) => s + r.amountPab, 0);
    return { managerId, totalPabBalance, totalPabStaked, tenantBalances };
}
async function getStakingOverview(managerId) {
    const tenants = await database_1.prisma.propertyTenant.findMany({
        where: { managerId },
        select: { id: true, email: true },
    });
    const tenantEmails = tenants.map(t => t.email);
    const stakedRecords = await database_1.prisma.stakingRecord.findMany({
        where: { status: 'ACTIVE' },
        include: { user: true },
    });
    const tenantStakes = stakedRecords
        .filter(s => s.user?.email && tenantEmails.includes(s.user.email))
        .map(s => ({
        tenantId: tenants.find(t => t.email === s.user?.email)?.id || '',
        email: s.user?.email || '',
        amount: s.amountPab,
        tier: s.tier,
    }));
    const totalStaked = tenantStakes.reduce((s, t) => s + t.amount, 0);
    // Aggregate by tier
    const tierMap = new Map();
    for (const stake of tenantStakes) {
        const existing = tierMap.get(stake.tier) || { count: 0, totalAmount: 0 };
        existing.count++;
        existing.totalAmount += stake.amount;
        tierMap.set(stake.tier, existing);
    }
    const tiers = Array.from(tierMap.entries()).map(([tier, data]) => ({ tier, ...data }));
    return { managerId, totalStaked, tenantStakes, tiers };
}
async function getRevenueAnalytics(managerId) {
    // Get all rent payments for this manager's properties
    const properties = await database_1.prisma.propertyManagerProperty.findMany({
        where: { managerId },
        select: { id: true, title: true },
    });
    const propertyIds = properties.map(p => p.id);
    const rentPayments = await database_1.prisma.rentPayment.findMany({
        where: { propertyId: { in: propertyIds } },
        orderBy: { paidAt: 'asc' },
    });
    const pabPayments = await database_1.prisma.pabPayment.findMany({
        where: { propertyId: { in: propertyIds } },
    });
    // Aggregate by month
    const monthlyMap = new Map();
    for (const p of rentPayments.filter(p => p.status === 'PAID' && p.paidAt)) {
        const month = p.paidAt.toISOString().slice(0, 7);
        const existing = monthlyMap.get(month) || { usdc: 0, pab: 0 };
        existing.usdc += p.amount;
        monthlyMap.set(month, existing);
    }
    for (const p of pabPayments.filter(pp => pp.status === 'CONFIRMED')) {
        const month = p.createdAt.toISOString().slice(0, 7);
        const existing = monthlyMap.get(month) || { usdc: 0, pab: 0 };
        existing.pab += p.amountPab;
        monthlyMap.set(month, existing);
    }
    const byMonth = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({
        month,
        usdc: data.usdc,
        pab: data.pab,
        totalUsdc: data.usdc + data.pab * PAB_PRICE_USDC,
    }))
        .sort((a, b) => a.month.localeCompare(b.month));
    // Aggregate by property
    const byProperty = properties.map(prop => {
        const propRent = rentPayments.filter(r => r.propertyId === prop.id && r.status === 'PAID');
        const propPab = pabPayments.filter(p => p.propertyId === prop.id && p.status === 'CONFIRMED');
        const usdc = propRent.reduce((s, r) => s + r.amount, 0);
        const pab = propPab.reduce((s, p) => s + p.amountPab, 0);
        return { propertyId: prop.id, title: prop.title, usdc, pab };
    });
    const totalUsdcRevenue = byMonth.reduce((s, m) => s + m.usdc, 0);
    const totalPabRevenue = byMonth.reduce((s, m) => s + m.pab, 0);
    const totalRevenueUsdc = totalUsdcRevenue + totalPabRevenue * PAB_PRICE_USDC;
    return {
        managerId,
        totalUsdcRevenue,
        totalPabRevenue,
        totalRevenueUsdc,
        byMonth,
        byProperty,
    };
}
async function getTenantRiskWithPabScoring(tenantId) {
    const tenant = await database_1.prisma.propertyTenant.findUnique({ where: { id: tenantId } });
    if (!tenant)
        return null;
    // Base risk from CRM automation service
    const baseRisk = await database_1.prisma.propertyTenant.findUnique({ where: { id: tenantId } });
    // Calculate PAB-based adjustment
    const wallet = await database_1.prisma.wallet.findFirst({ where: { user: { email: tenant.email } } });
    const stakingRecords = await database_1.prisma.stakingRecord.findMany({
        where: { userId: wallet?.userId || '', status: 'ACTIVE' },
    });
    const pabStaked = stakingRecords.reduce((s, r) => s + r.amountPab, 0);
    const pabBalance = wallet?.balance || 0;
    // PAB staking reduces risk (up to 20 points reduction for high staking)
    const stakeScore = Math.min(pabStaked / 100, 20); // 100 PAB staked = 1 point, max 20
    const balanceScore = Math.min(pabBalance / 500, 10); // 500 PAB balance = 1 point, max 10
    const pabAdjustment = stakeScore + balanceScore;
    // Start with base risk factors
    const factors = [];
    let baseScore = 100;
    // Payment history
    const ledger = await database_1.prisma.tenantLedger.findMany({ where: { tenantId } });
    const lateFees = ledger.filter(l => l.type === 'LATE_FEE').length;
    const totalPayments = ledger.filter(l => l.type === 'RENT').length;
    const lateRatio = totalPayments > 0 ? lateFees / totalPayments : 0;
    const paymentPenalty = Math.min(lateRatio * 50, 50);
    baseScore -= paymentPenalty;
    if (paymentPenalty > 0)
        factors.push({ label: 'Late payment ratio', impact: -paymentPenalty });
    // PAB adjustment (positive)
    baseScore += pabAdjustment;
    if (pabAdjustment > 0)
        factors.push({ label: 'PAB staking/balance boost', impact: pabAdjustment });
    // Screening band
    const screening = await database_1.prisma.propertyScreening.findFirst({
        where: { tenantEmail: tenant.email },
        orderBy: { screenedAt: 'desc' },
    });
    if (screening) {
        const bandPenalty = screening.band === 'HIGH' ? 30 : screening.band === 'MEDIUM' ? 10 : 0;
        baseScore -= bandPenalty;
        if (bandPenalty > 0)
            factors.push({ label: `Screening: ${screening.band}`, impact: -bandPenalty });
    }
    const adjustedRiskScore = Math.max(0, Math.min(100, Math.round(baseScore)));
    const riskBand = adjustedRiskScore >= 70 ? 'LOW' : adjustedRiskScore >= 40 ? 'MEDIUM' : 'HIGH';
    return {
        tenantId,
        email: tenant.email,
        riskScore: adjustedRiskScore,
        riskBand,
        pabStaked,
        pabBalance,
        adjustedRiskScore,
        factors,
    };
}
// ═══════════════════════════════════════════════════════════════════════════════
// BULK PAB REWARDS DISTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════════
async function createBulkPabReward(params) {
    const totalAmount = params.recipients.reduce((s, r) => s + r.amount, 0);
    const reward = await database_1.prisma.crmPabReward.create({
        data: {
            managerId: params.managerId,
            name: params.name,
            description: params.description,
            totalAmount,
            recipientCount: params.recipients.length,
            status: 'DRAFT',
            recipients: {
                create: params.recipients.map(r => ({
                    contactId: r.contactId,
                    email: r.email,
                    amount: r.amount,
                    status: 'PENDING',
                })),
            },
        },
        include: { recipients: true },
    });
    await logPaymentFlow({
        flowType: 'BULK_REWARD_CREATED',
        referenceId: reward.id,
        referenceType: 'CrmPabReward',
        amount: totalAmount,
        token: 'PAB',
        status: 'INITIATED',
        metadata: { recipientCount: params.recipients.length },
    });
    return reward;
}
async function distributeBulkPabReward(rewardId) {
    const reward = await database_1.prisma.crmPabReward.findUnique({
        where: { id: rewardId },
        include: { recipients: true },
    });
    if (!reward)
        return { success: false, error: 'Reward not found' };
    const platformKey = getPlatformKeypair();
    if (!platformKey)
        return { success: false, error: 'Platform wallet not configured' };
    const connection = getConnection();
    const mintKey = new web3_js_1.PublicKey(PAB_MINT);
    const fromKey = platformKey.publicKey;
    const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, fromKey);
    let sentCount = 0;
    let failedCount = 0;
    for (const recipient of reward.recipients) {
        if (recipient.status !== 'PENDING')
            continue;
        try {
            // Find user wallet by email
            const user = await database_1.prisma.user.findUnique({ where: { email: recipient.email } });
            if (!user) {
                await database_1.prisma.crmPabRewardRecipient.update({
                    where: { id: recipient.id },
                    data: { status: 'FAILED' },
                });
                failedCount++;
                continue;
            }
            const wallet = await database_1.prisma.wallet.findUnique({ where: { userId: user.id } });
            if (!wallet?.address) {
                await database_1.prisma.crmPabRewardRecipient.update({
                    where: { id: recipient.id },
                    data: { status: 'FAILED' },
                });
                failedCount++;
                continue;
            }
            const toKey = new web3_js_1.PublicKey(wallet.address);
            const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintKey, toKey);
            const { Transaction } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
            const transaction = new Transaction();
            const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
            if (!toAccountInfo) {
                transaction.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(fromKey, toTokenAccount, toKey, mintKey));
            }
            const amountRaw = Math.round(recipient.amount * Math.pow(10, 9));
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
                logger_1.logger.error(`[CrmPabReward] Transfer failed for ${recipient.email}: ${err.message}`);
            }
            await database_1.prisma.crmPabRewardRecipient.update({
                where: { id: recipient.id },
                data: {
                    status: txHash ? 'SENT' : 'FAILED',
                    txHash: txHash,
                    sentAt: txHash ? new Date() : undefined,
                },
            });
            if (txHash) {
                // Update user wallet balance
                await database_1.prisma.wallet.update({
                    where: { userId: user.id },
                    data: { balance: { increment: recipient.amount } },
                });
                sentCount++;
            }
            else {
                failedCount++;
            }
        }
        catch (err) {
            logger_1.logger.error(`[CrmPabReward] Recipient ${recipient.email} failed: ${err.message}`);
            await database_1.prisma.crmPabRewardRecipient.update({
                where: { id: recipient.id },
                data: { status: 'FAILED' },
            });
            failedCount++;
        }
    }
    const finalStatus = failedCount === 0 ? 'DISTRIBUTED' : sentCount > 0 ? 'PARTIAL' : 'FAILED';
    await database_1.prisma.crmPabReward.update({
        where: { id: rewardId },
        data: {
            status: finalStatus,
            distributedAt: new Date(),
        },
    });
    await logPaymentFlow({
        flowType: 'BULK_REWARD_DISTRIBUTED',
        referenceId: rewardId,
        referenceType: 'CrmPabReward',
        amount: reward.totalAmount,
        token: 'PAB',
        status: finalStatus === 'DISTRIBUTED' ? 'COMPLETED' : 'FAILED',
        metadata: { sentCount, failedCount },
    });
    return { success: true, sentCount, failedCount, status: finalStatus };
}
exports.crmPabService = {
    getManagerPabBalance,
    getStakingOverview,
    getRevenueAnalytics,
    getTenantRiskWithPabScoring,
    createBulkPabReward,
    distributeBulkPabReward,
    PAB_DISCOUNT_RATE,
    AUTO_STAKE_RATE,
    PAB_PRICE_USDC,
};
//# sourceMappingURL=crmPab.service.js.map