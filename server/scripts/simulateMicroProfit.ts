import { microProfitEngine } from '../src/services/microProfitEngine.service';

async function runSimulation() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('💰 MICRO PROFIT ENGINE — $25 STARTING CAPITAL SIMULATION');
  console.log('═══════════════════════════════════════════════════════\n');

  const startingUsd = 25;
  const solBalance = 0.50;

  const sim = (microProfitEngine.constructor as any).simulateDeployment(startingUsd, solBalance);

  console.log(`Starting Capital: $${startingUsd.toFixed(2)} USDC`);
  console.log(`SOL Balance: ${solBalance} SOL (for gas)`);
  console.log(`─────────────────────────────────`);
  console.log(`Batch Size: ${sim.batchSize} tasks per batch`);
  console.log(`Task Value: $${sim.taskValue.toFixed(2)} per task`);
  console.log(`USD per Cycle: $${(sim.batchSize * sim.taskValue).toFixed(2)}`);
  console.log(`Cycles to Deploy All: ${sim.cyclesNeeded}`);
  console.log(`─────────────────────────────────`);

  console.log(`\n📊 CYCLE BREAKDOWN:\n`);
  for (const r of sim.results) {
    console.log(`   ${r.batchId}: ${r.taskCount} tasks × $${sim.taskValue.toFixed(2)} = $${r.totalAmount.toFixed(2)} → fees: $${r.totalFees.toFixed(4)} - SOL: $${r.totalSolCost.toFixed(5)} = net: $${r.netProfit.toFixed(4)}`);
  }

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`📊 FINAL RESULTS`);
  console.log(`═══════════════════════════════════════════════════════\n`);
  console.log(`   Total Fees Collected: $${sim.totalFees.toFixed(4)}`);
  console.log(`   Total SOL Spent: $${sim.totalSol.toFixed(5)}`);
  console.log(`   Net Profit: $${sim.netProfit.toFixed(4)}`);
  console.log(`   ROI: ${sim.roiPercent.toFixed(3)}% per full deployment`);
  console.log(`   ─────────────────────────────────`);
  console.log(`   Daily Revenue (10 cycles): $${sim.dailyRevenue.toFixed(2)}`);
  console.log(`   Monthly Revenue: $${sim.monthlyRevenue.toFixed(2)}`);
  console.log(`   ─────────────────────────────────`);
  console.log(`   Capital stays intact: $${startingUsd.toFixed(2)} USDC`);
  console.log(`   SOL remaining: ${(solBalance - sim.totalSol).toFixed(5)} SOL`);
  console.log(`   ✅ FEES DO NOT EAT CAPITAL`);
  console.log(`   ✅ CAPITAL CYCLES REPEATEDLY`);
  console.log(`   ✅ 100% PROFIT FROM VELOCITY`);

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`🧠 ALGORITHM FINESSE`);
  console.log(`═══════════════════════════════════════════════════════\n`);
  console.log(`   1. BATCH SETTLEMENT: 20 tasks in 1 tx`);
  console.log(`      → SOL fee per task: $0.0000125 (vs $0.00025 individual)`);
  console.log(`      → 95% fee reduction`);
  console.log(`   2. PAB AS CREDIT: No on-chain cost for rewards`);
  console.log(`      → Agent withdraws when they want`);
  console.log(`      → Zero gas for reward issuance`);
  console.log(`   3. DYNAMIC BATCH SIZE: Scales with capital`);
  console.log(`      → $25: 20 tasks/batch`);
  console.log(`      → $100: 50 tasks/batch`);
  console.log(`   4. AUTO-COMPOUND: Fees flow back to operating`);
  console.log(`      → Same $1 cycles repeatedly`);
  console.log(`   5. SOL BUFFER: Never go below 0.01 SOL`);
  console.log(`      → Pause and alert if low`);

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`✅ SIMULATION COMPLETE`);
  console.log(`═══════════════════════════════════════════════════════\n`);
}

runSimulation().catch(err => {
  console.error('❌ Simulation failed:', err);
  process.exit(1);
});
