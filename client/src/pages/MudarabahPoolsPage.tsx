import React, { useState, useEffect, useCallback } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import {
  mudarabahService,
  MudarabahPool,
  RiskBand,
  Investment,
  PoolInvestment,
  TransparencyReport,
} from '../services/mudarabahService';
import { useAuthStore } from '../store/authStore';

const RISK_TONES: Record<RiskBand, 'success' | 'warning' | 'danger'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

export const MudarabahPoolsPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [pools, setPools] = useState<MudarabahPool[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [investmentsLoading, setInvestmentsLoading] = useState(false);
  const [error, setError] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskBand | ''>('');
  const [selectedPool, setSelectedPool] = useState<MudarabahPool | null>(null);
  const [poolDetail, setPoolDetail] = useState<MudarabahPool | null>(null);
  const [poolTransparency, setPoolTransparency] = useState<TransparencyReport | null>(null);
  const [poolInvestments, setPoolInvestments] = useState<PoolInvestment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [investAmount, setInvestAmount] = useState('');
  const [investing, setInvesting] = useState(false);
  const [investError, setInvestError] = useState('');
  const [investSuccess, setInvestSuccess] = useState(false);

  const loadPools = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (riskFilter) params.riskBand = riskFilter;
      const res = await mudarabahService.listPools(params);
      setPools(res.data?.data || []);
    } catch (e: any) {
      console.error('Failed to load pools:', e);
      setError('Failed to load pools. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [riskFilter]);

  const loadInvestments = useCallback(async () => {
    if (!isAuthenticated) return;
    setInvestmentsLoading(true);
    try {
      const res = await mudarabahService.myInvestments();
      const data = res.data?.data;
      setInvestments(data?.investments || []);
    } catch (e) {
      console.error('Failed to load investments:', e);
    } finally {
      setInvestmentsLoading(false);
    }
  }, [isAuthenticated]);

  const loadPoolDetail = useCallback(async (pool: MudarabahPool) => {
    setDetailLoading(true);
    setPoolDetail(pool);
    try {
      const [detailRes, transparencyRes, investmentsRes] = await Promise.allSettled([
        mudarabahService.getPool(pool.id),
        mudarabahService.getPoolTransparency(pool.id),
        mudarabahService.getPoolInvestments(pool.id),
      ]);

      if (detailRes.status === 'fulfilled') {
        setPoolDetail(detailRes.value.data?.data || pool);
      }
      if (transparencyRes.status === 'fulfilled') {
        setPoolTransparency(transparencyRes.value.data?.data);
      }
      if (investmentsRes.status === 'fulfilled') {
        setPoolInvestments(investmentsRes.value.data?.data || []);
      }
    } catch (e) {
      console.error('Failed to load pool detail:', e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPools();
  }, [loadPools]);

  useEffect(() => {
    loadInvestments();
  }, [loadInvestments]);

  const handleInvest = async () => {
    if (!selectedPool || !investAmount) return;
    const amount = parseFloat(investAmount);
    if (isNaN(amount)) {
      setInvestError('Please enter a valid amount');
      return;
    }
    if (amount < selectedPool.minInvestment) {
      setInvestError(`Minimum investment is $${selectedPool.minInvestment}`);
      return;
    }
    if (selectedPool.maxInvestment && amount > selectedPool.maxInvestment) {
      setInvestError(`Maximum investment is $${selectedPool.maxInvestment}`);
      return;
    }
    setInvestError('');
    setInvesting(true);
    try {
      await mudarabahService.invest(selectedPool.id, amount);
      setInvestSuccess(true);
      setTimeout(() => {
        setInvestSuccess(false);
        setSelectedPool(null);
        setInvestAmount('');
        loadPools();
        loadInvestments();
      }, 2000);
    } catch (e: any) {
      setInvestError(e?.response?.data?.error || 'Investment failed. Please try again.');
    } finally {
      setInvesting(false);
    }
  };

  const profitPreview = () => {
    if (!selectedPool || !investAmount) return null;
    const amount = parseFloat(investAmount);
    if (isNaN(amount)) return null;
    const ratioParts = selectedPool.profitShareRatio.split('/');
    const investorRatio = parseFloat(ratioParts[0]) / 100;
    const annualProfit = amount * (selectedPool.expectedApy / 100);
    const investorShare = annualProfit * investorRatio;
    return { annualProfit, investorShare };
  };

  const preview = profitPreview();

  const openPoolDetail = (pool: MudarabahPool) => {
    setSelectedPool(pool);
    setInvestAmount('');
    setInvestError('');
    setInvestSuccess(false);
    setPoolTransparency(null);
    setPoolInvestments([]);
    loadPoolDetail(pool);
  };

  return (
    <div className="min-h-screen pb-24 md:pb-10" style={{ background: 'var(--cream)', fontFamily: tokens.font.body }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--sage)]/10 border border-[var(--sage)]/20 text-[var(--sage)] text-sm font-semibold mb-4">
            <span>☪️</span> Sharia-Compliant
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[var(--warm-ink)] mb-4">
            Sharia-Compliant Profit Sharing
          </h1>
          <p className="text-lg text-[var(--soft-stone)] max-w-2xl mx-auto">
            Invest in real businesses. Earn from real revenue. No interest, no speculation.
          </p>
        </div>

        {/* Risk Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setRiskFilter('')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              !riskFilter ? 'bg-[var(--clay)]/15 text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.3)] hover:bg-[var(--warm-sand)]'
            }`}
          >
            All Risk Levels
          </button>
          {(['LOW', 'MEDIUM', 'HIGH'] as RiskBand[]).map((band) => (
            <button
              key={band}
              onClick={() => setRiskFilter(band)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                riskFilter === band ? 'bg-[var(--clay)]/15 text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.3)] hover:bg-[var(--warm-sand)]'
              }`}
            >
              {band}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && !loading && (
          <Surface className="p-6 mb-6 text-center border border-[var(--terracotta)]/20">
            <div className="text-3xl mb-2">⚠️</div>
            <p className="text-[var(--terracotta)] mb-3">{error}</p>
            <Button size="sm" onClick={loadPools}>Retry</Button>
          </Surface>
        )}

        {/* Pools Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Surface key={i} className="p-5 animate-pulse">
                <div className="h-4 bg-[var(--warm-sand)] rounded w-20 mb-3" />
                <div className="h-6 bg-[var(--warm-sand)] rounded w-3/4 mb-2" />
                <div className="h-8 bg-[var(--warm-sand)] rounded w-1/3 mb-4" />
                <div className="h-2 bg-[var(--warm-sand)] rounded w-full mb-2" />
                <div className="h-4 bg-[var(--warm-sand)] rounded w-2/3" />
              </Surface>
            ))}
          </div>
        ) : pools.length === 0 ? (
          <Surface className="p-8 text-center">
            <div className="text-4xl mb-4">🏦</div>
            <p className="text-[var(--soft-stone)] mb-2">No active pools available right now.</p>
            <p className="text-sm text-[var(--soft-stone)]">New pools are added regularly. Check back soon!</p>
          </Surface>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pools.map((pool) => (
              <Surface
                key={pool.id}
                className="p-5 flex flex-col gap-3 cursor-pointer hover:border-[var(--clay)]/30 transition-all"
                onClick={() => openPoolDetail(pool)}
              >
                <div className="flex items-center justify-between">
                  <Badge tone={RISK_TONES[pool.riskBand]}>{pool.riskBand} RISK</Badge>
                  <span className="text-xs text-[var(--soft-stone)]">{pool.profitShareRatio}</span>
                </div>
                <h3 className="font-bold text-[var(--warm-ink)] text-lg">{pool.title}</h3>
                {pool.businessName && (
                  <p className="text-sm text-[var(--soft-stone)]">{pool.businessName}</p>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--sage)]">{pool.expectedApy}%</span>
                  <span className="text-xs text-[var(--soft-stone)]">APY</span>
                </div>
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-[var(--soft-stone)] mb-1">
                    <span>${pool.currentAmount?.toLocaleString() || 0} raised</span>
                    <span>${pool.targetAmount?.toLocaleString() || 0}</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--warm-sand)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--clay)] to-[var(--terracotta)] rounded-full transition-all"
                      style={{ width: `${Math.min((pool.currentAmount / pool.targetAmount) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--soft-stone)]">Min: <span className="text-[var(--warm-ink)]">${pool.minInvestment}</span></span>
                  <span className="text-[var(--soft-stone)]">{pool.investorCount || 0} investors</span>
                </div>
                <Button size="sm" variant="outline" onClick={openPoolDetail.bind(null, pool)}>
                  View Details →
                </Button>
              </Surface>
            ))}
          </div>
        )}

        {/* My Investments Section */}
        {isAuthenticated && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-[var(--warm-ink)] mb-6">My Investments</h2>
            {investmentsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Surface key={i} className="p-4 animate-pulse">
                    <div className="h-4 bg-[var(--warm-sand)] rounded w-1/3 mb-2" />
                    <div className="h-3 bg-[var(--warm-sand)] rounded w-1/4" />
                  </Surface>
                ))}
              </div>
            ) : investments.length === 0 ? (
              <Surface className="p-6 text-center">
                <div className="text-3xl mb-3">💰</div>
                <p className="text-[var(--soft-stone)] mb-2">You haven't invested in any pools yet.</p>
                <p className="text-sm text-[var(--soft-stone)] mb-4">Start earning halal returns by investing in a pool above.</p>
                <Button size="sm" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Browse Pools</Button>
              </Surface>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[rgba(191,179,163,0.3)]">
                      <th className="pb-3 text-sm font-semibold text-[var(--soft-stone)]">Pool</th>
                      <th className="pb-3 text-sm font-semibold text-[var(--soft-stone)]">Amount</th>
                      <th className="pb-3 text-sm font-semibold text-[var(--soft-stone)]">Profit Received</th>
                      <th className="pb-3 text-sm font-semibold text-[var(--soft-stone)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investments.map((inv) => (
                      <tr key={inv.id} className="border-b border-[rgba(191,179,163,0.3)]">
                        <td className="py-3 text-sm text-[var(--warm-ink)]">{inv.pool?.title || inv.poolId}</td>
                        <td className="py-3 text-sm text-[var(--warm-ink)]">${inv.amount.toLocaleString()}</td>
                        <td className="py-3 text-sm text-[var(--sage)]">${inv.totalProfitReceived?.toLocaleString() || '0'}</td>
                        <td className="py-3"><Badge tone={inv.status === 'ACTIVE' ? 'success' : 'info'}>{inv.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pool Detail Modal */}
      {selectedPool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPool(null)}>
          <div className="absolute inset-0 bg-[var(--cream)]/70 backdrop-blur-sm" />
          <div
            className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-[var(--radius-card)] border border-[rgba(191,179,163,0.3)] bg-[var(--cream)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPool(null)}
              className="absolute top-4 right-4 text-[var(--soft-stone)] hover:text-[var(--warm-ink)] text-xl z-10"
            >
              ✕
            </button>

            {detailLoading && !poolDetail ? (
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-[var(--warm-sand)] rounded w-2/3" />
                <div className="h-4 bg-[var(--warm-sand)] rounded w-1/2" />
                <div className="h-20 bg-[var(--warm-sand)] rounded" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Badge tone={RISK_TONES[selectedPool.riskBand]}>{selectedPool.riskBand}</Badge>
                  <Badge tone="info">{selectedPool.profitShareRatio}</Badge>
                  <Badge tone="success">{selectedPool.category}</Badge>
                </div>

                <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">{selectedPool.title}</h2>
                {selectedPool.businessName && (
                  <p className="text-sm text-[var(--soft-stone)] mb-4">by {selectedPool.businessName}</p>
                )}

                <div className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-[var(--soft-stone)]">APY</span>
                      <p className="text-lg font-bold text-[var(--sage)]">{selectedPool.expectedApy}%</p>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--soft-stone)]">Min Investment</span>
                      <p className="text-lg font-bold text-[var(--warm-ink)]">${selectedPool.minInvestment}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--soft-stone)]">Max Investment</span>
                      <p className="text-lg font-bold text-[var(--warm-ink)]">${selectedPool.maxInvestment || '∞'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--soft-stone)]">Investors</span>
                      <p className="text-lg font-bold text-[var(--warm-ink)]">{selectedPool.investorCount || poolInvestments.length}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-xs text-[var(--soft-stone)] mb-1">
                      <span>${selectedPool.currentAmount?.toLocaleString() || 0} raised</span>
                      <span>${selectedPool.targetAmount?.toLocaleString() || 0} target</span>
                    </div>
                    <div className="w-full h-3 bg-[var(--warm-sand)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--clay)] to-[var(--terracotta)] rounded-full"
                        style={{ width: `${Math.min((selectedPool.currentAmount / selectedPool.targetAmount) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--warm-ink)] mb-1">Description</h4>
                    <p className="text-sm text-[var(--soft-stone)]">{selectedPool.description}</p>
                  </div>

                  {/* Revenue Source */}
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--warm-ink)] mb-1">Revenue Source</h4>
                    <p className="text-sm text-[var(--soft-stone)]">{selectedPool.revenueSource}</p>
                  </div>

                  {/* Additional Details */}
                  {poolTransparency && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-[var(--soft-stone)]">Profit Method</span>
                          <p className="text-sm text-[var(--warm-ink)]">{poolTransparency.profitCalcMethod}</p>
                        </div>
                        <div>
                          <span className="text-xs text-[var(--soft-stone)]">Distribution</span>
                          <p className="text-sm text-[var(--warm-ink)]">{poolTransparency.distributionFreq}</p>
                        </div>
                        <div>
                          <span className="text-xs text-[var(--soft-stone)]">Lockup</span>
                          <p className="text-sm text-[var(--warm-ink)]">{poolTransparency.lockupPeriodDays} days</p>
                        </div>
                        <div>
                          <span className="text-xs text-[var(--soft-stone)]">Early Withdraw</span>
                          <p className="text-sm text-[var(--warm-ink)]">{poolTransparency.allowEarlyWithdraw ? `Yes (${poolTransparency.earlyWithdrawPenalty}%)` : 'No'}</p>
                        </div>
                      </div>

                      {/* Distribution History */}
                      {poolTransparency.distributionHistory && poolTransparency.distributionHistory.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-[var(--warm-ink)] mb-2">Distribution History</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-[rgba(191,179,163,0.3)]">
                                  <th className="pb-2 text-[var(--soft-stone)]">Period</th>
                                  <th className="pb-2 text-[var(--soft-stone)]">Revenue</th>
                                  <th className="pb-2 text-[var(--soft-stone)]">Investor Share</th>
                                </tr>
                              </thead>
                              <tbody>
                                {poolTransparency.distributionHistory.slice(0, 5).map((d) => (
                                  <tr key={d.id} className="border-b border-[rgba(191,179,163,0.3)]">
                                    <td className="py-2 text-[var(--soft-stone)]">
                                      {new Date(d.periodStart).toLocaleDateString()} – {new Date(d.periodEnd).toLocaleDateString()}
                                    </td>
                                    <td className="py-2 text-[var(--warm-ink)]">${d.totalRevenue?.toLocaleString()}</td>
                                    <td className="py-2 text-[var(--sage)]">${d.investorShare?.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Sharia Compliance */}
                      <div className="bg-[var(--sage)]/10 border border-[var(--sage)]/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span>☪️</span>
                          <span className="text-sm font-semibold text-[var(--sage)]">Sharia Compliant</span>
                        </div>
                        <p className="text-xs text-[var(--soft-stone)]">{poolTransparency.shariaCompliance.model}</p>
                      </div>
                    </>
                  )}

                  {/* Invest Form */}
                  {isAuthenticated && (
                    <div className="border-t border-[rgba(191,179,163,0.3)] pt-4 space-y-3">
                      <h4 className="text-sm font-semibold text-[var(--warm-ink)]">Invest in this Pool</h4>
                      {investSuccess ? (
                        <div className="text-center py-4">
                          <div className="text-3xl mb-2">✅</div>
                          <p className="text-[var(--sage)] font-semibold">Investment successful!</p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="text-xs text-[var(--soft-stone)] mb-1 block">Amount ($)</label>
                            <input
                              type="number"
                              value={investAmount}
                              onChange={(e) => { setInvestAmount(e.target.value); setInvestError(''); }}
                              placeholder={`Min $${selectedPool.minInvestment}`}
                              className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]/50"
                              min={selectedPool.minInvestment}
                              max={selectedPool.maxInvestment || undefined}
                            />
                          </div>
                          {investError && (
                            <p className="text-xs text-[var(--terracotta)]">{investError}</p>
                          )}
                          {preview && (
                            <div className="bg-[var(--warm-sand)] rounded-xl p-3 space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-[var(--soft-stone)]">Est. Annual Profit (total)</span>
                                <span className="text-[var(--warm-ink)]">${preview.annualProfit.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[var(--soft-stone)]">Your Share ({selectedPool.profitShareRatio.split('/')[0]}%)</span>
                                <span className="text-[var(--sage)] font-bold">${preview.investorShare.toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                          <Button onClick={handleInvest} loading={investing} className="w-full" size="lg">
                            {investing ? 'Investing...' : 'Invest Now'}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  {!isAuthenticated && (
                    <div className="text-center border-t border-[rgba(191,179,163,0.3)] pt-4">
                      <p className="text-sm text-[var(--soft-stone)] mb-3">Log in to invest in this pool</p>
                      <Button onClick={() => (window.location.href = '/login')} variant="outline" size="sm">
                        Log In
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MudarabahPoolsPage;
