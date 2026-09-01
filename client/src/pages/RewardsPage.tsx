import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';

export const RewardsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'earn' | 'spend' | 'history'>('earn');
  const mockBalance = 250;
  const mockHistory = [
    { date: '2026-09-01', action: 'Added a property', amount: +5, type: 'earn' },
    { date: '2026-08-30', action: 'Ran tenant screening', amount: +10, type: 'earn' },
    { date: '2026-08-28', action: 'Referred a new user', amount: +25, type: 'earn' },
    { date: '2026-08-25', action: 'Connected wallet', amount: +15, type: 'earn' },
    { date: '2026-08-20', action: 'Filed dispute (stake)', amount: -10, type: 'spend' },
    { date: '2026-08-15', action: 'Won dispute (reward)', amount: +15, type: 'earn' },
  ];

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">💰 $PAB Rewards</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-100 font-headline">
            Earn. Spend. Stake.
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            Every good action earns $PAB. Spend on services, stake for trust, and build your reputation.
          </p>
        </div>

        <Surface className="p-6 mb-6 text-center" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.3)' }}>
          <div className="text-sm" style={{ color: tokens.color.muted }}>Your Balance</div>
          <div className="text-5xl font-black text-slate-100 my-3">{mockBalance} $PAB</div>
          <div className="text-sm" style={{ color: tokens.color.muted }}>≈ ${(mockBalance * 0.05).toFixed(2)} USD value</div>
          <div className="flex gap-2 mt-4 justify-center">
            <Button size="sm">Stake $PAB</Button>
            <Button size="sm" variant="ghost">Withdraw</Button>
          </div>
        </Surface>

        <div className="flex gap-2 mb-6">
          {([
            { id: 'earn', label: '💵 Earn', desc: 'Ways to earn' },
            { id: 'spend', label: '🛍️ Spend', desc: 'Use your $PAB' },
            { id: 'history', label: '📜 History', desc: 'Transactions' },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 px-4 py-3 rounded-xl text-center transition-all ${activeTab === t.id ? 'bg-indigo-500/20 border border-indigo-400/30' : 'bg-white/5 border border-white/10'}`}>
              <div className="text-lg">{t.label.split(' ')[0]}</div>
              <div className="text-xs font-semibold" style={{ color: activeTab === t.id ? '#a5b4fc' : tokens.color.muted }}>{t.label.split(' ')[1]}</div>
            </button>
          ))}
        </div>

        {activeTab === 'earn' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Ways to Earn $PAB</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { action: 'Complete a verified sale', reward: '+15 $PAB', icon: '✅' },
                  { action: 'Run a tenant screening', reward: '+10 $PAB', icon: '🔍' },
                  { action: 'Add a property', reward: '+5 $PAB', icon: '🏠' },
                  { action: 'Add a tenant', reward: '+3 $PAB', icon: '👥' },
                  { action: 'Refer a new user', reward: '+25 $PAB', icon: '🤝' },
                  { action: 'Connect wallet', reward: '+15 $PAB', icon: '🔗' },
                  { action: 'Win a dispute', reward: '+15 $PAB', icon: '⚖️' },
                  { action: 'Complete SafeMeet', reward: '+10 $PAB', icon: '📍' },
                  { action: 'Leave a review', reward: '+2 $PAB', icon: '⭐' },
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
            <Surface className="p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Staking Tiers</h2>
              <div className="space-y-3">
                {[
                  { tier: 'Bronze', stake: '100 $PAB', benefit: 'Basic trust badge', color: '#cd7f32' },
                  { tier: 'Silver', stake: '500 $PAB', benefit: 'Priority in search + reduced fees', color: '#c0c0c0' },
                  { tier: 'Gold', stake: '2,000 $PAB', benefit: 'Reduced fees + arbitration voting', color: '#ffd700' },
                  { tier: 'Platinum', stake: '10,000 $PAB', benefit: 'All benefits + revenue share', color: '#e5e4e2' },
                ].map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: t.color + '30', color: t.color }}>{t.tier[0]}</div>
                      <div>
                        <div className="font-semibold text-slate-100 text-sm">{t.tier}</div>
                        <div className="text-xs" style={{ color: tokens.color.muted }}>{t.benefit}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-300">{t.stake}</div>
                      <Button size="sm" className="mt-1">Stake</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {activeTab === 'spend' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Spend $PAB</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { title: 'Background Check', cost: '10 $PAB', desc: 'Screen a tenant or buyer', icon: '🔍' },
                  { title: 'Escrow Protection', cost: '5 $PAB', desc: 'Secure any transaction', icon: '🔒' },
                  { title: 'SafeMeet Scheduling', cost: '3 $PAB', desc: 'Book a safe exchange spot', icon: '📍' },
                  { title: 'Dispute Filing', cost: '10 $PAB', desc: 'File a dispute (refunded if you win)', icon: '⚖️' },
                  { title: 'Featured Listing', cost: '20 $PAB', desc: 'Boost your listing visibility', icon: '⭐' },
                  { title: 'Local Agent Hire', cost: '50 $PAB', desc: 'Hire a local expert for inspections', icon: '🤝' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{s.icon}</span>
                      <div>
                        <div className="font-semibold text-slate-100 text-sm">{s.title}</div>
                        <div className="text-xs" style={{ color: tokens.color.muted }}>{s.desc}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-300">{s.cost}</div>
                      <Button size="sm" className="mt-1">Use</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
            <Surface className="p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Redeem for Gift Cards</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { brand: 'Amazon', icon: '📦', rate: '100 $PAB = $5' },
                  { brand: 'Uber', icon: '🚗', rate: '100 $PAB = $5' },
                  { brand: 'Starbucks', icon: '☕', rate: '50 $PAB = $5' },
                  { brand: 'DoorDash', icon: '🍔', rate: '100 $PAB = $5' },
                ].map((g, i) => (
                  <button key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-center">
                    <div className="text-2xl mb-1">{g.icon}</div>
                    <div className="font-semibold text-slate-100 text-sm">{g.brand}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{g.rate}</div>
                  </button>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {activeTab === 'history' && (
          <Surface className="p-4 md:p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Transaction History</h2>
            <div className="space-y-2">
              {mockHistory.map((h, i) => (
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

export default RewardsPage;
