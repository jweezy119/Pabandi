export declare function startAutoTrader(): Promise<void>;
export declare function stopAutoTrader(): void;
export declare function getAutoTraderStats(): {
    running: boolean;
    uptimeMs: number;
    totalTrades: number;
    totalVolume: number;
    totalFees: number;
    startTime: number;
};
//# sourceMappingURL=autoTrader.service.d.ts.map