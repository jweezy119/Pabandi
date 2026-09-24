/** Real business (owner-agent) wallet: generated once, encrypted at rest. Print its pubkey so it can be funded. */
export declare function ensureBusinessWallet(): {
    pubkey: string;
    secretB64: string;
};
export interface SmeInput {
    skill: string;
    budgetUsd?: number;
    deadlineDays?: number;
    referralCode?: string;
    clientWallet?: string;
    payerSecretB64?: string;
    description?: string;
}
export declare function createGigFromSme(input: SmeInput): Promise<any>;
export interface AgentSignup {
    profileId: string;
    walletAddress: string;
    encryptedPrivateKey: string;
    category: string;
    skills?: string[];
    ownerUserId?: string;
    trustScore?: number;
    startingPab?: number;
}
export declare function registerAgent(input: AgentSignup): Promise<any>;
export declare function bidOnGig(gigId: string, opts: {
    agentId: string;
    quoteUsd?: number;
    passportToken?: string;
    stakePab?: number;
}): Promise<any>;
export declare function acceptBestBid(gigId: string, opts?: {
    payerSecretB64?: string;
    clientWallet?: string;
}): Promise<any>;
export declare function completeGig(gigId: string, txHash?: string): Promise<any>;
export declare function agentBalance(agentId: string): Promise<any>;
/** Controlled PAB faucet — tops up an agent's trust stake (treasury-funded; simulates mint from reserve). */
export declare function agentFaucet(agentId: string, amountPab: number): Promise<any>;
export declare function openBoard(limit?: number): Promise<any[]>;
export declare function claimGig(gigId: string, opts: {
    agentId?: string;
    passportToken?: string;
    claimerWallet?: string;
}): Promise<any>;
export declare function pabStats(): Promise<any>;
/** Transparent bid ranking for a gig — "why this agent won", surfaced to the public explainer. */
export declare function bidRanking(gigId: string): Promise<any>;
export declare const gigService: {
    createGigFromSme: typeof createGigFromSme;
    registerAgent: typeof registerAgent;
    bidOnGig: typeof bidOnGig;
    acceptBestBid: typeof acceptBestBid;
    agentBalance: typeof agentBalance;
    agentFaucet: typeof agentFaucet;
    pabStats: typeof pabStats;
    openBoard: typeof openBoard;
    claimGig: typeof claimGig;
    completeGig: typeof completeGig;
    bidRanking: typeof bidRanking;
    ensureBusinessWallet: typeof ensureBusinessWallet;
};
//# sourceMappingURL=gig.service.d.ts.map