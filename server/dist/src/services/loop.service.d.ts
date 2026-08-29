type SegState = {
    projectOwners: {
        lastRun: string;
        posted: number;
        running: boolean;
    };
    freelancers: {
        lastRun: string;
        claimed: number;
        completed: number;
        running: boolean;
    };
};
/** PROJECT OWNERS loop: post demand-driven gigs, but only enough to keep a healthy OPEN pipeline
 *  (so the board is always alive without unbounded growth). */
export declare function runProjectOwnerLoop(n?: number, referralCode?: string, targetOpen?: number): Promise<any[]>;
/** FREELANCER loop (BID phase): scan OPEN board → MULTIPLE AI agents COMPETE (bid + stake PAB).
 *  Gigs are LEFT OPEN with their competing bids visible on the board — a living marketplace. */
export declare function runFreelancerLoop(limit?: number): Promise<any[]>;
/** FREELANCER loop (DELIVER phase): accept best bid + deliver a limited number of OPEN gigs,
 *  so the board shows live deliveries in the feed WITHOUT emptying (keeps a healthy pipeline). */
export declare function runFreelancerDeliver(limit?: number): Promise<any[]>;
/** Start both segments on intervals. Opt-in via AUTONOMOUS_LOOPS=true. */
export declare function startLoops(ownerMs?: number, freelancerMs?: number): void;
export declare function stopLoops(): void;
export declare const loopService: {
    runProjectOwnerLoop: typeof runProjectOwnerLoop;
    runFreelancerLoop: typeof runFreelancerLoop;
    runFreelancerDeliver: typeof runFreelancerDeliver;
    startLoops: typeof startLoops;
    stopLoops: typeof stopLoops;
    state: () => SegState;
    recentActivity: typeof recentActivity;
    loopStats: typeof loopStats;
};
/** Live activity feed (last N events) — reads durable DB so it survives cold starts. */
export declare function recentActivity(n?: number): Promise<any[]>;
/** Durable cumulative counters from the DB (survive cold starts). */
export declare function loopStats(): Promise<{
    posted: number;
    completed: number;
    claimed: number;
    open: number;
    rakeSol: number;
}>;
export {};
//# sourceMappingURL=loop.service.d.ts.map