"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentWalletService = void 0;
exports.debitAgent = debitAgent;
exports.creditAgent = creditAgent;
exports.collectSolPlatformFee = collectSolPlatformFee;
exports.recordBookingOutcome = recordBookingOutcome;
/**
 * agentWallet.service.ts — autonomous agent spend rail.
 *
 * Centralizes all on-platform agent debits/credits so agents can operate across
 * gigs, bookings, tool calls, and app invocations without bespoke code in each
 * workflow. Protects treasury capital with compliance limits + simulated fallback.
 */
const database_1 = require("../utils/database");
const ptp_spec_1 = require("../protocol/ptp.spec");
const logger_1 = require("../utils/logger");
const COMPLIANCE_DAILY_OUTFLOW = Number(process.env.MAX_DAILY_OUTFLOW_PAB || '100');
const MAX_DAILY_TX = Number(process.env.MAX_TX_PER_DAY || '10');
async function assertCanDebit(agent, amount) {
    if (amount <= 0)
        throw new Error('debit amount must be > 0');
    if ((agent.balancePab || 0) < amount)
        throw new Error(`insufficient PAB balance: ${agent.balancePab} < ${amount}`);
    if (agent.dailyOutflow + amount > COMPLIANCE_DAILY_OUTFLOW) {
        throw new Error(`daily outflow limit reached: ${agent.dailyOutflow} + ${amount} > ${COMPLIANCE_DAILY_OUTFLOW}`);
    }
    if (agent.dailyTransactions >= MAX_DAILY_TX) {
        throw new Error(`daily transaction limit reached: ${agent.dailyTransactions} >= ${MAX_DAILY_TX}`);
    }
}
async function debitAgent(opts) {
    const agent = await database_1.prisma.web3Agent.findUnique({ where: { id: opts.agentId } });
    if (!agent)
        throw new Error(`agent not found: ${opts.agentId}`);
    await assertCanDebit(agent, opts.amount);
    const updated = await database_1.prisma.web3Agent.update({
        where: { id: opts.agentId },
        data: {
            balancePab: { decrement: opts.amount },
            dailyOutflow: { increment: opts.amount },
            dailyTransactions: { increment: 1 },
        },
    });
    await database_1.prisma.agentTransaction.create({
        data: {
            agentId: opts.agentId,
            type: opts.operation,
            amount: -opts.amount,
            fromAddress: agent.walletAddress,
            toAddress: process.env.PABANDI_TREASURY_WALLET || 'TREASURY',
            txHash: opts.refId,
            metadata: opts.metadata || {},
        },
    });
    logger_1.logger.info(`[agentWallet] debit ${opts.amount} PAB from ${agent.profileId} for ${opts.operation}`);
    return { ok: true, balancePab: updated.balancePab, dailyOutflow: updated.dailyOutflow, operation: opts.operation };
}
async function creditAgent(opts) {
    const agent = await database_1.prisma.web3Agent.findUnique({ where: { id: opts.agentId } });
    if (!agent)
        throw new Error(`agent not found: ${opts.agentId}`);
    const updated = await database_1.prisma.web3Agent.update({
        where: { id: opts.agentId },
        data: { balancePab: { increment: opts.amount } },
    });
    await database_1.prisma.agentTransaction.create({
        data: {
            agentId: opts.agentId,
            type: opts.operation,
            amount: opts.amount,
            fromAddress: process.env.PABANDI_TREASURY_WALLET || 'TREASURY',
            toAddress: agent.walletAddress,
            txHash: opts.refId,
            metadata: opts.metadata || {},
        },
    });
    logger_1.logger.info(`[agentWallet] credit ${opts.amount} PAB to ${agent.profileId} for ${opts.operation}`);
    return { ok: true, balancePab: updated.balancePab, operation: opts.operation };
}
/**
 * Collect the SOL platform fee for a booking/tool-call event atomically.
 * This is the canonical entry point for fee collection across the platform.
 */
async function collectSolPlatformFee(opts) {
    const fee = Math.max(0, opts.amountSol);
    if (fee === 0)
        return { ok: true, recorded: false };
    await database_1.prisma.treasuryPosition.create({
        data: {
            bucket: 'PLATFORM_FEE',
            kind: 'ESCROW',
            amount: fee,
            txHash: opts.metadata?.txHash || `sol-fee:${opts.gigId || opts.bookingId || 'unknown'}`,
            status: 'DEPLOYED',
            meta: {
                asset: 'SOL',
                source: 'AGENT_PLATFORM_FEE',
                agentId: opts.agentId,
                gigId: opts.gigId,
                bookingId: opts.bookingId,
                ...opts.metadata,
            },
        },
    });
    return { ok: true, recorded: true, amountSol: fee };
}
/**
 * Record a booking outcome and update reputation/trust.
 */
async function recordBookingOutcome(opts) {
    const agent = await database_1.prisma.web3Agent.findUnique({ where: { id: opts.agentId } });
    if (!agent)
        throw new Error(`agent not found: ${opts.agentId}`);
    let stake = await database_1.prisma.agentStake.findUnique({ where: { agentId: opts.agentId } });
    if (!stake) {
        stake = await database_1.prisma.agentStake.create({
            data: { agentId: opts.agentId, amountPab: 0, vault: process.env.PABANDI_TREASURY_WALLET || 'TREASURY' },
        });
    }
    let stakeDelta = 0;
    let trustDelta = 0;
    if (opts.status === 'COMPLETED') {
        const bonus = +(opts.qualityScore ? opts.qualityScore * 0.2 : 2).toFixed(2);
        stakeDelta = bonus;
        trustDelta = 5;
        await database_1.prisma.agentTransaction.create({
            data: {
                agentId: opts.agentId,
                type: 'BONUS',
                amount: bonus,
                fromAddress: process.env.PABANDI_TREASURY_WALLET || 'TREASURY',
                toAddress: agent.walletAddress,
                txHash: `bonus:${opts.agentId}:${opts.gigId || opts.bookingId || Date.now()}`,
                metadata: { reason: 'completed', gigId: opts.gigId, bookingId: opts.bookingId },
            },
        });
    }
    else if (opts.status === 'NO_SHOW') {
        const slash = Math.min(stake.amountPab, 5);
        stakeDelta = -slash;
        trustDelta = -15;
        await database_1.prisma.agentTransaction.create({
            data: {
                agentId: opts.agentId,
                type: 'SLASH',
                amount: -slash,
                fromAddress: agent.walletAddress,
                toAddress: process.env.PABANDI_TREASURY_WALLET || 'TREASURY',
                txHash: `slash:${opts.agentId}:${opts.gigId || opts.bookingId || Date.now()}`,
                metadata: { reason: 'no-show', gigId: opts.gigId, bookingId: opts.bookingId },
            },
        });
    }
    if (stakeDelta !== 0) {
        await database_1.prisma.agentStake.update({
            where: { agentId: opts.agentId },
            data: {
                amountPab: { increment: stakeDelta },
                indexed: stake.amountPab + stakeDelta >= 2000,
            },
        });
    }
    const updated = await database_1.prisma.web3Agent.update({
        where: { id: opts.agentId },
        data: { balancePab: { increment: Math.max(0, stakeDelta) } },
    });
    try {
        const trustScore = Math.max(0, Math.min(100, 50 + trustDelta));
        ptp_spec_1.ptpEngine.issueAgentPassport({
            agentId: opts.agentId,
            ownerUserId: opts.agentId,
            capabilities: ['act:book', 'act:bid', 'act:deliver'],
            trustScore,
            velocity: {
                direction: trustDelta > 0 ? 'RISING' : trustDelta < 0 ? 'DECLINING' : 'STEADY',
                momentum: Math.abs(trustDelta) / 10,
                confidence: 0.7,
            },
        });
    }
    catch (e) {
        logger_1.logger.warn(`[agentWallet] attestation re-issue failed: ${e.message}`);
    }
    return {
        ok: true,
        status: opts.status,
        stakeDelta,
        trustDelta,
        newBalance: updated.balancePab,
    };
}
exports.agentWalletService = {
    debitAgent,
    creditAgent,
    collectSolPlatformFee,
    recordBookingOutcome,
};
//# sourceMappingURL=agentWallet.service.js.map