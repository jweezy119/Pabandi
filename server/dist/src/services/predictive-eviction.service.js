"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.predictiveEvictionService = exports.PredictiveEvictionService = void 0;
const database_1 = require("../utils/database");
// In a real implementation, we would import '@tensorflow/tfjs-node' 
// or an ONNX runtime to execute the XGBoost/Temporal GNN models.
class PredictiveEvictionService {
    /**
     * Evaluates a tenant's eviction risk probability and updates their profile.
     * Uses a mocked ML ensemble representing XGBoost + Temporal GNN models
     * trained on CourtListener data and OSINT indicators.
     */
    async evaluateTenantRisk(tenantId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: tenantId },
            include: {
                leases: {
                    include: { payments: true }
                }
            }
        });
        if (!user)
            throw new Error('Tenant not found');
        // 1. Gather Features
        const totalLeases = user.leases.length;
        let latePayments = 0;
        let onTimePayments = 0;
        user.leases.forEach(lease => {
            lease.payments.forEach(p => {
                if (p.isOnTime)
                    onTimePayments++;
                else
                    latePayments++;
            });
        });
        // OSINT and Macro trends (mocked)
        const macroRiskFactor = 0.05; // Base county eviction risk
        const osintRiskFactor = user.trustScore < 50 ? 0.2 : 0.05;
        // 2. Execute ML Model (Mocked)
        // probability = 1 - (e^(-(weights * features)))
        // For simplicity, we just use a heuristic that simulates the ML output.
        let riskScore = 500; // Base score (out of 1000, higher is better)
        riskScore += onTimePayments * 20;
        riskScore -= latePayments * 50;
        // Normalize to 0-1000
        riskScore = Math.max(0, Math.min(1000, riskScore));
        // Convert score to probability of eviction (0.0 to 1.0)
        // Score 1000 -> 1% chance. Score 0 -> 90% chance.
        let evictionProbability = 0.9 - (riskScore / 1000) * 0.89;
        // Cap probability based on OSINT & Macro risks
        evictionProbability = Math.max(evictionProbability, macroRiskFactor);
        evictionProbability = Math.min(1.0, evictionProbability + osintRiskFactor);
        // 3. Update User Profile
        await database_1.prisma.user.update({
            where: { id: tenantId },
            data: {
                evictionRiskScore: Math.round(riskScore),
                evictionRiskProbability: evictionProbability
            }
        });
        return {
            tenantId,
            riskScore: Math.round(riskScore),
            evictionProbability,
            recommendation: evictionProbability > 0.4 ? 'HIGH_RISK' : 'APPROVE'
        };
    }
}
exports.PredictiveEvictionService = PredictiveEvictionService;
exports.predictiveEvictionService = new PredictiveEvictionService();
//# sourceMappingURL=predictive-eviction.service.js.map