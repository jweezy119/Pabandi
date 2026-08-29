export declare function decryptPrivateKey(encrypted: string): string;
export interface Web3Agent {
    id?: string;
    profileId: string;
    walletAddress: string;
    encryptedPrivateKey: string;
    category: 'freelance-dev' | 'small-biz-owner' | 'project-owner' | 'solopreneur';
    balancePab: number;
    dailyOutflow: number;
    dailyTransactions: number;
    lastReset: Date;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface TransactionResult {
    success: boolean;
    txHash?: string;
    error?: string;
    amount?: number;
    to?: string;
    simulated?: boolean;
}
export declare class Web3AgentService {
    private connection;
    private treasuryKeypair;
    /** Set true after prepareLiveBookingRails() — live sends then skip ATA creation (saves SOL). */
    private prepared;
    constructor();
    /** Initialize treasury keypair from env (for funding transfers) */
    initTreasury(): boolean;
    /** Create a new agent wallet for a profile */
    createAgent(profileId: string, category: Web3Agent['category'], firstName: string): Promise<Web3Agent>;
    /** Load all active agents */
    loadAgents(): Promise<Web3Agent[]>;
    /** Fetch one agent by its profileId (used by the unified booking rail). */
    getAgentByProfileId(profileId: string): Promise<Web3Agent | null>;
    /** Get agent balance on-chain */
    getBalance(agent: Web3Agent): Promise<number>;
    /** Fund an agent wallet from treasury */
    fundAgent(agent: Web3Agent, amountPab: number): Promise<TransactionResult>;
    /** Execute a booking payment (agent pays another agent) */
    executeBookingPayment(fromAgent: Web3Agent, toAgent: Web3Agent, amountPab: number): Promise<TransactionResult>;
    /** Reset daily counters (called at midnight UTC) */
    resetDailyCounters(): Promise<void>;
    /**
     * Prepare LIVE booking rails within a SOL budget (default 0.5 SOL).
     * One-time cost: creates a PAB ATA for every agent wallet (~0.002 SOL each) and
     * distributes a small slice of SOL to each agent so it can pay its own tx fees.
     * After this runs, live PAB sends cost only ~0.000005 SOL, so even 0.5 SOL funds
     * tens of thousands of bookings. Idempotent: skips agents already prepared.
     *
     * This is what makes a small SOL balance (e.g. 0.6) viable for live on-chain bookings.
     */
    prepareLiveBookingRails(opts?: {
        solBudget?: number;
        perAgentSol?: number;
    }): Promise<{
        prepared: number;
        fundedSol: number;
        ataCreated: number;
        solSpent: number;
        error?: string;
    }>;
    /** Probe whether the funded wallet has enough SOL to keep doing live sends. */
    liveSolBuffer(): Promise<{
        sol: number;
        agentsFunded: number;
    }>;
    /**
     * Collect fees from the USDC/PAB liquidity pool.
     * Scans pool reserves, calculates arbitrage opportunity,
     * executes swap if profitable, and credits fee to treasury.
     */
    collectPoolFees(): Promise<{
        success: boolean;
        feesCollected?: number;
        error?: string;
    }>;
}
export declare const web3AgentService: Web3AgentService;
//# sourceMappingURL=web3Agent.service.d.ts.map