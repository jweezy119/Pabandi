export interface FXQuote {
    sourceCurrency: string;
    targetCurrency: string;
    amount: number;
    rate: number;
    estimatedOutput: number;
    route: string[];
    provider: 'JUPITER' | 'CHAINLINK' | 'INTERNAL_LIQUIDITY';
    timestamp: string;
}
export declare class FXRouterService {
    /**
     * Evaluates multiple liquidity venues to find the most efficient routing
     * for cross-border capital (e.g. converting a USD deposit into SOL for staking yield,
     * or PKR into USDC for hedging).
     *
     * In production, this integrates with Jupiter Aggregator for Solana swaps
     * and Chainlink Data Feeds for off-chain FX verification.
     */
    getOptimalRoute(sourceCurrency: string, targetCurrency: string, amount: number): Promise<FXQuote>;
    /**
     * Executes a cross-border or on-chain swap using the optimal route.
     */
    executeSwap(quote: FXQuote): Promise<{
        success: boolean;
        txHash?: string;
    }>;
}
export declare const fxRouter: FXRouterService;
//# sourceMappingURL=fx.router.service.d.ts.map