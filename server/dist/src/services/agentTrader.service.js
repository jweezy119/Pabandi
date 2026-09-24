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
exports.agentTrader = exports.AgentTrader = void 0;
/**
 * agentTrader.service.ts — Agent Trading Loop
 *
 * Agents continuously buy/sell PAB to generate volume.
 * Trading fees (0.25%) accrue to LP.
 * Auto-compounds fees back into LP.
 * Platform takes 10% of LP earnings.
 */
const raydiumPool_service_1 = require("./raydiumPool.service");
class AgentTrader {
    constructor() {
        this.agents = new Map();
        this.states = new Map();
        this.intervals = new Map();
    }
    createAgent(config) {
        this.agents.set(config.id, config);
        this.states.set(config.id, {
            id: config.id,
            name: config.name,
            status: 'stopped',
            totalTrades: 0,
            totalVolumeUsd: 0,
            totalFeesPaid: 0,
            totalProfit: 0,
            pnl: 0,
        });
        return config;
    }
    startAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent)
            return false;
        agent.enabled = true;
        this.states.get(agentId).status = 'running';
        const interval = setInterval(async () => {
            await this.executeTrade(agentId);
        }, agent.tradeIntervalMs);
        this.intervals.set(agentId, interval);
        return true;
    }
    pauseAgent(agentId) {
        const interval = this.intervals.get(agentId);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(agentId);
        }
        const state = this.states.get(agentId);
        if (state)
            state.status = 'paused';
        return true;
    }
    stopAgent(agentId) {
        const interval = this.intervals.get(agentId);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(agentId);
        }
        const state = this.states.get(agentId);
        if (state)
            state.status = 'stopped';
        return true;
    }
    async executeTrade(agentId) {
        const agent = this.agents.get(agentId);
        const state = this.states.get(agentId);
        if (!agent || !state)
            return { success: false, error: 'Agent not found' };
        try {
            // Alternate between buy and sell
            const direction = state.totalTrades % 2 === 0 ? 'buy' : 'sell';
            const amount = Math.random() * (agent.maxTradeAmountUsdc - agent.minTradeAmountUsdc) + agent.minTradeAmountUsdc;
            // Use the agent's wallet address from database
            const { prisma } = await Promise.resolve().then(() => __importStar(require('../utils/database')));
            const agentProfile = await prisma.agentProfile.findUnique({ where: { id: agentId } });
            if (!agentProfile)
                return { success: false, error: 'Agent profile not found' };
            const result = direction === 'buy'
                ? await (0, raydiumPool_service_1.buyPAB)(agentProfile.walletAddress, amount)
                : await (0, raydiumPool_service_1.sellPAB)(agentProfile.walletAddress, amount);
            if (result.success) {
                state.totalTrades++;
                state.totalVolumeUsd += amount;
                state.lastTradeAt = new Date().toISOString();
                state.lastTradeDirection = direction;
                state.lastTradeAmount = amount;
            }
            return result;
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    getState(agentId) {
        return this.states.get(agentId);
    }
    getAllStates() {
        return Array.from(this.states.values());
    }
}
exports.AgentTrader = AgentTrader;
exports.agentTrader = new AgentTrader();
//# sourceMappingURL=agentTrader.service.js.map