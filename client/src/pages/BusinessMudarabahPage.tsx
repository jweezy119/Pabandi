import React, { useState, useEffect, useCallback } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import {
  mudarabahService,
  MudarabahPool,
  CreatePoolData,
  RiskBand,
  Distribution,
} from '../services/mudarabahService';
import { MudarabahPoolWizard } from '../components/MudarabahPoolWizard';

type Tab = 'myPools' | 'create' | 'distributions';

export const BusinessMudarabahPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('myPools');
  const [pools, setPools] = useState<MudarabahPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedPoolForDist, setSelectedPoolForDist] = useState<MudarabahPool | null>(null);
  const [distRevenue, setDistRevenue] = useState('');
  const [distStart, setDistStart] = useState('');
  const [distEnd, setDistEnd] = useState('');
  const [distributing, setDistributing] = useState(false);
  const [distError, setDistError] = useState('');
  const [editingPool, setEditingPool] = useState<MudarabahPool | null>(null);
  const [editForm, setEditForm] = useState<Partial<CreatePoolData>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [selectedPoolForInvestors, setSelectedPoolForInvestors] = useState<MudarabahPool | null>(null);
  const [recommendedInvestors, setRecommendedInvestors] = useState<any[]>([]);
  const [loadingInvestors, setLoadingInvestors] = useState(false);

  const loadRecommendedInvestors = useCallback(async (poolId: string) => {
    setLoadingInvestors(true);
    try {
      const res = await mudarabahService.getRecommendedInvestors(poolId, { limit: 10 });
      setRecommendedInvestors(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load recommended investors:', e);
    } finally {
      setLoadingInvestors(false);
    }
  }, []);

  const loadPools = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mudarabahService.myPools();
      setPools(res.data?.data || []);
    } catch (e: any) {
      console.error('Failed to load my pools:', e);
      setError('Failed to load your pools. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPools();
  }, [loadPools]);

  const handleClosePool = async (poolId: string) => {
    if (!confirm('Are you sure you want to close this pool? This action cannot be undone.')) return;
    try {
      await mudarabahService.closePool(poolId);
      loadPools();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to close pool');
    }
  };

  const handleDistribute = async () => {
    if (!selectedPoolForDist || !distRevenue || !distStart || !distEnd) return;
    const revenue = parseFloat(distRevenue);
    if (isNaN(revenue) || revenue <= 0) {
      setDistError('Please enter a valid revenue amount');
      return;
    }
    if (new Date(distStart) >= new Date(distEnd)) {
      setDistError('Period end must be after period start');
      return;
    }
    setDistError('');
    setDistributing(true);
    try {
      await mudarabahService.distributeProfits(selectedPoolForDist.id, {
        totalRevenue: revenue,
        periodStart: distStart,
        periodEnd: distEnd,
      });
      setSelectedPoolForDist(null);
      setDistRevenue('');
      setDistStart('');
      setDistEnd('');
      loadPools();
    } catch (e: any) {
      setDistError(e?.response?.data?.error || 'Distribution failed');
    } finally {
      setDistributing(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingPool) return;
    setEditSaving(true);
    setEditError('');
    try {
      await mudarabahService.updatePool(editingPool.id, editForm);
      setEditingPool(null);
      loadPools();
    } catch (e: any) {
      setEditError(e?.response?.data?.error || 'Update failed');
    } finally {
      setEditSaving(false);
    }
  };

  const distPreview = () => {
    if (!selectedPoolForDist || !distRevenue) return null;
    const revenue = parseFloat(distRevenue);
    if (isNaN(revenue)) return null;
    const ratioParts = selectedPoolForDist.profitShareRatio.split('/');
    const investorRatio = parseFloat(ratioParts[0]) / 100;
    const profit = revenue * 0.5; // assume 50% margin
    const investorShare = profit * investorRatio;
    const pabandiShare = profit * (1 - investorRatio);
    return { profit, investorShare, pabandiShare };
  };

  const distPreviewCalc = distPreview();

  return (
    <div className="min-h-screen pb-24 md:pb-10" style={{ background: tokens.color.background, fontFamily: tokens.font.body }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Business Mudarabah Dashboard</h1>
          <p className="mt-2 text-slate-400">Create and manage profit-sharing pools for your business.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {([
            { id: 'myPools', label: '📋 My Pools' },
            { id: 'create', label: '➕ Create Pool' },
            { id: 'distributions', label: '📊 Distributions' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                tab === t.id ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {t.label}
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

        {/* My Pools Tab */}
        {tab === 'myPools' && (
          <div className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Surface key={i} className="p-4 animate-pulse">
                    <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-white/10 rounded w-1/4" />
                  </Surface>
                ))}
              </div>
            ) : pools.length === 0 ? (
              <Surface className="p-8 text-center">
                <div className="text-4xl mb-4">🏦</div>
                <p className="text-slate-400 mb-2">You haven't created any pools yet.</p>
                <p className="text-sm text-slate-500 mb-4">Create your first Mudarabah pool to start raising capital.</p>
                <Button onClick={() => setTab('create')}>Create Your First Pool</Button>
              </Surface>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="pb-3 text-sm font-semibold text-slate-400">Pool</th>
                      <th className="pb-3 text-sm font-semibold text-slate-400">Status</th>
                      <th className="pb-3 text-sm font-semibold text-slate-400">Raised</th>
                      <th className="pb-3 text-sm font-semibold text-slate-400">Investors</th>
                      <th className="pb-3 text-sm font-semibold text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pools.map((pool) => (
                      <tr key={pool.id} className="border-b border-white/5">
                        <td className="py-3">
                          <div className="text-sm text-slate-100 font-semibold">{pool.title}</div>
                          <div className="text-xs text-slate-500">{pool.profitShareRatio} · {pool.riskBand}</div>
                        </td>
                        <td className="py-3">
                          <Badge tone={pool.status === 'OPEN' || pool.status === 'ACTIVE' ? 'success' : pool.status === 'CLOSED' ? 'danger' : 'warning'}>
                            {pool.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-sm text-slate-200">
                          ${pool.currentAmount?.toLocaleString() || 0} / ${pool.targetAmount?.toLocaleString() || 0}
                        </td>
                        <td className="py-3 text-sm text-slate-200">{pool.investorCount || 0}</td>
                        <td className="py-3">
                          <div className="flex gap-2 flex-wrap">
                            {(pool.status === 'OPEN' || pool.status === 'ACTIVE') && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setEditingPool(pool); setEditForm({ title: pool.title, description: pool.description, revenueSource: pool.revenueSource, expectedApy: pool.expectedApy, minInvestment: pool.minInvestment }); setEditError(''); }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setSelectedPoolForDist(pool); setDistRevenue(''); setDistStart(''); setDistEnd(''); setDistError(''); }}
                                >
                                  Distribute
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setSelectedPoolForInvestors(pool); setRecommendedInvestors([]); loadRecommendedInvestors(pool.id); }}
                                >
                                  🤖 Find Investors
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleClosePool(pool.id)}>
                                  Close
                                </Button>
                              </>
                            )}
                            {pool.status !== 'OPEN' && pool.status !== 'ACTIVE' && (
                              <span className="text-xs text-slate-500">Closed</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create Pool Tab — Advanced Wizard */}
        {tab === 'create' && (
          <MudarabahPoolWizard
            onSubmit={async (data) => {
              try {
                // Map FormData shape to CreatePoolData shape for API
                const poolData: CreatePoolData = {
                  title: data.title,
                  description: data.description,
                  profitShareRatio: data.profitShareRatio,
                  targetAmount: parseFloat(data.targetAmount),
                  minInvestment: parseFloat(data.minInvestment),
                  maxInvestment: data.maxInvestment ? parseFloat(data.maxInvestment) : undefined,
                  expectedApy: parseFloat(data.expectedApy),
                  revenueSource: data.revenueSource,
                  category: data.category,
                  useOfFunds: data.useOfFunds,
                  businessPlanUrl: data.businessPlanUrl,
                  profitCalcMethod: data.profitCalcMethod as any,
                  marginPercent: parseFloat(data.marginPercent),
                  reserveRatio: data.reserveRatio,
                  allowEarlyWithdraw: data.allowEarlyWithdraw,
                  earlyWithdrawPenalty: parseFloat(data.earlyWithdrawPenalty),
                  riskBand: data.riskBand as RiskBand,
                  riskDisclosure: data.riskDisclosure,
                  legalDisclaimer: data.legalDisclaimer,
                  shariaCompliant: true,
                  accreditedOnly: data.accreditedOnly,
                  lockupPeriodDays: data.lockupPeriodDays ? parseInt(data.lockupPeriodDays, 10) : 90,
                  autoDistribute: data.autoDistribute,
                  distributionDay: data.distributionDay ? parseInt(data.distributionDay, 10) : 1,
                  minDistribution: parseFloat(data.minDistribution),
                };
                await mudarabahService.createPool(poolData);
                setTab('myPools');
                loadPools();
              } catch (_e: any) {
                // Error handled inside wizard
              }
            }}
          />
        )}

        {/* Distributions Tab */}
        {tab === 'distributions' && (
          <div className="space-y-6">
            {pools.length === 0 ? (
              <Surface className="p-8 text-center">
                <div className="text-4xl mb-4">📊</div>
                <p className="text-slate-400 mb-2">No pools yet.</p>
                <p className="text-sm text-slate-500 mb-4">Create a pool first to manage distributions.</p>
                <Button onClick={() => setTab('create')}>Create Pool</Button>
              </Surface>
            ) : (
              pools.map((pool) => (
                <Surface key={pool.id} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-white">{pool.title}</h3>
                      <p className="text-xs text-slate-500">{pool.profitShareRatio} · {pool.distributionFreq}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge tone={pool.status === 'OPEN' || pool.status === 'ACTIVE' ? 'success' : 'danger'}>{pool.status}</Badge>
                      {(pool.status === 'OPEN' || pool.status === 'ACTIVE') && (
                        <Button size="sm" onClick={() => { setSelectedPoolForDist(pool); setDistRevenue(''); setDistStart(''); setDistEnd(''); setDistError(''); }}>
                          Distribute
                        </Button>
                      )}
                    </div>
                  </div>
                  <PoolDistributions poolId={pool.id} />
                </Surface>
              ))
            )}
          </div>
        )}

        {/* Recommended Investors Modal */}
        {selectedPoolForInvestors && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPoolForInvestors(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f172a] p-6" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedPoolForInvestors(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl">✕</button>
              <h2 className="text-xl font-bold text-white mb-2">🤖 Recommended Investors</h2>
              <p className="text-sm text-slate-400 mb-4">AI-matched to: {selectedPoolForInvestors.title}</p>
              {loadingInvestors ? (
                <div className="text-center py-10">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Finding the best investors...</p>
                </div>
              ) : recommendedInvestors.length === 0 ? (
                <Surface className="p-6 text-center">
                  <div className="text-3xl mb-3">📊</div>
                  <p className="text-slate-400">No recommendations yet. The AI learns as more investors join the platform.</p>
                </Surface>
              ) : (
                <div className="space-y-3">
                  {recommendedInvestors.map((inv: any, idx: number) => (
                    <Surface key={inv.investorId} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{inv.investor?.name || inv.investor?.email || 'Investor'}</div>
                          <div className="text-xs text-slate-500">{inv.matchReasons?.slice(0, 2).join(' · ')}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge tone="success">{inv.matchScore}% Match</Badge>
                        <div className="text-xs text-slate-500 mt-1">{inv.matchFactors?.category > 0.7 ? 'Category fit' : 'Diversified'}</div>
                      </div>
                    </Surface>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit Pool Modal */}
        {editingPool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditingPool(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f172a] p-6" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setEditingPool(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl">✕</button>
              <h2 className="text-xl font-bold text-white mb-4">Edit Pool</h2>
              {editError && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  <p className="text-sm text-rose-300">{editError}</p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 block">Title</label>
                  <input value={editForm.title || ''} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 block">Description</label>
                  <textarea value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50 resize-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 block">Revenue Source</label>
                  <textarea value={editForm.revenueSource || ''} onChange={(e) => setEditForm({ ...editForm, revenueSource: e.target.value })}
                    rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-300 mb-2 block">APY (%)</label>
                    <input type="number" value={editForm.expectedApy || ''} onChange={(e) => setEditForm({ ...editForm, expectedApy: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-300 mb-2 block">Min Investment</label>
                    <input type="number" value={editForm.minInvestment || ''} onChange={(e) => setEditForm({ ...editForm, minInvestment: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleEditSave} loading={editSaving}>Save Changes</Button>
                  <Button variant="ghost" onClick={() => setEditingPool(null)}>Cancel</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Distribute Profits Modal */}
        {selectedPoolForDist && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPoolForDist(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative max-w-lg w-full rounded-2xl border border-white/10 bg-[#0f172a] p-6" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedPoolForDist(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl">✕</button>
              <h2 className="text-xl font-bold text-white mb-2">Distribute Profits</h2>
              <p className="text-sm text-slate-400 mb-4">{selectedPoolForDist.title}</p>
              {distError && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  <p className="text-sm text-rose-300">{distError}</p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 block">Total Revenue for Period ($)</label>
                  <input
                    type="number"
                    value={distRevenue}
                    onChange={(e) => { setDistRevenue(e.target.value); setDistError(''); }}
                    placeholder="e.g. 50000"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-300 mb-2 block">Period Start</label>
                    <input type="date" value={distStart} onChange={(e) => setDistStart(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-300 mb-2 block">Period End</label>
                    <input type="date" value={distEnd} onChange={(e) => setDistEnd(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50" />
                  </div>
                </div>
                {distPreviewCalc && (
                  <div className="bg-white/5 rounded-xl p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-slate-300">Distribution Preview (assuming 50% margin)</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total Revenue</span>
                      <span className="text-slate-200">${parseFloat(distRevenue).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Profit (50%)</span>
                      <span className="text-slate-200">${distPreviewCalc.profit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Investor Share ({selectedPoolForDist.profitShareRatio.split('/')[0]}%)</span>
                      <span className="text-emerald-300 font-bold">${distPreviewCalc.investorShare.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Business Share ({selectedPoolForDist.profitShareRatio.split('/')[1]}%)</span>
                      <span className="text-indigo-300 font-bold">${distPreviewCalc.pabandiShare.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <Button onClick={handleDistribute} loading={distributing} className="w-full" size="lg">
                  {distributing ? 'Distributing...' : 'Confirm Distribution'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-component for distributions per pool
const PoolDistributions: React.FC<{ poolId: string }> = ({ poolId }) => {
  const [dists, setDists] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    mudarabahService.getDistributions(poolId)
      .then((res) => {
        setDists(res.data?.data || []);
      })
      .catch((e) => {
        console.error('Failed to load distributions:', e);
        setError('Failed to load distributions');
      })
      .finally(() => setLoading(false));
  }, [poolId]);

  if (loading) return <p className="text-sm text-slate-500">Loading distributions...</p>;
  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (dists.length === 0) return <p className="text-sm text-slate-500">No distributions yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="pb-2 text-xs font-semibold text-slate-500">Period</th>
            <th className="pb-2 text-xs font-semibold text-slate-500">Revenue</th>
            <th className="pb-2 text-xs font-semibold text-slate-500">Profit</th>
            <th className="pb-2 text-xs font-semibold text-slate-500">Investor Share</th>
            <th className="pb-2 text-xs font-semibold text-slate-500">Business Share</th>
          </tr>
        </thead>
        <tbody>
          {dists.map((d) => (
            <tr key={d.id} className="border-b border-white/5">
              <td className="py-2 text-xs text-slate-400">
                {new Date(d.periodStart).toLocaleDateString()} – {new Date(d.periodEnd).toLocaleDateString()}
              </td>
              <td className="py-2 text-slate-200">${d.totalRevenue?.toLocaleString()}</td>
              <td className="py-2 text-slate-200">${d.totalProfit?.toLocaleString()}</td>
              <td className="py-2 text-emerald-300">${d.investorShare?.toLocaleString()}</td>
              <td className="py-2 text-indigo-300">${d.pabandiShare?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BusinessMudarabahPage;
