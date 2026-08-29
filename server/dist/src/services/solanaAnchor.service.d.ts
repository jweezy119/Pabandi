export interface AnchorResult {
    artifactType: string;
    artifactHash: string;
    signature: string;
    slot?: number;
    simulated: boolean;
    rpc?: string;
    anchoredAt: string;
}
/** SHA-256 a JSON-serialisable artifact into a stable hex hash. */
export declare function hashArtifact(artifact: any): string;
/**
 * Anchor an artifact on Solana. Real tx when configured, simulated otherwise.
 * anchorSeed lets callers namespace the memo (e.g. "ZK_NULLIFIER", "ACTUS_SCHEDULE").
 */
export declare function anchorOnSolana(artifactType: string, artifact: any, anchorSeed?: string): Promise<AnchorResult>;
export declare const solanaAnchor: {
    anchorOnSolana: typeof anchorOnSolana;
    hashArtifact: typeof hashArtifact;
};
//# sourceMappingURL=solanaAnchor.service.d.ts.map