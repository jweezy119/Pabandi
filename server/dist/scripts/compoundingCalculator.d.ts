/**
 * Pabandi Compounding Profit Calculator
 * =====================================
 *
 * Starting: 0.62 SOL + $28 USDC
 *
 * The key insight: 0.62 SOL = gas for ~2,480 transactions
 * At 1 settlement/day, that's 6.8 YEARS of gas
 * SOL is NOT the constraint. USDC reserve IS.
 *
 * Compounding strategy:
 * - Daily profits flow back to reserve
 * - Bigger reserve = more agent credit = more volume
 * - Exponential growth
 */
declare function calculateCompounding(): void;
//# sourceMappingURL=compoundingCalculator.d.ts.map