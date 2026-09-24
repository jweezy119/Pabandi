"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trustArbitratorService = exports.TrustArbitratorService = void 0;
/**
 * trustArbitrator.service.ts
 * ────────────────────────────────────────────────────────────────────────────
 * AI-powered dispute resolution engine.
 *
 * Uses Alibaba Qwen (via DashScope) to analyze dispute evidence:
 * - Screenshots, messages, booking data, trust scores
 * - Returns ruling + confidence + $PAB reward/penalty for correct arbitrage
 *
 * Low-value disputes (<$500) are resolved autonomously.
 * High-value disputes are escalated to human review.
 */
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const pabTokenStaking_service_1 = require("./pabTokenStaking.service");
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const HUMAN_ESCALATION_THRESHOLD = 500; // USD
const HIGH_CONFIDENCE_THRESHOLD = 0.85;
class TrustArbitratorService {
    /**
     * Arbitrate a dispute using AI (Qwen) + contextual rules
     */
    async arbitrate(evidence) {
        try {
            // 1. Apply rule-based overrides first (fast paths)
            const ruleBased = this.applyRuleOverrides(evidence);
            if (ruleBased.shouldShortCircuit) {
                return this.finalizeRuleBased(ruleBased, evidence);
            }
            // 2. Use Qwen AI for deep analysis
            const aiResult = await this.analyzeWithQwen(evidence);
            // 3. Post-process AI result with business logic
            const needsHumanReview = evidence.claimAmount >= HUMAN_ESCALATION_THRESHOLD
                || aiResult.confidence < HIGH_CONFIDENCE_THRESHOLD;
            // 4. Determine $PAB rewards/slashes
            const pabReward = await this.computePabIncentives(evidence, aiResult.ruling);
            const pabSlash = await this.computePabSlashing(evidence, aiResult.ruling);
            return {
                ...aiResult,
                needsHumanReview,
                pabReward,
                pabSlash,
                estimatedResolutionTime: needsHumanReview ? '24-48 hours' : 'immediate',
            };
        }
        catch (error) {
            logger_1.logger.error('[TrustArbitrator] Arbitration failed:', error.message);
            return {
                ruling: 'NEEDS_MORE_INFO',
                confidence: 0,
                reasoning: 'AI analysis failed, escalating to human review.',
                factors: {},
                needsHumanReview: true,
                estimatedResolutionTime: '24-48 hours',
            };
        }
    }
    /**
     * Fast-path rule overrides (no AI needed)
     */
    applyRuleOverrides(evidence) {
        // Rule 1: Customer has >5 completed bookings and 0 disputes → buyer gets benefit of doubt
        if (evidence.customerTrustScore && evidence.customerTrustScore >= 90) {
            return {
                shouldShortCircuit: true,
                ruling: 'BUYER_WINS',
                confidence: 0.9,
                reasoning: 'Customer has high trust score (90+) — automatic benefit of doubt for legitimate claims.',
            };
        }
        // Rule 2: Business has >50 completed bookings, 0 disputes, >1000 $PAB staked → seller wins
        if (evidence.businessTrustScore && evidence.businessTrustScore >= 95
            && (evidence.businessStakedPab || 0) >= 1000) {
            return {
                shouldShortCircuit: true,
                ruling: 'SELLER_WINS',
                confidence: 0.9,
                reasoning: 'Merchant has elite trust score (95+) and 1000+ $PAB staked — claim rejected.',
            };
        }
        // Rule 3: If booking status is COMPLETED and delivered, seller wins
        if (evidence.bookingDetails.status === 'COMPLETED') {
            return {
                shouldShortCircuit: true,
                ruling: 'SELLER_WINS',
                confidence: 0.8,
                reasoning: 'Reservation was marked COMPLETED — service was acknowledged as delivered.',
            };
        }
        // Rule 4: If booking status is NO_SHOW, buyer wins
        if (evidence.bookingDetails.status === 'NO_SHOW') {
            return {
                shouldShortCircuit: true,
                ruling: 'BUYER_WINS',
                confidence: 0.9,
                reasoning: 'Provider had a NO_SHOW status — buyer is entitled to full refund.',
            };
        }
        // Rule 5: If evidence messages contain admission of fault from one party
        const allMessages = evidence.messages.map(m => m.text.toLowerCase()).join(' ');
        if (allMessages.includes('my fault') || allMessages.includes('i apologize') || allMessages.includes('i messed up')) {
            return {
                shouldShortCircuit: true,
                ruling: 'BUYER_WINS',
                confidence: 0.75,
                reasoning: 'Provider admitted fault in conversation.',
            };
        }
        return { shouldShortCircuit: false, ruling: 'NEEDS_MORE_INFO', confidence: 0, reasoning: '' };
    }
    async finalizeRuleBased(rule, evidence) {
        const pabSlash = await this.computePabSlashing(evidence, rule.ruling);
        const pabReward = await this.computePabIncentives(evidence, rule.ruling);
        return {
            ruling: rule.ruling,
            confidence: rule.confidence,
            reasoning: rule.reasoning,
            factors: { ruleBased: rule.confidence },
            pabReward,
            pabSlash,
            needsHumanReview: false,
            estimatedResolutionTime: 'immediate',
        };
    }
    /**
     * Use Qwen (DashScope) to analyze dispute evidence
     */
    async analyzeWithQwen(evidence) {
        if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
            // Fallback: rule-based without rules above
            return this.heuristicAnalysis(evidence);
        }
        const prompt = `
You are Pabandi's AI Trust Arbitrator. Analyze this dispute and return ONLY valid JSON (no markdown).

DISPUTE EVIDENCE:
${JSON.stringify({
            claimAmount: evidence.claimAmount,
            currency: evidence.currency,
            customerTrustScore: evidence.customerTrustScore,
            businessTrustScore: evidence.businessTrustScore,
            messages: evidence.messages.slice(0, 10).map(m => ({ role: m.role, text: m.text.slice(0, 300) })),
            bookingDetails: evidence.bookingDetails,
        }, null, 2)}

INSTRUCTIONS:
- Ruling must be one of: BUYER_WINS, SELLER_WINS, REFUND_HALF, NEEDS_MORE_INFO
- Confidence: 0.0 to 1.0
- Factors: key factors that influenced the decision with point values
- Reasoning: explain in 1-2 sentences

Return ONLY JSON:
{"ruling":"BUYER_WINS","confidence":0.85,"reasoning":"Customer has high trust score and provider had no-show history","factors":{"trustScoreDiff":15,"messageSentiment":-5}}
`;
        try {
            const response = await axios_1.default.post('https://dashscope-intl.alicloud.com/api/v1/services/aigc/text-generation/generation', {
                model: 'qwen-turbo',
                input: {
                    messages: [
                        { role: 'system', content: 'You are Pabandi\'s AI Trust Arbitrator. Return only valid JSON.' },
                        { role: 'user', content: prompt },
                    ],
                },
                parameters: { result_format: 'message' },
            }, {
                headers: {
                    'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            });
            const text = response.data?.output?.choices?.[0]?.message?.content?.trim();
            if (!text)
                throw new Error('Empty AI response');
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        }
        catch (error) {
            logger_1.logger.warn('[TrustArbitrator] Qwen API failed, falling back to heuristic:', error.message);
            return this.heuristicAnalysis(evidence);
        }
    }
    /**
     * Heuristic analysis fallback when AI is not available
     */
    heuristicAnalysis(evidence) {
        const factors = {};
        let score = 50; // neutral base
        // Trust score delta
        const custScore = evidence.customerTrustScore || 50;
        const bizScore = evidence.businessTrustScore || 50;
        const scoreDiff = custScore - bizScore;
        factors.trustScoreDelta = scoreDiff;
        score += scoreDiff * 0.3;
        // Stake weight
        const custStake = evidence.customerStakedPab || 0;
        const bizStake = evidence.businessStakedPab || 0;
        factors.stakeDelta = (custStake - bizStake) / 100;
        score += (custStake - bizStake) * 0.001;
        // Booking status
        if (evidence.bookingDetails.status === 'COMPLETED') {
            factors.bookingCompleted = 20;
            score += 20;
        }
        else if (evidence.bookingDetails.status === 'NO_SHOW') {
            factors.bookingNoShow = -25;
            score -= 25;
        }
        // Message sentiment (simple)
        const messages = evidence.messages.map(m => m.text.toLowerCase()).join(' ');
        if (messages.includes('cancelled') || messages.includes('canceled')) {
            factors.cancellationMentioned = 10;
            score -= 5;
        }
        // Final ruling
        let ruling;
        if (score >= 65) {
            ruling = 'BUYER_WINS';
        }
        else if (score <= 35) {
            ruling = 'SELLER_WINS';
        }
        else {
            ruling = 'REFUND_HALF';
        }
        const confidence = Math.min(0.9, Math.abs(score - 50) / 50 * 0.8 + 0.3);
        const reasoning = score >= 65
            ? 'Evidence favors the buyer based on trust metrics and booking history.'
            : score <= 35
                ? 'Evidence favors the seller based on booking completion and provider reliability.'
                : 'Insufficient evidence to determine fault — partial refund recommended.';
        return {
            ruling,
            confidence: Number(confidence.toFixed(2)),
            reasoning,
            factors,
        };
    }
    /**
     * Compute $PAB rewards for correct arbitration (incentivize good behavior)
     */
    async computePabIncentives(evidence, ruling) {
        if (ruling === 'NEEDS_MORE_INFO')
            return undefined;
        const winnerId = ruling === 'BUYER_WINS' ? evidence.customerId : evidence.businessId;
        if (!winnerId)
            return undefined;
        const amount = ruling === 'REFUND_HALF' ? 2.0 : 10.0; // Base reward
        const { multiplier } = await pabTokenStaking_service_1.pabTokenStakingService.getTrustMultiplier(winnerId);
        return {
            recipient: winnerId,
            amount: Number((amount * multiplier).toFixed(4)),
        };
    }
    /**
     * Compute $PAB slashing for the losing party
     */
    async computePabSlashing(evidence, ruling) {
        if (ruling === 'NEEDS_MORE_INFO')
            return undefined;
        const loserId = ruling === 'BUYER_WINS' ? evidence.businessId : evidence.customerId;
        if (!loserId)
            return undefined;
        const { totalStaked } = await pabTokenStaking_service_1.pabTokenStakingService.getTrustMultiplier(loserId);
        const slashAmount = Math.min(totalStaked * 0.05, totalStaked * 0.2);
        const reason = ruling === 'BUYER_WINS' ? 'NO_SHOW' : 'DISPUTE_LOST';
        return {
            target: loserId,
            amount: Number(slashAmount.toFixed(4)),
            reason,
        };
    }
}
exports.TrustArbitratorService = TrustArbitratorService;
exports.trustArbitratorService = new TrustArbitratorService();
//# sourceMappingURL=trustArbitrator.service.js.map