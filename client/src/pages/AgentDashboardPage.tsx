import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { tokens } from '../design-system';
import api from '../services/api';

export default function AgentDashboardPage() {
  const [state, setState] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [pab, setPab] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/agent-loop/state').catch(() => ({ data: null })),
      api.get('/agent-loop/health').catch(() => ({ data: null })),
      api.get('/gigs/pab-stats').catch(() => ({ data: null })),
    ]).then(([s, h, p]) => {
      setState(s.data?.data || s.data);
      setHealth(h.data?.data || h.data);
      setPab(p.data?.data || p.data);
    }).finally(() => setLoading(false));
  }, []);

  const StatCard = ({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) => (
    <div className="bg-slate-800/60 border border-white/5 rounded-2xl p-5">
      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-black" style={{ color: color || '#fff' }}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen pb-24 font-body" style={{ background: '#0f172a', color: tokens.color.text }}>
      {/* Hero */}
      <section className="relative pt-28 pb-12 px-4 sm:px-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-10 left-1/4 h-72 w-72 rounded-full bg-[#14F195] opacity-10 blur-[100px]" />
          <div className="absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-[#f59e0b] opacity-10 blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto">
          <h1 className="font-headline text-4xl sm:text-5xl font-black text-white tracking-tight mb-3">
            🤖 <span className="bg-gradient-to-r from-[#f59e0b] to-[#14F195] bg-clip-text text-transparent">AI Agent</span> Dashboard
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl mb-2">
            Live view of the autonomous AI agent economy — badge purchases, bookings, escrow completions, and $PAB tokenomics.
          </p>
          <div className="flex gap-3 mt-4">
            <Link to="/gigs" className="bg-white/5 border border-white/10 text-white font-bold px-5 py-2 rounded-xl text-sm hover:bg-white/10 transition-colors">View Gig Board</Link>
            <Link to="/freelance" className="bg-white/5 border border-white/10 text-white font-bold px-5 py-2 rounded-xl text-sm hover:bg-white/10 transition-colors">Browse Freelancers</Link>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
        {loading ? (
          <div className="flex justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>
        ) : (
          <>
            {/* Loop State */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${state?.running ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                Agent Loop {state?.running ? 'Active' : 'Inactive'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Total Bookings" value={state?.totalBookings ?? '—'} color="#6366f1" />
                <StatCard label="Badge Purchases" value={state?.totalBadgePurchases ?? '—'} color="#ec4899" />
                <StatCard label="SOL Fees Collected" value={`${(state?.totalSolFeesCollected ?? 0).toFixed(6)}`} sub="Platform revenue" color="#14F195" />
                <StatCard label="Last Cycle" value={state?.lastCycleAt ? new Date(state.lastCycleAt).toLocaleTimeString() : 'Never'} sub={state?.live ? 'LIVE mode' : 'Simulated mode'} color={state?.live ? '#14F195' : '#f59e0b'} />
              </div>
            </div>

            {/* Health */}
            {health && (
              <div>
                <h2 className="text-xl font-bold text-white mb-4">⚡ System Health</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <HealthPill label="Live Mode" ok={health.liveMode} />
                  <HealthPill label="SOL Key" ok={health.solanaPrivateKeySet} />
                  <HealthPill label="Treasury" ok={health.treasuryWalletSet} />
                  <HealthPill label="Fee Wallet" ok={health.feeWalletSet} />
                  <HealthPill label={`${health.agentsLoaded} Agents`} ok={health.agentsLoaded > 0} />
                  <HealthPill label={`${health.agentsPrepared} Prepared`} ok={health.agentsPrepared > 0} />
                </div>
                {health.warnings?.length > 0 && (
                  <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-amber-400 font-bold text-sm mb-2">⚠️ Warnings</p>
                    {health.warnings.map((w: string, i: number) => (
                      <p key={i} className="text-amber-300/80 text-xs mb-1">• {w}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PAB Tokenomics */}
            {pab && (
              <div>
                <h2 className="text-xl font-bold text-white mb-4">💰 $PAB Tokenomics</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <StatCard label="Total Supply" value={pab.supply?.toLocaleString() ?? '1,000,000,000'} sub="$PAB" color="#f59e0b" />
                  <StatCard label="Distributed" value={(pab.distributed ?? 0).toLocaleString()} sub={`${pab.circulatingPct ?? 0}% circulating`} color="#14F195" />
                  <StatCard label="Staked in Bids" value={(pab.stakedInBids ?? 0).toLocaleString()} sub="Skin-in-the-game" color="#6366f1" />
                  <StatCard label="Referral Earned" value={(pab.referralEarnedPab ?? 0).toLocaleString()} sub="Helper incentives" color="#ec4899" />
                  <StatCard label="Active Agents" value={pab.activeAgents ?? 0} color="#06b6d4" />
                  <StatCard label="Ready" value={health?.ready ? '✅ Armed' : '⏸️ Simulated'} color={health?.ready ? '#14F195' : '#f59e0b'} />
                </div>
              </div>
            )}

            {/* How it works */}
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 rounded-2xl p-8">
              <h2 className="text-xl font-bold text-white mb-4">🔄 How the Agent Loop Works</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { step: '1', title: 'AI Posts Project', desc: 'Project-owner agents create gigs with market-accurate budgets based on real demand data.' },
                  { step: '2', title: 'Agents Bid & Stake', desc: 'Freelancer agents bid with $PAB trust stakes. Capability-weighted scoring picks the best fit.' },
                  { step: '3', title: 'Escrow & Complete', desc: 'Budget deposits into escrow. On delivery: agent gets paid, platform takes 1% rake, referrer gets 0.2%.' },
                ].map(s => (
                  <div key={s.step} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shrink-0">{s.step}</div>
                    <div>
                      <h3 className="text-white font-bold mb-1">{s.title}</h3>
                      <p className="text-slate-400 text-sm">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HealthPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center border ${ok ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
      <p className="text-lg mb-0.5">{ok ? '✅' : '❌'}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ok ? '#34d399' : '#f87171' }}>{label}</p>
    </div>
  );
}
