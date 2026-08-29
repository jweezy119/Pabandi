import { Web3Agent } from './web3Agent.service';
export interface AgentDecision {
    action: 'BOOK' | 'STAKE' | 'BUY_BADGE' | 'FUND_REQUEST' | 'HOLD';
    toAgentId?: string;
    amount?: number;
    reason: string;
}
export declare class AgentDecisionEngine {
    private lastBookingTime;
    /**
     * Evaluate an agent's state and decide what action to take.
     * Rules:
     *   1. If balance < 20 PAB → request funding
     *   2. If balance > 50 PAB AND no booking in last 24h → book a service
     *   3. If balance > 100 PAB → stake 50 PAB
     *   4. Otherwise → hold
     */
    evaluate(agent: Web3Agent, allAgents: Web3Agent[]): Promise<AgentDecision>;
    /** Check if agent has made a booking in the last 24 hours */
    private hasRecentBooking;
    /** Record that an agent made a booking */
    recordBooking(profileId: string): void;
    /**
     * Run one evaluation cycle for all agents.
     * Returns stats about decisions made.
     */
    runCycle(allAgents: Web3Agent[]): Promise<{
        evaluated: number;
        bookings: number;
        stakes: number;
        fundingRequests: number;
        holds: number;
    }>;
}
export declare const agentDecisionEngine: AgentDecisionEngine;
//# sourceMappingURL=agentDecisionEngine.service.d.ts.map