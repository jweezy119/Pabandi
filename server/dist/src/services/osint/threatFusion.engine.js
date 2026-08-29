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
exports.threatFusionEngine = exports.ThreatFusionEngine = void 0;
const logger_1 = require("../../utils/logger");
const database_1 = require("../../utils/database");
const osintMCPClient_service_1 = require("./osintMCPClient.service");
const adversarialGraph_service_1 = require("./adversarialGraph.service");
const shadowEscrow_service_1 = require("./shadowEscrow.service");
const soulboundReputation_service_1 = require("./soulboundReputation.service");
class ThreatFusionEngine {
    /**
     * Execute a full-spectrum threat fusion analysis on a user/transaction.
     * This is the "big red button" — it orchestrates ALL intelligence layers.
     */
    async analyzeFull(userId, context) {
        const startTime = Date.now();
        logger_1.logger.info(`[ThreatFusion] ═══ FULL SPECTRUM ANALYSIS for user ${userId} ═══`);
        const signals = [];
        // ── 1. OSINT MCP Pipeline ──────────────────────────────────────────
        if (context.username) {
            try {
                const maigret = await osintMCPClient_service_1.osintMCPClient.queryMaigretMCP(context.username);
                signals.push({
                    source: 'OSINT_MCP_MAIGRET',
                    belief: this.osintToMass(maigret.riskScoreDelta, maigret.isSuspicious),
                    rawData: maigret,
                    timestamp: Date.now()
                });
            }
            catch (e) {
                logger_1.logger.warn(`[ThreatFusion] Maigret signal failed: ${e.message}`);
            }
        }
        if (context.domain) {
            try {
                const infra = await osintMCPClient_service_1.osintMCPClient.queryInfrastructurePipeline(context.domain);
                const combinedRisk = infra.reduce((sum, r) => sum + r.riskScoreDelta, 0);
                const anySuspicious = infra.some(r => r.isSuspicious);
                signals.push({
                    source: 'OSINT_MCP_INFRASTRUCTURE',
                    belief: this.osintToMass(combinedRisk, anySuspicious),
                    rawData: infra,
                    timestamp: Date.now()
                });
            }
            catch (e) {
                logger_1.logger.warn(`[ThreatFusion] Infrastructure signal failed: ${e.message}`);
            }
        }
        // ── 2. Adversarial Graph (Constellation) ───────────────────────────
        let constellation;
        if (context.walletAddress || context.username) {
            try {
                const seedType = context.walletAddress ? 'WALLET' : 'IDENTITY';
                const seedLabel = context.walletAddress || context.username;
                constellation = await adversarialGraph_service_1.adversarialGraphService.buildConstellation(`${seedType}-${seedLabel}`, seedType, seedLabel, 2 // Limit depth for performance
                );
                signals.push({
                    source: 'ADVERSARIAL_GRAPH',
                    belief: this.constellationToMass(constellation),
                    rawData: { threatLevel: constellation.threatLevel, nodes: constellation.totalNodes },
                    timestamp: Date.now()
                });
            }
            catch (e) {
                logger_1.logger.warn(`[ThreatFusion] Constellation signal failed: ${e.message}`);
            }
        }
        // ── 3. TrustFlux (Trajectory) ──────────────────────────────────────
        try {
            const { trustFluxService } = await Promise.resolve().then(() => __importStar(require('../trustFlux.service')));
            const flux = await trustFluxService.computeTrustFlux(userId);
            signals.push({
                source: 'TRUST_FLUX',
                belief: this.trustFluxToMass(flux.velocity, flux.trend, flux.anomaly),
                rawData: { velocity: flux.velocity, trend: flux.trend, anomaly: flux.anomaly },
                timestamp: Date.now()
            });
        }
        catch (e) {
            logger_1.logger.warn(`[ThreatFusion] TrustFlux signal failed: ${e.message}`);
        }
        // ── 4. Identity Clustering ─────────────────────────────────────────
        if (context.ipAddress && context.deviceFingerprint) {
            try {
                const { osintService } = await Promise.resolve().then(() => __importStar(require('../osint.service')));
                const cluster = await osintService.clusterIdentity(userId, context.ipAddress, context.deviceFingerprint);
                const clusterRisk = cluster.riskScore || 0;
                const multipleUsers = cluster.userIds.length > 1;
                signals.push({
                    source: 'IDENTITY_CLUSTER',
                    belief: {
                        safe: multipleUsers ? 0.1 : 0.7,
                        risky: multipleUsers ? 0.5 + Math.min(0.3, clusterRisk / 100) : 0.05,
                        unknown: multipleUsers ? 0.4 - Math.min(0.3, clusterRisk / 100) : 0.25
                    },
                    rawData: { clusterSize: cluster.userIds.length, riskScore: clusterRisk },
                    timestamp: Date.now()
                });
            }
            catch (e) {
                logger_1.logger.warn(`[ThreatFusion] Identity cluster signal failed: ${e.message}`);
            }
        }
        // ── 5. Transaction Pattern Analysis ────────────────────────────────
        if (context.transactionAmount) {
            try {
                const txSignal = await this.analyzeTransactionPatterns(userId, context.transactionAmount);
                signals.push(txSignal);
            }
            catch (e) {
                logger_1.logger.warn(`[ThreatFusion] Transaction pattern signal failed: ${e.message}`);
            }
        }
        // ── 6. User History Signal ─────────────────────────────────────────
        try {
            const historySignal = await this.analyzeUserHistory(userId);
            signals.push(historySignal);
        }
        catch (e) {
            logger_1.logger.warn(`[ThreatFusion] User history signal failed: ${e.message}`);
        }
        // ═══ DEMPSTER-SHAFER FUSION ════════════════════════════════════════
        const fusedBelief = this.dempsterShaferFusion(signals);
        // Plausibility of threat = risky + unknown (worst case includes uncertainty)
        const plausibilityOfThreat = fusedBelief.risky + fusedBelief.unknown;
        const beliefInSafety = fusedBelief.safe;
        // ═══ DECISION ══════════════════════════════════════════════════════
        let action;
        if (plausibilityOfThreat < 0.20) {
            action = 'AUTO_APPROVE';
        }
        else if (plausibilityOfThreat < 0.50) {
            action = 'ENHANCED_MONITORING';
        }
        else if (plausibilityOfThreat < 0.75) {
            action = 'REQUIRE_ADDITIONAL_KYC';
        }
        else {
            action = 'QUARANTINE';
        }
        // ═══ RECOMMENDATIONS ═══════════════════════════════════════════════
        const recommendations = this.generateRecommendations(action, signals, constellation);
        // ═══ AUTONOMOUS ACTIONS ════════════════════════════════════════════
        await this.executeAutonomousActions(userId, action, constellation, context);
        const processingTimeMs = Date.now() - startTime;
        const verdict = {
            userId,
            businessId: context.businessId,
            fusedBelief,
            plausibilityOfThreat: Math.round(plausibilityOfThreat * 1000) / 1000,
            beliefInSafety: Math.round(beliefInSafety * 1000) / 1000,
            action,
            signals,
            constellation,
            recommendations,
            fusionConfidence: Math.min(1.0, signals.length / 5),
            processingTimeMs,
            generatedAt: new Date().toISOString()
        };
        logger_1.logger.info(`[ThreatFusion] ═══ VERDICT: ${action} (plausibility=${plausibilityOfThreat.toFixed(3)}, safety=${beliefInSafety.toFixed(3)}) in ${processingTimeMs}ms ═══`);
        return verdict;
    }
    /**
     * Dempster-Shafer Rule of Combination.
     *
     * Fuses multiple independent belief mass functions into a single combined mass.
     * Unlike Bayesian methods, D-S handles uncertainty explicitly via the "unknown" mass.
     *
     * For two mass functions m1, m2:
     *   m12(A) = (1/K) * Σ_{B∩C=A} m1(B) * m2(C)
     *   K = 1 - Σ_{B∩C=∅} m1(B) * m2(C)   (normalization / conflict measure)
     */
    dempsterShaferFusion(signals) {
        if (signals.length === 0) {
            return { safe: 0, risky: 0, unknown: 1.0 }; // Total ignorance
        }
        // Start with the first signal's mass function
        let fused = { ...signals[0].belief };
        // Iteratively combine with each subsequent signal
        for (let i = 1; i < signals.length; i++) {
            fused = this.combineTwoMasses(fused, signals[i].belief);
        }
        return fused;
    }
    /**
     * Combine two Dempster-Shafer mass functions using Dempster's Rule.
     *
     * Frame of discernment: Θ = {SAFE, RISKY}
     * Focal elements: {SAFE}, {RISKY}, {SAFE, RISKY} (= UNKNOWN/uncertainty)
     *
     * Intersection rules:
     *   {SAFE} ∩ {SAFE} = {SAFE}
     *   {RISKY} ∩ {RISKY} = {RISKY}
     *   {SAFE} ∩ {RISKY} = ∅ (conflict)
     *   {SAFE} ∩ {UNKNOWN} = {SAFE}
     *   {RISKY} ∩ {UNKNOWN} = {RISKY}
     *   {UNKNOWN} ∩ {UNKNOWN} = {UNKNOWN}
     */
    combineTwoMasses(m1, m2) {
        // Compute conflict (mass assigned to empty set)
        const conflict = m1.safe * m2.risky + m1.risky * m2.safe;
        const K = 1 - conflict; // Normalization factor
        if (K <= 0.001) {
            // Total conflict — signals completely disagree; return maximum uncertainty
            logger_1.logger.warn(`[ThreatFusion] Maximum conflict detected between signals`);
            return { safe: 0.33, risky: 0.34, unknown: 0.33 };
        }
        // Compute combined masses via intersection rules
        const safeMass = (m1.safe * m2.safe + // SAFE ∩ SAFE
            m1.safe * m2.unknown + // SAFE ∩ UNKNOWN
            m1.unknown * m2.safe // UNKNOWN ∩ SAFE
        ) / K;
        const riskyMass = (m1.risky * m2.risky + // RISKY ∩ RISKY
            m1.risky * m2.unknown + // RISKY ∩ UNKNOWN
            m1.unknown * m2.risky // UNKNOWN ∩ RISKY
        ) / K;
        const unknownMass = (m1.unknown * m2.unknown // UNKNOWN ∩ UNKNOWN
        ) / K;
        return {
            safe: Math.round(safeMass * 1000) / 1000,
            risky: Math.round(riskyMass * 1000) / 1000,
            unknown: Math.round(unknownMass * 1000) / 1000
        };
    }
    // ── Signal-to-Mass Converters ────────────────────────────────────────
    osintToMass(riskScoreDelta, isSuspicious) {
        if (isSuspicious) {
            return {
                safe: 0.05,
                risky: Math.min(0.8, 0.3 + riskScoreDelta / 200),
                unknown: Math.max(0.15, 0.65 - riskScoreDelta / 200)
            };
        }
        return {
            safe: 0.6 + Math.min(0.3, Math.abs(riskScoreDelta) / 100),
            risky: 0.05,
            unknown: 0.35 - Math.min(0.3, Math.abs(riskScoreDelta) / 100)
        };
    }
    constellationToMass(report) {
        switch (report.threatLevel) {
            case 'CRITICAL': return { safe: 0.02, risky: 0.85, unknown: 0.13 };
            case 'HIGH': return { safe: 0.10, risky: 0.65, unknown: 0.25 };
            case 'MEDIUM': return { safe: 0.30, risky: 0.35, unknown: 0.35 };
            case 'LOW': return { safe: 0.60, risky: 0.10, unknown: 0.30 };
            default: return { safe: 0.33, risky: 0.33, unknown: 0.34 };
        }
    }
    trustFluxToMass(velocity, trend, anomaly) {
        if (anomaly) {
            return { safe: 0.10, risky: 0.50, unknown: 0.40 };
        }
        if (trend === 'RISING') {
            return { safe: 0.70, risky: 0.05, unknown: 0.25 };
        }
        if (trend === 'DECLINING') {
            return { safe: 0.15, risky: 0.45, unknown: 0.40 };
        }
        if (trend === 'VOLATILE') {
            return { safe: 0.20, risky: 0.35, unknown: 0.45 };
        }
        // STEADY
        return { safe: 0.50, risky: 0.10, unknown: 0.40 };
    }
    async analyzeTransactionPatterns(userId, amount) {
        // Pull recent transactions to detect anomalies
        const recentReservations = await database_1.prisma.reservation.findMany({
            where: { customerId: userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { depositAmount: true, createdAt: true, status: true }
        }).catch(() => []);
        const avgAmount = recentReservations.length > 0
            ? recentReservations.reduce((sum, r) => sum + (r.depositAmount || 0), 0) / recentReservations.length
            : amount;
        // Flag if current transaction is >3x the user's average
        const isAnomaly = amount > avgAmount * 3 && recentReservations.length > 3;
        // Flag if rapid-fire transactions (>5 in last hour)
        const oneHourAgo = new Date(Date.now() - 3600000);
        const recentCount = recentReservations.filter(r => r.createdAt > oneHourAgo).length;
        const isRapidFire = recentCount > 5;
        let belief;
        if (isAnomaly && isRapidFire) {
            belief = { safe: 0.05, risky: 0.80, unknown: 0.15 };
        }
        else if (isAnomaly || isRapidFire) {
            belief = { safe: 0.20, risky: 0.50, unknown: 0.30 };
        }
        else {
            belief = { safe: 0.65, risky: 0.05, unknown: 0.30 };
        }
        return {
            source: 'TRANSACTION_PATTERNS',
            belief,
            rawData: { amount, avgAmount, isAnomaly, isRapidFire, recentCount },
            timestamp: Date.now()
        };
    }
    async analyzeUserHistory(userId) {
        const [user, disputeCount, completedCount] = await Promise.all([
            database_1.prisma.user.findUnique({
                where: { id: userId },
                select: { trustScore: true, reliabilityScore: true, createdAt: true }
            }).catch(() => null),
            database_1.prisma.dispute.count({ where: { userId } }).catch(() => 0),
            database_1.prisma.reservation.count({ where: { customerId: userId, status: 'COMPLETED' } }).catch(() => 0)
        ]);
        if (!user) {
            return {
                source: 'USER_HISTORY',
                belief: { safe: 0.10, risky: 0.30, unknown: 0.60 },
                rawData: { exists: false },
                timestamp: Date.now()
            };
        }
        const accountAgeDays = (Date.now() - (user.createdAt?.getTime() || Date.now())) / 86400000;
        const trustScore = user.trustScore || 50;
        let belief;
        if (trustScore >= 80 && completedCount > 10 && disputeCount === 0 && accountAgeDays > 30) {
            belief = { safe: 0.85, risky: 0.02, unknown: 0.13 };
        }
        else if (trustScore >= 60 && completedCount > 3) {
            belief = { safe: 0.60, risky: 0.10, unknown: 0.30 };
        }
        else if (disputeCount > 2 || trustScore < 30) {
            belief = { safe: 0.10, risky: 0.60, unknown: 0.30 };
        }
        else {
            belief = { safe: 0.35, risky: 0.15, unknown: 0.50 };
        }
        return {
            source: 'USER_HISTORY',
            belief,
            rawData: { trustScore, completedCount, disputeCount, accountAgeDays },
            timestamp: Date.now()
        };
    }
    // ── Recommendations ──────────────────────────────────────────────────
    generateRecommendations(action, signals, constellation) {
        const recommendations = [];
        switch (action) {
            case 'QUARANTINE':
                recommendations.push('🚨 Deploy Shadow Escrow to extract adversary playbook');
                recommendations.push('🔒 Freeze all pending transactions for this user');
                recommendations.push('📡 Broadcast zero-day threat to MCP network');
                if (constellation && constellation.threatLevel === 'CRITICAL') {
                    recommendations.push(`🕸️ Investigate full constellation (${constellation.totalNodes} connected entities)`);
                }
                recommendations.push('🔥 Rot Soulbound NFT to BURNED status');
                break;
            case 'REQUIRE_ADDITIONAL_KYC':
                recommendations.push('🆔 Request government-issued ID verification');
                recommendations.push('📞 Require phone number verification (non-VOIP)');
                recommendations.push('📸 Request live selfie with ID document');
                recommendations.push('⏳ Hold transactions pending KYC completion');
                break;
            case 'ENHANCED_MONITORING':
                recommendations.push('👁️ Enable behavioral biometrics monitoring for next 30 days');
                recommendations.push('📊 Increase trust score audit frequency');
                recommendations.push('💰 Apply elevated escrow percentage (25%+)');
                break;
            case 'AUTO_APPROVE':
                recommendations.push('✅ Transaction cleared through all intelligence layers');
                recommendations.push('✨ Consider upgrading Soulbound NFT to OSINT_VERIFIED');
                break;
        }
        // Add signal-specific recommendations
        const highRiskSignals = signals.filter(s => s.belief.risky > 0.5);
        for (const signal of highRiskSignals) {
            recommendations.push(`⚠️ High-risk signal from ${signal.source} — investigate manually`);
        }
        return recommendations;
    }
    // ── Autonomous Actions ───────────────────────────────────────────────
    async executeAutonomousActions(userId, action, constellation, context) {
        try {
            if (action === 'QUARANTINE') {
                // Auto-deploy shadow escrow
                logger_1.logger.error(`[ThreatFusion] 🚨 AUTO-QUARANTINE: Deploying shadow escrow for user ${userId}`);
                await shadowEscrow_service_1.shadowEscrowService.deployHoneypot(userId, 'system', 0, 95);
                // Auto-rot soulbound NFT
                const tokenId = `PABANDI-SBT-${userId}`;
                await soulboundReputation_service_1.soulboundReputationService.rotToken(userId, tokenId, 'THREAT_FUSION_QUARANTINE');
                // Broadcast to MCP if constellation is critical
                if (constellation && constellation.threatLevel === 'CRITICAL') {
                    const { pabandiTrustMCPServer } = await Promise.resolve().then(() => __importStar(require('../../mcp/trustServer')));
                    await pabandiTrustMCPServer.publishZeroDayThreat({
                        sourceScammerId: userId,
                        muleWallets: constellation.contagionNodes
                            .filter(n => n.nodeId.startsWith('WALLET'))
                            .map(n => n.nodeLabel),
                        dropDomains: constellation.contagionNodes
                            .filter(n => n.nodeId.startsWith('DOMAIN') || n.nodeId.startsWith('INFRA'))
                            .map(n => n.nodeLabel),
                        tactic: `CONSTELLATION_${constellation.threatLevel}`
                    });
                }
            }
            else if (action === 'AUTO_APPROVE') {
                // Auto-upgrade soulbound NFT for clean users
                const tokenId = `PABANDI-SBT-${userId}`;
                await soulboundReputation_service_1.soulboundReputationService.upgradeToOsintVerified(userId, tokenId);
            }
        }
        catch (err) {
            logger_1.logger.error(`[ThreatFusion] Autonomous action failed: ${err.message}`);
        }
    }
}
exports.ThreatFusionEngine = ThreatFusionEngine;
exports.threatFusionEngine = new ThreatFusionEngine();
//# sourceMappingURL=threatFusion.engine.js.map