interface RewardTier {
  id: string;
  name: string;
  minStake: number;
  feeDiscount: number;
  rewardMultiplier: number;
  color: string;
  icon: string;
}

interface TierProgressProps {
  tiers: RewardTier[];
  currentTier: string;
  stakedAmount: number;
}

export default function TierProgress({ tiers, currentTier, stakedAmount }: TierProgressProps) {
  const currentTierData = tiers.find((t) => t.name === currentTier) || tiers[0];
  const nextTier = tiers.find((t) => t.minStake > stakedAmount);
  
  const progress = nextTier
    ? ((stakedAmount - (currentTierData?.minStake || 0)) / (nextTier.minStake - (currentTierData?.minStake || 0))) * 100
    : 100;

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700 mb-8">
      <h2 className="text-xl font-bold text-white mb-4">Tier Progress</h2>
      
      <div className="flex flex-wrap gap-3 mb-6">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`px-4 py-2 rounded-full text-sm font-medium border ${
              tier.name === currentTier
                ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                : 'border-slate-600 text-slate-400'
            }`}
          >
            <span className="mr-1">{tier.icon}</span>
            {tier.name}
            {tier.name === currentTier && <span className="ml-2 text-xs">✓</span>}
          </div>
        ))}
      </div>

      {nextTier && (
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">
              Progress to <span className="text-amber-400">{nextTier.icon} {nextTier.name}</span>
            </span>
            <span className="text-slate-400">
              {stakedAmount.toFixed(0)} / {nextTier.minStake} $PAB staked
            </span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Stake {nextTier.minStake - stakedAmount} more $PAB to unlock</span>
            <span>Next: {nextTier.feeDiscount}% fee discount, {nextTier.rewardMultiplier}x rewards</span>
          </div>
        </div>
      )}

      {!nextTier && (
        <div className="text-center py-4">
          <p className="text-amber-400 text-lg">🎉 You've reached the highest tier!</p>
          <p className="text-slate-400 text-sm mt-1">Enjoy 50% fee discount and 2x reward multiplier</p>
        </div>
      )}
    </div>
  );
}
