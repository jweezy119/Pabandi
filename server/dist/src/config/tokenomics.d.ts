export declare const TOKENOMICS: {
    /** Platform fee on booking value. 2% — below Stripe (2.9%+) and far below Upwork (10-20%). */
    readonly FEE_RATE: 0.02;
    /** Floor so tiny bookings still cover gas + are economically meaningful. */
    readonly MIN_FEE_PAB: 1;
    /** Share of the fee permanently burned (deflation). ~0.24%/yr of ~1B supply at scale. */
    readonly BURN_SHARE: 0.12;
    /** Allocation of the post-burn fee across treasury buckets (sums to 1.0). */
    readonly ALLOCATION: {
        readonly LP_PROVISION: 0.35;
        readonly OPERATING: 0.25;
        readonly YIELD_REINVEST: 0.25;
        readonly EMERGENCY: 0.15;
    };
    /** Notional PAB value of one simulated self-economy booking (demo visibility). */
    readonly SIM_BOOKING_VALUE_PAB: 1000;
    /** Flat $PAB fee to run one background check (anti-abuse monetization). */
    readonly PAB_FEE_PER_CHECK: 5;
};
/** Flat $PAB fee to run one background check (anti-abuse monetization). */
export declare const PAB_FEE_PER_CHECK = 5;
/** Flat $PAB fee to issue one Agent Capability Passport (the metered economic event). */
export declare const PAB_FEE_PER_PASSPORT = 2;
/** Foolproof abuse cap: max Agent Passport issues per owner per day. */
export declare const PASSPORT_MAX_ISSUES_PER_DAY = 50;
/** Reference USD price of 1 SOL for USD-denominated fee reporting (configurable). */
export declare const SOL_USD_PRICE: number;
/** Reference USD price of 1 $PAB for USD-denominated fee reporting. */
export declare const PAB_USD_PRICE = 0.1;
/** On-chain SOL platform fee per booking (gas + fee are both SOL). */
export declare const SOL_FEE_PER_BOOKING: number;
/** Fee for a booking of `amountPab` (value-based, with floor). */
export declare const computeFee: (amountPab: number) => number;
/** Deflationary burn for a given fee. */
export declare const computeBurn: (fee: number) => number;
/**
 * Records the full economic footprint of one booking fee:
 *  - BURN (deflation) as an AgentTransaction
 *  - the post-burn remainder allocated across treasury buckets (LP/OPS/YIELD/EMERGENCY)
 *    as treasuryPositions, so the Economy dashboard shows real utilization + control.
 */
export declare const recordBookingEconomics: (params: {
    agentId: string;
    fromAddress: string;
    fee: number;
}) => Promise<void>;
//# sourceMappingURL=tokenomics.d.ts.map