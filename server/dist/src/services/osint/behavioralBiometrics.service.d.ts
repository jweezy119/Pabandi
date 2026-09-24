/**
 * BehavioralBiometricsService — "Digital DNA Fingerprinting"
 * ────────────────────────────────────────────────────────────────────────────
 * Goes beyond device fingerprinting. Instead of checking WHAT device someone
 * uses, we analyze HOW they use it. Every person has a unique behavioral
 * signature that is nearly impossible to fake.
 *
 * Signals captured (via client-side SDK):
 *   1. Keystroke dynamics    — inter-key timing, dwell time, flight time
 *   2. Mouse/touch patterns  — velocity curves, hover hesitation, scroll entropy
 *   3. Navigation cadence    — time between page transitions, click depth
 *   4. Session rhythm        — active/idle ratio, session duration distribution
 *   5. Typing personality    — error rate, backspace frequency, word burst patterns
 *   6. Form interaction      — field-fill order, copy-paste detection, autofill usage
 *
 * Algorithm:
 *   - Each signal dimension produces a feature vector (typically 8-16 floats)
 *   - Vectors are concatenated into a BehavioralProfile (96-dimensional)
 *   - New sessions are compared against the stored profile using cosine similarity
 *   - If similarity < 0.65 → likely different person (account takeover or shared account)
 *   - If similarity < 0.40 → almost certainly different person → ALERT
 *
 * Attack resistance:
 *   - Cannot be spoofed by VPN, Tor, or device emulators
 *   - Bots and automation tools have 0.0 typing personality (no human variability)
 *   - Replay attacks fail because timing distributions shift naturally over time
 *   - Even the same person under duress shows detectable stress patterns
 *
 * This is the "lie detector" layer that catches account takeovers, social
 * engineering, and bot-driven fraud that OSINT alone would miss.
 */
export interface KeystrokeDynamics {
    interKeyTimings: number[];
    dwellTimes: number[];
    flightTimes: number[];
    errorRate: number;
    burstPattern: number[];
}
export interface MouseDynamics {
    velocityCurve: number[];
    hoverHesitations: number;
    clickAccuracy: number;
    scrollEntropy: number;
    straightLineRatio: number;
}
export interface NavigationCadence {
    pageTransitionTimes: number[];
    clickDepth: number;
    searchVsNavigate: number;
    sessionDuration: number;
    idleGaps: number[];
}
export interface BehavioralProfile {
    userId: string;
    featureVector: number[];
    keystrokeSignature: number[];
    mouseSignature: number[];
    navigationSignature: number[];
    sessionSignature: number[];
    sampleCount: number;
    lastUpdated: number;
    confidence: number;
}
export interface BiometricMatchResult {
    userId: string;
    similarity: number;
    isLikelyOwner: boolean;
    isProbablyDifferentPerson: boolean;
    isBot: boolean;
    isUnderDuress: boolean;
    riskLevel: 'SAFE' | 'SUSPICIOUS' | 'ALERT' | 'CRITICAL';
    anomalies: string[];
    confidence: number;
}
export declare class BehavioralBiometricsService {
    private profiles;
    /**
     * Ingest raw behavioral telemetry from a user session and update their profile.
     * Called by the client-side SDK on each session.
     */
    ingestSession(userId: string, keystrokes: KeystrokeDynamics, mouse: MouseDynamics, navigation: NavigationCadence): Promise<{
        profileUpdated: boolean;
        sampleCount: number;
    }>;
    /**
     * Match a live session against the stored behavioral profile.
     * Returns a similarity score and risk assessment.
     */
    matchSession(userId: string, keystrokes: KeystrokeDynamics, mouse: MouseDynamics, navigation: NavigationCadence): Promise<BiometricMatchResult>;
    /**
     * Get the behavioral divergence between two users.
     * Used by the AdversarialGraph to detect if two "different" accounts
     * are actually the same person (behavioral clone detection).
     */
    crossMatch(userIdA: string, userIdB: string): Promise<{
        similarity: number;
        isSamePerson: boolean;
        confidence: number;
    }>;
    private compressKeystroke;
    private compressMouse;
    private compressNavigation;
    private computeSessionRhythm;
    private detectBot;
    private detectDuress;
    private identifyAnomalies;
    private mean;
    private stddev;
    private median;
    private percentile;
    private entropy;
    private skewness;
    private kurtosis;
    private autocorrelation;
    private peakFrequency;
    private cosineSimilarity;
    private blendVectors;
}
export declare const behavioralBiometricsService: BehavioralBiometricsService;
//# sourceMappingURL=behavioralBiometrics.service.d.ts.map