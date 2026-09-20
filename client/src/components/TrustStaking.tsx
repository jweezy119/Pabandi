import React from 'react';

const PAB_PRICE = 0.000178;

interface StakingStatus {
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  stakedAmount: number; // in USD
  trustBoost: number;
  apy: number;
  lockEnds: string | null;
  rewardsEarned: number;
  nextTier: string | null;
  nextTierThreshold: number;
}

const TIERS = [
  { id: 'BRONZE', label: 'Bronze', min: 0, apy: 5, boost: 5, color: 'from-amber-600 to-amber-800', border: 'border-amber-500/30' },
  { id: 'SILVER', label: 'Silver', min: 50, apy: 8.5, boost: 15, color: 'from-slate-300 to-slate-500', border: 'border-slate-400/30' },
  { id: 'GOLD', label: 'Gold', min: 200, apy: 12, boost: 30, color: 'from-yellow-400 to-amber-500', border: 'border-yellow-400/30' },
  { id: 'PLATINUM', label: 'Platinum', min: 500, apy: 18, boost: 50, color: 'from-purple-400 to-fuchsia-600', border: 'border-purple-400/30' },
] as const;

export default function TrustStaking() {
  const [status, setStatus] = React.useState<StakingStatus | null>(null);
  const [stakeInput, setStakeInput] = React.useState('');
  const [showStake, setShowStake] = React.useState(false);
  const [showUnstake, setShowUnstake] = React.useState(false);

  React.useEffect(() => {
    // Simulated — would fetch from GET /api/v1/pab-staking/status
    setStatus({
      tier: 'SILVER',
      stakedAmount: 75,
      trustBoost: 15,
      apy: 8.5,
      lockEnds: '2026-12-15T00:00:00Z',
      rewardsEarned: 3.42,
      nextTier: 'Gold',
      nextTierThreshold: 200,
    });
  }, []);

  if (!status) return null;

  const currentTier = TIERS.find((t) => t.id === status.tier)!;
  const currentIdx = TIERS.findIndex((t) => t.id === status.tier);
  const nextTier = currentIdx < TIERS.length - 1 ? TIERS[currentIdx + 1] : null;

  const progress = nextTier
    ? ((status.stakedAmount - currentTier.min) / (nextTier.min - currentTier.min)) * 100
    : 100;

  const lockDays = status.lockEnds
    ? Math.max(0, Math.ceil((new Date(status.lockEnds).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleStake = async () => {
    const amount = parseFloat(stakeInput);
    if (amount <= 0 || isNaN(amount)) return;
    // Would call POST /api/v1/pab-staking/stake
    setStatus((s) => s ? { ...s, stakedAmount: s.stakedAmount + amount } : s);
    setStakeInput('');
    setShowStake(false);
  };

  const handleUnstake = async () => {
    // Would call POST /api/v1/pab-staking/unstake
    setShowUnstake(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Trust Staking</h1>
          <p className="text-slate-400 text-sm mt-1">Stake PAB to boost your trust score and earn rewards</p>
        </div>
      </div>

      {/* Current Tier Card */}
      <div className={`rounded-2xl bg-gradient-to-br ${currentTier.color} p-6 relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-white/70 uppercase tracking-wider mb-1">Current Tier</div>
              <div className="text-3xl font-bold text-white">{currentTier.label}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-white/70">Staked Value</div>
              <div className="text-2xl font-bold text-white">${status.stakedAmount.toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3 text-center">
              <div className="text-xs text-white/60">Trust Boost</div>
              <div className="text-lg font-bold text-white">+{currentTier.boost}%</div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3 text-center">
              <div className="text-xs text-white/60">APY</div>
              <div className="text-lg font-bold text-white">{currentTier.apy}%</div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3 text-center">
              <div className="text-xs text-white/60">Rewards</div>
              <div className="text-lg font-bold text-white">${status.rewardsEarned.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress to Next Tier */}
      {nextTier && (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-400">Progress to {nextTier.label}</span>
            <span className="text-sm text-white font-medium">${status.stakedAmount.toFixed(0)} / ${nextTier.min}</span>
          </div>
          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${nextTier.color} transition-all duration-500`}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>{currentTier.label}</span>
            <span className="text-slate-400">
              ${(nextTier.min - status.stakedAmount).toFixed(2)} more to {nextTier.label}
            </span>
            <span>{nextTier.label}</span>
          </div>
        </div>
      )}

      {/* Lock Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-400">lock_clock</span>
            </div>
            <div>
              <div className="text-white font-semibold text-sm">Lock Period</div>
              <div className="text-slate-400 text-xs">
                {lockDays > 0 ? `${lockDays} days remaining` : 'Unlocked'}
              </div>
            </div>
          </div>
          {status.lockEnds && lockDays > 0 && (
            <div className="text-xs text-slate-500">
              Unlocks {new Date(status.lockEnds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-400">trending_up</span>
            </div>
            <div>
              <div className="text-white font-semibold text-sm">Rewards Earned</div>
              <div className="text-emerald-400 text-lg font-bold">${status.rewardsEarned.toFixed(2)}</div>
            </div>
          </div>
          <div className="text-xs text-slate-500">Compounds automatically</div>
        </div>
      </div>

      {/* Tier Comparison */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-bold text-white mb-4">All Tiers</h2>
        <div className="space-y-3">
          {TIERS.map((tier) => {
            const isCurrent = tier.id === status.tier;
            return (
              <div
                key={tier.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  isCurrent
                    ? `${tier.border} bg-white/5`
                    : 'border-white/5 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tier.color} flex items-center justify-center`}>
                    <span className="text-white font-bold text-sm">{tier.label[0]}</span>
                  </div>
                  <div>
                    <div className={`font-semibold ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                      {tier.label} {isCurrent && <span className="text-xs text-emerald-400 ml-2">(Current)</span>}
                    </div>
                    <div className="text-xs text-slate-500">Min ${tier.min}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Boost</div>
                    <div className={`font-bold text-sm ${isCurrent ? 'text-white' : 'text-slate-400'}`}>+{tier.boost}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">APY</div>
                    <div className={`font-bold text-sm ${isCurrent ? 'text-emerald-400' : 'text-slate-400'}`}>{tier.apy}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!showStake && (
          <button
            onClick={() => setShowStake(true)}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
          >
            Stake More
          </button>
        )}
        {!showUnstake && lockDays === 0 && (
          <button
            onClick={() => setShowUnstake(true)}
            className="flex-1 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-semibold hover:bg-white/20 transition-all"
          >
            Unstake
          </button>
        )}
      </div>

      {/* Stake Form */}
      {showStake && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-6">
          <h3 className="text-white font-bold mb-4">Stake PAB</h3>
          <div className="flex gap-3">
            <input
              type="number"
              value={stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              placeholder="Amount in USD"
              className="flex-1 px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
            <button
              onClick={handleStake}
              className="px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-all"
            >
              Stake
            </button>
            <button
              onClick={() => setShowStake(false)}
              className="px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
            >
              Cancel
            </button>
          </div>
          {stakeInput && !isNaN(parseFloat(stakeInput)) && (
            <div className="mt-2 text-xs text-slate-400">
              ≈ {Math.ceil(parseFloat(stakeInput) / PAB_PRICE).toLocaleString()} PAB
            </div>
          )}
        </div>
      )}

      {/* Unstake Confirmation */}
      {showUnstake && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-6">
          <h3 className="text-white font-bold mb-2">Unstake</h3>
          <p className="text-slate-400 text-sm mb-4">
            Your staked amount plus rewards will be returned to your wallet.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleUnstake}
              className="px-6 py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-all"
            >
              Confirm Unstake
            </button>
            <button
              onClick={() => setShowUnstake(false)}
              className="px-6 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
