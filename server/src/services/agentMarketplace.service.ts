import { prisma } from '../utils/database';

const PLATFORM_FEE_USD = 0.02; // 2% total
const PAB_REWARD_RATE = 0.05;  // 5% PAB reward on both sides
const SOL_FEE_RATE = 0.001;    // 0.1% SOL fee (simulated)

export class AgentMarketplace {

  /**
   * Register a new AI agent
   */
  async registerAgent(params: {
    name: string;
    slug: string;
    description: string;
    capabilities: string[];
    walletAddress: string;
    publicKey: string;
  }) {
    return prisma.agentProfile.create({ data: params });
  }

  /**
   * Post a project
   */
  async postProject(params: {
    title: string;
    description: string;
    requirements: string;
    posterId: string;
    budgetUsd: number;
    deadline: Date;
    category: string;
    complexity: string;
  }) {
    const pabPrice = 0.10; // $0.10 per PAB
    return prisma.agentProject.create({
      data: {
        ...params,
        budgetPab: params.budgetUsd / pabPrice,
        status: 'OPEN',
      },
    });
  }

  /**
   * Place a bid on a project
   */
  async placeBid(params: {
    projectId: string;
    bidderId: string;
    proposedAmount: number;
    timelineHours: number;
    approach: string;
  }) {
    const pabPrice = 0.10;
    return prisma.agentProjectBid.create({
      data: {
        ...params,
        proposedPab: params.proposedAmount / pabPrice,
        status: 'PENDING',
      },
    });
  }

  /**
   * Accept a bid and fund escrow
   */
  async acceptBid(bidId: string) {
    const bid = await prisma.agentProjectBid.findUnique({
      where: { id: bidId },
      include: { project: true },
    });
    if (!bid) throw new Error('Bid not found');

    const platformFee = bid.proposedAmount * PLATFORM_FEE_USD;
    const releaseAmount = bid.proposedAmount - platformFee;

    // Create escrow
    const escrow = await prisma.agentEscrow.create({
      data: {
        projectId: bid.projectId,
        totalAmount: bid.proposedAmount,
        releaseAmount,
        platformFee,
        status: 'FUNDED',
      },
    });

    // Update bid and project
    await prisma.agentProjectBid.update({
      where: { id: bidId },
      data: { status: 'ACCEPTED', isWinning: true, acceptedAt: new Date() },
    });

    // Reject other bids
    await prisma.agentProjectBid.updateMany({
      where: { projectId: bid.projectId, id: { not: bidId } },
      data: { status: 'REJECTED' },
    });

    // Update project status
    await prisma.agentProject.update({
      where: { id: bid.projectId },
      data: { status: 'FUNDED', selectedBidId: bidId, escrowId: escrow.id },
    });

    return { escrow, bid };
  }

  /**
   * Complete project and release funds
   */
  async completeProject(projectId: string, solverId: string) {
    const project = await prisma.agentProject.findUnique({
      where: { id: projectId },
      include: { escrow: true },
    });
    if (!project || !project.escrow) throw new Error('Project or escrow not found');

    const pabPrice = 0.10;
    const pabReward = project.budgetUsd * PAB_REWARD_RATE;
    const solFee = project.budgetUsd * SOL_FEE_RATE;

    // Release escrow to solver
    await prisma.agentEscrow.update({
      where: { id: project.escrow.id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    // Update project
    await prisma.agentProject.update({
      where: { id: projectId },
      data: { status: 'COMPLETED' },
    });

    // Update solver stats
    await prisma.agentProfile.update({
      where: { id: solverId },
      data: {
        totalEarned: { increment: project.escrow.releaseAmount },
        projectsCompleted: { increment: 1 },
        reputation: { increment: 5 },
      },
    });

    // Update poster stats
    await prisma.agentProfile.update({
      where: { id: project.posterId },
      data: {
        totalSpent: { increment: project.budgetUsd },
      },
    });

    // Record transactions
    await prisma.agentMarketTransaction.create({
      data: {
        projectId,
        fromAgentId: project.posterId,
        toAgentId: solverId,
        amount: project.escrow.releaseAmount,
        pabReward: pabReward / pabPrice,
        platformFeeUsd: project.escrow.platformFee,
        platformFeeSol: solFee,
        type: 'PROJECT_PAYMENT',
        status: 'COMPLETED',
      },
    });

    return { success: true, released: project.escrow.releaseAmount, pabReward: pabReward / pabPrice };
  }

  /**
   * Self-heal: if project fails, return to bidding
   */
  async returnToBidding(projectId: string, reason: string) {
    const project = await prisma.agentProject.findUnique({
      where: { id: projectId },
      include: { escrow: true },
    });
    if (!project) throw new Error('Project not found');

    // Refund escrow to poster
    if (project.escrow) {
      await prisma.agentEscrow.update({
        where: { id: project.escrow.id },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });
    }

    // Reset bids
    await prisma.agentProjectBid.updateMany({
      where: { projectId },
      data: { status: 'PENDING', isWinning: false },
    });

    // Return project to OPEN
    await prisma.agentProject.update({
      where: { id: projectId },
      data: { status: 'OPEN', selectedBidId: null, escrowId: null },
    });

    // Penalize failed solver
    const winningBid = await prisma.agentProjectBid.findFirst({
      where: { projectId, isWinning: true },
    });
    if (winningBid) {
      await prisma.agentProfile.update({
        where: { id: winningBid.bidderId },
        data: {
          projectsFailed: { increment: 1 },
          reputation: { decrement: 10 },
        },
      });
    }

    return { success: true, message: 'Project returned to bidding', reason };
  }

  /**
   * Get marketplace stats
   */
  async getStats() {
    const [
      totalAgents,
      openProjects,
      activeProjects,
      completedProjects,
      totalVolume,
      totalFees,
    ] = await Promise.all([
      prisma.agentProfile.count({ where: { isActive: true } }),
      prisma.agentProject.count({ where: { status: 'OPEN' } }),
      prisma.agentProject.count({ where: { status: { in: ['FUNDED', 'IN_PROGRESS'] } } }),
      prisma.agentProject.count({ where: { status: 'COMPLETED' } }),
      prisma.agentMarketTransaction.aggregate({ _sum: { amount: true } }),
      prisma.agentMarketTransaction.aggregate({ _sum: { platformFeeUsd: true } }),
    ]);

    return {
      totalAgents,
      openProjects,
      activeProjects,
      completedProjects,
      totalVolume: totalVolume._sum.amount || 0,
      totalFees: totalFees._sum.platformFeeUsd || 0,
    };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard() {
    return prisma.agentProfile.findMany({
      where: { isActive: true },
      orderBy: { reputation: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        slug: true,
        capabilities: true,
        reputation: true,
        totalEarned: true,
        projectsCompleted: true,
      },
    });
  }
}

export const agentMarketplace = new AgentMarketplace();
