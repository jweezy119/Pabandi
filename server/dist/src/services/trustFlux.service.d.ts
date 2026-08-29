export interface TrustFluxResult {
    userId: string;
    velocity: number;
    confidence: number;
    trajectory: Array<{
        ts: number;
        score: number;
        velocity: number;
    }>;
    anomaly: boolean;
    trend: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE';
    predictedScore30d: number;
    predictedScore90d: number;
    peerNormalizedVelocity?: number;
}
export declare class TrustFluxService {
    /**
     * Compute TrustFlux for a user by analyzing their recent transaction graph.
     *
     * Algorithm:
     * 1. Collect all transactions in last 30 days (reservations, reviews, disputes, stakes)
     * 2. Build temporal event sequence with signed deltas
     * 3. Apply exponential decay weighting (older events weigh less)
     * 4. Bin into 4 × ~7.5-day windows and normalize
     * 5. Linear regression slope on binned scores = velocity
     * 6. Confidence = f(event count, recency ratio)
     * 7. Trend classification + anomaly detection
     * 8. 30-day / 90-day forward projections
     */
    computeTrustFlux(userId: string): Promise<TrustFluxResult>;
    /** Apply EMA smoothing to reduce noise in velocity signal */
    private applyEMA;
    /** Compute acceleration (second derivative of the score trajectory) */
    private computeAcceleration;
    /** Peer-group normalization: compare user's velocity to similar-tier peers */
    getPeerNormalizedVelocity(userId: string, rawVelocity: number): Promise<number>;
    /** Generate a 30-day forward trajectory projection */
    predict(userId: string, days?: number): Promise<Array<{
        ts: number;
        score: number;
        velocity: number;
    }>>;
    /** Linear regression slope — measures trend direction */
    private linearRegressionSlope;
    /** Classify trend based on velocity and recent activity */
    private classifyTrend;
    /** Detect anomalies: sudden score changes not explained by events */
    private detectAnomaly;
    /** Get current trust score from DB or compute baseline */
    private getCurrentScore;
    /** Return default flux for users with no activity */
    private defaultFlux;
}
export declare const trustFluxService: TrustFluxService;
//# sourceMappingURL=trustFlux.service.d.ts.map