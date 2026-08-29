"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentDecisionEngine = exports.AgentDecisionEngine = void 0;
const web3Agent_service_1 = require("./web3Agent.service");
class AgentDecisionEngine {
    constructor() {
        this.lastBookingTime = new Map();
    }
    /**
     * Evaluate an agent's state and decide what action to take.
     * Rules:
     *   1. If balance < 20 PAB → request funding
     *   2. If balance > 50 PAB AND no booking in last 24h → book a service
     *   3. If balance > 100 PAB → stake 50 PAB
     *   4. Otherwise → hold
     */
    async evaluate(agent, allAgents) {
        const balance = await web3Agent_service_1.web3AgentService.getBalance(agent);
        // Rule 1: Low balance → request funding
        if (balance < 20) {
            return {
                action: 'FUND_REQUEST',
                amount: 100,
                reason: `Balance ${balance.toFixed(1)} PAB below threshold (20 PAB)`,
            };
        }
        // Rule 2: Medium balance + idle → book a service
        if (balance > 50 && !this.hasRecentBooking(agent.profileId)) {
            const targets = allAgents.filter(a => a.profileId !== agent.profileId && a.category !== agent.category);
            if (targets.length > 0) {
                const target = targets[Math.floor(Math.random() * targets.length)];
                const bookingCost = 10; // 10 PAB service fee
                if (balance >= bookingCost + 5) { // Ensure we can pay fee too
                    return {
                        action: 'BOOK',
                        toAgentId: target.profileId,
                        amount: bookingCost,
                        reason: `Idle agent with ${balance.toFixed(1)} PAB booking ${target.category} service`,
                    };
                }
            }
        }
        // Rule 3: High balance → stake
        if (balance > 100) {
            return {
                action: 'STAKE',
                amount: 50,
                reason: `High balance (${balance.toFixed(1)} PAB) → staking 50 PAB`,
            };
        }
        // Rule 4: Hold
        return {
            action: 'HOLD',
            reason: `Balance ${balance.toFixed(1)} PAB — waiting for opportunity`,
        };
    }
    /** Check if agent has made a booking in the last 24 hours */
    hasRecentBooking(profileId) {
        const lastBooking = this.lastBookingTime.get(profileId) || 0;
        const dayMs = 24 * 60 * 60 * 1000;
        return Date.now() - lastBooking < dayMs;
    }
    /** Record that an agent made a booking */
    recordBooking(profileId) {
        this.lastBookingTime.set(profileId, Date.now());
    }
    /**
     * Run one evaluation cycle for all agents.
     * Returns stats about decisions made.
     */
    async runCycle(allAgents) {
        let bookings = 0;
        let stakes = 0;
        let fundingRequests = 0;
        let holds = 0;
        for (const agent of allAgents) {
            if (!agent.isActive)
                continue;
            const decision = await this.evaluate(agent, allAgents);
            switch (decision.action) {
                case 'BOOK':
                    const targetAgent = allAgents.find(a => a.profileId === decision.toAgentId);
                    if (targetAgent && decision.amount) {
                        // Execute booking payment
                        const result = await web3Agent_service_1.web3AgentService.executeBookingPayment(agent, targetAgent, decision.amount);
                        if (result.success) {
                            bookings++;
                            this.recordBooking(agent.profileId);
                            // Platform fee (5 PAB) is implicitly collected by the tx structure
                            // In production: separate fee collection transaction
                        }
                    }
                    break;
                case 'STAKE':
                    // Placeholder for staking logic
                    stakes++;
                    break;
                case 'FUND_REQUEST':
                    fundingRequests++;
                    break;
                case 'HOLD':
                    holds++;
                    break;
            }
        }
        return {
            evaluated: allAgents.filter(a => a.isActive).length,
            bookings,
            stakes,
            fundingRequests,
            holds,
        };
    }
}
exports.AgentDecisionEngine = AgentDecisionEngine;
exports.agentDecisionEngine = new AgentDecisionEngine();
//# sourceMappingURL=agentDecisionEngine.service.js.map