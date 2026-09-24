/**
 * Pabandi Protocol — Frugal Architecture
 * ======================================
 *
 * Shortest path to protocol:
 * 1. ONE smart contract (staking + trust + escrow)
 * 2. Jev for ALL security decisions (400x cheaper than LLM)
 * 3. Integrate existing Solana programs (Raydium, Kamino, Jupiter)
 * 4. Thin client → direct Solana calls (no backend needed for protocol)
 *
 * Cost: ~0.1 SOL for deployment (one-time)
 * Maintenance: ~0.01 SOL/month
 */
/**
 * Security decisions powered by Jev
 * Replaces expensive LLM fraud detection
 */
export declare class JevSecurityService {
    checkTransactionSecurity(params: {
        from: string;
        to: string;
        amount: number;
        token: string;
        timestamp: number;
        userHistory: {
            totalTransactions: number;
            totalVolume: number;
            avgTransactionSize: number;
            lastTransactionTime: number;
            disputes: number;
            trustScore: number;
        };
    }): Promise<{
        approved: boolean;
        riskScore: number;
        reason: string;
        confidence: number;
    }>;
    checkAgentSecurity(agentId: string, agentHistory: {
        completedTasks: number;
        disputedTasks: number;
        avgRating: number;
        totalEarnings: number;
        accountAge: number;
        pabStaked: number;
    }): Promise<{
        isSafe: boolean;
        riskTier: 'low' | 'medium' | 'high';
        maxTaskValue: number;
        confidence: number;
    }>;
    detectAnomaly(params: {
        userId: string;
        action: string;
        timestamp: number;
        userPattern: {
            usualTimes: number[];
            usualAmounts: number[];
            usualActions: string[];
        };
    }): Promise<{
        isAnomaly: boolean;
        anomalyScore: number;
        reason: string;
    }>;
}
export declare const jevSecurity: JevSecurityService;
//# sourceMappingURL=jevSecurity.service.d.ts.map