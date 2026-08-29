export interface ScoreChangeReceipt {
    previousScore: number;
    newScore: number;
    basePoints: number;
    contextWeight: number;
    valueMultiplier: number;
    expectedProbability: number;
    actualOutcome: number;
    streakBonus: number;
    totalChange: number;
    reasoning: string;
}
export declare class ReliabilityService {
    private readonly SCORE_MAX;
    private readonly SCORE_MIN;
    private readonly K_FACTOR;
    /**
     * Determine the Context Weight (C) based on the business category (Scarcity Multiplier)
     */
    private getContextWeight;
    /**
     * Determine the Value Multiplier based on financial context (Skin in the Game)
     */
    private calculateValueMultiplier;
    /**
     * Determine the Actual Outcome (A) based on the event status and cancel reason
     */
    private getActualOutcome;
    /**
     * The Global Trust Protocol: Update a user's reliability score using the Elo algorithm
     */
    updateScoreForReservationActivity(userId: string, status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED', isLateCancel?: boolean, reservationId?: string, reservationValue?: number, cancelReason?: string): Promise<{
        newScore: number;
        receipt: ScoreChangeReceipt;
    } | null>;
    /**
     * Fetches the formatted reliability profile of a user
     */
    getUserReliabilityProfile(userId: string): Promise<{
        score: number;
        baseScore: number;
        tier: string;
        totalCompleted: number;
        totalNoShows: number;
        graphTrust: {
            referrerScore: number;
            effect: number;
            reason: string;
        } | null;
    } | null>;
    /**
     * Run periodically to apply velocity decay to user reliability scores.
     * If a user hasn't made a booking in a long time, their score decays towards 50.
     */
    applyTimeDecay(): Promise<number>;
}
export declare const reliabilityService: ReliabilityService;
//# sourceMappingURL=reliability.service.d.ts.map