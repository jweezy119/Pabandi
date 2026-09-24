"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDemo = runDemo;
const profitEngine_service_1 = require("../services/profitEngine.service");
const logger_1 = require("../utils/logger");
/**
 * ProfitEngine Demo — Run N cycles and print the profit report
 * Demonstrates: velocity, self-learning, capital efficiency
 */
async function runDemo(cycleCount = 100) {
    logger_1.logger.info(`🚀 Starting ProfitEngine Demo — ${cycleCount} cycles`);
    logger_1.logger.info('='.repeat(60));
    const results = [];
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < cycleCount; i++) {
        const result = await profitEngine_service_1.profitEngine.runCycle();
        results.push(result);
        if (result.success) {
            successCount++;
            logger_1.logger.info(`Cycle ${result.cycleNumber}: ✅ ${result.cycleTime.toFixed(2)}s | Revenue: $${result.revenue.toFixed(4)} | PAB: ${result.pabIssued.toFixed(2)}`);
        }
        else {
            failCount++;
            logger_1.logger.warn(`Cycle ${result.cycleNumber}: ❌ failed (${result.cycleTime.toFixed(2)}s)`);
        }
        // Check arbitrage every 10 cycles
        if (i % 10 === 9) {
            const arb = await profitEngine_service_1.profitEngine.checkArbitrageOpportunity();
            if (arb.opportunity) {
                logger_1.logger.info(`  💰 Arbitrage opportunity: ${(arb.spread * 100).toFixed(2)}% spread — ${arb.action}`);
            }
        }
    }
    // Final report
    const report = profitEngine_service_1.profitEngine.getReport();
    const idleYield = await profitEngine_service_1.profitEngine.deployIdleCapital(100);
    const settlement = profitEngine_service_1.profitEngine.getSettlementSpeed();
    logger_1.logger.info('='.repeat(60));
    logger_1.logger.info('📊 PROFIT REPORT');
    logger_1.logger.info('='.repeat(60));
    logger_1.logger.info(`Total cycles:        ${report.totalCycles}`);
    logger_1.logger.info(`Successful:          ${successCount}`);
    logger_1.logger.info(`Failed:              ${failCount}`);
    logger_1.logger.info(`Success rate:        ${((successCount / cycleCount) * 100).toFixed(1)}%`);
    logger_1.logger.info(`Total revenue:       $${report.totalRevenue.toFixed(2)}`);
    logger_1.logger.info(`Total PAB issued:    ${report.totalPabIssued.toFixed(2)} PAB`);
    logger_1.logger.info(`Avg cycle time:      ${report.avgCycleTime.toFixed(2)}s`);
    logger_1.logger.info(`Capital velocity:    ${report.capitalVelocity.toFixed(0)} cycles/day`);
    logger_1.logger.info(`Daily revenue:       $${report.dailyRevenue.toFixed(2)}`);
    logger_1.logger.info(`Monthly revenue:     $${report.monthlyRevenue.toFixed(2)}`);
    logger_1.logger.info(`Annual revenue:      $${report.annualRevenue.toFixed(2)}`);
    logger_1.logger.info(`ROI:                 ${report.roiPercent.toFixed(1)}%`);
    logger_1.logger.info(`Efficiency:          ${report.efficiency.toFixed(1)}%`);
    logger_1.logger.info(`Current fee rate:    ${(report.currentFeeRate * 100).toFixed(2)}%`);
    logger_1.logger.info(`Idle capital yield:  $${idleYield.toFixed(4)}/day (on $100)`);
    logger_1.logger.info(`Settlement:          ${settlement.chain} @ ${settlement.finalityMs}ms / $${settlement.costPerTx}/tx`);
    logger_1.logger.info('='.repeat(60));
    logger_1.logger.info(`💡 With $100 capital: $${(report.dailyRevenue).toFixed(2)}/day → $${(report.dailyRevenue * 30).toFixed(2)}/month`);
    logger_1.logger.info('='.repeat(60));
    return report;
}
// Run if called directly
if (require.main === module) {
    const cycles = parseInt(process.argv[2] || '100', 10);
    runDemo(cycles)
        .then(() => process.exit(0))
        .catch(err => {
        logger_1.logger.error('Demo failed:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=runProfitEngineDemo.js.map