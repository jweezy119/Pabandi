/**
 * raydiumPool.service.ts — Backend-Managed AMM with Platform Custody
 * ==================================================================
 *
 * ALL funds are custodied by the platform wallet.
 * Agents track internal balances in the database.
 * Swaps execute from the platform wallet on behalf of agents.
 * LP fees accumulate as REAL USDC in the platform wallet.
 */
export declare function initializePool(pabAmount: number, usdcAmount: number): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function getPoolInfo(): Promise<{
    pabReserve: number;
    usdcReserve: number;
    price: number;
    totalFeesUsdc: number;
    totalVolumeUsd: number;
    k: number;
}>;
export declare function buyPAB(agentId: string, usdcAmount: number): Promise<{
    success: boolean;
    pabReceived?: number;
    error?: string;
}>;
export declare function sellPAB(agentId: string, pabAmount: number): Promise<{
    success: boolean;
    usdcReceived?: number;
    error?: string;
}>;
export declare function getFees(): {
    totalFeesUsdc: number;
    totalVolumeUsd: number;
};
//# sourceMappingURL=raydiumPool.service.d.ts.map