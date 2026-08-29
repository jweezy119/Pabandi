export interface FeeQuote {
    rate: number;
    feePab: number;
    tier: string;
}
/** Pick the value-progressive tier for a booking of `amountPab`. */
export declare function quoteFee(amountPab: number): FeeQuote;
/**
 * AGENTIC POLICY — given current system state, decide how to split this cycle's
 * collected fees between REINVEST (fund agents + gas) and RETAIN (platform profit).
 *
 * Logic (deterministic, self-optimizing toward sustained profit):
 *  - If agent PAB pools are thin (< UTIL_LOW), push reinvestment UP (protect throughput
 *    so future cycles still earn). Throughput is the profit engine; starving it kills
 *    future revenue.
 *  - If pools are healthy (>= UTIL_OK), pull reinvestment DOWN toward RETAIN_TARGET so
 *    profit accrues to the treasury.
 *  - Never let reinvestment spend the treasury below TREASURY_SOL_FLOOR.
 */
export declare function decideReinvestment(opts: {
    collectedPab: number;
    collectedSol: number;
    agentPabPoolAvg: number;
    treasurySol: number;
    avgBookingPab: number;
}): {
    reinvestPab: number;
    retainPab: number;
    reinvestSol: number;
    retainSol: number;
    reinvestRatio: number;
    reason: string;
};
/**
 * SELF-FUNDING LOOP — apply one cycle's collected fees:
 *  - reinvestPab → top up the N thinnest agents so they can keep booking (throughput)
 *  - reinvestSol → add to treasury gas buffer (rail stays live)
 *  - retainPab/retainSol → stay in treasury as platform profit (compounds via buybacks)
 * Returns an accounting record (no on-chain action here; the caller executes the
 * actual transfers via web3Agent.service so keys stay in one place).
 */
export declare function applyReinvestmentCycle(summary: {
    collectedPab: number;
    collectedSol: number;
    reinvestPab: number;
    reinvestSol: number;
    cycle: number;
}): Promise<{
    fundedAgents: number;
    pabToAgents: number;
    solToBuffer: number;
}>;
export declare const profitEngine: {
    quoteFee: typeof quoteFee;
    decideReinvestment: typeof decideReinvestment;
    applyReinvestmentCycle: typeof applyReinvestmentCycle;
    TIERS: any;
};
//# sourceMappingURL=profitEngine.service.d.ts.map