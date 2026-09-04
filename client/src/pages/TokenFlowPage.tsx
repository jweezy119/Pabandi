import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { Link } from 'react-router-dom';
import { pabService } from '../services/api';

export const TokenFlowPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'earn' | 'spend' | 'stake' | 'history'>('overview');
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pabService.getWallet()
      .then((r) => setWallet(r.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const balance = wallet?.balance || 0;
  const staked = wallet?.stakedAmt || 0;
  const totalEarned = wallet?.totalEarned || 0;
  const totalSpent = wallet?.totalSpent || 0;
  const tier = wallet?.stakedTier || 'None';

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
          {loading ? (
            <div className="text-3xl font-black text-slate-100 my-3">Loading...</div>
          ) : (
            <>
              <div className="text-5xl font-black text-slate-100 my-3">{balance.toLocaleString()} $PAB</div>
              <div className="text-sm" style={{ color: tokens.color.muted }}>≈ ${(balance * 0.01).toFixed(2)} USD value</div>
            </>
          )}
          <div className="flex gap-2 mt-4 justify-center">
            <Link to="/onramp"><Button size="sm">⬆️ Buy $PAB</Button></Link>
            <Link to="/offramp"><Button size="sm" variant="ghost">⬇️ Sell $PAB</Button></Link>
          </div>
        </Surface>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Surface className="text-center p-3">
            <div className="text-lg font-bold text-emerald-300">{totalEarned.toLocaleString()}</div>
            <div className="text-xs" style={{ color: tokens.color.muted }}>Total Earned</div>
          </Surface>
          <Surface className="text-center p-3">
            <div className="text-lg font-bold text-amber-300">{staked.toLocaleString()}</div>
            <div className="text-xs" style={{ color: tokens.color.muted }}>Staked</div>
          </Surface>
          <Surface className="text-center p-3">
            <div className="text-lg font-bold text-rose-300">{totalSpent.toLocaleString()}</div>
            <div className="text-xs" style={{ color: tokens.color.muted }}>Spent</div>
          </Surface>
          <Surface className="text-center p-3">
            <div className="text-lg font-bold text-indigo-300">{tier}</div>
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
                  <Link to="/promo"><Button size="sm" variant="ghost">Earn</Button></Link>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                  <div className="text-xl">🏆</div>
                  <div className="flex-1"><div className="font-semibold text-slate-100 text-sm">Stake</div><div className="text-xs" style={{ color: tokens.color.muted }}>Stake for trust badges & yield</div></div>
                  <Button size="sm" variant="ghost" onClick={() => setActiveTab('stake')}>Stake</Button>
                </div>
              </div>
            </Surface>
            {wallet?.transactions?.length > 0 && (
              <Surface className="p-4">
                <h3 className="text-base font-bold text-slate-100 mb-3">📜 Recent Transactions</h3>
                <div className="space-y-2">
                  {wallet.transactions.slice(0, 10).map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <div>
                        <div className="text-sm text-slate-300">{tx.description || tx.action}</div>
                        <div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(tx.createdAt).toLocaleDateString()}</div>
                      </div>
                      <span className={`text-sm font-bold ${tx.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount} $PAB
                      </span>
                    </div>
                  ))}
                </div>
              </Surface>
            )}
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
                { action: 'Write ZK-verified review', reward: '+7 $PAB', icon: '🔏' },
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
                { tier: 'Bronze', stake: 100, color: '#cd7f32', current: tier === 'BRONZE' },
                { tier: 'Silver', stake: 500, color: '#c0c0c0', current: tier === 'SILVER' },
                { tier: 'Gold', stake: 2000, color: '#ffd700', current: tier === 'GOLD' },
                { tier: 'Platinum', stake: 10000, color: '#e5e4e2', current: tier === 'PLATINUM' },
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
            <h3 className="text-base font-bold text-slate-100 mb-3">📜 Transaction History</h3>
            {wallet?.transactions?.length > 0 ? (
              <div className="space-y-2">
                {wallet.transactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div>
                      <div className="text-sm text-slate-300">{tx.description || tx.action}</div>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(tx.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${tx.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount} $PAB
                      </span>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>Balance: {tx.balanceAfter}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: tokens.color.muted }}>No transactions yet. Start earning $PAB!</p>
            )}
          </Surface>
        )}
      </div>
    </div>
  );
};

export default TokenFlowPage;
