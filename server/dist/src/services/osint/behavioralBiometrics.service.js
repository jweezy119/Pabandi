"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.behavioralBiometricsService = exports.BehavioralBiometricsService = void 0;
const logger_1 = require("../../utils/logger");
class BehavioralBiometricsService {
    constructor() {
        this.profiles = new Map();
    }
    /**
     * Ingest raw behavioral telemetry from a user session and update their profile.
     * Called by the client-side SDK on each session.
     */
    async ingestSession(userId, keystrokes, mouse, navigation) {
        logger_1.logger.info(`[BehavioralBiometrics] Ingesting session for user ${userId}`);
        // Compress raw signals into feature vectors
        const keystrokeVec = this.compressKeystroke(keystrokes);
        const mouseVec = this.compressMouse(mouse);
        const navigationVec = this.compressNavigation(navigation);
        const sessionVec = this.computeSessionRhythm(navigation);
        // Combine into full feature vector
        const fullVector = [...keystrokeVec, ...mouseVec, ...navigationVec, ...sessionVec];
        // Update or create profile
        const existing = this.profiles.get(userId);
        if (existing) {
            // Exponential moving average: blend new session with existing profile
            const alpha = Math.max(0.1, 1 / (existing.sampleCount + 1));
            const blended = existing.featureVector.map((v, i) => v * (1 - alpha) + (fullVector[i] || 0) * alpha);
            existing.featureVector = blended;
            existing.keystrokeSignature = this.blendVectors(existing.keystrokeSignature, keystrokeVec, alpha);
            existing.mouseSignature = this.blendVectors(existing.mouseSignature, mouseVec, alpha);
            existing.navigationSignature = this.blendVectors(existing.navigationSignature, navigationVec, alpha);
            existing.sessionSignature = this.blendVectors(existing.sessionSignature, sessionVec, alpha);
            existing.sampleCount++;
            existing.lastUpdated = Date.now();
            existing.confidence = Math.min(1.0, 0.3 + (existing.sampleCount / 20) * 0.7);
            return { profileUpdated: true, sampleCount: existing.sampleCount };
        }
        else {
            // Create new profile
            this.profiles.set(userId, {
                userId,
                featureVector: fullVector,
                keystrokeSignature: keystrokeVec,
                mouseSignature: mouseVec,
                navigationSignature: navigationVec,
                sessionSignature: sessionVec,
                sampleCount: 1,
                lastUpdated: Date.now(),
                confidence: 0.3
            });
            return { profileUpdated: true, sampleCount: 1 };
        }
    }
    /**
     * Match a live session against the stored behavioral profile.
     * Returns a similarity score and risk assessment.
     */
    async matchSession(userId, keystrokes, mouse, navigation) {
        const profile = this.profiles.get(userId);
        if (!profile || profile.sampleCount < 3) {
            // Insufficient data — cannot make a determination
            return {
                userId,
                similarity: 1.0,
                isLikelyOwner: true,
                isProbablyDifferentPerson: false,
                isBot: false,
                isUnderDuress: false,
                riskLevel: 'SAFE',
                anomalies: ['Insufficient behavioral data for comparison'],
                confidence: 0.1
            };
        }
        // Compress current session
        const keystrokeVec = this.compressKeystroke(keystrokes);
        const mouseVec = this.compressMouse(mouse);
        const navigationVec = this.compressNavigation(navigation);
        const sessionVec = this.computeSessionRhythm(navigation);
        const currentVector = [...keystrokeVec, ...mouseVec, ...navigationVec, ...sessionVec];
        // Compute cosine similarity
        const similarity = this.cosineSimilarity(profile.featureVector, currentVector);
        // Detect bot patterns
        const isBot = this.detectBot(keystrokes, mouse);
        // Detect duress patterns (stress indicators)
        const isUnderDuress = this.detectDuress(keystrokes, mouse, profile);
        // Compute per-dimension anomalies
        const anomalies = this.identifyAnomalies(profile, keystrokeVec, mouseVec, navigationVec);
        // Risk assessment
        let riskLevel = 'SAFE';
        if (isBot)
            riskLevel = 'CRITICAL';
        else if (similarity < 0.40)
            riskLevel = 'CRITICAL';
        else if (similarity < 0.55 || isUnderDuress)
            riskLevel = 'ALERT';
        else if (similarity < 0.65)
            riskLevel = 'SUSPICIOUS';
        const result = {
            userId,
            similarity: Math.round(similarity * 1000) / 1000,
            isLikelyOwner: similarity >= 0.65 && !isBot,
            isProbablyDifferentPerson: similarity < 0.40 || isBot,
            isBot,
            isUnderDuress,
            riskLevel,
            anomalies,
            confidence: profile.confidence
        };
        if (riskLevel !== 'SAFE') {
            logger_1.logger.warn(`[BehavioralBiometrics] ⚠️ Risk detected for user ${userId}: ${riskLevel} (similarity=${similarity.toFixed(3)}, bot=${isBot}, duress=${isUnderDuress})`);
        }
        return result;
    }
    /**
     * Get the behavioral divergence between two users.
     * Used by the AdversarialGraph to detect if two "different" accounts
     * are actually the same person (behavioral clone detection).
     */
    async crossMatch(userIdA, userIdB) {
        const profileA = this.profiles.get(userIdA);
        const profileB = this.profiles.get(userIdB);
        if (!profileA || !profileB) {
            return { similarity: 0, isSamePerson: false, confidence: 0 };
        }
        const similarity = this.cosineSimilarity(profileA.featureVector, profileB.featureVector);
        const confidence = Math.min(profileA.confidence, profileB.confidence);
        // Two different accounts with >0.85 behavioral similarity = same person
        return {
            similarity: Math.round(similarity * 1000) / 1000,
            isSamePerson: similarity > 0.85 && confidence > 0.5,
            confidence
        };
    }
    // ── Signal Compression ──────────────────────────────────────────────
    compressKeystroke(k) {
        return [
            this.mean(k.interKeyTimings),
            this.stddev(k.interKeyTimings),
            this.median(k.interKeyTimings),
            this.mean(k.dwellTimes),
            this.stddev(k.dwellTimes),
            this.mean(k.flightTimes),
            this.stddev(k.flightTimes),
            k.errorRate,
            this.mean(k.burstPattern),
            this.stddev(k.burstPattern),
            this.entropy(k.interKeyTimings),
            this.entropy(k.dwellTimes),
            this.skewness(k.interKeyTimings),
            this.kurtosis(k.interKeyTimings),
            this.autocorrelation(k.interKeyTimings),
            this.peakFrequency(k.burstPattern)
        ];
    }
    compressMouse(m) {
        return [
            this.mean(m.velocityCurve),
            this.stddev(m.velocityCurve),
            this.median(m.velocityCurve),
            m.hoverHesitations,
            m.clickAccuracy,
            m.scrollEntropy,
            m.straightLineRatio,
            this.entropy(m.velocityCurve),
            this.skewness(m.velocityCurve),
            this.kurtosis(m.velocityCurve),
            this.percentile(m.velocityCurve, 25),
            this.percentile(m.velocityCurve, 75),
            this.percentile(m.velocityCurve, 95),
            this.autocorrelation(m.velocityCurve),
            m.velocityCurve.length > 0 ? Math.max(...m.velocityCurve) : 0,
            m.velocityCurve.length > 0 ? Math.min(...m.velocityCurve) : 0
        ];
    }
    compressNavigation(n) {
        return [
            this.mean(n.pageTransitionTimes),
            this.stddev(n.pageTransitionTimes),
            this.median(n.pageTransitionTimes),
            n.clickDepth,
            n.searchVsNavigate,
            n.sessionDuration / 1000, // normalize to seconds
            this.mean(n.idleGaps),
            this.stddev(n.idleGaps),
            this.entropy(n.pageTransitionTimes),
            n.idleGaps.length,
            this.percentile(n.pageTransitionTimes, 90),
            this.skewness(n.pageTransitionTimes),
            n.sessionDuration > 0 ? n.idleGaps.reduce((a, b) => a + b, 0) / n.sessionDuration : 0,
            this.autocorrelation(n.pageTransitionTimes),
            n.pageTransitionTimes.length > 0 ? Math.max(...n.pageTransitionTimes) : 0,
            n.pageTransitionTimes.length > 0 ? Math.min(...n.pageTransitionTimes) : 0
        ];
    }
    computeSessionRhythm(n) {
        const totalIdle = n.idleGaps.reduce((a, b) => a + b, 0);
        const activeRatio = n.sessionDuration > 0 ? 1 - (totalIdle / n.sessionDuration) : 0;
        const burstiness = this.stddev(n.pageTransitionTimes) / (this.mean(n.pageTransitionTimes) || 1);
        return [
            activeRatio,
            burstiness,
            n.sessionDuration / 60000, // minutes
            n.idleGaps.length / (n.sessionDuration / 60000 || 1), // idle gaps per minute
            this.entropy(n.idleGaps),
            this.mean(n.idleGaps) / (n.sessionDuration || 1),
            n.pageTransitionTimes.length, // total page views
            n.clickDepth / (n.pageTransitionTimes.length || 1), // avg depth per page
            this.percentile(n.idleGaps, 50),
            this.percentile(n.idleGaps, 90),
            this.skewness(n.idleGaps),
            this.kurtosis(n.idleGaps),
            activeRatio > 0 ? n.pageTransitionTimes.length / (n.sessionDuration / 60000) : 0,
            burstiness > 2.0 ? 1 : 0, // burst mode flag
            Math.log1p(n.sessionDuration / 1000), // log-normalized duration
            this.autocorrelation(n.idleGaps)
        ];
    }
    // ── Bot & Duress Detection ──────────────────────────────────────────
    detectBot(k, m) {
        // Bots have unnaturally consistent timing (near-zero stddev)
        const keystrokeStddev = this.stddev(k.interKeyTimings);
        const mouseStddev = this.stddev(m.velocityCurve);
        // Human typing has stddev typically 20-150ms; bots < 5ms
        if (keystrokeStddev < 5 && k.interKeyTimings.length > 10)
            return true;
        // Bots have perfectly straight mouse movements
        if (m.straightLineRatio > 0.95 && m.velocityCurve.length > 20)
            return true;
        // Zero error rate with >50 keystrokes is suspicious (humans always make mistakes)
        if (k.errorRate === 0 && k.interKeyTimings.length > 50)
            return true;
        // Perfectly uniform inter-key timing (entropy near 0)
        if (this.entropy(k.interKeyTimings) < 0.5 && k.interKeyTimings.length > 20)
            return true;
        return false;
    }
    detectDuress(k, m, profile) {
        // Stress indicators: faster typing, more errors, erratic mouse movements
        const currentKeystrokeMean = this.mean(k.interKeyTimings);
        const profileKeystrokeMean = profile.keystrokeSignature[0] || currentKeystrokeMean;
        // Typing 40%+ faster than usual = stress/duress
        if (currentKeystrokeMean < profileKeystrokeMean * 0.6 && profile.sampleCount > 5)
            return true;
        // Error rate 3x higher than profile
        const profileErrorRate = profile.keystrokeSignature[7] || k.errorRate;
        if (k.errorRate > profileErrorRate * 3 && profile.sampleCount > 5)
            return true;
        // Mouse velocity variance 2x higher than profile
        const currentMouseStddev = this.stddev(m.velocityCurve);
        const profileMouseStddev = profile.mouseSignature[1] || currentMouseStddev;
        if (currentMouseStddev > profileMouseStddev * 2 && profile.sampleCount > 5)
            return true;
        return false;
    }
    identifyAnomalies(profile, keystrokeVec, mouseVec, navigationVec) {
        const anomalies = [];
        const threshold = 2.0; // Z-score threshold
        // Check keystroke anomalies
        const kSim = this.cosineSimilarity(profile.keystrokeSignature, keystrokeVec);
        if (kSim < 0.5)
            anomalies.push(`Keystroke pattern divergence (similarity: ${kSim.toFixed(2)})`);
        // Check mouse anomalies
        const mSim = this.cosineSimilarity(profile.mouseSignature, mouseVec);
        if (mSim < 0.5)
            anomalies.push(`Mouse movement pattern divergence (similarity: ${mSim.toFixed(2)})`);
        // Check navigation anomalies
        const nSim = this.cosineSimilarity(profile.navigationSignature, navigationVec);
        if (nSim < 0.5)
            anomalies.push(`Navigation cadence divergence (similarity: ${nSim.toFixed(2)})`);
        return anomalies;
    }
    // ── Statistical Utilities ───────────────────────────────────────────
    mean(arr) {
        if (arr.length === 0)
            return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    stddev(arr) {
        if (arr.length < 2)
            return 0;
        const avg = this.mean(arr);
        const sqDiffs = arr.map(v => Math.pow(v - avg, 2));
        return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / arr.length);
    }
    median(arr) {
        if (arr.length === 0)
            return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    percentile(arr, p) {
        if (arr.length === 0)
            return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const idx = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, idx)];
    }
    entropy(arr) {
        if (arr.length === 0)
            return 0;
        // Discretize into bins for entropy calculation
        const min = Math.min(...arr);
        const max = Math.max(...arr);
        const range = max - min || 1;
        const bins = 10;
        const counts = new Array(bins).fill(0);
        for (const v of arr) {
            const bin = Math.min(bins - 1, Math.floor(((v - min) / range) * bins));
            counts[bin]++;
        }
        let h = 0;
        for (const count of counts) {
            if (count > 0) {
                const p = count / arr.length;
                h -= p * Math.log2(p);
            }
        }
        return h;
    }
    skewness(arr) {
        if (arr.length < 3)
            return 0;
        const avg = this.mean(arr);
        const std = this.stddev(arr);
        if (std === 0)
            return 0;
        const n = arr.length;
        const m3 = arr.reduce((acc, v) => acc + Math.pow(v - avg, 3), 0) / n;
        return m3 / Math.pow(std, 3);
    }
    kurtosis(arr) {
        if (arr.length < 4)
            return 0;
        const avg = this.mean(arr);
        const std = this.stddev(arr);
        if (std === 0)
            return 0;
        const n = arr.length;
        const m4 = arr.reduce((acc, v) => acc + Math.pow(v - avg, 4), 0) / n;
        return m4 / Math.pow(std, 4) - 3; // Excess kurtosis
    }
    autocorrelation(arr) {
        if (arr.length < 3)
            return 0;
        const avg = this.mean(arr);
        let num = 0, den = 0;
        for (let i = 0; i < arr.length - 1; i++) {
            num += (arr[i] - avg) * (arr[i + 1] - avg);
        }
        for (let i = 0; i < arr.length; i++) {
            den += Math.pow(arr[i] - avg, 2);
        }
        return den === 0 ? 0 : num / den;
    }
    peakFrequency(arr) {
        if (arr.length === 0)
            return 0;
        // Simple peak detection: count local maxima
        let peaks = 0;
        for (let i = 1; i < arr.length - 1; i++) {
            if (arr[i] > arr[i - 1] && arr[i] > arr[i + 1])
                peaks++;
        }
        return peaks / (arr.length || 1);
    }
    cosineSimilarity(a, b) {
        if (a.length === 0 || b.length === 0)
            return 0;
        const len = Math.min(a.length, b.length);
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < len; i++) {
            dot += (a[i] || 0) * (b[i] || 0);
            normA += (a[i] || 0) ** 2;
            normB += (b[i] || 0) ** 2;
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom === 0 ? 0 : dot / denom;
    }
    blendVectors(existing, incoming, alpha) {
        return existing.map((v, i) => v * (1 - alpha) + (incoming[i] || 0) * alpha);
    }
}
exports.BehavioralBiometricsService = BehavioralBiometricsService;
exports.behavioralBiometricsService = new BehavioralBiometricsService();
//# sourceMappingURL=behavioralBiometrics.service.js.map