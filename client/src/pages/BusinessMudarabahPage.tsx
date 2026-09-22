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
    <div className="min-h-screen pb-24 md:pb-10" style={{ background: 'var(--cream)", fontFamily: tokens.font.body }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--warm-ink)]">Business Mudarabah Dashboard</h1>
          <p className="mt-2 text-[var(--soft-stone)]">Create and manage profit-sharing pools for your business.</p>
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
                tab === t.id ? 'bg-[rgba(var(--clay),0.15)] text-[var(--warm-ink)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.3)] hover:bg-[var(--warm-sand)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && !loading && (
          <Surface className="p-6 mb-6 text-center border border-[rgba(var(--dusty-rose),0.2)]">
            <div className="text-3xl mb-2">⚠️</div>
            <p className="text-[var(--dusty-rose)] mb-3">{error}</p>
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
                    <div className="h-4 bg-[var(--warm-sand)] rounded w-1/3 mb-2" />
                    <div className="h-3 bg-[var(--warm-sand)] rounded w-1/4" />
                  </Surface>
                ))}
              </div>
            ) : pools.length === 0 ? (
              <Surface className="p-8 text-center">
                <div className="text-4xl mb-4">🏦</div>
                <p className="text-[var(--soft-stone)] mb-2">You haven't created any pools yet.</p>
                <p className="text-sm text-[var(--soft-stone)] mb-4">Create your first Mudarabah pool to start raising capital.</p>
                <Button onClick={() => setTab('create')}>Create Your First Pool</Button>
              </Surface>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[rgba(191,179,163,0.3)]">
                      <th className="pb-3 text-sm font-semibold text-[var(--soft-stone)]">Pool</th>
                      <th className="pb-3 text-sm font-semibold text-[var(--soft-stone)]">Status</th>
                      <th className="pb-3 text-sm font-semibold text-[var(--soft-stone)]">Raised</th>
                      <th className="pb-3 text-sm font-semibold text-[var(--soft-stone)]">Investors</th>
                      <th className="pb-3 text-sm font-semibold text-[var(--soft-stone)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pools.map((pool) => (
                      <tr key={pool.id} className="border-b border-[rgba(191,179,163,0.2)]">
                        <td className="py-3">
                          <div className="text-sm text-[var(--warm-ink)] font-semibold">{pool.title}</div>
                          <div className="text-xs text-[var(--soft-stone)]">{pool.profitShareRatio} · {pool.riskBand}</div>
                        </td>
                        <td className="py-3">
                          <Badge tone={pool.status === 'OPEN' || pool.status === 'ACTIVE' ? 'success' : pool.status === 'CLOSED' ? 'danger' : 'warning'}>
                            {pool.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-sm text-[var(--warm-ink)]">
                          ${pool.currentAmount?.toLocaleString() || 0} / ${pool.targetAmount?.toLocaleString() || 0}
                        </td>
                        <td className="py-3 text-sm text-[var(--warm-ink)]">{pool.investorCount || 0}</td>
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
                              <span className="text-xs text-[var(--soft-stone)]">Closed</span>
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
                <p className="text-[var(--soft-stone)] mb-2">No pools yet.</p>
                <p className="text-sm text-[var(--soft-stone)] mb-4">Create a pool first to manage distributions.</p>
                <Button onClick={() => setTab('create')}>Create Pool</Button>
              </Surface>
            ) : (
              pools.map((pool) => (
                <Surface key={pool.id} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-[var(--warm-ink)]">{pool.title}</h3>
                      <p className="text-xs text-[var(--soft-stone)]">{pool.profitShareRatio} · {pool.distributionFreq}</p>
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
            <div className="absolute inset-0 bg-[var(--warm-sand)]/70 backdrop-blur-sm" />
            <div className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--cream)] p-6" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedPoolForInvestors(null)} className="absolute top-4 right-4 text-[var(--soft-stone)] hover:text-[var(--warm-ink)] text-xl">✕</button>
              <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">🤖 Recommended Investors</h2>
              <p className="text-sm text-[var(--soft-stone)] mb-4">AI-matched to: {selectedPoolForInvestors.title}</p>
              {loadingInvestors ? (
                <div className="text-center py-10">
                  <div className="w-8 h-8 border-2 border-[var(--clay)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-[var(--soft-stone)] text-sm">Finding the best investors...</p>
                </div>
              ) : recommendedInvestors.length === 0 ? (
                <Surface className="p-6 text-center">
                  <div className="text-3xl mb-3">📊</div>
                  <p className="text-[var(--soft-stone)]">No recommendations yet. The AI learns as more investors join the platform.</p>
                </Surface>
              ) : (
                <div className="space-y-3">
                  {recommendedInvestors.map((inv: any, idx: number) => (
                    <Surface key={inv.investorId} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[rgba(var(--clay),0.15)] flex items-center justify-center text-[var(--clay)] font-bold">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-[var(--warm-ink)] text-sm">{inv.investor?.name || inv.investor?.email || 'Investor'}</div>
                          <div className="text-xs text-[var(--soft-stone)]">{inv.matchReasons?.slice(0, 2).join(' · ')}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge tone="success">{inv.matchScore}% Match</Badge>
                        <div className="text-xs text-[var(--soft-stone)] mt-1">{inv.matchFactors?.category > 0.7 ? 'Category fit' : 'Diversified'}</div>
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
            <div className="absolute inset-0 bg-[var(--warm-sand)]/70 backdrop-blur-sm" />
            <div className="relative max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--cream)] p-6" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setEditingPool(null)} className="absolute top-4 right-4 text-[var(--soft-stone)] hover:text-[var(--warm-ink)] text-xl">✕</button>
              <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Edit Pool</h2>
              {editError && (
                <div className="mb-4 p-3 bg-[rgba(var(--dusty-rose),0.1)] border border-[rgba(var(--dusty-rose),0.2)] rounded-lg">
                  <p className="text-sm text-[var(--dusty-rose)]">{editError}</p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-[var(--soft-stone)] mb-2 block">Title</label>
                  <input value={editForm.title || ''} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]/50" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[var(--soft-stone)] mb-2 block">Description</label>
                  <textarea value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3} className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]/50 resize-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[var(--soft-stone)] mb-2 block">Revenue Source</label>
                  <textarea value={editForm.revenueSource || ''} onChange={(e) => setEditForm({ ...editForm, revenueSource: e.target.value })}
                    rows={2} className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]/50 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-[var(--soft-stone)] mb-2 block">APY (%)</label>
                    <input type="number" value={editForm.expectedApy || ''} onChange={(e) => setEditForm({ ...editForm, expectedApy: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]/50" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[var(--soft-stone)] mb-2 block">Min Investment</label>
                    <input type="number" value={editForm.minInvestment || ''} onChange={(e) => setEditForm({ ...editForm, minInvestment: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]/50" />
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
            <div className="absolute inset-0 bg-[var(--warm-sand)]/70 backdrop-blur-sm" />
            <div className="relative max-w-lg w-full rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--cream)] p-6" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedPoolForDist(null)} className="absolute top-4 right-4 text-[var(--soft-stone)] hover:text-[var(--warm-ink)] text-xl">✕</button>
              <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">Distribute Profits</h2>
              <p className="text-sm text-[var(--soft-stone)] mb-4">{selectedPoolForDist.title}</p>
              {distError && (
                <div className="mb-4 p-3 bg-[rgba(var(--dusty-rose),0.1)] border border-[rgba(var(--dusty-rose),0.2)] rounded-lg">
                  <p className="text-sm text-[var(--dusty-rose)]">{distError}</p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-[var(--soft-stone)] mb-2 block">Total Revenue for Period ($)</label>
                  <input
                    type="number"
                    value={distRevenue}
                    onChange={(e) => { setDistRevenue(e.target.value); setDistError(''); }}
                    placeholder="e.g. 50000"
                    className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-[var(--soft-stone)] mb-2 block">Period Start</label>
                    <input type="date" value={distStart} onChange={(e) => setDistStart(e.target.value)}
                      className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]/50" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[var(--soft-stone)] mb-2 block">Period End</label>
                    <input type="date" value={distEnd} onChange={(e) => setDistEnd(e.target.value)}
                      className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]/50" />
                  </div>
                </div>
                {distPreviewCalc && (
                  <div className="bg-[var(--warm-sand)] rounded-xl p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-[var(--soft-stone)]">Distribution Preview (assuming 50% margin)</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--soft-stone)]">Total Revenue</span>
                      <span className="text-[var(--warm-ink)]">${parseFloat(distRevenue).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--soft-stone)]">Profit (50%)</span>
                      <span className="text-[var(--warm-ink)]">${distPreviewCalc.profit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--soft-stone)]">Investor Share ({selectedPoolForDist.profitShareRatio.split('/')[0]}%)</span>
                      <span className="text-[var(--sage)] font-bold">${distPreviewCalc.investorShare.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--soft-stone)]">Business Share ({selectedPoolForDist.profitShareRatio.split('/')[1]}%)</span>
                      <span className="text-[var(--clay)] font-bold">${distPreviewCalc.pabandiShare.toFixed(2)}</span>
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

  if (loading) return <p className="text-sm text-[var(--soft-stone)]">Loading distributions...</p>;
  if (error) return <p className="text-sm text-[var(--dusty-rose)]">{error}</p>;
  if (dists.length === 0) return <p className="text-sm text-[var(--soft-stone)]">No distributions yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[rgba(191,179,163,0.3)]">
            <th className="pb-2 text-xs font-semibold text-[var(--soft-stone)]">Period</th>
            <th className="pb-2 text-xs font-semibold text-[var(--soft-stone)]">Revenue</th>
            <th className="pb-2 text-xs font-semibold text-[var(--soft-stone)]">Profit</th>
            <th className="pb-2 text-xs font-semibold text-[var(--soft-stone)]">Investor Share</th>
            <th className="pb-2 text-xs font-semibold text-[var(--soft-stone)]">Business Share</th>
          </tr>
        </thead>
        <tbody>
          {dists.map((d) => (
            <tr key={d.id} className="border-b border-[rgba(191,179,163,0.2)]">
              <td className="py-2 text-xs text-[var(--soft-stone)]">
                {new Date(d.periodStart).toLocaleDateString()} – {new Date(d.periodEnd).toLocaleDateString()}
              </td>
              <td className="py-2 text-[var(--warm-ink)]">${d.totalRevenue?.toLocaleString()}</td>
              <td className="py-2 text-[var(--warm-ink)]">${d.totalProfit?.toLocaleString()}</td>
              <td className="py-2 text-[var(--sage)]">${d.investorShare?.toLocaleString()}</td>
              <td className="py-2 text-[var(--clay)]">${d.pabandiShare?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BusinessMudarabahPage;
