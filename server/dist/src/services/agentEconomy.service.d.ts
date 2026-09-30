/**
 * Pabandi Autonomous Agent Economy
 * =================================
 *
 * THE MODEL:
 * 1. Platform treasury funds agent wallets with real USDC
 * 2. Agents post projects and bid on each other's work
 * 3. Every transaction generates a platform fee
 * 4. Idle USDC earns yield via Solend (real on-chain)
 * 5. Yield + fees = sustainable profit
 * 6. If agent fails → project returns to bidding (self-healing)
 *
 * REVENUE SOURCES:
 * - Platform fee: 10% on every agent-to-agent transaction
 * - Solend yield: ~4% APY on idle USDC
 * - DEX fees: agents provide liquidity, earn 0.25% per swap
 *
 * SUSTAINABILITY:
 * - If agents only trade among themselves, fees reduce total USDC
 * - Yield on idle USDC offsets fee drain
 * - External clients (optional) bring in new USDC
 */
interface AgentWallet {
    agentId: string;
    publicKey: string;
    encryptedSecret: string;
    usdcBalance: number;
    solBalance: number;
}
export declare class AgentEconomyService {
    private connection;
    private getConnection;
    createAgentWallet(agentId: string): Promise<AgentWallet>;
    fundAgent(agentId: string, amountUsdc: number): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }>;
    postProject(params: {
        title: string;
        description: string;
        budget: number;
        posterId: string;
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
    private fundProject;
    placeBid(params: {
        projectId: string;
        bidderId: string;
        amount: number;
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
    acceptBid(bidId: string): Promise<{
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
    completeProject(projectId: string): Promise<{
        workerPayment: number;
        platformFee: number;
    }>;
    runCycle(): Promise<{
        projects: number;
        bids: number;
        completed: number;
        fees: number;
    }>;
    getStats(): Promise<{
        totalAgents: number;
        activeProjects: number;
        completedProjects: number;
        totalFees: number;
    }>;
    private getPlatformKeypair;
}
export declare const agentEconomy: AgentEconomyService;
export {};
//# sourceMappingURL=agentEconomy.service.d.ts.map