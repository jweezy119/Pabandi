/**
 * TemporalDeceptionDetector — "Chrono-Forensics"
 * ────────────────────────────────────────────────────────────────────────────
 * Detects time-based manipulation tactics that other fraud systems completely miss.
 *
 * Most fraud detection is spatial (where is the user?) or identity-based
 * (who is the user?). Pabandi adds TEMPORAL forensics — analyzing WHEN
 * actions happen and whether the timing patterns are humanly possible.
 *
 * Detection Vectors:
 *
 *   1. Impossible Travel Detection
 *      - User logs in from Lagos at 14:00 and New York at 14:05
 *      - No commercial flight covers that in 5 minutes
 *      - Uses Haversine formula + maximum human travel speed
 *
 *   2. Timezone Paradox Detection
 *      - Account claims to be in Dubai (UTC+4) but consistently
 *        active during 3-6 AM Dubai time (= US business hours)
 *      - Detects timezone spoofing used by fraudsters
 *
 *   3. Session Velocity Abuse
 *      - Automated accounts complete multi-step flows in <2 seconds
 *      - Human minimum: ~8 seconds for a 3-step checkout flow
 *      - Flags superhuman interaction speeds
 *
 *   4. Circadian Rhythm Analysis
 *      - Builds a 24-hour activity histogram per user
 *      - Legitimate users have distinct sleep periods (6-8 hours of inactivity)
 *      - Bot accounts are uniformly active 24/7
 *      - Account sharing shows >1 circadian peak (multiple humans)
 *
 *   5. Temporal Collusion Detection
 *      - Two accounts that always transact within <60s of each other
 *      - Wash trading pattern: A → B → A within tight windows
 *      - Detects coordinated fake review/transaction rings
 *
 *   6. Timestamp Forgery Detection
 *      - Client-side timestamps that don't match server-side receipt time
 *      - Clock skew > 30 seconds = suspicious
 *      - Clock skew patterns that match known bot frameworks
 */
export interface GeoPoint {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
}
export interface TemporalEvent {
    userId: string;
    timestamp: number;
    action: string;
    geoLocation?: GeoPoint;
    clientTimestamp?: number;
    sessionId?: string;
    metadata?: Record<string, any>;
}
export interface TemporalAnomalyReport {
    userId: string;
    anomalies: TemporalAnomaly[];
    circadianProfile: CircadianProfile;
    overallRisk: 'CLEAN' | 'SUSPICIOUS' | 'COMPROMISED';
    confidence: number;
    analyzedEvents: number;
    generatedAt: string;
}
export interface TemporalAnomaly {
    type: 'IMPOSSIBLE_TRAVEL' | 'TIMEZONE_PARADOX' | 'SESSION_VELOCITY_ABUSE' | 'CIRCADIAN_ANOMALY' | 'TEMPORAL_COLLUSION' | 'TIMESTAMP_FORGERY';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    evidence: Record<string, any>;
    detectedAt: number;
}
export interface CircadianProfile {
    activityHistogram: number[];
    sleepWindow: {
        startHour: number;
        endHour: number;
    } | null;
    peakHours: number[];
    is24x7Active: boolean;
    hasMultiplePeaks: boolean;
    entropy: number;
}
export declare class TemporalDeceptionDetector {
    private eventBuffer;
    /**
     * Ingest a temporal event for a user. Events are buffered for batch analysis.
     */
    recordEvent(event: TemporalEvent): void;
    /**
     * Run full temporal forensics on a user's event history.
     */
    analyzeUser(userId: string): Promise<TemporalAnomalyReport>;
    private detectImpossibleTravel;
    private detectTimezoneParadox;
    private detectSessionVelocityAbuse;
    private buildCircadianProfile;
    private analyzeCircadian;
    private detectTemporalCollusion;
    private detectTimestampForgery;
    /**
     * Haversine formula: great-circle distance between two geo points.
     */
    private haversineDistance;
    private deg2rad;
    private shannonEntropy;
    private findPeaks;
    private loadEventsFromDB;
}
export declare const temporalDeceptionDetector: TemporalDeceptionDetector;
//# sourceMappingURL=temporalDeception.detector.d.ts.map