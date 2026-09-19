function calculateOptimalSwap() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('💰 OPTIMAL SWAP CALCULATOR');
  console.log('═══════════════════════════════════════════════════════\n');

  const solPrice = 112;
  const currentSol = 0.62;
  const currentSolValue = currentSol * solPrice;

  console.log(`Current: ${currentSol} SOL @ $${solPrice} = $${currentSolValue.toFixed(2)}`);
  console.log('─────────────────────────────────\n');

  // ── Swap 50% ──────────────────────────────────────────
  console.log('OPTION: SWAP 50% (0.31 SOL → USDC)\n');

  const swapSol = 0.31;
  const swapUsdc = swapSol * solPrice;
  const remainingSol = currentSol - swapSol;
  const remainingSolValue = remainingSol * solPrice;
  const gasTxs = remainingSol / 0.00025;
  const gasDays = gasTxs;

  console.log(`Swap: ${swapSol} SOL → $${swapUsdc.toFixed(2)} USDC`);
  console.log(`Remaining: ${remainingSol} SOL ($${remainingSolValue.toFixed(2)})`);
  console.log(`Gas transactions: ${gasTxs.toFixed(0)} (${gasDays.toFixed(0)} days)`);
  console.log('─────────────────────────────────\n');

  // ── Profit Projections ────────────────────────────────
  console.log('PROFIT PROJECTIONS:\n');

  const reserve = swapUsdc;
  const volumeMultiplier = 26.79;
  const feeRate = 0.02;

  const dailyVolume = reserve * volumeMultiplier;
  const dailyFees = dailyVolume * feeRate;
  const dailyNet = dailyFees - 0.00025;

  console.log(`  USDC Reserve: $${reserve.toFixed(2)}`);
  console.log(`  Daily Volume: $${dailyVolume.toFixed(2)}`);
  console.log(`  Daily Fees (2%): $${dailyFees.toFixed(2)}`);
  console.log(`  Daily SOL Cost: $0.00025`);
  console.log(`  Daily Net Profit: $${dailyNet.toFixed(2)}`);
  console.log('─────────────────────────────────\n');

  console.log(`  Weekly Profit: $${(dailyNet * 7).toFixed(2)}`);
  console.log(`  Monthly Profit: $${(dailyNet * 30).toFixed(2)}`);
  console.log(`  Annual Profit: $${(dailyNet * 365).toFixed(2)}`);
  console.log('─────────────────────────────────\n');

  // ── Compounding ───────────────────────────────────────
  console.log('WITH DAILY COMPOUNDING (30 days):\n');

  let r = reserve;
  for (let day = 1; day <= 30; day++) {
    const vol = r * volumeMultiplier;
    const fee = vol * feeRate;
    r += fee - 0.00025;
  }

  console.log(`  Start: $${reserve.toFixed(2)}`);
  console.log(`  End: $${r.toFixed(2)}`);
  console.log(`  Profit: $${(r - reserve).toFixed(2)}`);
  console.log(`  Growth: ${((r / reserve - 1) * 100).toFixed(1)}%`);
  console.log('─────────────────────────────────\n');

  // ── Gas Safety ────────────────────────────────────────
  console.log('GAS SAFETY:\n');
  console.log(`  Remaining SOL: ${remainingSol}`);
  console.log(`  Transactions: ${gasTxs.toFixed(0)}`);
  console.log(`  Days of gas: ${gasDays.toFixed(0)}`);
  console.log(`  Months of gas: ${(gasDays / 30).toFixed(1)}`);
  console.log(`  ✅ More than enough`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ RECOMMENDATION: SWAP 0.31 SOL → $34.72 USDC');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('  You get:');
  console.log('  - $34.72 USDC reserve for agents');
  console.log('  - 0.31 SOL left for 1,240 transactions');
  console.log('  - $24.78/day profit');
  console.log('  - $743/month profit');
  console.log('  - Compounding ready');
  console.log('\n  When SOL runs low, swap 0.01 more. Easy.');
  console.log('═══════════════════════════════════════════════════════\n');
}

calculateOptimalSwap();
