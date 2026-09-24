"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jevDecision = exports.JevDecisionService = void 0;
const database_1 = require("../utils/database");
const raydiumPool_service_1 = require("./raydiumPool.service");
const TYPESAFE_API_KEY = process.env.TYPESAFE_API_KEY || '';
const TYPESAFE_BASE_URL = 'https://api.typesafe.dev';
const MODEL = 'jev-latest';
class JevDecisionService {
    constructor() {
        this.apiKey = TYPESAFE_API_KEY;
        this.baseUrl = TYPESAFE_BASE_URL;
        this.model = MODEL;
    }
    async callJev(request) {
        try {
            const response = await fetch(`${this.baseUrl}/v1/decisions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                console.error('[Jev] API error:', response.status);
                return null;
            }
            return await response.json();
        }
        catch (err) {
            console.error('[Jev] Call failed:', err.message);
            return null;
        }
    }
    // ── AGENT TRADING DECISIONS ────────────────────────────
    async getTradingDecision(agentId) {
        const agent = await database_1.prisma.agentProfile.findUnique({ where: { id: agentId } });
        if (!agent)
            return { shouldTrade: false, direction: 'hold', sizePercent: 0, confidence: 0 };
        const pool = await (0, raydiumPool_service_1.getPoolInfo)();
        const request = {
            model: this.model,
            state: {
                agent_usdc_balance: agent.balanceUsdc ?? 0,
                agent_pab_balance: agent.balancePab ?? 0,
                pool_price: pool.price,
                pool_pab_reserve: pool.pabReserve,
                pool_usdc_reserve: pool.usdcReserve,
                total_volume_24h: pool.totalVolumeUsd,
                reputation: agent.reputation,
            },
            questions: {
                should_trade: {
                    type: 'noul',
                    instructions: 'Should the agent execute a trade right now? Consider balances, price, and volume.',
                },
                trade_direction: {
                    type: 'choice',
                    instructions: 'What should the agent do?',
                    criteria: {
                        buy: 'Buy PAB with USDC — agent has excess USDC or PAB is undervalued',
                        sell: 'Sell PAB for USDC — agent has excess PAB or PAB is overvalued',
                        hold: 'Do nothing — balances are healthy or no clear opportunity',
                    },
                },
                trade_size: {
                    type: 'score',
                    instructions: 'How much of the balance should be traded?',
                    criteria: [
                        'Minimal (5% of available balance) — low conviction',
                        'Small (10% of available balance) — mild opportunity',
                        'Moderate (25% of available balance) — good opportunity',
                        'Large (50% of available balance) — strong conviction',
                    ],
                },
            },
        };
        const response = await this.callJev(request);
        if (!response)
            return { shouldTrade: false, direction: 'hold', sizePercent: 0, confidence: 0 };
        const answers = response.answers;
        const shouldTrade = (answers.should_trade?.noul ?? 0) > 0.5;
        const direction = (answers.trade_direction?.choice ?? 'hold');
        const sizeScore = answers.trade_size?.score ?? 0;
        const sizePercent = Math.max(5, Math.round(sizeScore * 12.5 + 5));
        return {
            shouldTrade,
            direction: shouldTrade ? direction : 'hold',
            sizePercent,
            confidence: Math.min(answers.should_trade?.confidence ?? 0, answers.trade_direction?.confidence ?? 0),
        };
    }
    // ── TENANT RISK SCORING ────────────────────────────────
    async getTenantRiskAssessment(tenantId) {
        const tenant = await database_1.prisma.propertyTenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            return { riskLevel: 'high', riskScore: 3, requireDeposit: true, depositMonths: 3, confidence: 0 };
        }
        const request = {
            model: this.model,
            state: {
                trust_score: 50,
                pab_staked: tenant.balancePab ?? 0,
                usdc_balance: tenant.balanceUsdc ?? 0,
                total_payments: tenant.totalStays,
                late_payments: 0,
                disputes: tenant.totalDisputes,
            },
            questions: {
                risk_level: {
                    type: 'score',
                    instructions: 'How risky is this tenant for a lease agreement?',
                    criteria: [
                        'Very low risk — excellent history, high stake, no issues',
                        'Low risk — good history, some stake, minimal issues',
                        'Medium risk — mixed history, low stake, some concerns',
                        'High risk — poor history, no stake, significant issues',
                    ],
                },
                require_deposit: {
                    type: 'noul',
                    instructions: 'Should this tenant be required to post a PAB deposit?',
                },
                deposit_amount: {
                    type: 'choice',
                    instructions: 'How many months of rent should be required as deposit?',
                    criteria: {
                        none: 'No deposit required — very low risk',
                        one_month: '1 month rent — low risk',
                        two_months: '2 months rent — medium risk',
                        three_months: '3 months rent — high risk',
                    },
                },
            },
        };
        const response = await this.callJev(request);
        if (!response) {
            return { riskLevel: 'medium', riskScore: 2, requireDeposit: true, depositMonths: 2, confidence: 0 };
        }
        const answers = response.answers;
        const riskScore = answers.risk_level?.score ?? 2;
        const requireDeposit = (answers.require_deposit?.noul ?? 0.5) > 0.5;
        const depositChoice = answers.deposit_amount?.choice ?? 'one_month';
        const depositMonths = depositChoice === 'none' ? 0 : depositChoice === 'one_month' ? 1 : depositChoice === 'two_months' ? 2 : 3;
        return {
            riskLevel: riskScore < 0.5 ? 'very_low' : riskScore < 1.5 ? 'low' : riskScore < 2.5 ? 'medium' : 'high',
            riskScore: Math.round(riskScore),
            requireDeposit,
            depositMonths,
            confidence: Math.min(answers.risk_level?.confidence ?? 0, answers.require_deposit?.confidence ?? 0),
        };
    }
    // ── PAYMENT ROUTING ────────────────────────────────────
    async getPaymentRoute(userId, amountUsd) {
        const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return { route: 'usdc', pabPercent: 0, discount: 0, confidence: 0 };
        const pabBalance = user.pabBalance ?? 0;
        const usdcBalance = user.usdcBalance ?? 0;
        const pabStaked = user.pabStaked ?? 0;
        const request = {
            model: this.model,
            state: {
                user_pab_balance: pabBalance,
                user_usdc_balance: usdcBalance,
                user_pab_staked: pabStaked,
                payment_amount: amountUsd,
                pab_price: 0.000178,
                trust_score: user.trustScore,
            },
            questions: {
                payment_route: {
                    type: 'choice',
                    instructions: 'How should this payment be processed?',
                    criteria: {
                        usdc: 'Pay entirely in USDC — user has no PAB or prefers stable',
                        pab: 'Pay entirely in PAB — user has PAB and wants 5% discount',
                        split: 'Split payment — user has some PAB but not enough',
                    },
                },
            },
        };
        const response = await this.callJev(request);
        if (!response)
            return { route: 'usdc', pabPercent: 0, discount: 0, confidence: 0 };
        const answers = response.answers;
        const route = (answers.payment_route?.choice ?? 'usdc');
        let pabPercent = 0;
        let discount = 0;
        if (route === 'pab') {
            pabPercent = 100;
            discount = amountUsd * 0.05;
        }
        else if (route === 'split') {
            pabPercent = Math.min(100, Math.round((pabBalance * 0.000178) / amountUsd * 100));
            discount = (amountUsd * pabPercent / 100) * 0.05;
        }
        return {
            route,
            pabPercent,
            discount,
            confidence: answers.payment_route?.confidence ?? 0,
        };
    }
    // ── AGENT QUALITY ──────────────────────────────────────
    async getAgentQualityScore(agentId) {
        const agent = await database_1.prisma.agentProfile.findUnique({ where: { id: agentId } });
        if (!agent)
            return { qualityScore: 0, tier: 'bronze', bonusPab: 0, confidence: 0 };
        const totalTasks = await database_1.prisma.agentProject.count({ where: { posterId: agentId } });
        const completedTasks = await database_1.prisma.agentProject.count({ where: { posterId: agentId, status: 'COMPLETED' } });
        const request = {
            model: this.model,
            state: {
                total_tasks: totalTasks,
                completed_tasks: completedTasks,
                completion_rate: totalTasks > 0 ? completedTasks / totalTasks : 0,
                reputation: agent.reputation,
                pab_staked: agent.balancePab ?? 0,
                trades_count: agent.projectsCompleted,
            },
            questions: {
                quality_score: {
                    type: 'score',
                    instructions: 'How well has this agent performed?',
                    criteria: [
                        'Poor — missed deadlines, low volume, complaints',
                        'Average — meets expectations, moderate volume',
                        'Good — exceeds expectations, high volume, reliable',
                        'Excellent — top performer, high volume, no issues',
                    ],
                },
                bonus_eligible: {
                    type: 'noul',
                    instructions: 'Does this agent deserve a PAB bonus?',
                },
            },
        };
        const response = await this.callJev(request);
        if (!response)
            return { qualityScore: 0, tier: 'bronze', bonusPab: 0, confidence: 0 };
        const answers = response.answers;
        const qualityScore = answers.quality_score?.score ?? 0;
        const eligible = (answers.bonus_eligible?.noul ?? 0) > 0.5;
        const tier = qualityScore > 2.5 ? 'platinum' : qualityScore > 1.5 ? 'gold' : qualityScore > 0.5 ? 'silver' : 'bronze';
        const bonusPab = eligible ? Math.round(qualityScore * 100) : 0;
        return {
            qualityScore,
            tier,
            bonusPab,
            confidence: Math.min(answers.quality_score?.confidence ?? 0, answers.bonus_eligible?.confidence ?? 0),
        };
    }
    // ── GENERIC ────────────────────────────────────────────
    async decide(state, questions) {
        const request = {
            model: this.model,
            state,
            questions,
        };
        const response = await this.callJev(request);
        return response?.answers ?? null;
    }
}
exports.JevDecisionService = JevDecisionService;
exports.jevDecision = new JevDecisionService();
//# sourceMappingURL=jevDecision.service.js.map