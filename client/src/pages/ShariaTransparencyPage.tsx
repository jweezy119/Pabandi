import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { mudarabahService, MudarabahPool, TransparencyReport } from '../services/mudarabahService';

const RISK_TONES: Record<string, 'success' | 'warning' | 'danger'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

export const ShariaTransparencyPage: React.FC = () => {
  const [pools, setPools] = useState<MudarabahPool[]>([]);
  const [transparency, setTransparency] = useState<TransparencyReport | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPools();
  }, []);

  const loadPools = async () => {
    setLoading(true);
    try {
      const res = await mudarabahService.listPools({ status: 'ACTIVE' });
      setPools(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load pools:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadTransparency = async (poolId: string) => {
    setSelectedPoolId(poolId);
    try {
      const res = await mudarabahService.getPoolTransparency(poolId);
      setTransparency(res.data?.data || null);
    } catch (e) {
      console.error('Failed to load transparency:', e);
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-10" style={{ background: tokens.color.background, fontFamily: tokens.font.body }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--sage)]/10 border border-[var(--sage)]/20 text-[var(--sage)] text-sm font-semibold mb-4">
            <span>☪️</span> Full Transparency
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[var(--warm-ink)] mb-4">
            Sharia Transparency
          </h1>
          <p className="text-lg text-[var(--soft-stone)] max-w-2xl mx-auto">
            Every pool is backed by real business revenue. No interest, no speculation — just honest profit-sharing.
          </p>
        </div>

        {/* What is Mudarabah */}
        <Surface className="p-6 mb-8">
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">What is Mudarabah?</h2>
          <p className="text-[var(--warm-ink)] leading-relaxed mb-4">
            A partnership where one provides capital, one provides expertise. Profits are shared pre-agreed.
            Losses are borne by capital provider only (unless negligence proven).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[var(--warm-sand)] rounded-xl p-4">
              <div className="text-2xl mb-2">🤝</div>
              <h4 className="font-bold text-[var(--warm-ink)] mb-1">Capital Provider (Rab-ul-Mal)</h4>
              <p className="text-sm text-[var(--soft-stone)]">Provides investment capital. Bears financial loss if business underperforms.</p>
            </div>
            <div className="bg-[var(--warm-sand)] rounded-xl p-4">
              <div className="text-2xl mb-2">💼</div>
              <h4 className="font-bold text-[var(--warm-ink)] mb-1">Business Manager (Mudarib)</h4>
              <p className="text-sm text-[var(--soft-stone)]">Provides expertise and effort. Shares in profits per agreed ratio.</p>
            </div>
            <div className="bg-[var(--warm-sand)] rounded-xl p-4">
              <div className="text-2xl mb-2">📜</div>
              <h4 className="font-bold text-[var(--warm-ink)] mb-1">Pre-Agreed Terms</h4>
              <p className="text-sm text-[var(--soft-stone)]">Profit split is fixed upfront. No guaranteed returns — pure risk-sharing.</p>
            </div>
          </div>
        </Surface>

        {/* The Math */}
        <Surface className="p-6 mb-8">
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">The Math — How It Works</h2>
          <p className="text-[var(--soft-stone)] text-sm mb-4">Real numbers from a real pool example:</p>
          <div className="bg-[var(--warm-ink)]/30 rounded-xl p-5 space-y-3 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--soft-stone)]">Pool Total Revenue (Q1 2026)</span>
              <span className="text-[var(--warm-ink)] font-bold">$120,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--soft-stone)]">Operating Expenses (50%)</span>
              <span className="text-[var(--terracotta)]">-$60,000</span>
            </div>
            <div className="border-t border-[rgba(191,179,163,0.2)] pt-2 flex justify-between">
              <span className="text-[var(--soft-stone)]">Net Profit</span>
              <span className="text-[var(--sage)] font-bold">$60,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--soft-stone)]">Investor Share (70%)</span>
              <span className="text-[var(--sage)] font-bold">$42,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--soft-stone)]">Business Share (30%)</span>
              <span className="text-[var(--clay)] font-bold">$18,000</span>
            </div>
            <div className="border-t border-[rgba(191,179,163,0.2)] pt-2 flex justify-between">
              <span className="text-[var(--soft-stone)]">Investor APY (on $10K)</span>
              <span className="text-[var(--muted-ochre)] font-bold">~16.8% annualized</span>
            </div>
          </div>
          <p className="text-xs text-[var(--soft-stone)] mt-3">
            * Revenue is reported by the business manager. Pabandi verifies through bank reconciliation and smart contract escrow.
          </p>
        </Surface>

        {/* Comparison Table */}
        <Surface className="p-6 mb-8">
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">What Others Do vs What Pabandi Does</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[rgba(191,179,163,0.2)]">
                  <th className="pb-3 text-[var(--soft-stone)]">Aspect</th>
                  <th className="pb-3 text-[var(--terracotta)]">What Others Do</th>
                  <th className="pb-3 text-[var(--sage)]">What Pabandi Does</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[rgba(191,179,163,0.15)]">
                  <td className="py-3 font-semibold text-[var(--warm-ink)]">Return Source</td>
                  <td className="py-3 text-[var(--soft-stone)]">Riba (Interest)</td>
                  <td className="py-3 text-[var(--sage)]">Real business revenue</td>
                </tr>
                <tr className="border-b border-[rgba(191,179,163,0.15)]">
                  <td className="py-3 font-semibold text-[var(--warm-ink)]">Asset Backing</td>
                  <td className="py-3 text-[var(--soft-stone)]">Speculation / derivatives</td>
                  <td className="py-3 text-[var(--sage)]">Real assets & operations</td>
                </tr>
                <tr className="border-b border-[rgba(191,179,163,0.15)]">
                  <td className="py-3 font-semibold text-[var(--warm-ink)]">Fees</td>
                  <td className="py-3 text-[var(--soft-stone)]">Hidden spreads</td>
                  <td className="py-3 text-[var(--sage)]">Transparent spread</td>
                </tr>
                <tr className="border-b border-[rgba(191,179,163,0.15)]">
                  <td className="py-3 font-semibold text-[var(--warm-ink)]">Guarantees</td>
                  <td className="py-3 text-[var(--soft-stone)]">Fixed returns promised</td>
                  <td className="py-3 text-[var(--sage)]">No guarantees — pure risk-sharing</td>
                </tr>
                <tr className="border-b border-[rgba(191,179,163,0.15)]">
                  <td className="py-3 font-semibold text-[var(--warm-ink)]">Loss Allocation</td>
                  <td className="py-3 text-[var(--soft-stone)]">Often socialized to users</td>
                  <td className="py-3 text-[var(--sage)]">Borne by capital provider (unless negligence)</td>
                </tr>
                <tr>
                  <td className="py-3 font-semibold text-[var(--warm-ink)]">Oversight</td>
                  <td className="py-3 text-[var(--soft-stone)]">Opaque</td>
                  <td className="py-3 text-[var(--sage)]">Sharia board + public audit trail</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Surface>

        {/* Live Transparency */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Live Transparency — Active Pools</h2>
          {loading ? (
            <p className="text-[var(--soft-stone)]">Loading pools...</p>
          ) : pools.length === 0 ? (
            <Surface className="p-6 text-center">
              <p className="text-[var(--soft-stone)]">No active pools to display. Check back soon.</p>
            </Surface>
          ) : (
            <div className="space-y-4">
              {pools.map((pool) => (
                <Surface key={pool.id} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-[var(--warm-ink)]">{pool.title}</h3>
                      <p className="text-xs text-[var(--soft-stone)]">{pool.businessName || 'Verified Business'}</p>
                    </div>
                    <Badge tone={RISK_TONES[pool.riskBand] || 'info'}>{pool.riskBand}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                    <div>
                      <span className="text-xs text-[var(--soft-stone)]">APY</span>
                      <p className="text-[var(--sage)] font-bold">{pool.expectedApy}%</p>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--soft-stone)]">Ratio</span>
                      <p className="text-[var(--warm-ink)] font-bold">{pool.profitShareRatio}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--soft-stone)]">Raised</span>
                      <p className="text-[var(--warm-ink)] font-bold">${pool.currentAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--soft-stone)]">Investors</span>
                      <p className="text-[var(--warm-ink)] font-bold">{pool.investorCount}</p>
                    </div>
                  </div>
                  <div className="bg-[var(--warm-sand)] rounded-xl p-3 mb-3">
                    <span className="text-xs text-[var(--soft-stone)]">Revenue Source</span>
                    <p className="text-sm text-[var(--warm-ink)]">{pool.revenueSource}</p>
                  </div>
                  <div className="bg-[var(--warm-sand)] rounded-xl p-3 mb-3">
                    <span className="text-xs text-[var(--soft-stone)]">Profit Formula</span>
                    <p className="text-sm text-[var(--warm-ink)]">
                      Profit = (Revenue – Expenses) × {pool.profitShareRatio.split('/')[0]}% to investors, {pool.profitShareRatio.split('/')[1]}% to business
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => loadTransparency(pool.id)}>
                    View Distribution History
                  </Button>
                  {selectedPoolId === pool.id && transparency && (
                    <div className="mt-4 border-t border-[rgba(191,179,163,0.2)] pt-4">
                      <h4 className="text-sm font-semibold text-[var(--warm-ink)] mb-2">Distribution History</h4>
                      {transparency.distributionHistory.length === 0 ? (
                        <p className="text-xs text-[var(--soft-stone)]">No distributions yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-[rgba(191,179,163,0.2)]">
                                <th className="pb-2 text-[var(--soft-stone)]">Period</th>
                                <th className="pb-2 text-[var(--soft-stone)]">Revenue</th>
                                <th className="pb-2 text-[var(--soft-stone)]">Investor</th>
                                <th className="pb-2 text-[var(--soft-stone)]">Business</th>
                              </tr>
                            </thead>
                            <tbody>
                              {transparency.distributionHistory.map((d: any) => (
                                <tr key={d.id} className="border-b border-[rgba(191,179,163,0.15)]">
                                  <td className="py-2 text-[var(--soft-stone)]">
                                    {new Date(d.periodStart).toLocaleDateString()}–{new Date(d.periodEnd).toLocaleDateString()}
                                  </td>
                                  <td className="py-2 text-[var(--warm-ink)]">${d.totalRevenue.toLocaleString()}</td>
                                  <td className="py-2 text-[var(--sage)]">${d.investorShare.toLocaleString()}</td>
                                  <td className="py-2 text-[var(--clay)]">${d.pabandiShare.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <p className="text-xs text-[var(--soft-stone)] mt-2">
                        Total distributed to date: ${transparency.totalProfitDistributed?.toLocaleString() || '0'} · Total investors: {transparency.investorCount}
                      </p>
                    </div>
                  )}
                </Surface>
              ))}
            </div>
          )}
        </div>

        {/* Fatwa / Sharia Board */}
        <Surface className="p-6">
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Sharia Board Endorsement</h2>
          <div className="flex flex-col items-center text-center py-6">
            <div className="text-5xl mb-4">📜</div>
            <p className="text-[var(--soft-stone)] max-w-md mb-4">
              Pabandi's Mudarabah structure is under review by qualified Sharia scholars.
              Full fatwa documentation and board member profiles will be published here upon completion.
            </p>
            <Badge tone="info">Coming Soon</Badge>
          </div>
          <div className="border-t border-[rgba(191,179,163,0.2)] pt-4 mt-4">
            <h4 className="text-sm font-semibold text-[var(--warm-ink)] mb-2">What We Are Working On</h4>
            <ul className="text-sm text-[var(--soft-stone)] space-y-1">
              <li>• Sharia board member recruitment (AAOIFI-certified scholars)</li>
              <li>• Full Mudarabah contract audit by external Sharia advisor</li>
              <li>• Quarterly Sharia compliance reports</li>
              <li>• Public fatwa certification</li>
            </ul>
          </div>
        </Surface>
      </div>
    </div>
  );
};

export default ShariaTransparencyPage;
