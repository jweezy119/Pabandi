import { profitEngine } from '../services/profitEngine.service';
import { logger } from '../utils/logger';

/**
 * ProfitEngine Demo — Run N cycles and print the profit report
 * Demonstrates: velocity, self-learning, capital efficiency
 */
async function runDemo(cycleCount = 100): Promise<void> {
  logger.info(`🚀 Starting ProfitEngine Demo — ${cycleCount} cycles`);
  logger.info('='.repeat(60));

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < cycleCount; i++) {
    const result = await profitEngine.runCycle();
    results.push(result);

    if (result.success) {
      successCount++;
      logger.info(
        `Cycle ${result.cycleNumber}: ✅ ${result.cycleTime.toFixed(2)}s | Revenue: $${result.revenue.toFixed(4)} | PAB: ${result.pabIssued.toFixed(2)}`
      );
    } else {
      failCount++;
      logger.warn(`Cycle ${result.cycleNumber}: ❌ failed (${result.cycleTime.toFixed(2)}s)`);
    }

    // Check arbitrage every 10 cycles
    if (i % 10 === 9) {
      const arb = await profitEngine.checkArbitrageOpportunity();
      if (arb.opportunity) {
        logger.info(`  💰 Arbitrage opportunity: ${(arb.spread * 100).toFixed(2)}% spread — ${arb.action}`);
      }
    }
  }

  // Final report
  const report = profitEngine.getReport();
  const idleYield = await profitEngine.deployIdleCapital(100);
  const settlement = profitEngine.getSettlementSpeed();

  logger.info('='.repeat(60));
  logger.info('📊 PROFIT REPORT');
  logger.info('='.repeat(60));
  logger.info(`Total cycles:        ${report.totalCycles}`);
  logger.info(`Successful:          ${successCount}`);
  logger.info(`Failed:              ${failCount}`);
  logger.info(`Success rate:        ${((successCount / cycleCount) * 100).toFixed(1)}%`);
  logger.info(`Total revenue:       $${report.totalRevenue.toFixed(2)}`);
  logger.info(`Total PAB issued:    ${report.totalPabIssued.toFixed(2)} PAB`);
  logger.info(`Avg cycle time:      ${report.avgCycleTime.toFixed(2)}s`);
  logger.info(`Capital velocity:    ${report.capitalVelocity.toFixed(0)} cycles/day`);
  logger.info(`Daily revenue:       $${report.dailyRevenue.toFixed(2)}`);
  logger.info(`Monthly revenue:     $${report.monthlyRevenue.toFixed(2)}`);
  logger.info(`Annual revenue:      $${report.annualRevenue.toFixed(2)}`);
  logger.info(`ROI:                 ${report.roiPercent.toFixed(1)}%`);
  logger.info(`Efficiency:          ${report.efficiency.toFixed(1)}%`);
  logger.info(`Current fee rate:    ${(report.currentFeeRate * 100).toFixed(2)}%`);
  logger.info(`Idle capital yield:  $${idleYield.toFixed(4)}/day (on $100)`);
  logger.info(`Settlement:          ${settlement.chain} @ ${settlement.finalityMs}ms / $${settlement.costPerTx}/tx`);
  logger.info('='.repeat(60));
  logger.info(`💡 With $100 capital: $${(report.dailyRevenue).toFixed(2)}/day → $${(report.dailyRevenue * 30).toFixed(2)}/month`);
  logger.info('='.repeat(60));

  return report as any;
}

// Run if called directly
if (require.main === module) {
  const cycles = parseInt(process.argv[2] || '100', 10);
  runDemo(cycles)
    .then(() => process.exit(0))
    .catch(err => {
      logger.error('Demo failed:', err);
      process.exit(1);
    });
}

export { runDemo };
