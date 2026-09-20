import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface DashboardData {
  balance: { usdc: number; pabTokens: number; pabValueUsd: number; totalUsd: number };
  staking: { tier: string; trustBoost: number; apy: number; lockedUntil: string | null };
  payments: Array<{ id: string; amount: number; token: string; status: string; date: string; description: string }>;
  pending: Array<{ id: string; type: string; title: string; dueDate?: string; amount?: number }>;
  lease: { monthlyRent: number; nextDue: string; daysUntilDue: number };
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'from-amber-600 to-amber-800',
  SILVER: 'from-slate-300 to-slate-500',
  GOLD: 'from-yellow-400 to-amber-500',
  PLATINUM: 'from-purple-400 to-fuchsia-600',
};

const TIER_LABELS: Record<string, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
};

export default function TenantPortal() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { setError('Not authenticated'); setLoading(false); return; }

        // Fetch PAB balance
        const balanceRes = await fetch('/api/v1/crm-pab/balance', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const balanceData = await balanceRes.json();

        // Fetch staking status
        const stakingRes = await fetch('/api/v1/pab-staking/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const stakingData = await stakingRes.json();

        // Fetch DEX price for PAB valuation
        const priceRes = await fetch('/api/v1/pab-dex/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const priceData = await priceRes.json();

        const pabPrice = priceData.success ? priceData.data.pool.price : 0.000178;

        // Build data from real API responses
        if (balanceData.success && stakingData.success) {
          const totalPab = balanceData.data.totalPabBalance || 0;
          const stakedPab = balanceData.data.totalPabStaked || 0;
          const totalUsdc = 0; // Would come from wallet API

          setData({
            balance: {
              usdc: totalUsdc,
              pabTokens: totalPab,
              pabValueUsd: totalPab * pabPrice,
              totalUsd: totalUsdc + totalPab * pabPrice,
            },
            staking: {
              tier: stakingData.data.tier || 'BRONZE',
              trustBoost: stakingData.data.trustBoost || 0,
              apy: stakingData.data.apy || 0,
              lockedUntil: stakingData.data.lockedUntil || null,
            },
            payments: [], // Would come from payment history API
            pending: [],
            lease: { monthlyRent: 0, nextDue: '', daysUntilDue: 0 },
          });
        } else {
          setData(null);
        }
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
          <h2 className="text-xl font-semibold text-slate-200 mb-2">No Data Available</h2>
          <p className="text-slate-400 mb-4">
            {error || 'Unable to load your dashboard data. Make sure you\'re logged in.'}
          </p>
          <Link
            to="/login"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-400 mb-1">Total Balance</h3>
        <p className="text-3xl font-bold text-white">${data.balance.totalUsd.toFixed(2)}</p>
        <p className="text-sm text-slate-500 mt-1">
          {data.balance.pabTokens.toFixed(0)} PAB • ${data.balance.usdc.toFixed(2)} USDC
        </p>
      </div>

      {/* Staking Card */}
      <div className={`bg-gradient-to-br ${TIER_COLORS[data.staking.tier] || 'from-slate-700 to-slate-800'} rounded-xl p-6`}>
        <h3 className="text-sm font-medium text-white/80 mb-1">Trust Tier</h3>
        <p className="text-2xl font-bold text-white">{TIER_LABELS[data.staking.tier] || 'Bronze'}</p>
        <div className="flex gap-4 mt-2 text-xs text-white/70">
          <span>Trust Boost: +{data.staking.trustBoost}</span>
          <span>APY: {data.staking.apy}%</span>
          {data.staking.lockedUntil && <span>Locked until: {new Date(data.staking.lockedUntil).toLocaleDateString()}</span>}
        </div>
      </div>

      {/* Payments */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Payment History</h3>
        {data.payments.length === 0 ? (
          <p className="text-slate-500 text-sm">No payments yet</p>
        ) : (
          <div className="space-y-2">
            {data.payments.map((p) => (
              <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0">
                <div>
                  <p className="text-sm text-slate-200">{p.description}</p>
                  <p className="text-xs text-slate-500">{p.date} • {p.token}</p>
                </div>
                <span className={`text-sm font-medium ${p.status === 'completed' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  ${p.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
