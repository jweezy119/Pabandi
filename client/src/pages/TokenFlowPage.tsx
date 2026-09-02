import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { Link } from 'react-router-dom';

export const TokenFlowPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'earn' | 'spend' | 'stake' | 'history'>('overview');

  const mockBalance = 2500;
  const mockStaked = 500;
  const mockEarned = 1250;
  const mockSpent = 300;

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <Badge tone="info" className="mb-3">💰 $PAB Token Flow</Badge>
          <h1 className="text-3xl font-black text-slate-100 font-headline">Your $PAB Dashboard</h1>
          <p className="mt-2 text-slate-400">Earn, spend, stake, and govern with $PAB.</p>
        </div>

        {/* Balance Card */}
        <Surface className="p-6 mb-6 text-center" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.3)' }}>
          <div className="text-sm" style={{ color: tokens.color.muted }}>Total Balance</div>
          <div className="text-5xl font-black text-slate-100 my-3">{mockBalance.toLocaleString()} $PAB</div>
          <div className="text-sm" style={{ color: tokens.color.muted }}>≈ ${(mockBalance * 0.01).toFixed(2)} USD value</div>
          <div className="flex gap-2 mt-4 justify-center">
            <Link to="/onramp"><Button size="sm">⬆️ Buy $PAB</Button></Link>
            <Link to="/offramp"><Button size="sm" variant="ghost">⬇️ Sell $PAB</Button></Link>
          </div>
        </Surface>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Surface className="text-center p-3">
            <div className="text-lg font-bold text-emerald-300">{mockEarned.toLocaleString()}</div>
            <div className="text-xs" style={{ color: tokens.color.muted }}>Total Earned</div>
          </Surface>
          <Surface className="text-center p-3">
            <div className="text-lg font-bold text-amber-300">{mockStaked.toLocaleString()}</div>
            <div className="text-xs" style={{ color: tokens.color.muted }}>Staked</div>
          </Surface>
          <Surface className="text-center p-3">
            <div className="text-lg font-bold text-rose-300">{mockSpent.toLocaleString()}</div>
            <div className="text-xs" style={{ color: tokens.color.muted }}>Spent</div>
          </Surface>
          <Surface className="text-center p-3">
            <div className="text-lg font-bold text-indigo-300">Silver</div>
            <div className="text-xs" style={{ color: tokens.color.muted }}>Current Tier</div>
          </Surface>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {(['overview', 'earn', 'spend', 'stake', 'history'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap ${activeTab === t ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <Surface className="p-4">
              <h3 className="text-base font-bold text-slate-100 mb-3">🔄 Token Flow</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                  <div className="text-xl">⬆️</div>
                  <div className="flex-1"><div className="font-semibold text-slate-100 text-sm">On-Ramp</div><div className="text-xs" style={{ color: tokens.color.muted }}>Buy $PAB with SOL or USD</div></div>
                  <Link to="/onramp"><Button size="sm">Buy</Button></Link>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                  <div className="text-xl">⬇️</div>
                  <div className="flex-1"><div className="font-semibold text-slate-100 text-sm">Off-Ramp</div><div className="text-xs" style={{ color: tokens.color.muted }}>Sell $PAB for SOL or USD</div></div>
                  <Link to="/offramp"><Button size="sm">Sell</Button></Link>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                  <div className="text-xl">💰</div>
                  <div className="flex-1"><div className="font-semibold text-slate-100 text-sm">Earn</div><div className="text-xs" style={{ color: tokens.color.muted }}>Complete actions to earn $PAB</div></div>
                  <Button size="sm" variant="ghost">Earn</Button>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                  <div className="text-xl">🏆</div>
                  <div className="flex-1"><div className="font-semibold text-slate-100 text-sm">Stake</div><div className="text-xs" style={{ color: tokens.color.muted }}>Stake for trust badges & yield</div></div>
                  <Button size="sm" variant="ghost">Stake</Button>
                </div>
              </div>
            </Surface>
            <Surface className="p-4">
              <h3 className="text-base font-bold text-slate-100 mb-3">📈 Price History</h3>
              <div className="h-32 flex items-end gap-1">
                {[40, 45, 42, 55, 60, 58, 65, 70, 68, 75, 80, 85].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-indigo-500/30" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="flex justify-between text-xs mt-2" style={{ color: tokens.color.muted }}>
                <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
              </div>
            </Surface>
          </div>
        )}

        {/* Earn Tab */}
        {activeTab === 'earn' && (
          <Surface className="p-4">
            <h3 className="text-base font-bold text-slate-100 mb-3">Ways to Earn $PAB</h3>
            <div className="space-y-2">
              {[
                { action: 'Complete a verified sale', reward: '+15 $PAB', icon: '✅' },
                { action: 'Run a tenant screening', reward: '+10 $PAB', icon: '🔍' },
                { action: 'Add a property', reward: '+5 $PAB', icon: '🏠' },
                { action: 'Refer a new user', reward: '+25 $PAB', icon: '🤝' },
                { action: 'Connect wallet', reward: '+15 $PAB', icon: '🔗' },
                { action: 'Win a dispute', reward: '+15 $PAB', icon: '⚖️' },
                { action: 'Complete SafeMeet', reward: '+10 $PAB', icon: '📍' },
                { action: 'Verify identity', reward: '+20 $PAB', icon: '🪪' },
              ].map((e, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{e.icon}</span>
                    <span className="text-sm text-slate-300">{e.action}</span>
                  </div>
                  <span className="text-sm font-bold text-emerald-300">{e.reward}</span>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {/* Spend Tab */}
        {activeTab === 'spend' && (
          <Surface className="p-4">
            <h3 className="text-base font-bold text-slate-100 mb-3">Spend $PAB</h3>
            <div className="space-y-2">
              {[
                { title: 'Background Check', cost: '10 $PAB', icon: '🔍' },
                { title: 'Escrow Protection', cost: '5 $PAB', icon: '🔒' },
                { title: 'SafeMeet Scheduling', cost: '3 $PAB', icon: '📍' },
                { title: 'Featured Listing', cost: '20 $PAB', icon: '⭐' },
                { title: 'Local Agent Hire', cost: '50 $PAB', icon: '🤝' },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{s.icon}</span>
                    <span className="text-sm text-slate-300">{s.title}</span>
                  </div>
                  <span className="text-sm font-bold text-amber-300">{s.cost}</span>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {/* Stake Tab */}
        {activeTab === 'stake' && (
          <Surface className="p-4">
            <h3 className="text-base font-bold text-slate-100 mb-3">Stake $PAB</h3>
            <div className="space-y-3">
              {[
                { tier: 'Bronze', stake: 100, color: '#cd7f32', current: false },
                { tier: 'Silver', stake: 500, color: '#c0c0c0', current: true },
                { tier: 'Gold', stake: 2000, color: '#ffd700', current: false },
                { tier: 'Platinum', stake: 10000, color: '#e5e4e2', current: false },
              ].map((t) => (
                <div key={t.tier} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: t.color + '30', color: t.color }}>{t.tier[0]}</div>
                    <div>
                      <div className="font-semibold text-slate-100 text-sm">{t.tier}</div>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>Stake {t.stake} $PAB</div>
                    </div>
                  </div>
                  {t.current ? <Badge tone="success">Current</Badge> : <Button size="sm">Stake</Button>}
                </div>
              ))}
            </div>
          </Surface>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <Surface className="p-4">
            <h3 className="text-base font-bold text-slate-100 mb-3">Transaction History</h3>
            <div className="space-y-2">
              {[
                { date: '2026-09-01', action: 'Added a property', amount: +5 },
                { date: '2026-08-30', action: 'Ran tenant screening', amount: +10 },
                { date: '2026-08-28', action: 'Referred a new user', amount: +25 },
                { date: '2026-08-25', action: 'Connected wallet', amount: +15 },
                { date: '2026-08-20', action: 'Filed dispute (stake)', amount: -10 },
                { date: '2026-08-15', action: 'Won dispute (reward)', amount: +15 },
              ].map((h, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div>
                    <div className="font-semibold text-slate-100 text-sm">{h.action}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{h.date}</div>
                  </div>
                  <span className={`text-sm font-bold ${h.amount > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {h.amount > 0 ? '+' : ''}{h.amount} $PAB
                  </span>
                </div>
              ))}
            </div>
          </Surface>
        )}
      </div>
    </div>
  );
};

export default TokenFlowPage;
