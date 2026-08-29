"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ecommerceReliabilityPredictor = exports.EcommerceReliabilityPredictor = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../utils/logger");
class EcommerceReliabilityPredictor {
    /**
     * Predict reliability for an E-Commerce actor (Buyer or Seller)
     */
    async predict(features) {
        try {
            // 1. Try DashScope AI API first
            const apiKey = process.env.DASHSCOPE_API_KEY;
            if (apiKey && apiKey !== 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
                try {
                    const prompt = `
            You are Pabandi's AI Trust Engine analyzing a user on a major e-commerce platform like Daraz or Alibaba.
            Pabandi acts purely as an intelligence layer on top of existing payment rails. We do not process payments.
            
            Analyze the following e-commerce data and predict the reliability score.
            Role: ${features.role}
            Data: ${JSON.stringify(features)}
            
            Return ONLY a valid JSON object with this exact structure (no markdown formatting, just raw JSON):
            {
              "trustScore": <number between 0 and 100, where 100 is perfectly reliable>,
              "factors": { "<reason_string>": <positive_or_negative_number_impact> },
              "recommendationAction": "<Short action, e.g. 'Disable COD', 'Allow standard checkout', 'Flag for review'>",
              "recommendationDetails": "<Brief explanation of why this action is recommended>",
              "paymentRoutingAdvice": "<Strictly how the platform's EXISTING payment rails should handle this. e.g. 'Route through standard checkout', 'Force prepaid via card, disable COD rail'>"
            }
          `;
                    const response = await axios_1.default.post('https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
                        model: 'qwen-turbo',
                        input: {
                            messages: [
                                { role: 'system', content: 'You are an AI predictive risk analysis system. Only output JSON.' },
                                { role: 'user', content: prompt }
                            ]
                        },
                        parameters: {
                            result_format: 'message'
                        }
                    }, {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (response.data?.output?.choices?.length > 0) {
                        const aiText = response.data.output.choices[0].message.content.trim();
                        const cleaned = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
                        const aiResult = JSON.parse(cleaned);
                        const trustScore = Math.max(0, Math.min(100, aiResult.trustScore || 50));
                        const riskLevel = this.getRiskLevel(trustScore);
                        return {
                            role: features.role,
                            trustScore,
                            riskLevel,
                            factors: aiResult.factors || {},
                            recommendation: {
                                action: aiResult.recommendationAction || 'Standard Checkout',
                                details: aiResult.recommendationDetails || 'AI analysis complete.',
                                paymentRoutingAdvice: aiResult.paymentRoutingAdvice || 'Route via standard platform payment rails.',
                            }
                        };
                    }
                }
                catch (apiError) {
                    logger_1.logger.error(`[DashScope] Failed e-commerce prediction API call, falling back to heuristic ML: ${apiError.message}`);
                }
            }
            // 2. Fall back to Rule-Based / Heuristic Model
            return this.ruleBasedPrediction(features);
        }
        catch (error) {
            logger_1.logger.error('Error in Ecommerce AI prediction, falling back to rule-based', error);
            return this.ruleBasedPrediction(features);
        }
    }
    ruleBasedPrediction(features) {
        let score = 70; // Base trust score
        const factors = {};
        let action = 'Allow standard checkout';
        let details = 'User metrics fall within acceptable platform norms.';
        let paymentRoutingAdvice = 'Route via standard platform payment rails.';
        if (features.role === 'BUYER') {
            const bh = features.buyerHistory;
            const pd = features.buyerDeliveryFactors;
            const pf = features.buyerPaymentFactors;
            if (bh) {
                if (bh.totalOrders > 10) {
                    score += 10;
                    factors['Established Account'] = 10;
                }
                if (bh.returnRate > 0.2) {
                    score -= (bh.returnRate * 50);
                    factors['High Return Rate'] = -Math.round(bh.returnRate * 50);
                }
            }
            if (pd) {
                if (pd.codRejectionRate > 0.15) {
                    score -= 40;
                    factors['Frequent COD Rejection'] = -40;
                    action = 'Disable Cash on Delivery';
                    details = 'High probability of package rejection at door based on history.';
                    paymentRoutingAdvice = 'Force prepaid options only (Credit Card / Wallet) via existing rails. Disable COD toggle.';
                }
            }
            if (pf && pf.paymentFailureRate > 0.3) {
                score -= 20;
                factors['High Payment Failure'] = -20;
            }
        }
        else if (features.role === 'SELLER') {
            const fh = features.sellerFulfillmentHistory;
            const qf = features.sellerQualityFactors;
            const pf = features.sellerPlatformFactors;
            if (fh) {
                if (fh.onTimeShippingRate < 0.8) {
                    score -= 25;
                    factors['Poor Shipping Time'] = -25;
                }
                if (fh.outOfStockCancellationRate > 0.1) {
                    score -= 15;
                    factors['Inventory Issues'] = -15;
                }
            }
            if (qf) {
                if (qf.disputeRate > 0.05) {
                    score -= 30;
                    factors['High Dispute Rate'] = -30;
                    action = 'Require Escrow / Delay Payout';
                    details = 'High volume of buyer disputes indicates potential quality/fraud issues.';
                    paymentRoutingAdvice = 'Hold funds in platform escrow for 14 days post-delivery before releasing to seller.';
                }
                if (qf.averageReviewScore < 3.5) {
                    score -= 15;
                    factors['Poor Reviews'] = -15;
                }
            }
            if (pf) {
                if (pf.isVerified) {
                    score += 15;
                    factors['Verified Business'] = 15;
                }
                else if (pf.accountAgeDays < 30) {
                    score -= 10;
                    factors['New Unverified Seller'] = -10;
                }
            }
        }
        // Clamp score
        score = Math.max(0, Math.min(100, Math.round(score)));
        return {
            role: features.role,
            trustScore: score,
            riskLevel: this.getRiskLevel(score),
            factors,
            recommendation: {
                action,
                details,
                paymentRoutingAdvice,
            }
        };
    }
    getRiskLevel(score) {
        if (score < 40)
            return 'CRITICAL';
        if (score < 60)
            return 'HIGH';
        if (score < 80)
            return 'MODERATE';
        return 'LOW';
    }
}
exports.EcommerceReliabilityPredictor = EcommerceReliabilityPredictor;
exports.ecommerceReliabilityPredictor = new EcommerceReliabilityPredictor();
//# sourceMappingURL=ecommerceReliabilityPredictor.js.map