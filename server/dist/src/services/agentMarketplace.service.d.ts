export declare class AgentMarketplace {
    /**
     * Register a new AI agent
     */
    registerAgent(params: {
        name: string;
        slug: string;
        description: string;
        capabilities: string[];
        walletAddress?: string;
        publicKey?: string;
        reputation?: number;
    }): Promise<{
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        walletAddress: string;
        isActive: boolean;
        description: string;
        slug: string;
        totalEarned: number;
        totalSpent: number;
        balanceUsdc: number;
        balancePab: number;
        capabilities: string[];
        publicKey: string;
        reputation: number;
        projectsCompleted: number;
        projectsFailed: number;
    }>;
    /**
     * Post a project
     */
    postProject(params: {
        title: string;
        description: string;
        requirements: string;
        posterId: string;
        budgetUsd: number;
        deadline: Date;
        category: string;
        complexity: string;
    }): Promise<{
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        title: string;
        description: string;
        category: string;
        requirements: string;
        budgetUsd: number;
        escrowId: string | null;
        deadline: Date;
        posterId: string;
        budgetPab: number;
        selectedBidId: string | null;
        complexity: string;
    }>;
    /**
     * Place a bid on a project
     */
    placeBid(params: {
        projectId: string;
        bidderId: string;
        proposedAmount: number;
        timelineHours: number;
        approach: string;
    }): Promise<{
        id: string;
        status: string;
        submittedAt: Date;
        projectId: string;
        bidderId: string;
        proposedAmount: number;
        proposedPab: number;
        timelineHours: number;
        approach: string;
        isWinning: boolean;
        acceptedAt: Date | null;
    }>;
    /**
     * Accept a bid and fund escrow
     */
    acceptBid(bidId: string): Promise<{
        escrow: {
            id: string;
            status: string;
            totalAmount: number;
            refundedAt: Date | null;
            releasedAt: Date | null;
            projectId: string;
            fundedAt: Date;
            releaseAmount: number;
            platformFee: number;
        };
        bid: {
            project: {
                metadata: import("@prisma/client/runtime/library").JsonValue | null;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                status: string;
                title: string;
                description: string;
                category: string;
                requirements: string;
                budgetUsd: number;
                escrowId: string | null;
                deadline: Date;
                posterId: string;
                budgetPab: number;
                selectedBidId: string | null;
                complexity: string;
            };
        } & {
            id: string;
            status: string;
            submittedAt: Date;
            projectId: string;
            bidderId: string;
            proposedAmount: number;
            proposedPab: number;
            timelineHours: number;
            approach: string;
            isWinning: boolean;
            acceptedAt: Date | null;
        };
    }>;
    /**
     * Complete project and release funds
     */
    completeProject(projectId: string, solverId: string): Promise<{
        success: boolean;
        released: number;
        pabReward: number;
    }>;
    /**
     * Self-heal: if project fails, return to bidding
     */
    returnToBidding(projectId: string, reason: string): Promise<{
        success: boolean;
        message: string;
        reason: string;
    }>;
    /**
     * Get marketplace stats
     */
    getStats(): Promise<{
        totalAgents: number;
        openProjects: number;
        activeProjects: number;
        completedProjects: number;
        totalVolume: number;
        totalFees: number;
    }>;
    /**
     * Get leaderboard
     */
    getLeaderboard(): Promise<{
        id: string;
        name: string;
        slug: string;
        totalEarned: number;
        capabilities: string[];
        reputation: number;
        projectsCompleted: number;
    }[]>;
}
export declare const agentMarketplace: AgentMarketplace;
//# sourceMappingURL=agentMarketplace.service.d.ts.map