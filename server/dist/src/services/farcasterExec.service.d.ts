export type FarcasterAction = {
    kind: 'post';
    text: string;
} | {
    kind: 'reply';
    castHash: string;
    text: string;
} | {
    kind: 'like';
    castHash: string;
} | {
    kind: 'repost';
    castHash: string;
};
export interface FarcasterResult {
    dryRun: boolean;
    command: string;
    executed: boolean;
    output?: string;
    error?: string;
}
export declare const farcasterExec: {
    isDryRun: () => boolean;
    run(action: FarcasterAction): Promise<FarcasterResult>;
    /** Search casts (dry-run returns []). Real impl depends on your Farcaster tooling. */
    search(_query: string, _n?: number): Promise<{
        dryRun: boolean;
        query: string;
        casts: any[];
        error?: string;
    }>;
};
export default farcasterExec;
//# sourceMappingURL=farcasterExec.service.d.ts.map