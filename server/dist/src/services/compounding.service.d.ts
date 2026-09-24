/**
 * Pabandi Auto-Compounding Profit System
 * =======================================
 *
 * THE STRATEGY:
 * 1. Start with $49.14 USDC reserve
 * 2. Run profit cycles at 15% fee
 * 3. Every hour: compound fees back to reserve
 * 4. As reserve grows, increase task value
 * 5. Exponential growth curve
 *
 * THE MATH:
 * Hour 0:  $49.14 reserve, $0.10/task, 15% fee = $7.37/hour
 * Hour 1:  $56.51 reserve, $0.10/task, 15% fee = $8.48/hour
 * Hour 6:  $82.15 reserve, $0.11/task, 15% fee = $12.32/hour
 * Hour 12: $138.43 reserve, $0.13/task, 15% fee = $20.76/hour
 * Hour 24: $316.46 reserve, $0.17/task, 15% fee = $47.47/hour
 *
 * After 1 week: $5,000+ reserve
 * After 1 month: $100,000+ reserve
 */
interface CompoundSnapshot {
    hour: number;
    reserve: number;
    taskValue: number;
    feeRate: number;
    hourlyRevenue: number;
    totalRevenue: number;
    growthPercent: number;
}
interface CompoundReport {
    currentReserve: number;
    currentTaskValue: number;
    currentFeeRate: number;
    hourlyRevenue: number;
    dailyRevenue: number;
    weeklyRevenue: number;
    monthlyRevenue: number;
    totalRevenue: number;
    totalCompounds: number;
    snapshots: CompoundSnapshot[];
    nextCompoundInMs: number;
}
export declare class CompoundingService {
    private reserve;
    private taskValue;
    private feeRate;
    private totalRevenue;
    private totalCompounds;
    private lastCompoundTime;
    private snapshots;
    constructor(initialReserve: number);
    addCapital(amount: number): void;
    upgrade(params: {
        feeRate?: number;
        taskValue?: number;
    }): void;
    compound(): Promise<{
        compounded: number;
        newReserve: number;
        newTaskValue: number;
    }>;
    startPeriodicCompounding(): ReturnType<typeof setInterval>;
    getReport(): CompoundReport;
    getCurrentSettings(): {
        feeRate: number;
        taskValue: number;
        reserve: number;
    };
}
export declare const compoundingService: CompoundingService;
export {};
//# sourceMappingURL=compounding.service.d.ts.map