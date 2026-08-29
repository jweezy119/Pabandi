/**
 * Pabandi Autonomous Treasury Orchestrator
 * -----------------------------------------
 * Our own version of the "Meld brain": issues virtual accounts, listens for
 * fiat wires, and sweeps held fiat into on-chain stablecoins.
 *
 * Provider-agnostic via the ITreasuryAdapter interface. The active adapter is
 * chosen by env (TREASURY_PROVIDER). Default = SIMULATOR so the entire flow can
 * be built & tested today without a banking partner.
 *
 * Ledger: every sweep is written to the TreasuryPosition table (bucket = SWEEP)
 * with details in `meta`, so the profitability report has real (simulated)
 * data to show.
 */
export declare class TreasuryOrchestrator {
    private adapter;
    constructor();
    /** Create (or fetch) a virtual bank account for a Pabandi user. */
    issueVirtualAccount(userId: string): Promise<any>;
    /** Simulate / receive an incoming fiat wire to a virtual account. */
    handleIncomingWire(virtualAccountId: string, amountUsd: number): Promise<any>;
    /** Sweep a pending fiat position into on-chain stablecoin. */
    sweepToWeb3(treasuryPositionId: string, destinationWallet: string): Promise<any>;
    /** Full demo flow: issue account → incoming wire → sweep. Used for the report. */
    runDemoFlow(userId: string, amountUsd: number, destinationWallet: string): Promise<any>;
    /** Ledger for the profitability report. */
    getLedger(limit?: number): Promise<any[]>;
}
export declare const treasuryOrchestrator: TreasuryOrchestrator;
//# sourceMappingURL=orchestrator.service.d.ts.map