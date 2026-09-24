interface CycleResult {
    cycleNumber: number;
    cycleTime: number;
    projectId: string;
    revenue: number;
    pabIssued: number;
    success: boolean;
}
interface ProfitReport {
    totalCycles: number;
    totalRevenue: number;
    totalPabIssued: number;
    avgCycleTime: number;
    capitalVelocity: number;
    dailyRevenue: number;
    monthlyRevenue: number;
    annualRevenue: number;
    roiPercent: number;
    efficiency: number;
    currentFeeRate: number;
    protectedDailyRevenue: number;
    protectedMonthlyRevenue: number;
}
export declare class ProfitEngine {
    private cycleCount;
    private totalRevenue;
    private totalPabIssued;
    private cycleTimes;
    private lastCycleTime;
    private cyclesThisMinute;
    private minuteResetTime;
    private get feeRate();
    private get taskValue();
    private isRateLimited;
    private recordCycleExecution;
    runCycle(): Promise<CycleResult>;
    private completeProject;
    private adjustFeeRate;
    private getAvgCycleTime;
    private recordCycle;
    getReport(): ProfitReport;
    checkArbitrageOpportunity(): Promise<{
        opportunity: boolean;
        spread: number;
        action: string;
    }>;
    deployIdleCapital(amountUsd: number): Promise<number>;
    getSettlementSpeed(): {
        chain: string;
        finalityMs: number;
        costPerTx: number;
    };
    quoteFee(amountPab: number): {
        feePab: number;
        rate: number;
    };
    decideReinvestment(params: {
        collectedPab: number;
        collectedSol: number;
        agentPabPoolAvg: number;
        treasurySol: number;
        avgBookingPab: number;
    }): {
        reinvestPab: number;
        reinvestSol: number;
        retainPab: number;
        retainSol: number;
        reason: string;
    };
    applyReinvestmentCycle(params: {
        collectedPab: number;
        collectedSol: number;
        reinvestPab: number;
        reinvestSol: number;
        cycle: number;
    }): Promise<void>;
}
export declare const profitEngine: ProfitEngine;
export {};
//# sourceMappingURL=profitEngine.service.d.ts.map