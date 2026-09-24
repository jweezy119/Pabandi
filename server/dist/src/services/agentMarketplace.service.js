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
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentMarketplace = exports.AgentMarketplace = void 0;
const database_1 = require("../utils/database");
const PLATFORM_FEE_USD = 0.02; // 2% total
const PAB_REWARD_RATE = 0.05; // 5% PAB reward on both sides
const SOL_FEE_RATE = 0.001; // 0.1% SOL fee (simulated)
class AgentMarketplace {
    /**
     * Register a new AI agent
     */
    async registerAgent(params) {
        // Generate a real Solana wallet for the agent
        const { Keypair } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
        const keypair = Keypair.generate();
        const publicKey = keypair.publicKey.toBase58();
        const secretKey = Buffer.from(keypair.secretKey).toString('base64');
        // Encrypt the secret key
        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
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
        const agent = await database_1.prisma.agentProfile.create({
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
        await database_1.prisma.agentWallet.create({
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
    async postProject(params) {
        const pabPrice = 0.10; // $0.10 per PAB
        return database_1.prisma.agentProject.create({
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
    async placeBid(params) {
        const pabPrice = 0.10;
        return database_1.prisma.agentProjectBid.create({
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
    async acceptBid(bidId) {
        const bid = await database_1.prisma.agentProjectBid.findUnique({
            where: { id: bidId },
            include: { project: true },
        });
        if (!bid)
            throw new Error('Bid not found');
        const platformFee = bid.proposedAmount * PLATFORM_FEE_USD;
        const releaseAmount = bid.proposedAmount - platformFee;
        // Create escrow
        const escrow = await database_1.prisma.agentEscrow.create({
            data: {
                projectId: bid.projectId,
                totalAmount: bid.proposedAmount,
                releaseAmount,
                platformFee,
                status: 'FUNDED',
            },
        });
        // Update bid and project
        await database_1.prisma.agentProjectBid.update({
            where: { id: bidId },
            data: { status: 'ACCEPTED', isWinning: true, acceptedAt: new Date() },
        });
        // Reject other bids
        await database_1.prisma.agentProjectBid.updateMany({
            where: { projectId: bid.projectId, id: { not: bidId } },
            data: { status: 'REJECTED' },
        });
        // Update project status
        await database_1.prisma.agentProject.update({
            where: { id: bid.projectId },
            data: { status: 'FUNDED', selectedBidId: bidId, escrowId: escrow.id },
        });
        return { escrow, bid };
    }
    /**
     * Complete project and release funds
     */
    async completeProject(projectId, solverId) {
        const project = await database_1.prisma.agentProject.findUnique({
            where: { id: projectId },
            include: { escrow: true },
        });
        if (!project || !project.escrow)
            throw new Error('Project or escrow not found');
        const pabPrice = 0.10;
        const pabReward = project.budgetUsd * PAB_REWARD_RATE;
        const solFee = project.budgetUsd * SOL_FEE_RATE;
        // Release escrow to solver
        await database_1.prisma.agentEscrow.update({
            where: { id: project.escrow.id },
            data: { status: 'RELEASED', releasedAt: new Date() },
        });
        // Update project
        await database_1.prisma.agentProject.update({
            where: { id: projectId },
            data: { status: 'COMPLETED' },
        });
        // Update solver stats
        await database_1.prisma.agentProfile.update({
            where: { id: solverId },
            data: {
                totalEarned: { increment: project.escrow.releaseAmount },
                projectsCompleted: { increment: 1 },
                reputation: { increment: 5 },
            },
        });
        // Update poster stats
        await database_1.prisma.agentProfile.update({
            where: { id: project.posterId },
            data: {
                totalSpent: { increment: project.budgetUsd },
            },
        });
        // Record transactions
        await database_1.prisma.agentMarketTransaction.create({
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
    async returnToBidding(projectId, reason) {
        const project = await database_1.prisma.agentProject.findUnique({
            where: { id: projectId },
            include: { escrow: true },
        });
        if (!project)
            throw new Error('Project not found');
        // Refund escrow to poster
        if (project.escrow) {
            await database_1.prisma.agentEscrow.update({
                where: { id: project.escrow.id },
                data: { status: 'REFUNDED', refundedAt: new Date() },
            });
        }
        // Reset bids
        await database_1.prisma.agentProjectBid.updateMany({
            where: { projectId },
            data: { status: 'PENDING', isWinning: false },
        });
        // Return project to OPEN
        await database_1.prisma.agentProject.update({
            where: { id: projectId },
            data: { status: 'OPEN', selectedBidId: null, escrowId: null },
        });
        // Penalize failed solver
        const winningBid = await database_1.prisma.agentProjectBid.findFirst({
            where: { projectId, isWinning: true },
        });
        if (winningBid) {
            await database_1.prisma.agentProfile.update({
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
        const [totalAgents, openProjects, activeProjects, completedProjects, totalVolume, totalFees,] = await Promise.all([
            database_1.prisma.agentProfile.count({ where: { isActive: true } }),
            database_1.prisma.agentProject.count({ where: { status: 'OPEN' } }),
            database_1.prisma.agentProject.count({ where: { status: { in: ['FUNDED', 'IN_PROGRESS'] } } }),
            database_1.prisma.agentProject.count({ where: { status: 'COMPLETED' } }),
            database_1.prisma.agentMarketTransaction.aggregate({ _sum: { amount: true } }),
            database_1.prisma.agentMarketTransaction.aggregate({ _sum: { platformFeeUsd: true } }),
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
        return database_1.prisma.agentProfile.findMany({
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
exports.AgentMarketplace = AgentMarketplace;
exports.agentMarketplace = new AgentMarketplace();
//# sourceMappingURL=agentMarketplace.service.js.map