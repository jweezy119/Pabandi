export type SocialAction = {
    kind: 'post';
    text: string;
    mediaId?: string;
} | {
    kind: 'reply';
    postId: string;
    text: string;
} | {
    kind: 'quote';
    postId: string;
    text: string;
} | {
    kind: 'like';
    postId: string;
} | {
    kind: 'repost';
    postId: string;
} | {
    kind: 'follow';
    handle: string;
};
export interface SocialResult {
    dryRun: boolean;
    command: string;
    executed: boolean;
    output?: string;
    error?: string;
}
export declare const socialExec: {
    isDryRun: () => boolean;
    /**
     * Execute (or simulate) a social action. Returns the command + result.
     * In DRY_RUN, never touches the network. In LIVE, runs xurl and captures JSON.
     */
    run(action: SocialAction): Promise<SocialResult>;
    /**
     * Search X (live) for posts to engage with. Dry-run returns [] + the query.
     * Returns raw post objects (ids, text) so the marketing agent can decide replies.
     */
    search(query: string, n?: number): Promise<{
        dryRun: boolean;
        query: string;
        posts: any[];
        error?: string;
    }>;
};
export default socialExec;
//# sourceMappingURL=socialExec.service.d.ts.map