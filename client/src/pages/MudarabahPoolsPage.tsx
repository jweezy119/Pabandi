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
    <div className="min-h-screen pb-24 md:pb-10" style={{ background: tokens.color.background, fontFamily: tokens.font.body }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-semibold mb-4">
            <span>☪️</span> Sharia-Compliant
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-100 mb-4">
            Sharia-Compliant Profit Sharing
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Invest in real businesses. Earn from real revenue. No interest, no speculation.
          </p>
        </div>

        {/* Risk Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setRiskFilter('')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              !riskFilter ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            All Risk Levels
          </button>
          {(['LOW', 'MEDIUM', 'HIGH'] as RiskBand[]).map((band) => (
            <button
              key={band}
              onClick={() => setRiskFilter(band)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                riskFilter === band ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {band}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && !loading && (
          <Surface className="p-6 mb-6 text-center border border-rose-500/20">
            <div className="text-3xl mb-2">⚠️</div>
            <p className="text-rose-300 mb-3">{error}</p>
            <Button size="sm" onClick={loadPools}>Retry</Button>
          </Surface>
        )}

        {/* Pools Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Surface key={i} className="p-5 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-20 mb-3" />
                <div className="h-6 bg-white/10 rounded w-3/4 mb-2" />
                <div className="h-8 bg-white/10 rounded w-1/3 mb-4" />
                <div className="h-2 bg-white/10 rounded w-full mb-2" />
                <div className="h-4 bg-white/10 rounded w-2/3" />
              </Surface>
            ))}
          </div>
        ) : pools.length === 0 ? (
          <Surface className="p-8 text-center">
            <div className="text-4xl mb-4">🏦</div>
            <p className="text-slate-400 mb-2">No active pools available right now.</p>
            <p className="text-sm text-slate-500">New pools are added regularly. Check back soon!</p>
          </Surface>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pools.map((pool) => (
              <Surface
                key={pool.id}
                className="p-5 flex flex-col gap-3 cursor-pointer hover:border-indigo-500/30 transition-all"
                onClick={() => openPoolDetail(pool)}
              >
                <div className="flex items-center justify-between">
                  <Badge tone={RISK_TONES[pool.riskBand]}>{pool.riskBand} RISK</Badge>
                  <span className="text-xs text-slate-500">{pool.profitShareRatio}</span>
                </div>
                <h3 className="font-bold text-white text-lg">{pool.title}</h3>
                {pool.businessName && (
                  <p className="text-sm text-slate-400">{pool.businessName}</p>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-300">{pool.expectedApy}%</span>
                  <span className="text-xs text-slate-500">APY</span>
                </div>
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>${pool.currentAmount?.toLocaleString() || 0} raised</span>
                    <span>${pool.targetAmount?.toLocaleString() || 0}</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                      style={{ width: `${Math.min((pool.currentAmount / pool.targetAmount) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Min: <span className="text-slate-200">${pool.minInvestment}</span></span>
                  <span className="text-slate-400">{pool.investorCount || 0} investors</span>
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
            <h2 className="text-2xl font-bold text-white mb-6">My Investments</h2>
            {investmentsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Surface key={i} className="p-4 animate-pulse">
                    <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-white/10 rounded w-1/4" />
                  </Surface>
                ))}
              </div>
            ) : investments.length === 0 ? (
              <Surface className="p-6 text-center">
                <div className="text-3xl mb-3">💰</div>
                <p className="text-slate-400 mb-2">You haven't invested in any pools yet.</p>
                <p className="text-sm text-slate-500 mb-4">Start earning halal returns by investing in a pool above.</p>
                <Button size="sm" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Browse Pools</Button>
              </Surface>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="pb-3 text-sm font-semibold text-slate-400">Pool</th>
                      <th className="pb-3 text-sm font-semibold text-slate-400">Amount</th>
                      <th className="pb-3 text-sm font-semibold text-slate-400">Profit Received</th>
                      <th className="pb-3 text-sm font-semibold text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investments.map((inv) => (
                      <tr key={inv.id} className="border-b border-white/5">
                        <td className="py-3 text-sm text-slate-100">{inv.pool?.title || inv.poolId}</td>
                        <td className="py-3 text-sm text-slate-200">${inv.amount.toLocaleString()}</td>
                        <td className="py-3 text-sm text-emerald-300">${inv.totalProfitReceived?.toLocaleString() || '0'}</td>
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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f172a] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPool(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl z-10"
            >
              ✕
            </button>

            {detailLoading && !poolDetail ? (
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-white/10 rounded w-2/3" />
                <div className="h-4 bg-white/10 rounded w-1/2" />
                <div className="h-20 bg-white/10 rounded" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Badge tone={RISK_TONES[selectedPool.riskBand]}>{selectedPool.riskBand}</Badge>
                  <Badge tone="info">{selectedPool.profitShareRatio}</Badge>
                  <Badge tone="success">{selectedPool.category}</Badge>
                </div>

                <h2 className="text-xl font-bold text-white mb-2">{selectedPool.title}</h2>
                {selectedPool.businessName && (
                  <p className="text-sm text-slate-400 mb-4">by {selectedPool.businessName}</p>
                )}

                <div className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-slate-500">APY</span>
                      <p className="text-lg font-bold text-emerald-300">{selectedPool.expectedApy}%</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Min Investment</span>
                      <p className="text-lg font-bold text-white">${selectedPool.minInvestment}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Max Investment</span>
                      <p className="text-lg font-bold text-white">${selectedPool.maxInvestment || '∞'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Investors</span>
                      <p className="text-lg font-bold text-white">{selectedPool.investorCount || poolInvestments.length}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>${selectedPool.currentAmount?.toLocaleString() || 0} raised</span>
                      <span>${selectedPool.targetAmount?.toLocaleString() || 0} target</span>
                    </div>
                    <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: `${Math.min((selectedPool.currentAmount / selectedPool.targetAmount) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-1">Description</h4>
                    <p className="text-sm text-slate-400">{selectedPool.description}</p>
                  </div>

                  {/* Revenue Source */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-1">Revenue Source</h4>
                    <p className="text-sm text-slate-400">{selectedPool.revenueSource}</p>
                  </div>

                  {/* Additional Details */}
                  {poolTransparency && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-slate-500">Profit Method</span>
                          <p className="text-sm text-slate-200">{poolTransparency.profitCalcMethod}</p>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500">Distribution</span>
                          <p className="text-sm text-slate-200">{poolTransparency.distributionFreq}</p>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500">Lockup</span>
                          <p className="text-sm text-slate-200">{poolTransparency.lockupPeriodDays} days</p>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500">Early Withdraw</span>
                          <p className="text-sm text-slate-200">{poolTransparency.allowEarlyWithdraw ? `Yes (${poolTransparency.earlyWithdrawPenalty}%)` : 'No'}</p>
                        </div>
                      </div>

                      {/* Distribution History */}
                      {poolTransparency.distributionHistory && poolTransparency.distributionHistory.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-300 mb-2">Distribution History</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-white/10">
                                  <th className="pb-2 text-slate-500">Period</th>
                                  <th className="pb-2 text-slate-500">Revenue</th>
                                  <th className="pb-2 text-slate-500">Investor Share</th>
                                </tr>
                              </thead>
                              <tbody>
                                {poolTransparency.distributionHistory.slice(0, 5).map((d) => (
                                  <tr key={d.id} className="border-b border-white/5">
                                    <td className="py-2 text-slate-400">
                                      {new Date(d.periodStart).toLocaleDateString()} – {new Date(d.periodEnd).toLocaleDateString()}
                                    </td>
                                    <td className="py-2 text-slate-200">${d.totalRevenue?.toLocaleString()}</td>
                                    <td className="py-2 text-emerald-300">${d.investorShare?.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Sharia Compliance */}
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span>☪️</span>
                          <span className="text-sm font-semibold text-emerald-300">Sharia Compliant</span>
                        </div>
                        <p className="text-xs text-slate-400">{poolTransparency.shariaCompliance.model}</p>
                      </div>
                    </>
                  )}

                  {/* Invest Form */}
                  {isAuthenticated && (
                    <div className="border-t border-white/10 pt-4 space-y-3">
                      <h4 className="text-sm font-semibold text-slate-300">Invest in this Pool</h4>
                      {investSuccess ? (
                        <div className="text-center py-4">
                          <div className="text-3xl mb-2">✅</div>
                          <p className="text-emerald-300 font-semibold">Investment successful!</p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">Amount ($)</label>
                            <input
                              type="number"
                              value={investAmount}
                              onChange={(e) => { setInvestAmount(e.target.value); setInvestError(''); }}
                              placeholder={`Min $${selectedPool.minInvestment}`}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50"
                              min={selectedPool.minInvestment}
                              max={selectedPool.maxInvestment || undefined}
                            />
                          </div>
                          {investError && (
                            <p className="text-xs text-rose-400">{investError}</p>
                          )}
                          {preview && (
                            <div className="bg-white/5 rounded-xl p-3 space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Est. Annual Profit (total)</span>
                                <span className="text-slate-200">${preview.annualProfit.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Your Share ({selectedPool.profitShareRatio.split('/')[0]}%)</span>
                                <span className="text-emerald-300 font-bold">${preview.investorShare.toFixed(2)}</span>
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
                    <div className="text-center border-t border-white/10 pt-4">
                      <p className="text-sm text-slate-400 mb-3">Log in to invest in this pool</p>
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
