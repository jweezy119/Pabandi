/**
 * Calculate a reliability score (0-100) for a CRM client based on job history.
 *
 * Scoring:
 *   - Baseline: 50
 *   - Completion rate: +30 max (proportional to completed/total)
 *   - Cancel penalty: -15 max (proportional to cancelled/total)
 *   - Repeat bonus: +5 for 3+ jobs, +10 for 10+ jobs
 *   - Default penalty: -20 per completed job whose escrow was REFUNDED
 */
export declare function calculateClientScore(clientId: string, jobs: any[]): number;
/**
 * Recalculate and persist a client's reliabilityScore.
 */
export declare function updateClientScore(clientId: string): Promise<number>;
/**
 * Determine the lifecycle stage of a client.
 *
 * Priority order (first match wins):
 *   - vip:        10+ completed AND score > 80
 *   - at_risk:    score < 30 OR has a defaulted escrow (REFUNDED)
 *   - repeat:     2+ completed
 *   - booked:     has 1+ job
 *   - verified:   phone exists OR score > 0
 *   - lead:       no jobs (fallback)
 */
export declare function getClientStage(client: any, jobs: any[]): string;
/**
 * Recalculate score + stage for a client and persist both.
 */
export declare function refreshClientTrust(clientId: string): Promise<{
    score: number;
    stage: string;
}>;
//# sourceMappingURL=crm-reliability.service.d.ts.map