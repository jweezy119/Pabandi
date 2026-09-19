import { prisma } from '../utils/database';

/**
 * Pabandi On-Chain Settlement Service
 * ===================================
 *
 * Runs periodically (e.g., hourly or daily):
 * 1. Accumulates all agent credits since last settlement
 * 2. Calls autoApproval.autoTransfer() for each agent
 * 3. Records the on-chain tx hash in UsdcTransfer
 * 4. Marks credits as settled
 *
 * THIS is what makes Phantom wallets show real USDC movement.
 */

import { autoApproval } from './autoApproval.service';

const SETTLEMENT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

interface SettlementResult {
  settled: number;
  failed: number;
  totalUsdc: number;
  totalSolCost: number;
  txHashes: string[];
  errors: string[];
}

export class SettlementService {

  /**
   * Run settlement: move real USDC to agents based on accumulated credits
   */
  async runSettlement(): Promise<SettlementResult> {
    const result: SettlementResult = {
      settled: 0,
      failed: 0,
      totalUsdc: 0,
      totalSolCost: 0,
      txHashes: [],
      errors: [],
    };

    if (!autoApproval.isEnabled()) {
      result.errors.push('Auto-approval not enabled — PLATFORM_PRIVATE_KEY not set');
      return result;
    }

    try {
      // 1. Find all unsettled agent credits
      const unsettledRewards = await prisma.rewardTransaction.findMany({
        where: {
          status: 'CLAIMED',
          settledAt: null,
        },
      });

      if (unsettledRewards.length === 0) {
        return result;
      }

      // 2. Group by agent and sum credits
      const agentCredits = new Map<string, { agentId: string; totalUsdc: number; walletAddress: string }>();

      for (const reward of unsettledRewards) {
        // Get agent wallet — first try AgentWallet, then fallback to AgentProfile
        let walletAddr = '';
        const agentWallet = await prisma.agentWallet.findUnique({
          where: { agentId: reward.userId },
        });
        if (agentWallet) {
          walletAddr = agentWallet.publicKey;
        } else {
          const agent = await prisma.agentProfile.findUnique({
            where: { id: reward.userId },
          });
          if (agent) {
            walletAddr = agent.walletAddress;
            // Also create an AgentWallet for next time
            await prisma.agentWallet.create({
              data: {
                agentId: reward.userId,
                publicKey: walletAddr,
                encryptedSecret: '',
                balanceUsdc: 0,
              },
            }).catch(() => {});
          }
        }

        const existing = agentCredits.get(reward.userId) || {
          agentId: reward.userId,
          totalUsdc: 0,
          walletAddress: walletAddr,
        };

        existing.totalUsdc += reward.usdValue;
        agentCredits.set(reward.userId, existing);
      }

      // 3. Settle each agent with on-chain USDC transfer
      for (const [agentId, credit] of agentCredits) {
        if (credit.totalUsdc < 0.01) continue; // Skip dust

        try {
          // Transfer real USDC from platform wallet to agent wallet
          const txResult = await autoApproval.autoTransfer({
            toWallet: credit.walletAddress,
            amountUsdc: credit.totalUsdc,
            referenceId: `settlement-${agentId}-${Date.now()}`,
          });

          if (txResult.success && txResult.txHash) {
            // Record the on-chain transfer
            await prisma.usdcTransfer.create({
              data: {
                fromWallet: autoApproval.getPlatformAddress(),
                toWallet: credit.walletAddress,
                amountUsdc: credit.totalUsdc,
                txHash: txResult.txHash,
                type: 'AGENT_PAYMENT',
                referenceId: agentId,
                status: 'CONFIRMED',
                blockTime: new Date(),
              },
            });

            // Mark rewards as settled
            await prisma.rewardTransaction.updateMany({
              where: {
                userId: agentId,
                status: 'CLAIMED',
                settledAt: null,
              },
              data: { settledAt: new Date() },
            });

            result.settled++;
            result.totalUsdc += credit.totalUsdc;
            result.txHashes.push(txResult.txHash);
          } else {
            result.failed++;
            result.errors.push(`Agent ${agentId}: ${txResult.error}`);
          }
        } catch (err: any) {
          result.failed++;
          result.errors.push(`Agent ${agentId}: ${err.message}`);
        }
      }

      return result;
    } catch (err: any) {
      result.errors.push(`Settlement failed: ${err.message}`);
      return result;
    }
  }

  /**
   * Start periodic settlement
   */
  startPeriodicSettlement(): ReturnType<typeof setInterval> {
    // Run immediately
    this.runSettlement().then(result => {
      if (result.settled > 0) {
        console.log(`[Settlement] Settled ${result.settled} agents, $${result.totalUsdc.toFixed(2)} USDC`);
      }
    });

    // Run on interval
    return setInterval(async () => {
      const result = await this.runSettlement();
      if (result.settled > 0) {
        console.log(`[Settlement] Settled ${result.settled} agents, $${result.totalUsdc.toFixed(2)} USDC`);
      }
    }, SETTLEMENT_INTERVAL_MS);
  }
}

export const settlementService = new SettlementService();
