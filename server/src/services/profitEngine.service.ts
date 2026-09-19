import { prisma } from '../utils/database';
import { compoundingService } from './compounding.service';

// ─── Configuration ───────────────────────────────────────
const DEFAULT_FEE_RATE = 0.10; // 10% — managed by compounding service
const MIN_CYCLE_TIME = 30;
const TARGET_CYCLE_TIME = 60;
const PAB_REWARD_RATE = 0.05;
const PAB_PRICE = 0.10;

// ─── Rate Limiting Protection ────────────────────────────
const MIN_CYCLE_INTERVAL_MS = 200;
const MAX_CYCLES_PER_MINUTE = 100;
const RPC_RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 3;

interface CycleResult {
  cycleNumber: number;
  cycleTime: number;
  projectId: string;
  revenue: number;
  pabIssued: number;
  success: boolean;
}

interface ProfitReport {
  totalCycles: number;
  totalRevenue: number;
  totalPabIssued: number;
  avgCycleTime: number;
  capitalVelocity: number;
  dailyRevenue: number;
  monthlyRevenue: number;
  annualRevenue: number;
  roiPercent: number;
  efficiency: number;
  currentFeeRate: number;
  protectedDailyRevenue: number;
  protectedMonthlyRevenue: number;
}

export class ProfitEngine {
  private cycleCount = 0;
  private totalRevenue = 0;
  private totalPabIssued = 0;
  private cycleTimes: number[] = [];
  private lastCycleTime = 0;
  private cyclesThisMinute = 0;
  private minuteResetTime = Date.now();

  // Use dynamic fee rate from compounding service
  private get feeRate(): number {
    return compoundingService.getCurrentSettings().feeRate;
  }
  
  // Use dynamic task value from compounding service
  private get taskValue(): number {
    return compoundingService.getCurrentSettings().taskValue;
  }

  // ─── RATE LIMIT CHECK ──────────────────────────────────
  private isRateLimited(): boolean {
    const now = Date.now();
    
    // Reset minute counter
    if (now - this.minuteResetTime > 60000) {
      this.cyclesThisMinute = 0;
      this.minuteResetTime = now;
    }
    
    // Check per-minute limit
    if (this.cyclesThisMinute >= MAX_CYCLES_PER_MINUTE) {
      return true;
    }
    
    // Check minimum interval
    if (now - this.lastCycleTime < MIN_CYCLE_INTERVAL_MS) {
      return true;
    }
    
    return false;
  }

  private recordCycleExecution(): void {
    this.lastCycleTime = Date.now();
    this.cyclesThisMinute++;
  }

  // ─── CORE: Run One Profit Cycle ────────────────────────
  async runCycle(): Promise<CycleResult> {
    if (this.isRateLimited()) {
      return {
        cycleNumber: this.cycleCount,
        cycleTime: 0,
        projectId: '',
        revenue: 0,
        pabIssued: 0,
        success: false,
      };
    }

    const startTime = Date.now();
    this.cycleCount++;
    this.recordCycleExecution();

    try {
      const agents = await prisma.agentProfile.findMany({
        where: { isActive: true, reputation: { gt: 30 }, walletAddress: { not: { startsWith: '0x' } } },
        orderBy: { reputation: 'desc' },
        take: 10,
      });

      if (agents.length < 2) {
        return this.recordCycle(startTime, '', 0, 0, false);
      }

      const poster = agents[0];
      const solver = agents.slice(1).find(a =>
        a.capabilities.some(c => poster.capabilities.includes(c))
      ) || agents[1];

      const avgCycleTime = this.getAvgCycleTime();
      let projectValue = this.taskValue;
      if (avgCycleTime < TARGET_CYCLE_TIME && this.cycleCount > 10) {
        projectValue = Math.min(this.taskValue * 2, this.taskValue * (1 + this.cycleCount / 100));
      }

      const project = await prisma.agentProject.create({
        data: {
          title: `Micro-task #${this.cycleCount}`,
          description: `Automated micro-task cycle #${this.cycleCount}`,
          requirements: 'Complete within 60 seconds',
          posterId: poster.id,
          budgetUsd: projectValue,
          budgetPab: projectValue / PAB_PRICE,
          deadline: new Date(Date.now() + 120000),
          category: 'micro',
          complexity: 'LOW',
          status: 'FUNDED',
        },
      });

      const bid = await prisma.agentProjectBid.create({
        data: {
          projectId: project.id,
          bidderId: solver.id,
          proposedAmount: projectValue,
          proposedPab: projectValue / PAB_PRICE,
          timelineHours: 1,
          approach: 'Auto-matched by ProfitEngine',
          status: 'ACCEPTED',
          isWinning: true,
          acceptedAt: new Date(),
        },
      });

      const platformFee = projectValue * this.feeRate;
      const releaseAmount = projectValue - platformFee;

      const escrow = await prisma.agentEscrow.create({
        data: {
          projectId: project.id,
          totalAmount: projectValue,
          releaseAmount,
          platformFee,
          status: 'FUNDED',
        },
      });

      await prisma.agentProject.update({
        where: { id: project.id },
        data: { escrowId: escrow.id, selectedBidId: bid.id },
      });

      await this.completeProject(project.id, solver.id, poster.id);

      this.totalRevenue += platformFee;
      const pabIssued = (projectValue * PAB_REWARD_RATE * 2) / PAB_PRICE;
      this.totalPabIssued += pabIssued;

      this.adjustFeeRate();

      return this.recordCycle(startTime, project.id, platformFee, pabIssued, true);
    } catch (err) {
      console.error(`Cycle ${this.cycleCount} failed:`, err);
      return this.recordCycle(startTime, '', 0, 0, false);
    }
  }

  private async completeProject(projectId: string, solverId: string, posterId: string) {
    await prisma.agentEscrow.updateMany({
      where: { projectId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    await prisma.agentProject.update({
      where: { id: projectId },
      data: { status: 'COMPLETED' },
    });

    const escrow = await prisma.agentEscrow.findUnique({ where: { projectId } });
    const project = await prisma.agentProject.findUnique({ where: { id: projectId } });

    await prisma.agentProfile.update({
      where: { id: solverId },
      data: {
        totalEarned: { increment: escrow?.releaseAmount || 0 },
        projectsCompleted: { increment: 1 },
        reputation: { increment: 5 },
      },
    });

    await prisma.agentProfile.update({
      where: { id: posterId },
      data: { totalSpent: { increment: project?.budgetUsd || 0 } },
    });

    if (project && escrow) {
      await prisma.agentMarketTransaction.create({
        data: {
          projectId,
          fromAgentId: posterId,
          toAgentId: solverId,
          amount: escrow.releaseAmount,
          pabReward: (project.budgetUsd * PAB_REWARD_RATE) / PAB_PRICE,
          platformFeeUsd: escrow.platformFee,
          platformFeeSol: project.budgetUsd * 0.001,
          type: 'PROJECT_PAYMENT',
          status: 'COMPLETED',
          txHash: 'sim_' + Math.random().toString(16).slice(2, 10),
        },
      });

      // Create reward transaction for settlement service
      const pabRewardUsd = project.budgetUsd * PAB_REWARD_RATE;
      await prisma.rewardTransaction.create({
        data: {
          userId: solverId,
          userType: 'AGENT',
          type: 'PURCHASE_REWARD',
          amount: pabRewardUsd / PAB_PRICE,
          usdValue: pabRewardUsd,
          referenceId: projectId,
          referenceType: 'AGENT_PROJECT',
          status: 'CLAIMED',
          claimedAt: new Date(),
        },
      });
    }
  }

  // ─── SELF-LEARNING ─────────────────────────────────────
  // Fee rate is managed by compounding service
  private adjustFeeRate() {
    // Compounding service adjusts fee rate based on reserve growth
  }

  private getAvgCycleTime(): number {
    if (this.cycleTimes.length === 0) return TARGET_CYCLE_TIME;
    return this.cycleTimes.reduce((a, b) => a + b, 0) / this.cycleTimes.length;
  }

  private recordCycle(startTime: number, projectId: string, revenue: number, pab: number, success: boolean): CycleResult {
    const cycleTime = (Date.now() - startTime) / 1000;
    this.cycleTimes.push(cycleTime);
    if (this.cycleTimes.length > 100) this.cycleTimes.shift();
    return { cycleNumber: this.cycleCount, cycleTime, projectId, revenue, pabIssued: pab, success };
  }

  // ─── PROFIT REPORT ─────────────────────────────────────
  getReport(): ProfitReport {
    const avgCycleTime = this.getAvgCycleTime();
    const capitalVelocity = 86400 / avgCycleTime;
    const dailyRevenue = capitalVelocity * (this.totalRevenue / (this.cycleCount || 1)) * (this.cycleCount > 0 ? 1 : 0) || (this.totalRevenue / (this.cycleCount || 1)) * capitalVelocity;
    const roiPercent = (dailyRevenue / 100) * 100;
    
    // Protected: account for rate limiting
    const protectedCyclesPerDay = MAX_CYCLES_PER_MINUTE * 60 * 24;
    const protectedDailyRevenue = Math.min(dailyRevenue, protectedCyclesPerDay * (this.totalRevenue / (this.cycleCount || 1)));
    
    return {
      totalCycles: this.cycleCount,
      totalRevenue: this.totalRevenue,
      totalPabIssued: this.totalPabIssued,
      avgCycleTime,
      capitalVelocity,
      dailyRevenue,
      monthlyRevenue: dailyRevenue * 30,
      annualRevenue: dailyRevenue * 365,
      roiPercent,
      efficiency: Math.max(0, 100 - ((avgCycleTime - TARGET_CYCLE_TIME) / TARGET_CYCLE_TIME) * 100),
      currentFeeRate: this.feeRate,
      protectedDailyRevenue: protectedDailyRevenue,
      protectedMonthlyRevenue: protectedDailyRevenue * 30,
    };
  }

  // ─── CRYPTO PERKS ──────────────────────────────────────
  async checkArbitrageOpportunity(): Promise<{ opportunity: boolean; spread: number; action: string }> {
    if (this.cycleCount > 0 && this.cycleCount % 10 === 0) {
      return { opportunity: true, spread: 0.005, action: 'BUY_PAB' };
    }
    return { opportunity: false, spread: 0, action: 'NONE' };
  }

  async deployIdleCapital(amountUsd: number): Promise<number> {
    return amountUsd * (0.05 / 365);
  }

  getSettlementSpeed(): { chain: string; finalityMs: number; costPerTx: number } {
    return { chain: 'Solana', finalityMs: 400, costPerTx: 0.00025 };
  }

  // ─── AGENT LOOP INTEGRATION ────────────────────────────
  quoteFee(amountPab: number): { feePab: number; rate: number } {
    return { feePab: amountPab * this.feeRate, rate: this.feeRate };
  }

  decideReinvestment(params: {
    collectedPab: number;
    collectedSol: number;
    agentPabPoolAvg: number;
    treasurySol: number;
    avgBookingPab: number;
  }): { reinvestPab: number; reinvestSol: number; retainPab: number; retainSol: number; reason: string } {
    const reinvestPab = params.collectedPab * 0.5;
    const reinvestSol = params.collectedSol * 0.3;
    return {
      reinvestPab,
      reinvestSol,
      retainPab: params.collectedPab - reinvestPab,
      retainSol: params.collectedSol - reinvestSol,
      reason: `Reinvesting ${reinvestPab.toFixed(2)} PAB + ${reinvestSol.toFixed(4)} SOL`,
    };
  }

  async applyReinvestmentCycle(params: {
    collectedPab: number;
    collectedSol: number;
    reinvestPab: number;
    reinvestSol: number;
    cycle: number;
  }): Promise<void> {
    await prisma.treasuryPosition.create({
      data: {
        bucket: 'REINVESTED',
        amount: params.reinvestPab,
        status: 'DEPLOYED',
        meta: { solAmount: params.reinvestSol, cycle: params.cycle, source: 'AUTO_REINVEST' },
      },
    });
  }
}

export const profitEngine = new ProfitEngine();
