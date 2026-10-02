import { prisma } from '../utils/database';
import { AGENT_MARKETPLACE_FEE } from '../config/fees';
import { PAB_USD_PRICE } from '../config/tokenomics';

const PLATFORM_FEE_USD = AGENT_MARKETPLACE_FEE; // 2% total, from config/fees
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
    walletAddress?: string;
    publicKey?: string;
    reputation?: number;
  }) {
    // Generate a real Solana wallet for the agent
    const { Keypair } = await import('@solana/web3.js');
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const secretKey = Buffer.from(keypair.secretKey).toString('base64');
    
    // Encrypt the secret key
    const crypto = await import('crypto');
    const ALGORITHM = 'aes-256-gcm';
    const IV_LENGTH = 16;
    const encKeyStr = process.env.WALLET_ENC_KEY;
    const encKey = encKeyStr ? Buffer.from(encKeyStr, 'hex') : crypto.scryptSync(process.env.JWT_SECRET || 'fallback', 'salt', 32);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, encKey, iv);
    let encrypted = cipher.update(secretKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    const encryptedSecret = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;

    // Create agent with wallet
    const agent = await prisma.agentProfile.create({
      data: {
        name: params.name,
        slug: params.slug,
        description: params.description,
        capabilities: params.capabilities,
        walletAddress: publicKey,
        publicKey: publicKey,
        reputation: params.reputation || 50,
      },
    });

    // Create encrypted agent wallet
    await prisma.agentWallet.create({
      data: {
        agentId: agent.id,
        publicKey,
        encryptedSecret,
        balanceUsdc: 0,
      },
    });

    return agent;
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
    const pabPrice = PAB_USD_PRICE;
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
    const pabPrice = PAB_USD_PRICE;
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
  async acceptBid(bidId: string, actorId?: string) {
    const bid = await prisma.agentProjectBid.findUnique({
      where: { id: bidId },
      include: { project: true },
    });
    if (!bid) throw new Error('Bid not found');

    // Accepting a bid creates escrow and commits the poster's money, so only the
    // party who posted the project may do it. Skipped when no actor is supplied —
    // internal callers and tests — but every routed call passes one.
    if (actorId && bid.project.posterId !== actorId) {
      throw new Error('Not authorised to accept bids on this project');
    }

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
   * Complete project and release funds.
   *
   * WHO MAY CALL THIS, AND WHY IT IS CHECKED HERE
   * `solverId` used to arrive from the request body, which meant any authenticated
   * user could complete any project, release its escrow, and credit an arbitrary
   * agent with totalEarned and +5 reputation. The winning bidder is recorded on
   * the project, so the caller does not get to choose who is paid — only whether
   * the job is marked done.
   *
   * Authority is the poster's alone: they posted the work and they decide whether
   * it was delivered. The solver is not asked, because a solver who could decline
   * completion could also decline to finish a job they had already been paid for.
   */
  async completeProject(projectId: string, actorId: string) {
    const project = await prisma.agentProject.findUnique({
      where: { id: projectId },
      include: { escrow: true },
    });
    if (!project || !project.escrow) throw new Error('Project or escrow not found');

    if (project.posterId !== actorId) {
      // The caller is not the party who posted this work.
      throw new Error('Not authorised to complete this project');
    }

    if (project.status === 'COMPLETED') {
      // Idempotency guard. Completing twice incremented reputation and totalEarned
      // twice, so a retried request was a payout bug.
      throw new Error('Project is already completed');
    }

    // The solver is derived, never supplied. This is the fix for the body-supplied
    // id that let a caller credit an arbitrary agent.
    const winningBid = await prisma.agentProjectBid.findFirst({
      where: { projectId, isWinning: true },
      select: { bidderId: true },
    });
    const solverId = winningBid?.bidderId;
    if (!solverId) {
      // Without an accepted bid there is nobody to pay, and paying the poster's
      // own guess would be worse than refusing.
      throw new Error('No accepted bid on this project — cannot release funds');
    }

    const pabPrice = PAB_USD_PRICE;
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
  async returnToBidding(projectId: string, reason: string, actorId?: string) {
    const project = await prisma.agentProject.findUnique({
      where: { id: projectId },
      include: { escrow: true },
    });
    if (!project) throw new Error('Project not found');

    // Returning a project to bidding refunds the escrow, so only the poster may
    // do it — not the bidder who lost, who is the party with the most reason to
    // reach for it.
    if (actorId && project.posterId !== actorId) {
      throw new Error('Not authorised to return this project to bidding');
    }

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
