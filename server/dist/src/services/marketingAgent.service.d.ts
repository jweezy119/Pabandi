import { SocialAction } from './socialExec.service';
export interface MarketingPost {
    text: string;
    action: SocialAction;
    dryRun: boolean;
}
/**
 * Compose a Desi-sarcastic, TRUTHFUL post using real on-chain stats.
 * No synthetic numbers — every figure is pulled from the economy ledger.
 */
declare function composePost(): Promise<string>;
/**
 * Generate + (optionally in live mode) post a marketing update.
 * In DRY_RUN (default) this logs the exact xurl command and returns it — no network, no cost.
 */
export declare function generateAndPost(): Promise<MarketingPost>;
/**
 * Autonomous engagement: search X for relevant conversations and decide a safe action.
 * DRY_RUN logs the decision; LIVE executes via xurl (repost/reply/like).
 * Conservative: only engage clearly on-topic posts, never our own, varied actions.
 */
export declare function runEngagementSweep(): Promise<{
    dryRun: boolean;
    decisions: any[];
}>;
/**
 * Generate + post a marketing update to Farcaster (DRY_RUN-safe, same pattern as X).
 */
export declare function generateAndPostFarcaster(): Promise<MarketingPost>;
/**
 * Autonomous Farcaster engagement sweep (DRY_RUN logs decisions; LIVE executes).
 */
export declare function runFarcasterSweep(): Promise<{
    dryRun: boolean;
    decisions: any[];
}>;
export declare function runDemo(): Promise<{
    transcript: any[];
    leaderboard: any;
}>;
export declare const marketingAgent: {
    generateAndPost: typeof generateAndPost;
    runEngagementSweep: typeof runEngagementSweep;
    composePost: typeof composePost;
    generateAndPostFarcaster: typeof generateAndPostFarcaster;
    runFarcasterSweep: typeof runFarcasterSweep;
    runDemo: typeof runDemo;
};
export declare function startAutonomousMarketing(intervalMs?: number): void;
export declare function stopAutonomousMarketing(): void;
export default marketingAgent;
//# sourceMappingURL=marketingAgent.service.d.ts.map