import React, { useState, useEffect } from 'react';

interface StakingTier {
  tier: string;
  minAmount: number;
  trustBoost: number;
  apy: number;
  active: boolean;
}

interface StakingStatus {
  totalStaked: number;
  totalTrustBoost: number;
  activeCount: number;
  tiers: StakingTier[];
  records: any[];
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'from-amber-700 to-amber-900',
  SILVER: 'from-gray-300 to-gray-500',
  GOLD: 'from-yellow-400 to-yellow-600',
  PLATINUM: 'from-purple-400 to-purple-700',
};

const TIER_ICONS: Record<string, string> = {
  BRONZE: '🥉',
  SILVER: '🥈',
  GOLD: '🥇',
  PLATINUM: '💎',
};

export const PabStaking: React.FC = () => {
  const [status, setStatus] = useState<StakingStatus | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('SILVER');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/pab-staking/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setStatus(data.data);
    } catch (err) {
      console.error('Failed to fetch staking status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleStake = async () => {
    setLoading(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/pab-staking/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier: selectedTier }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Successfully staked at ${selectedTier} tier!`);
        fetchStatus();
      } else {
        setMessage(data.error || 'Staking failed');
      }
    } catch (err) {
      setMessage('Network error');
    }
    setLoading(false);
  };

  const handleUnstake = async (stakingId: string) => {
    setLoading(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/pab-staking/unstake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stakingId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Successfully unstaked!');
        fetchStatus();
      } else {
        setMessage(data.error || 'Unstake failed');
      }
    } catch (err) {
      setMessage('Network error');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-3xl font-bold text-white mb-6">PAB Staking</h2>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-blue-900/50 border border-blue-500 text-blue-200">
          {message}
        </div>
      )}

      {/* Stats */}
      {status && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{status.totalStaked.toFixed(2)}</div>
            <div className="text-gray-400 text-sm">PAB Staked</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">+{status.totalTrustBoost}</div>
            <div className="text-gray-400 text-sm">Trust Boost</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">{status.activeCount}</div>
            <div className="text-gray-400 text-sm">Active Positions</div>
          </div>
        </div>
      )}

      {/* Tier Selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {status?.tiers.map((tier) => (
          <button
            key={tier.tier}
            onClick={() => setSelectedTier(tier.tier)}
            className={`relative p-4 rounded-xl border-2 transition-all ${
              selectedTier === tier.tier
                ? 'border-blue-500 shadow-lg shadow-blue-500/30'
                : 'border-gray-700 hover:border-gray-500'
            } ${tier.active ? 'ring-2 ring-green-500' : ''}`}
          >
            <div className={`text-3xl mb-2`}>{TIER_ICONS[tier.tier]}</div>
            <div className="font-bold text-white">{tier.tier}</div>
            <div className="text-sm text-gray-400">{tier.minAmount} PAB</div>
            <div className="text-xs text-green-400 mt-1">+{tier.trustBoost} trust</div>
            <div className="text-xs text-yellow-400">{tier.apy}% APY</div>
            {tier.active && (
              <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Stake Button */}
      <button
        onClick={handleStake}
        disabled={loading}
        className={`w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r ${TIER_COLORS[selectedTier]} disabled:opacity-50`}
      >
        {loading ? 'Processing...' : `Stake ${selectedTier}`}
      </button>

      {/* Active Positions */}
      {status && status.records.filter(r => r.status === 'ACTIVE').length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-bold text-white mb-4">Your Positions</h3>
          <div className="space-y-3">
            {status.records
              .filter((r: any) => r.status === 'ACTIVE')
              .map((record: any) => (
                <div key={record.id} className="bg-gray-800 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white">{record.tier}</span>
                    <span className="ml-3 text-gray-400">{record.amountPab} PAB</span>
                    <span className="ml-3 text-green-400">+{record.trustBoost} trust</span>
                  </div>
                  <button
                    onClick={() => handleUnstake(record.id)}
                    disabled={loading || new Date(record.unlockAt) > new Date()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg text-sm"
                  >
                    {new Date(record.unlockAt) > new Date()
                      ? `Locked until ${new Date(record.unlockAt).toLocaleDateString()}`
                      : 'Unstake'}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PabStaking;
