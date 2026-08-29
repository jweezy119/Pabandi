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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trustGuaranteeService = exports.TrustGuaranteeService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const ptp_spec_1 = require("../protocol/ptp.spec");
// In-memory stores (production: DB + Stripe)
const activePolicies = new Map();
const claims = new Map();
// Platform-level risk pool
let totalGuaranteedUSD = 0;
let totalFeesCollectedUSD = 0;
let totalPayoutsUSD = 0;
class TrustGuaranteeService {
    /**
     * Purchase a transaction guarantee.
     * Only available for Band A and Band B buyers.
     */
    async purchaseGuarantee(merchantId, buyerId, transactionAmountUSD, buyerTrustScore) {
        const riskBand = ptp_spec_1.ptpEngine.scoreToRiskBand(buyerTrustScore);
        const bandSpec = ptp_spec_1.PTP_RISK_BANDS[riskBand];
        // Only Band A and B are eligible for guarantees
        if (bandSpec.guaranteeMaxUSD <= 0) {
            return {
                error: `Buyer's risk band (${riskBand}: ${bandSpec.label}) is not eligible for guarantees. Band A or B required.`,
            };
        }
        // Cap the guarantee at the band's maximum
        const guaranteedAmount = Math.min(transactionAmountUSD, bandSpec.guaranteeMaxUSD);
        // Calculate fee
        const feePercent = bandSpec.guaranteeFeePercent;
        const feeUSD = Math.round(guaranteedAmount * (feePercent / 100) * 100) / 100;
        // Issue policy
        const policy = {
            id: `guar_${crypto_1.default.randomBytes(8).toString('hex')}`,
            merchantId,
            buyerId,
            buyerRiskBand: riskBand,
            transactionAmountUSD,
            guaranteedAmountUSD: guaranteedAmount,
            feeUSD,
            feePercent,
            status: 'ACTIVE',
            coverageType: 'BOTH',
            createdAt: Date.now(),
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        };
        activePolicies.set(policy.id, policy);
        totalGuaranteedUSD += guaranteedAmount;
        totalFeesCollectedUSD += feeUSD;
        // Record in audit trail
        await database_1.prisma.trustAuditTrail.create({
            data: {
                userId: merchantId,
                previousScore: 0,
                newScore: 0,
                changeReason: 'GUARANTEE_PURCHASED',
                component: 'PTP_GUARANTEE',
                severity: 'positive',
                metadata: {
                    policyId: policy.id,
                    guaranteedAmountUSD: guaranteedAmount,
                    feeUSD,
                    buyerRiskBand: riskBand,
                    transactionAmountUSD,
                },
            },
        }).catch(err => logger_1.logger.warn(`[Guarantee] Audit trail write failed: ${err.message}`));
        logger_1.logger.info(`[Guarantee] Policy ${policy.id}: $${guaranteedAmount} guaranteed for Band ${riskBand} buyer (fee: $${feeUSD})`);
        return policy;
    }
    /**
     * File a guarantee claim when a guaranteed transaction goes wrong.
     */
    async fileClaim(policyId, merchantId, claimType, claimAmountUSD, evidence) {
        const policy = activePolicies.get(policyId);
        if (!policy) {
            return { error: 'Guarantee policy not found' };
        }
        if (policy.merchantId !== merchantId) {
            return { error: 'Unauthorized: you are not the policy holder' };
        }
        if (policy.status !== 'ACTIVE') {
            return { error: `Policy is ${policy.status}, not claimable` };
        }
        if (Date.now() > policy.expiresAt) {
            policy.status = 'EXPIRED';
            return { error: 'Guarantee policy has expired' };
        }
        if (claimAmountUSD > policy.guaranteedAmountUSD) {
            return { error: `Claim amount ($${claimAmountUSD}) exceeds guaranteed amount ($${policy.guaranteedAmountUSD})` };
        }
        const claim = {
            id: `claim_${crypto_1.default.randomBytes(8).toString('hex')}`,
            policyId,
            merchantId,
            claimType,
            claimAmountUSD,
            evidence,
            status: 'PENDING',
            submittedAt: Date.now(),
        };
        claims.set(claim.id, claim);
        policy.status = 'CLAIMED';
        policy.claimId = claim.id;
        // Auto-adjudicate small claims (< $50) for Band A buyers
        if (claimAmountUSD < 50 && policy.buyerRiskBand === 'A') {
            claim.status = 'APPROVED';
            claim.payoutAmountUSD = claimAmountUSD;
            claim.resolvedAt = Date.now();
            policy.status = 'PAID_OUT';
            totalPayoutsUSD += claimAmountUSD;
            logger_1.logger.info(`[Guarantee] Auto-approved claim ${claim.id}: $${claimAmountUSD} (Band A, small claim)`);
        }
        else {
            claim.status = 'UNDER_REVIEW';
            logger_1.logger.info(`[Guarantee] Claim ${claim.id} submitted for review: $${claimAmountUSD} (${claimType})`);
        }
        return claim;
    }
    /**
     * Adjudicate a claim (admin action).
     */
    async adjudicateClaim(claimId, decision, payoutAmount, denialReason) {
        const claim = claims.get(claimId);
        if (!claim)
            return { error: 'Claim not found' };
        const policy = activePolicies.get(claim.policyId);
        if (decision === 'APPROVE') {
            const payout = payoutAmount || claim.claimAmountUSD;
            claim.status = 'APPROVED';
            claim.payoutAmountUSD = payout;
            claim.resolvedAt = Date.now();
            totalPayoutsUSD += payout;
            if (policy)
                policy.status = 'PAID_OUT';
            // Penalize the buyer's trust score
            try {
                const { trustScoreService } = await Promise.resolve().then(() => __importStar(require('./trustScore.service')));
                await trustScoreService.processEvent(claim.merchantId, {
                    component: 'PTP_GUARANTEE',
                    reason: `Guarantee claim paid: ${claim.claimType}`,
                    severity: 'negative',
                });
            }
            catch { }
            logger_1.logger.info(`[Guarantee] Claim ${claimId} APPROVED: $${payout} payout`);
        }
        else {
            claim.status = 'DENIED';
            claim.denialReason = denialReason || 'Insufficient evidence';
            claim.resolvedAt = Date.now();
            if (policy)
                policy.status = 'ACTIVE'; // Reactivate policy
            logger_1.logger.info(`[Guarantee] Claim ${claimId} DENIED: ${denialReason}`);
        }
        return claim;
    }
    /**
     * Get platform-wide guarantee risk pool stats.
     */
    getRiskPoolStats() {
        const pendingClaims = Array.from(claims.values()).filter(c => c.status === 'PENDING' || c.status === 'UNDER_REVIEW').length;
        return {
            totalGuaranteedUSD: Math.round(totalGuaranteedUSD * 100) / 100,
            totalFeesCollectedUSD: Math.round(totalFeesCollectedUSD * 100) / 100,
            totalPayoutsUSD: Math.round(totalPayoutsUSD * 100) / 100,
            netRevenueUSD: Math.round((totalFeesCollectedUSD - totalPayoutsUSD) * 100) / 100,
            lossRatio: totalFeesCollectedUSD > 0
                ? Math.round((totalPayoutsUSD / totalFeesCollectedUSD) * 1000) / 1000
                : 0,
            activePolicies: Array.from(activePolicies.values()).filter(p => p.status === 'ACTIVE').length,
            pendingClaims,
        };
    }
    /**
     * Get guarantee eligibility and pricing for a specific buyer.
     */
    getEligibility(buyerTrustScore, transactionAmountUSD) {
        const riskBand = ptp_spec_1.ptpEngine.scoreToRiskBand(buyerTrustScore);
        const bandSpec = ptp_spec_1.PTP_RISK_BANDS[riskBand];
        if (bandSpec.guaranteeMaxUSD <= 0) {
            return {
                eligible: false,
                riskBand,
                guaranteedAmountUSD: 0,
                feeUSD: 0,
                feePercent: 0,
                coverageDescription: `Band ${riskBand} (${bandSpec.label}) is not eligible for guarantees. Minimum Band B required.`,
            };
        }
        const guaranteedAmount = Math.min(transactionAmountUSD, bandSpec.guaranteeMaxUSD);
        const feePercent = bandSpec.guaranteeFeePercent;
        const feeUSD = Math.round(guaranteedAmount * (feePercent / 100) * 100) / 100;
        return {
            eligible: true,
            riskBand,
            guaranteedAmountUSD: guaranteedAmount,
            feeUSD,
            feePercent,
            coverageDescription: `Band ${riskBand} (${bandSpec.label}): Up to $${guaranteedAmount} guaranteed against fraud and no-shows. Expected fraud rate: ${(bandSpec.fraudProbability * 100).toFixed(1)}%.`,
        };
    }
}
exports.TrustGuaranteeService = TrustGuaranteeService;
exports.trustGuaranteeService = new TrustGuaranteeService();
//# sourceMappingURL=trustGuarantee.service.js.map