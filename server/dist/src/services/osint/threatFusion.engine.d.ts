import { ConstellationReport } from './adversarialGraph.service';
import { BiometricMatchResult } from './behavioralBiometrics.service';
/**
 * ThreatFusionEngine — "Cognitive Threat Intelligence"
 * ────────────────────────────────────────────────────────────────────────────
 * The central nervous system of Pabandi's security architecture.
 *
 * While most platforms have siloed security tools (fraud checker here,
 * OSINT there, biometrics somewhere else), the Threat Fusion Engine
 * FUSES signals from ALL Pabandi intelligence layers into a single
 * cognitive assessment.
 *
 * Signal Sources:
 *   1. OSINT MCP Pipeline     — external intelligence (Maigret, Shodan, etc.)
 *   2. Adversarial Graph      — constellation mapping & contagion
 *   3. Behavioral Biometrics  — session-level user authenticity
 *   4. TrustFlux             — velocity and trajectory of trust
 *   5. Shadow Escrow         — active defense intelligence
 *   6. Identity Clustering    — device/IP collisions
 *   7. Transaction Patterns   — amount, frequency, counterparty diversity
 *
 * Fusion Algorithm (Dempster-Shafer Evidence Theory):
 *   - Each signal source produces a "belief mass" for {SAFE, RISKY, UNKNOWN}
 *   - Dempster's Rule of Combination fuses these masses
 *   - The final "plausibility of threat" is used for automated decisions:
 *       > plausibility < 0.20  → AUTO_APPROVE
 *       > 0.20 ≤ plaus < 0.50 → ENHANCED_MONITORING (shadow mode)
 *       > 0.50 ≤ plaus < 0.75 → REQUIRE_ADDITIONAL_KYC
 *       > plausibility ≥ 0.75 → QUARANTINE (shadow escrow deployment)
 *
 * This makes Pabandi the ONLY marketplace platform that does true
 * multi-source intelligence fusion with mathematically grounded
 * evidence combination theory.
 */
export interface FusionSignal {
    source: string;
    belief: {
        safe: number;
        risky: number;
        unknown: number;
    };
    rawData: any;
    timestamp: number;
}
export interface FusionVerdict {
    userId: string;
    businessId?: string;
    fusedBelief: {
        safe: number;
        risky: number;
        unknown: number;
    };
    plausibilityOfThreat: number;
    beliefInSafety: number;
    action: 'AUTO_APPROVE' | 'ENHANCED_MONITORING' | 'REQUIRE_ADDITIONAL_KYC' | 'QUARANTINE';
    signals: FusionSignal[];
    constellation?: ConstellationReport;
    biometricMatch?: BiometricMatchResult;
    recommendations: string[];
    fusionConfidence: number;
    processingTimeMs: number;
    generatedAt: string;
}
export declare class ThreatFusionEngine {
    /**
     * Execute a full-spectrum threat fusion analysis on a user/transaction.
     * This is the "big red button" — it orchestrates ALL intelligence layers.
     */
    analyzeFull(userId: string, context: {
        businessId?: string;
        transactionAmount?: number;
        username?: string;
        domain?: string;
        ipAddress?: string;
        deviceFingerprint?: string;
        walletAddress?: string;
    }): Promise<FusionVerdict>;
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
    private dempsterShaferFusion;
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
    private combineTwoMasses;
    private osintToMass;
    private constellationToMass;
    private trustFluxToMass;
    private analyzeTransactionPatterns;
    private analyzeUserHistory;
    private generateRecommendations;
    private executeAutonomousActions;
}
export declare const threatFusionEngine: ThreatFusionEngine;
//# sourceMappingURL=threatFusion.engine.d.ts.map