import React, { useState, useEffect, useCallback } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { mudarabahService, MudarabahPool, CreatePoolData, RiskBand, Distribution, DistributionFreq } from '../services/mudarabahService';

type Tab = 'myPools' | 'create' | 'distributions';

const PROFIT_RATIOS = ['70/30', '60/40', '50/50'];
const RISK_BANDS: RiskBand[] = ['LOW', 'MEDIUM', 'HIGH'];
const DISTRIBUTION_FREQS: DistributionFreq[] = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'];

const emptyForm: CreatePoolData = {
  title: '',
  description: '',
  profitShareRatio: '70/30',
  targetAmount: 0,
  minInvestment: 100,
  maxInvestment: 10000,
  expectedApy: 12,
  revenueSource: '',
  riskBand: 'MEDIUM',
  distributionFreq: 'QUARTERLY',
};
export const BusinessMudarabahPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('myPools');
  const [pools, setPools] = useState<MudarabahPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreatePoolData>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState(false);
  const [selectedPoolForDist, setSelectedPoolForDist] = useState<MudarabahPool | null>(null);
  const [distRevenue, setDistRevenue] = useState('');
  const [distStart, setDistStart] = useState('');
  const [distEnd, setDistEnd] = useState('');
  const [distributing, setDistributing] = useState(false);
  const [editingPool, setEditingPool] = useState<MudarabahPool | null>(null);
  const [editForm, setEditForm] = useState<Partial<CreatePoolData>>({});
  const [editSaving, setEditSaving] = useState(false);

  const loadPools = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mudarabahService.myPools();
      setPools(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load my pools:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPools();
  }, [loadPools]);



  const handleCreatePool = async () => {
    if (!form.title || !form.description || !form.revenueSource || !form.targetAmount) {
      setCreateError('Please fill in all required fields');
      return;
    }
    if (form.minInvestment >= form.maxInvestment) {
      setCreateError('Min investment must be less than max investment');
      return;
    }
    setCreateError('');
    setCreating(true);
    try {
      await mudarabahService.createPool(form);
      setCreateSuccess(true);
      setForm(emptyForm);
      setTimeout(() => {
        setCreateSuccess(false);
        setTab('myPools');
        loadPools();
      }, 1500);
    } catch (e: any) {
      setCreateError(e?.response?.data?.error || 'Failed to create pool');
    } finally {
      setCreating(false);
    }
  };

  const handleClosePool = async (poolId: string) => {
    if (!confirm('Are you sure you want to close this pool?')) return;
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
    if (isNaN(revenue) || revenue <= 0) return;
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
      alert(e?.response?.data?.error || 'Distribution failed');
    } finally {
      setDistributing(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingPool) return;
    setEditSaving(true);
    try {
      await mudarabahService.updatePool(editingPool.id, editForm);
      setEditingPool(null);
      loadPools();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Update failed');
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
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-allowed transition-all ${
                tab === t.id ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* My Pools Tab */}
        {tab === 'myPools' && (
          <div className="space-y-4">
            {loading ? (
              <p className="text-slate-400">Loading your pools...</p>
            ) : pools.length === 0 ? (
              <Surface className="p-8 text-center">
                <div className="text-4xl mb-4">🏦</div>
                <p className="text-slate-400 mb-4">You haven't created any pools yet.</p>
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
                          <Badge tone={pool.status === 'ACTIVE' ? 'success' : pool.status === 'CLOSED' ? 'danger' : 'warning'}>
                            {pool.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-sm text-slate-200">
                          ${pool.currentAmount.toLocaleString()} / ${pool.targetAmount.toLocaleString()}
                        </td>
                        <td className="py-3 text-sm text-slate-200">{pool.investorCount}</td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            {pool.status === 'ACTIVE' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setEditingPool(pool); setEditForm(pool); }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setSelectedPoolForDist(pool); setDistRevenue(''); setDistStart(''); setDistEnd(''); }}
                                >
                                  Distribute
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleClosePool(pool.id)}>
                                  Close
                                </Button>
                              </>
                            )}
                            {pool.status !== 'ACTIVE' && (
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

        {/* Create Pool Tab */}
        {tab === 'create' && (
          <Surface className="p-6">
            {createSuccess ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-white mb-2">Pool Created!</h3>
                <p className="text-slate-400">Your Mudarabah pool is now live.</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white mb-6">Create New Mudarabah Pool</h3>
                {createError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-400/20 text-rose-300 text-sm">
                    {createError}
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-300 mb-2 block">Pool Title *</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Restaurant Expansion Fund"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-300 mb-2 block">Description *</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe the business opportunity..."
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-slate-300 mb-2 block">Profit Share Ratio *</label>
                      <select
                        value={form.profitShareRatio}
                        onChange={(e) => setForm({ ...form, profitShareRatio: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50"
                      >
                        {PROFIT_RATIOS.map((r) => (
                          <option key={r} value={r} className="bg-slate-800">
                            {r} (Investor/Business)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-300 mb-2 block">Risk Band *</label>
                      <select
                        value={form.riskBand}
                        onChange={(e) => setForm({ ...form, riskBand: e.target.value as RiskBand })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50"
                      >
                        {RISK_BANDS.map((b) => (
                          <option key={b} value={b} className="bg-slate-800">{b}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-slate-300 mb-2 block">Target Amount ($) *</label>
                      <input
                        type="number"
                        value={form.targetAmount || ''}
                        onChange={(e) => setForm({ ...form, targetAmount: parseFloat(e.target.value) || 0 })}
                        placeholder="100000"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-300 mb-2 block">Min Investment ($)</label>
                      <input
                        type="number"
                        value={form.minInvestment || ''}
                        onChange={(e) => setForm({ ...form, minInvestment: parseFloat(e.target.value) || 0 })}
                        placeholder="100"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-300 mb-2 block">Max Investment ($)</label>
                      <input
                        type="number"
                        value={form.maxInvestment || ''}
                        onChange={(e) => setForm({ ...form, maxInvestment: parseFloat(e.target.value) || 0 })}
                        placeholder="10000"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-slate-300 mb-2 block">Expected APY (%) *</label>
                      <input
                        type="number"
                        value={form.expectedApy || ''}
                        onChange={(e) => setForm({ ...form, expectedApy: parseFloat(e.target.value) || 0 })}
                        placeholder="12"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-300 mb-2 block">Distribution Frequency</label>
                      <select
                        value={form.distributionFreq}
                        onChange={(e) => setForm({ ...form, distributionFreq: e.target.value as DistributionFreq })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50"
                      >
                        {DISTRIBUTION_FREQS.map((f) => (
                          <option key={f} value={f} className="bg-slate-800">{f}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-300 mb-2 block">Revenue Source *</label>
                    <textarea
                      value={form.revenueSource}
                      onChange={(e) => setForm({ ...form, revenueSource: e.target.value })}
                      placeholder="Explain what business activity generates the profit. e.g. 'Revenue from food sales, catering contracts, and delivery services...'"
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500/50 resize-none"
                    />
                  </div>
                  <Button onClick={handleCreatePool} loading={creating} size="lg" className="w-full">
                    {creating ? 'Creating...' : 'Create Pool'}
                  </Button>
                </div>
              </>
            )}
          </Surface>
        )}

        {/* Distributions Tab */}
        {tab === 'distributions' && (
          <div className="space-y-6">
            {pools.length === 0 ? (
              <Surface className="p-8 text-center">
                <p className="text-slate-400">No pools yet. Create a pool first to manage distributions.</p>
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
                      <Badge tone={pool.status === 'ACTIVE' ? 'success' : 'danger'}>{pool.status}</Badge>
                      {pool.status === 'ACTIVE' && (
                        <Button size="sm" onClick={() => { setSelectedPoolForDist(pool); setDistRevenue(''); setDistStart(''); setDistEnd(''); }}>
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

        {/* Edit Pool Modal */}
        {editingPool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditingPool(null)}>
            <div className="absolute inset-0 bg-black/70" />
            <div className="relative max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f172a] p-6" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setEditingPool(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl">✕</button>
              <h2 className="text-xl font-bold text-white mb-4">Edit Pool</h2>
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
            <div className="absolute inset-0 bg-black/70" />
            <div className="relative max-w-lg w-full rounded-2xl border border-white/10 bg-[#0f172a] p-6" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedPoolForDist(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl">✕</button>
              <h2 className="text-xl font-bold text-white mb-2">Distribute Profits</h2>
              <p className="text-sm text-slate-400 mb-4">{selectedPoolForDist.title}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 block">Total Revenue for Period ($)</label>
                  <input
                    type="number"
                    value={distRevenue}
                    onChange={(e) => setDistRevenue(e.target.value)}
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Direct fetch to avoid parent race
    mudarabahService.getDistributions(poolId).then((res) => {
      setDists(res.data?.data || []);
    }).finally(() => setLoading(false));
  }, [poolId]);

  if (loading) return <p className="text-sm text-slate-500">Loading distributions...</p>;
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
              <td className="py-2 text-slate-200">${d.totalRevenue.toLocaleString()}</td>
              <td className="py-2 text-slate-200">${d.profitAmount.toLocaleString()}</td>
              <td className="py-2 text-emerald-300">${d.investorShare.toLocaleString()}</td>
              <td className="py-2 text-indigo-300">${d.pabandiShare.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BusinessMudarabahPage;
