"use strict";
/**
 * Pabandi Frictionless Payment Agent
 * ==================================
 *
 * Users NEVER touch crypto directly.
 * The agent handles ALL on-chain complexity.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentAgent = exports.FrictionlessPaymentAgent = void 0;
const database_1 = require("../utils/database");
const raydiumPool_service_1 = require("./raydiumPool.service");
const PAB_PRICE_USDC = 0.000178; // Current DEX price
const BOOKING_DEPOSIT_RATE = 0.10; // 10% of booking value
const CHECKIN_REWARD_RATE = 0.01; // 1% of booking value
const PAB_DISCOUNT_RATE = 0.05; // 5% discount for PAB payments
const AUTO_STAKE_RATE = 0.10; // 10% of PAB earned auto-staked
class FrictionlessPaymentAgent {
    /**
     * Process a payment from a user (in USD)
     * Agent handles all crypto conversion on the backend
     */
    async processPayment(userId, amountUsd, type, referenceId) {
        try {
            const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
            if (!user)
                return { success: false, amountUsd };
            // Use agent's balance for tracking
            const agentProfile = await database_1.prisma.agentProfile.findFirst({ where: { isActive: true } });
            if (!agentProfile)
                return { success: false, amountUsd };
            const pabAmount = amountUsd / PAB_PRICE_USDC;
            switch (type) {
                case 'booking_deposit':
                    return this.executeBookingDeposit(agentProfile.id, amountUsd, pabAmount);
                case 'rent_payment':
                    return this.executeRentPayment(agentProfile.id, amountUsd, pabAmount);
                case 'lease_deposit':
                    return this.executeLeaseDeposit(agentProfile.id, amountUsd, pabAmount);
                case 'reward_payout':
                    return this.executeRewardPayout(agentProfile.id, amountUsd, pabAmount);
                default:
                    return { success: false, amountUsd };
            }
        }
        catch (err) {
            console.error('[PaymentAgent] Error:', err.message);
            return { success: false, amountUsd };
        }
    }
    /**
     * Booking deposit: Agent locks PAB in escrow
     */
    async executeBookingDeposit(agentId, amountUsd, pabAmount) {
        // Deduct from agent's USDC balance
        await database_1.prisma.agentProfile.update({
            where: { id: agentId },
            data: { balanceUsdc: { decrement: amountUsd } },
        });
        // Add PAB to agent's staked balance
        await database_1.prisma.agentProfile.update({
            where: { id: agentId },
            data: { balancePab: { increment: pabAmount } },
        });
        return { success: true, amountUsd, amountPab: pabAmount };
    }
    /**
     * Check-in reward: Agent distributes PAB reward
     */
    async processCheckinReward(agentId, bookingValueUsd) {
        const rewardUsd = bookingValueUsd * CHECKIN_REWARD_RATE;
        const rewardPab = rewardUsd / PAB_PRICE_USDC;
        // Auto-stake 10% for trust score
        const stakeAmount = rewardPab * AUTO_STAKE_RATE;
        const payoutAmount = rewardPab - stakeAmount;
        // Update agent balances
        await database_1.prisma.agentProfile.update({
            where: { id: agentId },
            data: { balancePab: { increment: payoutAmount } },
        });
        return { success: true, amountUsd: rewardUsd, amountPab: rewardPab };
    }
    /**
     * Rent payment: Agent converts USDC to PAB, sends to landlord
     */
    async executeRentPayment(agentId, amountUsd, pabAmount) {
        const discount = amountUsd * PAB_DISCOUNT_RATE;
        const finalAmount = amountUsd - discount;
        // Deduct USDC from agent
        await database_1.prisma.agentProfile.update({
            where: { id: agentId },
            data: { balanceUsdc: { decrement: finalAmount } },
        });
        // Add PAB to agent's balance
        await database_1.prisma.agentProfile.update({
            where: { id: agentId },
            data: { balancePab: { increment: pabAmount } },
        });
        return { success: true, amountUsd: finalAmount, amountPab: pabAmount };
    }
    /**
     * Lease deposit: Agent locks PAB in escrow
     */
    async executeLeaseDeposit(agentId, amountUsd, pabAmount) {
        await database_1.prisma.agentProfile.update({
            where: { id: agentId },
            data: {
                balanceUsdc: { decrement: amountUsd },
                balancePab: { increment: pabAmount },
            },
        });
        return { success: true, amountUsd, amountPab: pabAmount };
    }
    /**
     * Reward payout: Convert PAB to USDC for agent
     */
    async executeRewardPayout(agentId, amountUsd, pabAmount) {
        // Sell PAB on DEX for USDC
        const result = await (0, raydiumPool_service_1.sellPAB)(agentId, pabAmount);
        if (result.success) {
            await database_1.prisma.agentProfile.update({
                where: { id: agentId },
                data: {
                    balancePab: { decrement: pabAmount },
                    balanceUsdc: { increment: result.usdcReceived || 0 },
                },
            });
        }
        return { success: result.success, amountUsd, amountPab: pabAmount };
    }
    /**
     * Get agent's portfolio (USD only — no crypto jargon)
     */
    async getAgentPortfolio(agentId) {
        const agent = await database_1.prisma.agentProfile.findUnique({ where: { id: agentId } });
        if (!agent)
            return null;
        const pabPrice = PAB_PRICE_USDC;
        const pabValueUsd = agent.balancePab * pabPrice;
        const totalValue = agent.balanceUsdc + pabValueUsd;
        return {
            usdcBalance: agent.balanceUsdc,
            pabBalance: agent.balancePab,
            pabValueUsd,
            totalValueUsd: totalValue,
            trustScore: agent.reputation,
        };
    }
}
exports.FrictionlessPaymentAgent = FrictionlessPaymentAgent;
exports.paymentAgent = new FrictionlessPaymentAgent();
//# sourceMappingURL=frictionlessPayment.service.js.map