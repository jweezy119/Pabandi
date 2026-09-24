"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trustAttestationService = exports.TrustAttestationService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const ptp_spec_1 = require("../protocol/ptp.spec");
const trustFlux_service_1 = require("./trustFlux.service");
class TrustAttestationService {
    /**
     * Issue a signed cryptographic attestation for a user using the PTP protocol.
     */
    async issue(userId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { trustScore: true, verificationTier: true }
        });
        if (!user)
            throw new Error('User not found');
        const score = user.trustScore;
        // Compute velocity for PTP
        let velocityData = { direction: 'STEADY', momentum: 0, confidence: 0.5 };
        try {
            const flux = await trustFlux_service_1.trustFluxService.computeTrustFlux(userId);
            velocityData = {
                direction: flux.trend,
                momentum: Math.abs(flux.velocity),
                confidence: flux.confidence,
            };
        }
        catch (err) {
            logger_1.logger.warn(`Could not compute TrustFlux for ${userId}, using defaults.`);
        }
        // Issue standard PTP Attestation
        return ptp_spec_1.ptpEngine.issueAttestation(userId, 'INDIVIDUAL', // default to individual, could infer from DB
        score, velocityData);
    }
    /**
     * Verify an attestation from a 3rd party.
     * Defers to PTP Engine.
     */
    verify(attestation) {
        return ptp_spec_1.ptpEngine.verifyAttestation(attestation);
    }
}
exports.TrustAttestationService = TrustAttestationService;
exports.trustAttestationService = new TrustAttestationService();
//# sourceMappingURL=trustAttestation.service.js.map