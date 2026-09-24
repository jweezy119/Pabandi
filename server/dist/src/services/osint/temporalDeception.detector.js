"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.temporalDeceptionDetector = exports.TemporalDeceptionDetector = void 0;
const logger_1 = require("../../utils/logger");
const database_1 = require("../../utils/database");
// Maximum speed constants for impossible travel detection
const MAX_FLIGHT_SPEED_KMH = 1000; // Commercial jet
const MAX_DRIVE_SPEED_KMH = 200; // Highway driving
const EARTH_RADIUS_KM = 6371;
class TemporalDeceptionDetector {
    constructor() {
        this.eventBuffer = new Map();
    }
    /**
     * Ingest a temporal event for a user. Events are buffered for batch analysis.
     */
    recordEvent(event) {
        const events = this.eventBuffer.get(event.userId) || [];
        events.push(event);
        // Keep last 500 events per user
        if (events.length > 500)
            events.shift();
        this.eventBuffer.set(event.userId, events);
    }
    /**
     * Run full temporal forensics on a user's event history.
     */
    async analyzeUser(userId) {
        logger_1.logger.info(`[ChronoForensics] Analyzing temporal patterns for user ${userId}`);
        const events = this.eventBuffer.get(userId) || [];
        // Also pull from database if available
        const dbEvents = await this.loadEventsFromDB(userId);
        const allEvents = [...events, ...dbEvents]
            .sort((a, b) => a.timestamp - b.timestamp);
        if (allEvents.length < 5) {
            return {
                userId,
                anomalies: [],
                circadianProfile: this.buildCircadianProfile([]),
                overallRisk: 'CLEAN',
                confidence: 0.1,
                analyzedEvents: allEvents.length,
                generatedAt: new Date().toISOString()
            };
        }
        const anomalies = [];
        // ── 1. Impossible Travel Detection ─────────────────────────────────
        const travelAnomalies = this.detectImpossibleTravel(allEvents);
        anomalies.push(...travelAnomalies);
        // ── 2. Timezone Paradox Detection ──────────────────────────────────
        const tzAnomalies = this.detectTimezoneParadox(allEvents);
        anomalies.push(...tzAnomalies);
        // ── 3. Session Velocity Abuse ──────────────────────────────────────
        const velocityAnomalies = this.detectSessionVelocityAbuse(allEvents);
        anomalies.push(...velocityAnomalies);
        // ── 4. Circadian Rhythm Analysis ───────────────────────────────────
        const circadianProfile = this.buildCircadianProfile(allEvents);
        const circadianAnomalies = this.analyzeCircadian(circadianProfile);
        anomalies.push(...circadianAnomalies);
        // ── 5. Temporal Collusion Detection ────────────────────────────────
        const collusionAnomalies = await this.detectTemporalCollusion(userId, allEvents);
        anomalies.push(...collusionAnomalies);
        // ── 6. Timestamp Forgery Detection ─────────────────────────────────
        const forgeryAnomalies = this.detectTimestampForgery(allEvents);
        anomalies.push(...forgeryAnomalies);
        // Overall risk assessment
        const criticalCount = anomalies.filter(a => a.severity === 'CRITICAL').length;
        const highCount = anomalies.filter(a => a.severity === 'HIGH').length;
        let overallRisk = 'CLEAN';
        if (criticalCount > 0 || highCount > 2)
            overallRisk = 'COMPROMISED';
        else if (highCount > 0 || anomalies.length > 3)
            overallRisk = 'SUSPICIOUS';
        const confidence = Math.min(1.0, 0.3 + allEvents.length / 100);
        return {
            userId,
            anomalies,
            circadianProfile,
            overallRisk,
            confidence,
            analyzedEvents: allEvents.length,
            generatedAt: new Date().toISOString()
        };
    }
    // ── Detection Methods ───────────────────────────────────────────────
    detectImpossibleTravel(events) {
        const anomalies = [];
        const geoEvents = events.filter(e => e.geoLocation);
        for (let i = 1; i < geoEvents.length; i++) {
            const prev = geoEvents[i - 1];
            const curr = geoEvents[i];
            if (!prev.geoLocation || !curr.geoLocation)
                continue;
            const distanceKm = this.haversineDistance(prev.geoLocation, curr.geoLocation);
            const timeHours = (curr.timestamp - prev.timestamp) / 3600000;
            if (timeHours <= 0)
                continue;
            const requiredSpeedKmh = distanceKm / timeHours;
            if (requiredSpeedKmh > MAX_FLIGHT_SPEED_KMH && distanceKm > 100) {
                anomalies.push({
                    type: 'IMPOSSIBLE_TRAVEL',
                    severity: 'CRITICAL',
                    description: `User would need to travel at ${Math.round(requiredSpeedKmh)} km/h from ${prev.geoLocation.city || 'unknown'} to ${curr.geoLocation.city || 'unknown'} (${Math.round(distanceKm)} km in ${(timeHours * 60).toFixed(1)} minutes). Max possible: ${MAX_FLIGHT_SPEED_KMH} km/h.`,
                    evidence: {
                        from: prev.geoLocation,
                        to: curr.geoLocation,
                        distanceKm: Math.round(distanceKm),
                        timeMinutes: Math.round(timeHours * 60),
                        requiredSpeedKmh: Math.round(requiredSpeedKmh),
                        fromAction: prev.action,
                        toAction: curr.action
                    },
                    detectedAt: Date.now()
                });
            }
        }
        return anomalies;
    }
    detectTimezoneParadox(events) {
        const anomalies = [];
        // Group events by claimed timezone (from geoLocation)
        // If user claims UTC+4 but is consistently active during UTC+4's 2-5 AM → paradox
        const geoEvents = events.filter(e => e.geoLocation);
        if (geoEvents.length < 10)
            return anomalies;
        // Estimate claimed timezone from geo (simplified)
        const lastGeo = geoEvents[geoEvents.length - 1].geoLocation;
        const claimedTzOffset = Math.round(lastGeo.longitude / 15); // Rough TZ from longitude
        // Compute activity hours in claimed timezone
        const localHours = events.map(e => {
            const utcHour = new Date(e.timestamp).getUTCHours();
            return (utcHour + claimedTzOffset + 24) % 24;
        });
        // Count activity in "sleep hours" (2 AM - 6 AM local)
        const sleepHourActivity = localHours.filter(h => h >= 2 && h <= 6).length;
        const sleepHourRatio = sleepHourActivity / localHours.length;
        // If >40% of activity is during claimed timezone's sleep hours → paradox
        if (sleepHourRatio > 0.4 && localHours.length > 20) {
            anomalies.push({
                type: 'TIMEZONE_PARADOX',
                severity: 'HIGH',
                description: `${Math.round(sleepHourRatio * 100)}% of user activity occurs during 2-6 AM in their claimed timezone (UTC${claimedTzOffset >= 0 ? '+' : ''}${claimedTzOffset}). This suggests timezone spoofing or geo-masking.`,
                evidence: {
                    claimedTzOffset,
                    sleepHourActivity,
                    totalEvents: localHours.length,
                    sleepHourRatio: Math.round(sleepHourRatio * 100),
                    claimedLocation: lastGeo
                },
                detectedAt: Date.now()
            });
        }
        return anomalies;
    }
    detectSessionVelocityAbuse(events) {
        const anomalies = [];
        // Group events by session
        const sessions = new Map();
        for (const event of events) {
            const sessionId = event.sessionId || 'default';
            if (!sessions.has(sessionId))
                sessions.set(sessionId, []);
            sessions.get(sessionId).push(event);
        }
        for (const [sessionId, sessionEvents] of sessions) {
            if (sessionEvents.length < 3)
                continue;
            const sorted = sessionEvents.sort((a, b) => a.timestamp - b.timestamp);
            // Check for superhuman speed: multi-step flows completed too fast
            for (let i = 2; i < sorted.length; i++) {
                const windowStart = sorted[i - 2].timestamp;
                const windowEnd = sorted[i].timestamp;
                const windowMs = windowEnd - windowStart;
                // 3 sequential actions in <1 second is not humanly possible
                if (windowMs < 1000 && windowMs >= 0) {
                    anomalies.push({
                        type: 'SESSION_VELOCITY_ABUSE',
                        severity: 'HIGH',
                        description: `3 actions completed in ${windowMs}ms (session ${sessionId}). Minimum human time: ~3000ms. Likely automated.`,
                        evidence: {
                            sessionId,
                            actions: sorted.slice(i - 2, i + 1).map(e => ({ action: e.action, ts: e.timestamp })),
                            windowMs,
                            humanMinimumMs: 3000
                        },
                        detectedAt: Date.now()
                    });
                    break; // One per session is enough
                }
            }
        }
        return anomalies;
    }
    buildCircadianProfile(events) {
        // Build 24-hour histogram
        const hourCounts = new Array(24).fill(0);
        for (const event of events) {
            const hour = new Date(event.timestamp).getUTCHours();
            hourCounts[hour]++;
        }
        // Normalize
        const maxCount = Math.max(1, ...hourCounts);
        const histogram = hourCounts.map(c => Math.round((c / maxCount) * 1000) / 1000);
        // Find sleep window (longest consecutive period below 0.1 activity)
        let sleepWindow = null;
        let maxSleepLength = 0;
        let sleepStart = -1;
        for (let start = 0; start < 24; start++) {
            let length = 0;
            for (let offset = 0; offset < 24; offset++) {
                const hour = (start + offset) % 24;
                if (histogram[hour] < 0.1) {
                    length++;
                }
                else {
                    break;
                }
            }
            if (length > maxSleepLength) {
                maxSleepLength = length;
                sleepStart = start;
            }
        }
        if (maxSleepLength >= 4) {
            sleepWindow = {
                startHour: sleepStart,
                endHour: (sleepStart + maxSleepLength) % 24
            };
        }
        // Find peak hours
        const peakThreshold = 0.7;
        const peakHours = histogram
            .map((v, h) => ({ v, h }))
            .filter(x => x.v >= peakThreshold)
            .map(x => x.h);
        // Detect 24/7 activity (entropy close to max = log2(24) ≈ 4.58)
        const entropy = this.shannonEntropy(histogram);
        const is24x7Active = entropy > 4.0 && maxSleepLength < 3;
        // Detect multiple peaks (account sharing)
        const peaks = this.findPeaks(histogram);
        const hasMultiplePeaks = peaks.length > 2;
        return {
            activityHistogram: histogram,
            sleepWindow,
            peakHours,
            is24x7Active,
            hasMultiplePeaks,
            entropy: Math.round(entropy * 1000) / 1000
        };
    }
    analyzeCircadian(profile) {
        const anomalies = [];
        if (profile.is24x7Active) {
            anomalies.push({
                type: 'CIRCADIAN_ANOMALY',
                severity: 'HIGH',
                description: `Account shows 24/7 uniform activity (entropy: ${profile.entropy}). No detectable sleep period. Likely automated or multiple operators.`,
                evidence: {
                    entropy: profile.entropy,
                    sleepWindow: profile.sleepWindow,
                    histogram: profile.activityHistogram
                },
                detectedAt: Date.now()
            });
        }
        if (profile.hasMultiplePeaks) {
            anomalies.push({
                type: 'CIRCADIAN_ANOMALY',
                severity: 'MEDIUM',
                description: `Multiple distinct activity peaks detected, suggesting account sharing between ${this.findPeaks(profile.activityHistogram).length} operators in different timezones.`,
                evidence: {
                    peakHours: profile.peakHours,
                    peakCount: this.findPeaks(profile.activityHistogram).length,
                    histogram: profile.activityHistogram
                },
                detectedAt: Date.now()
            });
        }
        return anomalies;
    }
    async detectTemporalCollusion(userId, events) {
        const anomalies = [];
        // Find transaction events
        const txEvents = events.filter(e => e.action === 'TRANSACTION' || e.action === 'BOOKING' || e.action === 'REVIEW');
        if (txEvents.length < 3)
            return anomalies;
        // Check for ping-pong patterns: A → B → A within tight windows
        // Pull counterparty info from metadata
        const counterparties = new Map();
        for (const tx of txEvents) {
            const counterpartyId = tx.metadata?.counterpartyId || tx.metadata?.businessId;
            if (counterpartyId) {
                if (!counterparties.has(counterpartyId))
                    counterparties.set(counterpartyId, []);
                counterparties.get(counterpartyId).push(tx.timestamp);
            }
        }
        for (const [counterpartyId, timestamps] of counterparties) {
            if (timestamps.length < 3)
                continue;
            // Check for suspiciously regular intervals
            const intervals = [];
            for (let i = 1; i < timestamps.length; i++) {
                intervals.push(timestamps[i] - timestamps[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const stddev = Math.sqrt(intervals.map(i => Math.pow(i - avgInterval, 2)).reduce((a, b) => a + b, 0) / intervals.length);
            // Very regular intervals (low stddev relative to mean) = automated collusion
            const coefficientOfVariation = stddev / (avgInterval || 1);
            if (coefficientOfVariation < 0.1 && timestamps.length >= 5) {
                anomalies.push({
                    type: 'TEMPORAL_COLLUSION',
                    severity: 'CRITICAL',
                    description: `Suspiciously regular transaction pattern with counterparty ${counterpartyId}. ${timestamps.length} transactions at ~${Math.round(avgInterval / 1000)}s intervals (CV: ${coefficientOfVariation.toFixed(3)}). Likely wash trading or coordinated fraud.`,
                    evidence: {
                        counterpartyId,
                        transactionCount: timestamps.length,
                        avgIntervalSeconds: Math.round(avgInterval / 1000),
                        coefficientOfVariation: Math.round(coefficientOfVariation * 1000) / 1000,
                        intervals: intervals.map(i => Math.round(i / 1000))
                    },
                    detectedAt: Date.now()
                });
            }
        }
        return anomalies;
    }
    detectTimestampForgery(events) {
        const anomalies = [];
        const eventsWithClientTs = events.filter(e => e.clientTimestamp != null);
        for (const event of eventsWithClientTs) {
            const skewMs = Math.abs(event.timestamp - (event.clientTimestamp || 0));
            // Clock skew > 30 seconds is suspicious
            if (skewMs > 30000) {
                anomalies.push({
                    type: 'TIMESTAMP_FORGERY',
                    severity: skewMs > 300000 ? 'HIGH' : 'MEDIUM',
                    description: `Client timestamp differs from server by ${Math.round(skewMs / 1000)}s. Action: ${event.action}. This may indicate timestamp manipulation or use of a debugging proxy.`,
                    evidence: {
                        serverTimestamp: event.timestamp,
                        clientTimestamp: event.clientTimestamp,
                        skewMs,
                        skewSeconds: Math.round(skewMs / 1000),
                        action: event.action
                    },
                    detectedAt: Date.now()
                });
            }
        }
        return anomalies;
    }
    // ── Utility Methods ──────────────────────────────────────────────────
    /**
     * Haversine formula: great-circle distance between two geo points.
     */
    haversineDistance(a, b) {
        const dLat = this.deg2rad(b.latitude - a.latitude);
        const dLon = this.deg2rad(b.longitude - a.longitude);
        const sinDlat = Math.sin(dLat / 2);
        const sinDlon = Math.sin(dLon / 2);
        const calc = sinDlat * sinDlat +
            Math.cos(this.deg2rad(a.latitude)) * Math.cos(this.deg2rad(b.latitude)) *
                sinDlon * sinDlon;
        const c = 2 * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc));
        return EARTH_RADIUS_KM * c;
    }
    deg2rad(deg) {
        return deg * (Math.PI / 180);
    }
    shannonEntropy(distribution) {
        const sum = distribution.reduce((a, b) => a + b, 0);
        if (sum === 0)
            return 0;
        let entropy = 0;
        for (const v of distribution) {
            if (v > 0) {
                const p = v / sum;
                entropy -= p * Math.log2(p);
            }
        }
        return entropy;
    }
    findPeaks(histogram) {
        const peaks = [];
        for (let i = 0; i < histogram.length; i++) {
            const prev = histogram[(i - 1 + histogram.length) % histogram.length];
            const next = histogram[(i + 1) % histogram.length];
            if (histogram[i] > prev && histogram[i] > next && histogram[i] > 0.3) {
                peaks.push(i);
            }
        }
        return peaks;
    }
    async loadEventsFromDB(userId) {
        try {
            const recentActivity = await database_1.prisma.trustAuditTrail.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 100,
                select: { createdAt: true, changeReason: true }
            });
            return recentActivity.map(a => ({
                userId,
                timestamp: a.createdAt.getTime(),
                action: a.changeReason
            }));
        }
        catch {
            return [];
        }
    }
}
exports.TemporalDeceptionDetector = TemporalDeceptionDetector;
exports.temporalDeceptionDetector = new TemporalDeceptionDetector();
//# sourceMappingURL=temporalDeception.detector.js.map