import React, { useState, useEffect } from 'react';
import { Surface, Badge, tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';
import apiClient from '../services/api';
import { getAuthToken } from '../utils/authToken';

const TIERS = [
  { name: 'Bronze', stake: '100 $PAB', benefit: 'Basic trust badge', color: 'var(--terracotta)', perks: ['List items', 'Basic support', '10% API discount'], discount: '10%' },
  { name: 'Silver', stake: '1,000 $PAB', benefit: 'Priority in search', color: 'var(--soft-stone)', perks: ['Priority search', '25% API discount', 'Verified badge', 'Priority support'], discount: '25%' },
  { name: 'Gold', stake: '10,000 $PAB', benefit: 'Reduced fees + beta', color: 'var(--muted-ochre)', perks: ['50% API discount', 'Beta access', 'Arbitration voting', 'Featured listings'], discount: '50%' },
  { name: 'Platinum', stake: '100,000 $PAB', benefit: 'Enterprise + white-label', color: 'var(--soft-stone)', perks: ['Enterprise tier', 'White-label rights', 'Governance votes', 'Custom branding', 'API access'], discount: '50%' },
];

const FLOWS = [
  { from: 'Platform Revenue', to: 'Treasury', desc: '1% rake on all transactions', icon: '💰' },
  { from: 'Treasury', to: 'Liquidity Pool', desc: '35% of fees buy back PAB', icon: '🏊' },
  { from: 'Treasury', to: 'Burn', desc: '12% of fees burned forever', icon: '🔥' },
  { from: 'Treasury', to: 'Yield', desc: '25% distributed to stakers', icon: '📈' },
  { from: 'Treasury', to: 'Operations', desc: '28% funds platform ops', icon: '⚙️' },
];

export const TokenomicsPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [treasury, setTreasury] = useState<any>(null);
  const [position, setPosition] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    Promise.all([
      fetch(`${baseUrl}/api/v1/pab/treasury`).then(res => res.json()).then(j => j.data).catch(() => null),
      isAuthenticated ? fetch(`${baseUrl}/api/v1/pab-staking/position`, { headers: { Authorization: `Bearer ${getAuthToken()}` } }).then(res => res.json()).then(j => j.data).catch(() => null) : Promise.resolve(null),
    ]).then(([treasuryData, positionData]) => {
      setTreasury(treasuryData);
      setPosition(positionData);
      setLoading(false);
    });
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">$PAB Tokenomics</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--warm-ink)] font-headline">
            The $PAB Economy
          </h1>
          <p className="mt-3 text-[var(--soft-stone)] max-w-2xl mx-auto">
            $PAB is the trust and rewards token of Pabandi. Earn it, stake it, spend it, govern with it.
          </p>
        </div>

        {/* Live Treasury Stats */}
        {!loading && treasury && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Surface className="text-center p-4">
              <div className="text-xl md:text-2xl font-bold text-[var(--warm-ink)]">{Number(treasury.totalPabStaked || 0).toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Total Staked</div>
            </Surface>
            <Surface className="text-center p-4">
              <div className="text-xl md:text-2xl font-bold text-[var(--sage)]">{Number(treasury.totalPabBurned || 0).toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Total Burned</div>
            </Surface>
            <Surface className="text-center p-4">
              <div className="text-xl md:text-2xl font-bold text-[var(--clay)]">{Number(treasury.totalSolEarned || 0).toFixed(2)}</div>
              <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>SOL Earned</div>
            </Surface>
            <Surface className="text-center p-4">
              <div className="text-xl md:text-2xl font-bold text-[var(--muted-ochre)]">{Number(treasury.poolUsdcBalance || 0).toFixed(2)}</div>
              <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>USDC Balance</div>
            </Surface>
          </div>
        )}

        {/* User Position */}
        {isAuthenticated && position && (
          <Surface className="p-4 md:p-6 mb-6">
            <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">👤 Your Position</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[var(--warm-sand)]">
                <div className="text-xs" style={{ color: tokens.color.textDim }}>Total Staked</div>
                <div className="text-lg font-bold text-[var(--warm-ink)]">{Number(position.totalStaked || 0).toLocaleString()} $PAB</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--warm-sand)]">
                <div className="text-xs" style={{ color: tokens.color.textDim }}>Tier</div>
                <div className="text-lg font-bold text-[var(--warm-ink)]">{position.tier || 'None'}</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--warm-sand)]">
                <div className="text-xs" style={{ color: tokens.color.textDim }}>Trust Boost</div>
                <div className="text-lg font-bold text-[var(--sage)]">+{position.trustBoost || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--warm-sand)]">
                <div className="text-xs" style={{ color: tokens.color.textDim }}>Fee Discount</div>
                <div className="text-lg font-bold text-[var(--clay)]">{Math.round((position.feeDiscount || 0) * 100)}%</div>
              </div>
            </div>
            {position.records && position.records.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-bold text-[var(--warm-ink)] mb-2">Active Stakes</h3>
                <div className="space-y-2">
                  {position.records.map((record: any) => (
                    <div key={record.id} className="p-3 rounded-xl bg-[var(--warm-sand)] flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-[var(--warm-ink)]">{Number(record.amountPab).toLocaleString()} $PAB</div>
                        <div className="text-xs" style={{ color: tokens.color.textDim }}>Unlocks: {new Date(record.unlockAt).toLocaleDateString()}</div>
                      </div>
                      <div className="text-xs font-bold px-2 py-1 rounded-full bg-[var(--sage)]/20 text-[var(--sage)]">{record.tier}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Surface>
        )}

        {/* Token Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Surface className="text-center p-4">
            <div className="text-xl md:text-2xl font-bold text-[var(--warm-ink)]">1B</div>
            <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Total Supply</div>
          </Surface>
          <Surface className="text-center p-4">
            <div className="text-xl md:text-2xl font-bold text-[var(--sage)]">9</div>
            <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Decimals</div>
          </Surface>
          <Surface className="text-center p-4">
            <div className="text-xl md:text-2xl font-bold text-[var(--clay)]">SPL</div>
            <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Token Standard</div>
          </Surface>
          <Surface className="text-center p-4">
            <div className="text-xl md:text-2xl font-bold text-[var(--muted-ochre)]">Solana</div>
            <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Blockchain</div>
          </Surface>
        </div>

        {/* Revenue Flow */}
        <Surface className="p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">💸 Revenue Flow</h2>
          <p className="text-sm mb-4" style={{ color: tokens.color.textDim }}>Every Pabandi transaction generates a 1% platform fee in SOL. Here's where it goes:</p>
          <div className="space-y-3">
            {FLOWS.map((flow, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--warm-sand)]">
                <div className="text-xl">{flow.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-[var(--warm-ink)] text-sm">{flow.from} → {flow.to}</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>{flow.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-xl bg-[var(--sage)]/10 border border-[var(--sage)]/20">
            <div className="text-sm font-bold text-[var(--sage)]">Why this matters</div>
            <div className="text-xs text-[var(--sage)]/80 mt-1">The buyback-and-burn creates deflationary pressure. Stakers earn real yield from platform revenue. Governance gives holders a say in protocol upgrades.</div>
          </div>
        </Surface>

        {/* Staking Tiers */}
        <Surface className="p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">🏆 Staking Tiers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TIERS.map((tier) => (
              <div key={tier.name} className="p-4 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: tier.color + '30', color: tier.color }}>
                    {tier.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-[var(--warm-ink)]">{tier.name}</div>
                    <div className="text-xs" style={{ color: tokens.color.textDim }}>Stake: {tier.stake}</div>
                  </div>
                </div>
                <div className="space-y-1">
                  {tier.perks.map((perk, i) => (
                    <div key={i} className="text-xs flex items-center gap-2" style={{ color: tokens.color.textDim }}>
                      <span style={{ color: tier.color }}>✓</span> {perk}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Surface>

        {/* Token Distribution */}
        <Surface className="p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">📊 Token Distribution</h2>
          <div className="space-y-3">
            {[
              { label: 'Community Rewards', pct: 30, color: 'var(--clay)', desc: 'Earned through platform activity' },
              { label: 'Liquidity Mining', pct: 20, color: 'var(--sage)', desc: 'LP staking rewards' },
              { label: 'Team & Advisors', pct: 15, color: 'var(--muted-ochre)', desc: '4-year vesting, 1-year cliff' },
              { label: 'Treasury', pct: 20, color: '#ec4899', desc: 'Platform development & operations' },
              { label: 'Initial Distribution', pct: 10, color: '#8b5cf6', desc: 'Early supporters & airdrops' },
              { label: 'Ecosystem Fund', pct: 5, color: '#6b7280', desc: 'Partnerships & grants' },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl bg-[var(--warm-sand)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-[var(--warm-ink)] text-sm">{item.label}</div>
                  <div className="font-bold" style={{ color: item.color }}>{item.pct}%</div>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--warm-sand)]">
                  <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                </div>
                <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </Surface>

        {/* Utility */}
        <Surface className="p-4 md:p-6">
          <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">🔧 $PAB Utility</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: '💳', title: 'Pay Fees', desc: 'Use PAB to pay platform fees at a discount' },
              { icon: '🏛️', title: 'Govern', desc: 'Vote on protocol upgrades and fee changes' },
              { icon: '🎁', title: 'Stake', desc: 'Stake for trust badges and priority access' },
              { icon: '🛡️', title: 'Secure', desc: 'Stake as escrow guarantee for sales' },
              { icon: '🤝', title: 'Refer', desc: 'Earn PAB for bringing new users' },
              { icon: '⭐', title: 'Boost', desc: 'Spend PAB to feature your listings' },
            ].map((u, i) => (
              <div key={i} className="p-3 rounded-xl bg-[var(--warm-sand)] text-center">
                <div className="text-2xl mb-2">{u.icon}</div>
                <div className="font-semibold text-[var(--warm-ink)] text-sm">{u.title}</div>
                <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{u.desc}</div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
};

export default TokenomicsPage;
