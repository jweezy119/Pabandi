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
        id: string;
        walletAddress: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        description: string;
        slug: string;
        balancePab: number;
        capabilities: string[];
        balanceUsdc: number;
        publicKey: string;
        reputation: number;
        totalEarned: number;
        totalSpent: number;
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
        id: string;
        createdAt: Date;
        updatedAt: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
        description: string;
        category: string;
        title: string;
        deadline: Date;
        budgetUsd: number;
        requirements: string;
        budgetPab: number;
        selectedBidId: string | null;
        escrowId: string | null;
        complexity: string;
        posterId: string;
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
        proposedAmount: number;
        proposedPab: number;
        timelineHours: number;
        approach: string;
        isWinning: boolean;
        submittedAt: Date;
        acceptedAt: Date | null;
        projectId: string;
        bidderId: string;
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
            projectId: string;
            releaseAmount: number;
            platformFee: number;
            fundedAt: Date;
            releasedAt: Date | null;
        };
        bid: {
            project: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                metadata: import("@prisma/client/runtime/library").JsonValue | null;
                status: string;
                description: string;
                category: string;
                title: string;
                deadline: Date;
                budgetUsd: number;
                requirements: string;
                budgetPab: number;
                selectedBidId: string | null;
                escrowId: string | null;
                complexity: string;
                posterId: string;
            };
        } & {
            id: string;
            status: string;
            proposedAmount: number;
            proposedPab: number;
            timelineHours: number;
            approach: string;
            isWinning: boolean;
            submittedAt: Date;
            acceptedAt: Date | null;
            projectId: string;
            bidderId: string;
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
        capabilities: string[];
        reputation: number;
        totalEarned: number;
        projectsCompleted: number;
    }[]>;
}
export declare const agentMarketplace: AgentMarketplace;
//# sourceMappingURL=agentMarketplace.service.d.ts.map