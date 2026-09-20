import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { tokens, Surface, Button, Badge } from '../design-system';
import { protocolService } from '../services/protocolService';

const TIERS = [
  { name: 'BRONZE', minAmount: 0, apy: 0, color: '#cd7f32', trustBoost: 0 },
  { name: 'SILVER', minAmount: 100, apy: 5, color: '#c0c0c0', trustBoost: 100 },
  { name: 'GOLD', minAmount: 500, apy: 8, color: '#ffd700', trustBoost: 300 },
  { name: 'PLATINUM', minAmount: 2000, apy: 12, color: '#e5e4e2', trustBoost: 1000 },
];

const TIER_BENEFITS: Record<string, string[]> = {
  BRONZE: ['Basic trust badge', 'Access to marketplace', '1% fee discount'],
  SILVER: ['Priority search', 'Reduced fees (5%)', 'Verified badge', 'Priority support'],
  GOLD: ['All Silver perks', '10% fee discount', 'Arbitration voting', 'Featured listings'],
  PLATINUM: ['All Gold perks', 'Revenue share', 'Governance votes', 'Custom branding', 'API access'],
};

export const StakingInterface: React.FC = () => {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: statusData } = useQuery('staking-status', async () => {
    const res = await protocolService.getStakingStatus();
    return res?.data?.data;
  });

  const { data: tiersData } = useQuery('staking-tiers', async () => {
    const res = await protocolService.getStakingTiers();
    return res?.data?.data;
  });

  const stakeMutation = useMutation(
    (tier: string) => protocolService.stake(tier),
    { onSuccess: () => { queryClient.invalidateQueries('staking-status'); setSelectedTier(null); } }
  );

  const unstakeMutation = useMutation(
    (stakingId: string) => protocolService.unstake(stakingId),
    { onSuccess: () => { queryClient.invalidateQueries('staking-status'); } }
  );

  const status = statusData || { records: [], totalStaked: 0, totalTrustBoost: 0, activeCount: 0, tiers: [] };
  const activeTiers = tiersData || TIERS;

  const getTierInfo = (tierName: string) => {
    return activeTiers.find((t: any) => t.tier === tierName || t.name === tierName) || TIERS.find(t => t.name === tierName);
  };

  const isLocked = (record: any) => {
    return record.status === 'ACTIVE' && new Date(record.unlockAt) > new Date();
  };

  const lockCountdown = (record: any) => {
    const diff = new Date(record.unlockAt).getTime() - Date.now();
    if (diff <= 0) return 'Unlocked';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h remaining`;
  };

  const currentTier = status.tiers?.find((t: any) => t.active);

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">Staking</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-100">
            Stake PAB
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            Stake PAB tokens to earn yield, boost trust score, and unlock protocol benefits.
          </p>
        </div>

        {/* Current Status */}
        <Surface className="p-5">
          <h3 className="text-sm font-bold text-slate-100 mb-4">Your Staking Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-2xl font-black text-emerald-300">{Number(status.totalStaked || 0).toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Total Staked (PAB)</div>
            </div>
            <div>
              <div className="text-2xl font-black text-indigo-300">{status.totalTrustBoost || 0}</div>
              <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Trust Boost</div>
            </div>
            <div>
              <div className="text-2xl font-black text-purple-300">{status.activeCount || 0}</div>
              <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Active Stakes</div>
            </div>
            <div>
              <div className="text-2xl font-black text-amber-300">
                {currentTier ? currentTier.tier : 'None'}
              </div>
              <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Current Tier</div>
            </div>
          </div>
        </Surface>

        {/* Tier Selection */}
        <Surface className="p-5">
          <h3 className="text-sm font-bold text-slate-100 mb-4">Available Tiers</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                  selectedTier === tier.name ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-white/10 hover:border-white/20'
                }`}
                style={{ background: 'rgba(255,255,255,0.03)' }}
                onClick={() => setSelectedTier(tier.name)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full" style={{ background: tier.color }} />
                  <span className="font-bold text-slate-100">{tier.name}</span>
                </div>
                <div className="text-xs" style={{ color: tokens.color.textDim }}>
                  Min: {tier.minAmount} PAB
                </div>
                <div className="text-lg font-bold text-emerald-300 mt-1">{tier.apy}% APY</div>
                <div className="mt-2 space-y-1">
                  {TIER_BENEFITS[tier.name]?.slice(0, 3).map((benefit, i) => (
                    <div key={i} className="text-xs flex items-center gap-1" style={{ color: tokens.color.textDim }}>
                      <span style={{ color: tier.color }}>✓</span> {benefit}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {selectedTier && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="primary"
                onClick={() => stakeMutation.mutate(selectedTier)}
                loading={stakeMutation.isLoading}
              >
                Stake {selectedTier}
              </Button>
              <span className="text-xs" style={{ color: tokens.color.textDim }}>
                Requires {getTierInfo(selectedTier)?.minAmount} PAB minimum
              </span>
            </div>
          )}
        </Surface>

        {/* Active Stakes */}
        {status.records && status.records.length > 0 && (
          <Surface className="p-5">
            <h3 className="text-sm font-bold text-slate-100 mb-4">Your Stakes</h3>
            <div className="space-y-3">
              {status.records.map((record: any) => {
                const tierInfo = getTierInfo(record.tier);
                const locked = isLocked(record);
                return (
                  <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: tierInfo?.color || '#666' }} />
                      <div>
                        <div className="font-semibold text-slate-100 text-sm">{record.tier}</div>
                        <div className="text-xs" style={{ color: tokens.color.textDim }}>
                          {Number(record.amountPab).toLocaleString()} PAB • {tierInfo?.apy}% APY
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {locked ? (
                        <div className="text-right">
                          <div className="text-xs text-amber-300">🔒 Locked</div>
                          <div className="text-xs" style={{ color: tokens.color.textDim }}>{lockCountdown(record)}</div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => unstakeMutation.mutate(record.id)}
                          loading={unstakeMutation.isLoading}
                          disabled={record.status !== 'ACTIVE'}
                        >
                          Unstake
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Surface>
        )}

        {/* Tier Benefits Comparison */}
        <Surface className="p-5">
          <h3 className="text-sm font-bold text-slate-100 mb-4">Tier Benefits Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: tokens.color.textDim }}>
                  <th className="text-left py-2 px-2">Benefit</th>
                  {TIERS.map((t) => (
                    <th key={t.name} className="text-center py-2 px-2">
                      <span style={{ color: t.color }}>{t.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['Marketplace Access', 'Fee Discount', 'Priority Search', 'Verified Badge', 'Arbitration', 'Revenue Share', 'Governance'].map((benefit) => (
                  <tr key={benefit} className="border-t border-white/5">
                    <td className="py-2 px-2 text-slate-200">{benefit}</td>
                    {TIERS.map((tier) => {
                      const benefits = TIER_BENEFITS[tier.name] || [];
                      const hasBenefit = benefits.some((b: string) => b.toLowerCase().includes(benefit.toLowerCase().split(' ')[0]));
                      return (
                        <td key={tier.name} className="text-center py-2 px-2">
                          {hasBenefit ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      </div>
    </div>
  );
};

export default StakingInterface;
