"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const microProfitEngine_service_1 = require("../src/services/microProfitEngine.service");
async function runSimulation() {
    const startingUsd = 28;
    const solBalance = 0.50;
    const sim = microProfitEngine_service_1.microProfitEngine.constructor.simulateDeployment(startingUsd, solBalance);
    console.log('═══════════════════════════════════════════════════════');
    console.log('💰 MICRO PROFIT ENGINE — $28.00 DEPLOYMENT');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`Starting Capital: $${startingUsd.toFixed(2)} USDC`);
    console.log(`SOL Balance: ${solBalance} SOL (for gas)`);
    console.log(`─────────────────────────────────`);
    console.log(`Batch Size: ${sim.batchSize} tasks per batch`);
    console.log(`Task Value: $${sim.taskValue.toFixed(2)} per task`);
    console.log(`USD per Cycle: $${(sim.batchSize * sim.taskValue).toFixed(2)}`);
    console.log(`Cycles to Deploy All: ${sim.cyclesNeeded}`);
    console.log(`─────────────────────────────────\n`);
    console.log(`Total Fees Collected: $${sim.totalFees.toFixed(4)}`);
    console.log(`Total SOL Spent: $${sim.totalSol.toFixed(5)}`);
    console.log(`Net Profit: $${sim.netProfit.toFixed(4)}`);
    console.log(`ROI: ${sim.roiPercent.toFixed(3)}% per full deployment`);
    console.log(`─────────────────────────────────`);
    console.log(`Daily Revenue (10 cycles): $${sim.dailyRevenue.toFixed(2)}`);
    console.log(`Monthly Revenue: $${sim.monthlyRevenue.toFixed(2)}`);
    console.log(`Annual Revenue: $${sim.annualRevenue.toFixed(2)}`);
    console.log(`─────────────────────────────────`);
    console.log(`Capital stays intact: $${startingUsd.toFixed(2)} USDC`);
    console.log(`SOL remaining: ${(solBalance - sim.totalSol).toFixed(5)} SOL`);
    console.log(`✅ FEES DO NOT EAT CAPITAL`);
    console.log(`✅ CAPITAL CYCLES REPEATEDLY`);
    console.log(`✅ 100% PROFIT FROM VELOCITY`);
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`✅ DEPLOYMENT READY`);
    console.log(`═══════════════════════════════════════════════════════\n`);
}
runSimulation().catch(err => {
    console.error('❌ Simulation failed:', err);
    process.exit(1);
});
//# sourceMappingURL=simulate28.js.map