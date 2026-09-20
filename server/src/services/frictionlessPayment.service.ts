/**
 * Pabandi Frictionless Payment Agent
 * ==================================
 * 
 * Users NEVER touch crypto directly.
 * The agent handles ALL on-chain complexity.
 */

import { prisma } from '../utils/database';
import { buyPAB, sellPAB, getPoolInfo } from './raydiumPool.service';

const PAB_PRICE_USDC = 0.000178; // Current DEX price
const BOOKING_DEPOSIT_RATE = 0.10; // 10% of booking value
const CHECKIN_REWARD_RATE = 0.01; // 1% of booking value
const PAB_DISCOUNT_RATE = 0.05; // 5% discount for PAB payments
const AUTO_STAKE_RATE = 0.10; // 10% of PAB earned auto-staked

export class FrictionlessPaymentAgent {
  
  /**
   * Process a payment from a user (in USD)
   * Agent handles all crypto conversion on the backend
   */
  async processPayment(userId: string, amountUsd: number, type: string, referenceId: string): Promise<{ success: boolean; amountUsd: number; amountPab?: number }> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return { success: false, amountUsd };
      
      // Use agent's balance for tracking
      const agentProfile = await prisma.agentProfile.findFirst({ where: { isActive: true } });
      if (!agentProfile) return { success: false, amountUsd };
      
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
    } catch (err: any) {
      console.error('[PaymentAgent] Error:', err.message);
      return { success: false, amountUsd };
    }
  }
  
  /**
   * Booking deposit: Agent locks PAB in escrow
   */
  private async executeBookingDeposit(agentId: string, amountUsd: number, pabAmount: number) {
    // Deduct from agent's USDC balance
    await prisma.agentProfile.update({
      where: { id: agentId },
      data: { balanceUsdc: { decrement: amountUsd } },
    });
    
    // Add PAB to agent's staked balance
    await prisma.agentProfile.update({
      where: { id: agentId },
      data: { balancePab: { increment: pabAmount } },
    });
    
    return { success: true, amountUsd, amountPab: pabAmount };
  }
  
  /**
   * Check-in reward: Agent distributes PAB reward
   */
  async processCheckinReward(agentId: string, bookingValueUsd: number): Promise<{ success: boolean; amountUsd: number; amountPab: number }> {
    const rewardUsd = bookingValueUsd * CHECKIN_REWARD_RATE;
    const rewardPab = rewardUsd / PAB_PRICE_USDC;
    
    // Auto-stake 10% for trust score
    const stakeAmount = rewardPab * AUTO_STAKE_RATE;
    const payoutAmount = rewardPab - stakeAmount;
    
    // Update agent balances
    await prisma.agentProfile.update({
      where: { id: agentId },
      data: { balancePab: { increment: payoutAmount } },
    });
    
    return { success: true, amountUsd: rewardUsd, amountPab: rewardPab };
  }
  
  /**
   * Rent payment: Agent converts USDC to PAB, sends to landlord
   */
  private async executeRentPayment(agentId: string, amountUsd: number, pabAmount: number) {
    const discount = amountUsd * PAB_DISCOUNT_RATE;
    const finalAmount = amountUsd - discount;
    
    // Deduct USDC from agent
    await prisma.agentProfile.update({
      where: { id: agentId },
      data: { balanceUsdc: { decrement: finalAmount } },
    });
    
    // Add PAB to agent's balance
    await prisma.agentProfile.update({
      where: { id: agentId },
      data: { balancePab: { increment: pabAmount } },
    });
    
    return { success: true, amountUsd: finalAmount, amountPab: pabAmount };
  }
  
  /**
   * Lease deposit: Agent locks PAB in escrow
   */
  private async executeLeaseDeposit(agentId: string, amountUsd: number, pabAmount: number) {
    await prisma.agentProfile.update({
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
  private async executeRewardPayout(agentId: string, amountUsd: number, pabAmount: number) {
    // Sell PAB on DEX for USDC
    const result = await sellPAB(agentId, pabAmount);
    
    if (result.success) {
      await prisma.agentProfile.update({
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
  async getAgentPortfolio(agentId: string) {
    const agent = await prisma.agentProfile.findUnique({ where: { id: agentId } });
    if (!agent) return null;
    
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

export const paymentAgent = new FrictionlessPaymentAgent();
