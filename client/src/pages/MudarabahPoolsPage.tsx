import React, { useState, useEffect, useCallback } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { mudarabahService, MudarabahPool, RiskBand, Investment } from '../services/mudarabahService';
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
  const [riskFilter, setRiskFilter] = useState<RiskBand | ''>('');
  const [selectedPool, setSelectedPool] = useState<MudarabahPool | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [investing, setInvesting] = useState(false);
  const [investError, setInvestError] = useState('');
  const [investSuccess, setInvestSuccess] = useState(false);

  const loadPools = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { status: 'ACTIVE' };
      if (riskFilter) params.riskBand = riskFilter;
      const res = await mudarabahService.listPools(params);
      setPools(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load pools:', e);
    } finally {
      setLoading(false);
    }
  }, [riskFilter]);

  const loadInvestments = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await mudarabahService.myInvestments();
      setInvestments(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load investments:', e);
    }
  }, [isAuthenticated]);

  const [recommendations, setRecommendations] = useState<any[]>([]);
  const loadRecommendations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await mudarabahService.getRecommendations({ limit: 3 });
      setRecommendations(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load recommendations:', e);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const [showProfile, setShowProfile] = useState(false);

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
    if (amount > selectedPool.maxInvestment) {
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
      setInvestError(e?.response?.data?.error || 'Investment failed');
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

        {/* AI Recommendations */}
        {isAuthenticated && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🤖</span>
              <h2 className="text-lg font-bold text-white">AI-Recommended For You</h2>
              <span className="text-xs text-slate-500">Powered by Mudarabah Matcher</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.length === 0 ? (
                <Surface className="p-4 col-span-full">
                  <p className="text-slate-400 text-sm">Complete your investor profile to get personalized recommendations.</p>
                  <Button size="sm" onClick={() => setShowProfile(true)} className="mt-2">Set Preferences</Button>
                </Surface>
              ) : (
                recommendations.slice(0, 3).map((rec) => (
                  <Surface key={rec.poolId} className="p-4 border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <Badge tone="success">{rec.matchScore}% Match</Badge>
                      <span className="text-xs text-slate-500">{rec.matchReasons[0]}</span>
                    </div>
                    <h3 className="font-bold text-white text-sm">{rec.poolTitle}</h3>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-lg font-bold text-emerald-300">{rec.expectedApy}%</span>
                      <span className="text-xs text-slate-500">APY</span>
                      <span className="text-xs text-slate-500">· {rec.profitShareRatio}</span>
                    </div>
                    <Button size="sm" className="w-full mt-3" onClick={() => { setSelectedPool(rec.pool); setInvestAmount(''); }}>
                      Invest Now
                    </Button>
                  </Surface>
                ))
              )}
            </div>
          </div>
        )}

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

        {/* Pools Grid */}
        {loading ? (
          <p className="text-slate-400 text-center py-12">Loading pools...</p>
        ) : pools.length === 0 ? (
          <Surface className="p-8 text-center">
            <div className="text-4xl mb-4">🏦</div>
            <p className="text-slate-400">No active pools available. Check back soon!</p>
          </Surface>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pools.map((pool) => (
              <Surface key={pool.id} className="p-5 flex flex-col gap-3" onClick={() => { setSelectedPool(pool); setInvestAmount(''); setInvestError(''); setInvestSuccess(false); }}>
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
                    <span>${pool.currentAmount.toLocaleString()} raised</span>
                    <span>${pool.targetAmount.toLocaleString()}</span>
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
                  <span className="text-slate-400">{pool.investorCount} investors</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setSelectedPool(pool); setInvestAmount(''); setInvestError(''); setInvestSuccess(false); }}>
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
            {investments.length === 0 ? (
              <Surface className="p-6 text-center">
                <p className="text-slate-400">You haven't invested in any pools yet. Start earning halal returns above!</p>
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
                        <td className="py-3 text-sm text-emerald-300">${inv.profitReceived?.toLocaleString() || '0'}</td>
                        <td className="py-3"><Badge tone="info">{inv.status}</Badge></td>
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
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f172a] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPool(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <Badge tone={RISK_TONES[selectedPool.riskBand]}>{selectedPool.riskBand}</Badge>
              <Badge tone="info">{selectedPool.profitShareRatio}</Badge>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">{selectedPool.title}</h2>
            {selectedPool.businessName && (
              <p className="text-sm text-slate-400 mb-4">{selectedPool.businessName}</p>
            )}

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-1">Description</h4>
                <p className="text-sm text-slate-400">{selectedPool.description}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-1">Revenue Source</h4>
                <p className="text-sm text-slate-400">{selectedPool.revenueSource}</p>
              </div>

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
                  <p className="text-lg font-bold text-white">${selectedPool.maxInvestment}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Investors</span>
                  <p className="text-lg font-bold text-white">{selectedPool.investorCount}</p>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>${selectedPool.currentAmount.toLocaleString()} raised</span>
                  <span>${selectedPool.targetAmount.toLocaleString()} target</span>
                </div>
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                    style={{ width: `${Math.min((selectedPool.currentAmount / selectedPool.targetAmount) * 100, 100)}%` }}
                  />
                </div>
              </div>

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
                          max={selectedPool.maxInvestment}
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
          </div>
        </div>
      )}
    </div>
  );
};

export default MudarabahPoolsPage;
