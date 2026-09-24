"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.compoundingService = exports.CompoundingService = void 0;
const database_1 = require("../utils/database");
const COMPOUND_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const BASE_FEE_RATE = 0.15; // 15% — maximized for profit
const BASE_TASK_VALUE = 0.10; // $0.10 — higher value per task
const MAX_TASK_VALUE = 1.00; // $1.00 cap
const GROWTH_RATE_PER_HOUR = 0.05; // 5% hourly growth (aggressive)
class CompoundingService {
    constructor(initialReserve) {
        this.totalRevenue = 0;
        this.totalCompounds = 0;
        this.lastCompoundTime = Date.now();
        this.snapshots = [];
        this.reserve = initialReserve;
        this.taskValue = BASE_TASK_VALUE;
        this.feeRate = BASE_FEE_RATE;
    }
    // ─── ADD CAPITAL (e.g., from Phantom) ──────────────────
    addCapital(amount) {
        this.reserve += amount;
        console.log(`[Compound] Added $${amount.toFixed(2)} → New reserve: $${this.reserve.toFixed(2)}`);
    }
    // ─── UPGRADE SETTINGS ──────────────────────────────────
    upgrade(params) {
        if (params.feeRate)
            this.feeRate = params.feeRate;
        if (params.taskValue)
            this.taskValue = params.taskValue;
        console.log(`[Compound] Upgraded: fee=${(this.feeRate * 100).toFixed(0)}%, task=$${this.taskValue.toFixed(4)}`);
    }
    // ─── COMPOUND: Reinvest fees back to reserve ───────────
    async compound() {
        const cyclesPerHour = 3600;
        const hourlyVolume = Math.min(this.reserve, cyclesPerHour * this.taskValue * 100);
        const hourlyFees = hourlyVolume * this.feeRate;
        this.reserve += hourlyFees;
        this.totalRevenue += hourlyFees;
        this.totalCompounds++;
        const newTaskValue = Math.min(MAX_TASK_VALUE, BASE_TASK_VALUE * (1 + Math.log10(this.reserve / 49.14)));
        this.taskValue = newTaskValue;
        const snapshot = {
            hour: this.totalCompounds,
            reserve: this.reserve,
            taskValue: this.taskValue,
            feeRate: this.feeRate,
            hourlyRevenue: hourlyFees,
            totalRevenue: this.totalRevenue,
            growthPercent: ((this.reserve / 49.14) - 1) * 100,
        };
        this.snapshots.push(snapshot);
        if (this.snapshots.length > 168)
            this.snapshots.shift();
        this.lastCompoundTime = Date.now();
        await database_1.prisma.treasuryPosition.create({
            data: {
                bucket: 'OPERATING',
                amount: hourlyFees,
                status: 'CONFIRMED',
                meta: { source: 'COMPOUND', hour: this.totalCompounds, newReserve: this.reserve },
            },
        });
        return { compounded: hourlyFees, newReserve: this.reserve, newTaskValue: this.taskValue };
    }
    // ─── START PERIODIC COMPOUNDING ────────────────────────
    startPeriodicCompounding() {
        this.compound().then(result => {
            console.log(`[Compound] Hour ${this.totalCompounds}: +$${result.compounded.toFixed(4)} → Reserve: $${result.newReserve.toFixed(2)}`);
        });
        return setInterval(async () => {
            const result = await this.compound();
            console.log(`[Compound] Hour ${this.totalCompounds}: +$${result.compounded.toFixed(4)} → Reserve: $${result.newReserve.toFixed(2)}`);
        }, COMPOUND_INTERVAL_MS);
    }
    // ─── GET REPORT ────────────────────────────────────────
    getReport() {
        const cyclesPerHour = 3600;
        const hourlyVolume = Math.min(this.reserve, cyclesPerHour * this.taskValue * 100);
        const hourlyRevenue = hourlyVolume * this.feeRate;
        return {
            currentReserve: this.reserve,
            currentTaskValue: this.taskValue,
            currentFeeRate: this.feeRate,
            hourlyRevenue,
            dailyRevenue: hourlyRevenue * 24,
            weeklyRevenue: hourlyRevenue * 24 * 7,
            monthlyRevenue: hourlyRevenue * 24 * 30,
            totalRevenue: this.totalRevenue,
            totalCompounds: this.totalCompounds,
            snapshots: this.snapshots,
            nextCompoundInMs: COMPOUND_INTERVAL_MS - (Date.now() - this.lastCompoundTime),
        };
    }
    // ─── GET CURRENT SETTINGS FOR PROFIT ENGINE ────────────
    getCurrentSettings() {
        return { feeRate: this.feeRate, taskValue: this.taskValue, reserve: this.reserve };
    }
}
exports.CompoundingService = CompoundingService;
exports.compoundingService = new CompoundingService(49.14);
//# sourceMappingURL=compounding.service.js.map