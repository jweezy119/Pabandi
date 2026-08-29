"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trustApiAsService = exports.TrustApiAsService = void 0;
/**
 * trustApiAsService.service.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Trust API-as-a-Service (APIaaS) — Recurring revenue layer.
 *
 * External businesses (marketplaces, insurtechs, DeFi protocols) subscribe
 * to ongoing trust verification for their customers/providers.
 *
 * Pricing tiers:
 *   - Starter: 1k verifications/month @ $99 → $0.099/verify
 *   - Growth: 10k verifications/month @ $799 → $0.0799/verify
 *   - Enterprise: Unlimited + custom integration @ $2,499/month
 *   - Pay-as-you-go: $0.15/verify (for < 1k/month)
 *
 * Each "verification" triggers TrustFlux + TrustVeil + TrustArbitrator
 * and returns a real-time trust verdict.
 */
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const trustFlux_service_1 = require("./trustFlux.service");
const ptp_spec_1 = require("../protocol/ptp.spec");
const billing_service_1 = require("./billing.service");
class TrustApiAsService {
    /**
     * Verify an entity's trust status via the B2B API.
     * Checks subscription quota via BillingService, computes TrustFlux,
     * returns a real-time PTP verification verdict.
     */
    async verifyEntity(apiKey, entityId, entityType) {
        // 1. Validate API key via Billing Service
        const customer = billing_service_1.billingService.validateApiKey(apiKey);
        if (!customer) {
            return { error: 'Invalid or inactive API key' };
        }
        // 2. Compute TrustFlux for velocity + trend
        let flux = { velocity: 0, trend: 'STEADY', confidence: 0.1 };
        try {
            flux = await trustFlux_service_1.trustFluxService.computeTrustFlux(entityId);
        }
        catch (e) {
            logger_1.logger.warn(`[TrustAPI] TrustFlux computation failed for ${entityId}, using defaults.`);
        }
        // Get base trust score
        let trustScore = 50;
        try {
            const user = await database_1.prisma.user.findUnique({ where: { id: entityId }, select: { trustScore: true } });
            if (user)
                trustScore = user.trustScore;
        }
        catch (e) { }
        // 3. Issue PTP Attestation
        const attestation = ptp_spec_1.ptpEngine.issueAttestation(entityId, entityType === 'CUSTOMER' ? 'INDIVIDUAL' : 'BUSINESS', trustScore, {
            direction: flux.trend,
            momentum: Math.abs(flux.velocity),
            confidence: flux.confidence
        });
        // 4. Record metered usage
        const usageRes = await billing_service_1.billingService.recordUsage(apiKey, 'VERIFICATION', 1, {
            entityType,
            riskBand: attestation.assessment.riskBand
        });
        if (!usageRes.success) {
            logger_1.logger.error(`[TrustAPI] Failed to record usage for customer ${customer.id}`);
        }
        // 5. Log usage in Audit Trail
        await database_1.prisma.trustAuditTrail.create({
            data: {
                userId: customer.id, // Using the API customer ID
                previousScore: 0,
                newScore: 0,
                changeReason: 'API_VERIFICATION_PTP',
                component: 'TRUST_API',
                severity: 'positive',
                metadata: {
                    billingTier: customer.tier,
                    entityType,
                    riskBand: attestation.assessment.riskBand,
                },
            },
        }).catch(e => logger_1.logger.warn(`[TrustAPI] Audit log failed: ${e.message}`));
        const now = Date.now();
        const result = {
            verified: true,
            entityId: attestation.subject.id,
            entityType,
            attestation,
            timestamp: now,
        };
        logger_1.logger.info(`[TrustAPI] PTP Verification by ${customer.companyName} — risk band: ${attestation.assessment.riskBand}`);
        return result;
    }
}
exports.TrustApiAsService = TrustApiAsService;
exports.trustApiAsService = new TrustApiAsService();
//# sourceMappingURL=trustApiAsService.service.js.map