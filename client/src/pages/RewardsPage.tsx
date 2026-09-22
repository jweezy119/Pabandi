import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import RewardCard from '../components/RewardCard';
import FeeOffsetCalculator from '../components/FeeOffsetCalculator';
import TierProgress from '../components/TierProgress';

interface RewardTransaction {
  id: string;
  type: string;
  amount: number;
  usdValue: number;
  status: string;
  createdAt: string;
  referenceType?: string;
}

interface RewardBalance {
  totalEarned: number;
  totalClaimed: number;
  currentTier: string;
  stakedAmount: number;
  totalVesting: number;
}

interface RewardTier {
  id: string;
  name: string;
  minStake: number;
  feeDiscount: number;
  rewardMultiplier: number;
  color: string;
  icon: string;
}

export default function RewardsPage() {
  useAuthStore(); // check auth state
  const [balance, setBalance] = useState<RewardBalance | null>(null);
  const [history, setHistory] = useState<RewardTransaction[]>([]);
  const [tiers, setTiers] = useState<RewardTier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRewardsData();
  }, []);

  const fetchRewardsData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const [balanceRes, historyRes, tiersRes] = await Promise.all([
        fetch('/api/v1/rewards/balance', { headers }),
        fetch('/api/v1/rewards/history', { headers }),
        fetch('/api/v1/rewards/tiers'),
      ]);

      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setBalance(data.balance);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.history || []);
      }
      if (tiersRes.ok) {
        const data = await tiersRes.json();
        setTiers(data.tiers || []);
      }
    } catch (err) {
      console.error('Failed to fetch rewards data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-[var(--muted-ochre)] text-xl">Loading your rewards...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-[var(--warm-ink)] mb-2">$PAB Rewards</h1>
          <p className="text-[var(--soft-stone)]">Earn tokens on every payment. Stake to unlock fee discounts.</p>
        </div>

        {/* Hero Balance Card */}
        <div className="bg-gradient-to-r from-[var(--muted-ochre)]/20 to-[var(--terracotta)]/20 backdrop-blur-lg rounded-2xl p-8 border border-amber-500/30 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div>
              <p className="text-[var(--muted-ochre)] text-sm font-medium mb-1">Your $PAB Balance</p>
              <p className="text-5xl font-bold text-[var(--warm-ink)]">
                {balance?.totalEarned?.toFixed(2) || '0.00'}
                <span className="text-2xl text-[var(--muted-ochre)] ml-2">$PAB</span>
              </p>
              <p className="text-[var(--soft-stone)] mt-2">
                Current Tier: <span className="text-[var(--muted-ochre)] font-semibold">{balance?.currentTier || 'Bronze'}</span>
                {balance?.stakedAmount ? ` • ${balance.stakedAmount.toFixed(0)} staked` : ''}
              </p>
            </div>
            <div className="mt-6 md:mt-0">
              <button className="px-6 py-3 bg-[var(--muted-ochre)] hover:bg-[var(--muted-ochre)] text-[var(--warm-ink)] font-semibold rounded-xl transition-all shadow-lg shadow-[var(--muted-ochre)]/25">
                Stake $PAB →
              </button>
            </div>
          </div>
        </div>

        {/* Tier Progress */}
        <TierProgress tiers={tiers} currentTier={balance?.currentTier || 'Bronze'} stakedAmount={balance?.stakedAmount || 0} />

        {/* Fee Offset Calculator */}
        <FeeOffsetCalculator />

        {/* How It Works */}
        <div className="bg-[var(--cream)]/50 backdrop-blur rounded-2xl p-6 border border-slate-700 mb-8">
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-[var(--muted-ochre)]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">💳</span>
              </div>
              <h3 className="text-[var(--warm-ink)] font-semibold mb-1">Pay with Card</h3>
              <p className="text-[var(--soft-stone)] text-sm">Use your regular credit/debit card via Square checkout</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🪙</span>
              </div>
              <h3 className="text-[var(--warm-ink)] font-semibold mb-1">Earn $PAB</h3>
              <p className="text-[var(--soft-stone)] text-sm">Get 10% back in $PAB tokens automatically after payment</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[var(--dusty-rose)]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-[var(--warm-ink)] font-semibold mb-1">Save on Fees</h3>
              <p className="text-[var(--soft-stone)] text-sm">Stake $PAB to unlock up to 50% fee discounts</p>
            </div>
          </div>
        </div>

        {/* Reward History */}
        <div className="bg-[var(--cream)]/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Reward History</h2>
          {history.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--soft-stone)] text-lg">No rewards yet</p>
              <p className="text-[var(--soft-stone)] text-sm mt-1">Make your first booking to start earning $PAB!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((tx) => (
                <RewardCard key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
