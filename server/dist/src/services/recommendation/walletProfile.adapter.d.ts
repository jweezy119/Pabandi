/**
 * walletProfile.adapter — first-party, on-chain wallet-behavior signal extraction.
 *
 * Frugality / Invent & Simplify:
 *  - PRIMARY signal = real on-chain history (age, recurring income, DeFi LTV, program
 *    interactions). No paid API required to run: defaults to public RPC.
 *  - HELIUS is a drop-in slot: set process.env.HELIUS_API_KEY and the adapter routes
 *    getSignaturesForAddress through Helius's enhanced RPC for higher rate limits +
 *    parsed transaction metadata. Same output shape either way.
 *  - Returns a normalized WalletProfile the scorer consumes. Deterministic, no AI.
 */
export interface WalletProfile {
    address: string;
    ageDays: number;
    txCount: number;
    recurringIncome: boolean;
    incomeStreams: number;
    ltvPct: number | null;
    defiInteractions: number;
    anchorDeploys: number;
    failedTxRatio: number;
    lastActiveDays: number;
    raw?: any;
}
declare function rpcUrl(): string;
/**
 * Extract a WalletProfile from on-chain history.
 * Sampling cap keeps it cheap: we read up to `limit` signatures and inspect a window
 * of them for income/deFi/program signals. Recurring income + anchor deploys are the
 * highest-value signals for the recommendation engine.
 */
export declare function getWalletProfile(address: string, limit?: number): Promise<WalletProfile>;
export declare const _internal: {
    KNOWN_LEND_PROGRAMS: Set<string>;
    BPF_LOADER: Set<string>;
    rpcUrl: typeof rpcUrl;
};
export {};
//# sourceMappingURL=walletProfile.adapter.d.ts.map