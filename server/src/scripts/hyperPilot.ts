/**
 * hyperPilot.ts — Pabandi Protocol v2.0 "Hyper-Pilot" simulation.
 *
 * Drives the REAL services (pydService pricing, geoRiskOracle, ptpEngine) over a
 * synthetic but statistically realistic population to validate the dual-risk
 * actuarial engine BEFORE any chain work. No on-chain calls — Solana infra
 * is untouched. Emits a Monte-Carlo JSON report (Bear/Base/Bull) + HTML dashboard.
 *
 * Run: HYPER_PILOT_N=500 npx ts-node server/src/scripts/hyperPilot.ts
 */
import { pydService, computeDepositTerms } from '../services/pyd.service';
import { geoRiskOracle, RiskBand } from '../services/geoRiskOracle.service';
import { ptpEngine } from '../protocol/ptp.spec';
import { writeFileSync } from 'fs';

const BANDS: RiskBand[] = ['A', 'B', 'C', 'D', 'E'];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Landlord { id: string; name: string; baseRent: number; geoRiskBand: RiskBand; }
interface Tenant { id: string; trustScore: number; trustBand: RiskBand; }

// 5 landlords with deliberately DIVERSE risk profiles (location risk).
const LANDLORDS: Landlord[] = [
  { id: 'LL_COASTAL', name: 'Coastal Floodplain Holdings', baseRent: 2200, geoRiskBand: 'E' },
  { id: 'LL_URBAN', name: 'Urban Core REIT', baseRent: 1800, geoRiskBand: 'D' },
  { id: 'LL_SUBURB', name: 'Suburban Family Homes', baseRent: 1500, geoRiskBand: 'C' },
  { id: 'LL_EXURB', name: 'Exurban Gardens', baseRent: 1300, geoRiskBand: 'B' },
  { id: 'LL_SAFE', name: 'Safe Haven Properties', baseRent: 1600, geoRiskBand: 'A' },
];

function makeTenants(n: number, seed: number): Tenant[] {
  const r = rng(seed);
  const out: Tenant[] = [];
  for (let i = 0; i < n; i++) {
    const score = Math.max(5, Math.min(99, Math.round(50 + (r() + r() + r() - 1.5) * 38)));
    out.push({ id: `T${i}`, trustScore: score, trustBand: ptpEngine.scoreToRiskBand(score) });
  }
  return out;
}

const SCENARIOS = {
  Bear:  { rentMult: 0.85, yieldMult: 0.6, defaultRate: 0.18 },
  Base:  { rentMult: 1.00, yieldMult: 1.0, defaultRate: 0.09 },
  Bull:  { rentMult: 1.15, yieldMult: 1.4, defaultRate: 0.04 },
} as const;
type ScenarioName = keyof typeof SCENARIOS;

interface PilotResult {
  scenario: ScenarioName;
  tenants: number;
  landlords: number;
  avgBaseRent: number;
  avgAdjustedRent: number;
  rentPremiumFromRisk: number;
  rentDiscountFromTrust: number;
  depositsTotalUSD: number;
  depositReductionTotalUSD: number;
  yieldToTenantsUSD: number;
  pabandiSpreadUSD: number;
  predictedDefaults: number;
  bandMix: Record<string, number>;
}

/** Run one full pilot pass under a market scenario (drives REAL pydService pricing). */
function runPilot(scenario: ScenarioName, tenants: Tenant[]): PilotResult {
  const sc = SCENARIOS[scenario];
  const r = rng(0xC0FFEE ^ scenario.length);
  let avgBase = 0, avgAdj = 0, prem = 0, disc = 0;
  let deposits = 0, reduction = 0, yieldT = 0, spread = 0, defaults = 0;
  const bandMix: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const ll of LANDLORDS) {
    const baseRent = +(ll.baseRent * sc.rentMult).toFixed(2);
    for (const t of tenants) {
      bandMix[t.trustBand]++;
      const price = pydService.priceRent(baseRent, ll.geoRiskBand, t.trustBand);
      avgBase += baseRent; avgAdj += price.adjustedRentUSD;
      prem += Math.max(0, price.deltaUSD);
      disc += Math.max(0, -price.deltaUSD);

      // REAL deposit-pricing math (pure, no DB) — dual-risk reduction.
      const terms = computeDepositTerms({
        requiredAmountUSD: baseRent * 2,
        tenantTrustScore: t.trustScore,
        geoRiskBand: ll.geoRiskBand,
      });
      deposits += baseRent * 2;
      reduction += (baseRent * 2) - terms.actualDepositUSD;

      // Local yield estimate (mirrors pydService.projectYield math, no DB).
      const principal = terms.actualDepositUSD;
      const tenantApy = 5.5;
      const yieldEst = principal * (tenantApy / 100) * sc.yieldMult;
      const spreadEst = principal * 0.015 * sc.yieldMult;
      yieldT += yieldEst;
      spread += spreadEst;

      const riskIdx = (BANDS.indexOf(ll.geoRiskBand) + BANDS.indexOf(t.trustBand)) / 8;
      if (r() < sc.defaultRate * (0.5 + riskIdx)) defaults++;
    }
  }

  const n = tenants.length * LANDLORDS.length;
  return {
    scenario,
    tenants: tenants.length,
    landlords: LANDLORDS.length,
    avgBaseRent: +(avgBase / n).toFixed(2),
    avgAdjustedRent: +(avgAdj / n).toFixed(2),
    rentPremiumFromRisk: +prem.toFixed(2),
    rentDiscountFromTrust: +disc.toFixed(2),
    depositsTotalUSD: +deposits.toFixed(2),
    depositReductionTotalUSD: +reduction.toFixed(2),
    yieldToTenantsUSD: +yieldT.toFixed(2),
    pabandiSpreadUSD: +spread.toFixed(2),
    predictedDefaults: defaults,
    bandMix,
  };
}

/** Render an HTML dashboard from the pilot results. */
function renderHtml(results: PilotResult[]): string {
  const rows = results.map((r) => `
    <tr>
      <td><b>${r.scenario}</b></td>
      <td>${r.tenants * r.landlords}</td>
      <td>$${r.avgBaseRent}</td>
      <td>$${r.avgAdjustedRent}</td>
      <td style="color:#c0392b">+$${r.rentPremiumFromRisk}</td>
      <td style="color:#27ae60">-$${r.rentDiscountFromTrust}</td>
      <td>$${r.depositsTotalUSD.toLocaleString()}</td>
      <td>$${r.depositReductionTotalUSD.toLocaleString()}</td>
      <td>$${r.yieldToTenantsUSD.toLocaleString()}</td>
      <td><b>$${r.pabandiSpreadUSD.toLocaleString()}</b></td>
      <td>${r.predictedDefaults}</td>
    </tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8">
  <title>Pabandi Hyper-Pilot — Dual-Risk Actuarial Simulation</title>
  <style>body{font-family:system-ui;background:#0f1220;color:#e6e6e6;margin:0;padding:32px}
  h1{color:#7c5cff}table{border-collapse:collapse;width:100%;margin-top:16px}
  th,td{border:1px solid #2a2f45;padding:8px 10px;text-align:right;font-size:13px}
  th{background:#1a1f35;color:#9aa4ff}td:first-child,th:first-child{text-align:left}
  .note{color:#8a90b0;margin-top:18px;font-size:13px;max-width:760px}</style></head>
  <body><h1>Pabandi Protocol v2.0 — Hyper-Pilot Simulation</h1>
  <p class="note">Dual-risk actuarial engine (property location risk + tenant PTP trust) driven over the
  REAL pydService. 5 landlords (diverse property risk) × 500 tenants (diverse trust). Monte-Carlo Bear/Base/Bull.
  Off-chain (Solana infra untouched). Pabandi spread column = protocol revenue from yield.</p>
  <table><thead><tr>
    <th>Scenario</th><th>Contracts</th><th>Avg Base</th><th>Avg Adj</th>
    <th>Risk Premium</th><th>Trust Discount</th><th>Deposits</th><th>Deposit Cut</th>
    <th>Yield→Tenant</th><th>Pabandi Spread</th><th>Pred. Defaults</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <p class="note">Generated ${new Date().toISOString()} · reproducible seed · simulated external OSINT (flagged).</p>
  </body></html>`;
}

async function main() {
  const N_TENANTS = Number(process.env.HYPER_PILOT_N || 500);
  const tenants = makeTenants(N_TENANTS, 0xBADC0DE);
  const results: PilotResult[] = [];
  for (const sc of Object.keys(SCENARIOS) as ScenarioName[]) {
    results.push(runPilot(sc, tenants));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    population: { landlords: LANDLORDS.length, tenants: N_TENANTS, contracts: N_TENANTS * LANDLORDS.length },
    scenarios: results,
  };
  writeFileSync('hyperPilot.report.json', JSON.stringify(report, null, 2));
  writeFileSync('hyperPilot.dashboard.html', renderHtml(results));
  console.log('Hyper-Pilot complete. Reports written:');
  console.log('  hyperPilot.report.json  (Monte-Carlo Bear/Base/Bull)');
  console.log('  hyperPilot.dashboard.html (dashboard)');
  for (const r of results) {
    console.log(`[${r.scenario}] contracts=${r.tenants * r.landlords} avgAdjRent=$${r.avgAdjustedRent} ` +
      `riskPremium=+$${r.rentPremiumFromRisk} trustDiscount=-$${r.rentDiscountFromTrust} ` +
      `pabandiSpread=$${r.pabandiSpreadUSD} defaults=${r.predictedDefaults}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
