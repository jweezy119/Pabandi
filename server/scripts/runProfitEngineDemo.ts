import { PrismaClient } from '@prisma/client';
import { profitEngine } from '../src/services/profitEngine.service';

const prisma = new PrismaClient();

async function runProfitDemo() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('💰 PABANDI PROFIT ENGINE — VELOCITY DEMO');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── Ensure agents exist ─────────────────────────────────
  let agents = await prisma.agentProfile.findMany({ where: { isActive: true }, take: 10 });
  
  if (agents.length < 5) {
    console.log('📋 Seeding agents for ProfitEngine...\n');
    const seeds = [
      { name: 'AlphaBot', slug: 'alphabot', capabilities: ['coding', 'analysis'], reputation: 90 },
      { name: 'BetaWorker', slug: 'betaworker', capabilities: ['coding', 'review'], reputation: 80 },
      { name: 'GammaSolver', slug: 'gammasolver', capabilities: ['analysis', 'research'], reputation: 75 },
      { name: 'DeltaAI', slug: 'deltaai', capabilities: ['design', 'prototyping'], reputation: 70 },
      { name: 'EpsilonX', slug: 'epsilonx', capabilities: ['security', 'auditing'], reputation: 85 },
    ];
    for (const s of seeds) {
      const existing = await prisma.agentProfile.findUnique({ where: { slug: s.slug } });
      if (!existing) {
        await prisma.agentProfile.create({
          data: { ...s, description: `AI agent: ${s.name}`, walletAddress: '0x' + Math.random().toString(16).slice(2, 10), publicKey: 'pk_' + s.slug },
        });
      }
    }
    agents = await prisma.agentProfile.findMany({ where: { isActive: true }, take: 10 });
    console.log(`   Seeded ${agents.length} agents\n`);
  }

  // ── Run 50 rapid cycles ─────────────────────────────────
  console.log('⚡ RUNNING 50 RAPID CYCLES...\n');
  
  const startTime = Date.now();
  let successes = 0;
  let failures = 0;
  
  for (let i = 0; i < 50; i++) {
    const result = await profitEngine.runCycle();
    if (result.success) {
      successes++;
      if ((i + 1) % 10 === 0) {
        console.log(`   Cycle ${i + 1}: ✅ $${result.revenue.toFixed(4)} revenue | ${result.cycleTime.toFixed(2)}s | ${result.pabIssued.toFixed(1)} PAB issued`);
      }
    } else {
      failures++;
      console.log(`   Cycle ${i + 1}: ❌ Failed`);
    }
  }
  
  const totalTime = (Date.now() - startTime) / 1000;
  const report = profitEngine.getReport();

  // ── Results ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 PROFIT ENGINE RESULTS');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log(`   Total Cycles: ${report.totalCycles}`);
  console.log(`   Successes: ${successes} | Failures: ${failures}`);
  console.log(`   Total Time: ${totalTime.toFixed(2)}s`);
  console.log(`   Avg Cycle Time: ${report.avgCycleTime.toFixed(2)}s`);
  console.log(`   ─────────────────────────────────`);
  console.log(`   💰 TOTAL REVENUE: $${report.totalRevenue.toFixed(4)}`);
  console.log(`   🎁 TOTAL PAB ISSUED: ${report.totalPabIssued.toFixed(1)} PAB`);
  console.log(`   ─────────────────────────────────`);
  console.log(`   📈 VELOCITY PROJECTIONS:`);
  console.log(`      Capital Velocity: ${report.capitalVelocity.toFixed(0)} cycles/day`);
  console.log(`      Daily Revenue: $${report.dailyRevenue.toFixed(2)}`);
  console.log(`      Monthly Revenue: $${report.monthlyRevenue.toFixed(2)}`);
  console.log(`      Annual Revenue: $${report.annualRevenue.toFixed(2)}`);
  console.log(`   ─────────────────────────────────`);
  console.log(`   ⚡ EFFICIENCY: ${report.efficiency.toFixed(1)}%`);
  console.log(`   📊 ROI: ${report.roiPercent.toFixed(1)}% (on $100 capital)`);

  // ── Crypto Perks ────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('⚡ CRYPTO PERKS UTILIZED');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const speed = profitEngine.getSettlementSpeed();
  console.log(`   Chain: ${speed.chain}`);
  console.log(`   Finality: ${speed.finalityMs}ms (${speed.finalityMs / 1000}s)`);
  console.log(`   Cost per tx: $${speed.costPerTx}`);
  console.log(`   24/7 uptime: ✅ Always running`);
  console.log(`   Global access: ✅ Any agent, anywhere`);
  console.log(`   Atomic settlement: ✅ Payment + settlement simultaneously`);
  console.log(`   DeFi composability: ✅ Integrate with Solend, Marinade`);
  
  const arb = await profitEngine.checkArbitrageOpportunity();
  if (arb.opportunity) {
    console.log(`   🎯 ARBITRAGE: ${arb.action} (${(arb.spread * 100).toFixed(1)}% spread)`);
  }

  const idleYield = await profitEngine.deployIdleCapital(100);
  console.log(`   💤 Idle capital yield: $${idleYield.toFixed(4)}/day on $100 (5% APY)`);

  // ── Self-Learning Status ────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🧠 SELF-LEARNING STATUS');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`   Fee Rate: ${((profitEngine as any).feeRate * 100).toFixed(2)}%`);
  console.log(`   Adjustments Made: ${(profitEngine as any).cycleTimes?.length || 0}`);
  console.log(`   Learning: ${report.avgCycleTime < 60 ? '✅ Cycles fast → can lower fees for more volume' : '⚠️ Cycles slow → increasing fees to compensate'}`);

  // ── Scaling Math ────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📈 SCALING PROJECTIONS');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const perCycle = report.totalRevenue / (report.totalCycles || 1);
  const cyclesPerDay = report.capitalVelocity;
  
  console.log(`   Per cycle revenue: $${perCycle.toFixed(4)}`);
  console.log(`   Cycles/day: ${cyclesPerDay.toFixed(0)}`);
  console.log(`   ─────────────────────────────────`);
  console.log(`   With $1 capital:  $${(perCycle * cyclesPerDay).toFixed(2)}/day`);
  console.log(`   With $10 capital: $${(perCycle * cyclesPerDay * 10).toFixed(2)}/day`);
  console.log(`   With $100 capital: $${(perCycle * cyclesPerDay * 100).toFixed(2)}/day`);
  console.log(`   With $1000 capital: $${(perCycle * cyclesPerDay * 1000).toFixed(2)}/day`);
  console.log(`   ─────────────────────────────────`);
  console.log(`   Key insight: Same $1 cycles ${cyclesPerDay.toFixed(0)}x/day`);
  console.log(`   Velocity = Profit. Speed = Money.`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ PROFIT ENGINE DEMO COMPLETE');
  console.log('═══════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

runProfitDemo().catch(err => {
  console.error('❌ Profit Engine demo failed:', err);
  process.exit(1);
});
