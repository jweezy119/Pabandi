"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.jevSecurity = exports.JevSecurityService = void 0;
const TYPESAFE_API_KEY = process.env.TYPESAFE_API_KEY || '';
/**
 * Security decisions powered by Jev
 * Replaces expensive LLM fraud detection
 */
class JevSecurityService {
    // ── FRAUD DETECTION ──────────────────────────────────
    async checkTransactionSecurity(params) {
        const request = {
            model: 'jev-latest',
            state: {
                amount: params.amount,
                token: params.token,
                user_trust_score: params.userHistory.trustScore,
                user_total_tx: params.userHistory.totalTransactions,
                user_total_volume: params.userHistory.totalVolume,
                user_avg_tx_size: params.userHistory.avgTransactionSize,
                time_since_last_tx: params.timestamp - params.userHistory.lastTransactionTime,
                user_disputes: params.userHistory.disputes,
                is_new_recipient: params.userHistory.totalTransactions < 5,
                is_large_tx: params.amount > params.userHistory.avgTransactionSize * 3,
            },
            questions: {
                is_fraud: {
                    type: 'noul',
                    instructions: 'Is this transaction potentially fraudulent? Consider amount, frequency, trust score, and history.',
                },
                risk_level: {
                    type: 'score',
                    instructions: 'How risky is this transaction?',
                    criteria: [
                        'Very low risk — normal pattern, high trust',
                        'Low risk — slightly unusual but acceptable',
                        'Medium risk — unusual pattern, requires monitoring',
                        'High risk — suspicious pattern, likely fraud',
                    ],
                },
            },
        };
        try {
            const response = await fetch('https://api.typesafe.dev/v1/decisions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TYPESAFE_API_KEY}`,
                },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                // Fallback: approve if Jev is down
                return { approved: true, riskScore: 0, reason: 'Jev unavailable', confidence: 0.5 };
            }
            const data = await response.json();
            const answers = data.answers || {};
            const isFraud = (answers.is_fraud?.noul ?? 0) > 0.5;
            const riskScore = answers.risk_level?.score ?? 0;
            return {
                approved: !isFraud && riskScore < 2.5,
                riskScore,
                reason: isFraud ? 'Flagged by Jev security' : 'Passed security check',
                confidence: Math.min(answers.is_fraud?.confidence ?? 0, answers.risk_level?.confidence ?? 0),
            };
        }
        catch {
            return { approved: true, riskScore: 0, reason: 'Jev error', confidence: 0.5 };
        }
    }
    // ── AGENT RISK SCORING ───────────────────────────────
    async checkAgentSecurity(agentId, agentHistory) {
        const request = {
            model: 'jev-latest',
            state: {
                completed_tasks: agentHistory.completedTasks,
                disputed_tasks: agentHistory.disputedTasks,
                dispute_rate: agentHistory.completedTasks > 0 ? agentHistory.disputedTasks / agentHistory.completedTasks : 0,
                avg_rating: agentHistory.avgRating,
                total_earnings: agentHistory.totalEarnings,
                account_age_days: agentHistory.accountAge,
                pab_staked: agentHistory.pabStaked,
            },
            questions: {
                is_safe: {
                    type: 'noul',
                    instructions: 'Is this agent safe to work with? Consider dispute rate, ratings, and stake.',
                },
                risk_tier: {
                    type: 'choice',
                    instructions: 'What risk tier does this agent fall into?',
                    criteria: {
                        low: 'Low risk — high ratings, low disputes, significant stake',
                        medium: 'Medium risk — acceptable ratings, some disputes, moderate stake',
                        high: 'High risk — poor ratings, high disputes, low stake',
                    },
                },
            },
        };
        try {
            const response = await fetch('https://api.typesafe.dev/v1/decisions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TYPESAFE_API_KEY}`,
                },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                return { isSafe: true, riskTier: 'medium', maxTaskValue: 100, confidence: 0.5 };
            }
            const data = await response.json();
            const answers = data.answers || {};
            const isSafe = (answers.is_safe?.noul ?? 0.5) > 0.5;
            const riskTier = (answers.risk_tier?.choice ?? 'medium');
            const maxValues = { low: 10000, medium: 1000, high: 100 };
            return {
                isSafe,
                riskTier,
                maxTaskValue: maxValues[riskTier],
                confidence: Math.min(answers.is_safe?.confidence ?? 0, answers.risk_tier?.confidence ?? 0),
            };
        }
        catch {
            return { isSafe: true, riskTier: 'medium', maxTaskValue: 100, confidence: 0.5 };
        }
    }
    // ── ANOMALY DETECTION ────────────────────────────────
    async detectAnomaly(params) {
        const hour = new Date(params.timestamp).getHours();
        const isUnusualTime = !params.userPattern.usualTimes.includes(hour);
        const isUnusualAction = !params.userPattern.usualActions.includes(params.action);
        const request = {
            model: 'jev-latest',
            state: {
                hour_of_day: hour,
                is_unusual_time: isUnusualTime,
                is_unusual_action: isUnusualAction,
                usual_action_count: params.userPattern.usualActions.length,
                user_age_days: 30, // Simplified
            },
            questions: {
                is_anomaly: {
                    type: 'noul',
                    instructions: 'Is this user behavior anomalous? Consider time, action type, and history.',
                },
            },
        };
        try {
            const response = await fetch('https://api.typesafe.dev/v1/decisions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TYPESAFE_API_KEY}`,
                },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                return { isAnomaly: false, anomalyScore: 0, reason: 'Jev unavailable' };
            }
            const data = await response.json();
            const answers = data.answers || {};
            const isAnomaly = (answers.is_anomaly?.noul ?? 0) > 0.5;
            return {
                isAnomaly,
                anomalyScore: answers.is_anomaly?.noul ?? 0,
                reason: isAnomaly ? 'Unusual behavior detected' : 'Normal behavior',
            };
        }
        catch {
            return { isAnomaly: false, anomalyScore: 0, reason: 'Jev error' };
        }
    }
}
exports.JevSecurityService = JevSecurityService;
exports.jevSecurity = new JevSecurityService();
//# sourceMappingURL=jevSecurity.service.js.map