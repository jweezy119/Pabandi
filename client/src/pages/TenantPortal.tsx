import React from 'react';
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
  const [data, setData] = React.useState<DashboardData | null>(null);

  React.useEffect(() => {
    // Simulated data — in production, fetch from /api/v1/crm-pab/balance etc.
    setData({
      balance: { usdc: 2450.0, pabTokens: 15000, pabValueUsd: 2.67, totalUsd: 2452.67 },
      staking: { tier: 'SILVER', trustBoost: 15, apy: 8.5, lockedUntil: '2026-12-15T00:00:00Z' },
      payments: [
        { id: '1', amount: 1850, token: 'USDC', status: 'completed', date: '2026-09-01', description: 'Monthly Rent' },
        { id: '2', amount: 1850, token: 'USDC', status: 'completed', date: '2026-08-01', description: 'Monthly Rent' },
        { id: '3', amount: 1757.5, token: 'PAB', status: 'completed', date: '2026-07-01', description: 'Monthly Rent (5% discount)' },
      ],
      pending: [
        { id: '1', type: 'rent', title: 'Rent Due October', dueDate: '2026-10-01', amount: 1850 },
        { id: '2', type: 'maintenance', title: 'Plumbing inspection follow-up', dueDate: '2026-09-25' },
      ],
      lease: { monthlyRent: 1850, nextDue: '2026-10-01', daysUntilDue: 11 },
    });
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tierGradient = TIER_COLORS[data.staking.tier] || 'from-slate-500 to-slate-700';
  const tierLabel = TIER_LABELS[data.staking.tier] || 'Starter';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-1">Your rental dashboard at a glance</p>
        </div>
        <Link
          to="/tenant-portal/pay-rent"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">payments</span>
          Pay Rent
        </Link>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border border-emerald-500/20 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-1">Total Balance</div>
            <div className="text-3xl font-bold text-white">${data.balance.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">USDC</span>
                <span className="text-white font-medium">${data.balance.usdc.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">PAB Value</span>
                <span className="text-white font-medium">${data.balance.pabValueUsd.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Staking Card */}
        <div className={`rounded-2xl bg-gradient-to-br ${tierGradient} p-6 relative overflow-hidden`}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative">
            <div className="text-xs font-medium text-white/70 uppercase tracking-wider mb-1">Trust Tier</div>
            <div className="text-2xl font-bold text-white">{tierLabel}</div>
            <div className="mt-3 flex items-center gap-4">
              <div>
                <div className="text-xs text-white/60">Boost</div>
                <div className="text-white font-semibold">+{data.staking.trustBoost}%</div>
              </div>
              <div>
                <div className="text-xs text-white/60">APY</div>
                <div className="text-white font-semibold">{data.staking.apy}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Next Payment */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="text-xs font-medium text-purple-400 uppercase tracking-wider mb-1">Next Payment</div>
          <div className="text-3xl font-bold text-white">${data.lease.monthlyRent.toLocaleString()}</div>
          <div className="mt-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              data.lease.daysUntilDue <= 5 ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {data.lease.daysUntilDue} days
            </span>
            <span className="text-slate-400 text-sm ml-2">due {new Date(data.lease.nextDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Pending Actions */}
      {data.pending.length > 0 && (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <h2 className="text-lg font-bold text-white mb-4">Pending Actions</h2>
          <div className="space-y-3">
            {data.pending.map((action) => (
              <div key={action.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-emerald-500/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    action.type === 'rent' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    <span className="material-symbols-outlined text-[20px]">
                      {action.type === 'rent' ? 'home' : 'build'}
                    </span>
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{action.title}</div>
                    {action.dueDate && (
                      <div className="text-slate-400 text-xs">
                        {new Date(action.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </div>
                {action.amount && (
                  <div className="text-white font-bold">${action.amount.toLocaleString()}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: '/tenant-portal/pay-rent', icon: 'payments', label: 'Pay Rent', color: 'emerald' },
            { to: '/tenant-portal/maintenance', icon: 'build', label: 'Maintenance', color: 'amber' },
            { to: '/tenant-portal/lease', icon: 'description', label: 'View Lease', color: 'purple' },
            { to: '/tenant-portal/staking', icon: 'account_balance', label: 'Stake PAB', color: 'cyan' },
          ].map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl bg-${action.color}-500/20 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <span className={`material-symbols-outlined text-${action.color}-400`}>{action.icon}</span>
              </div>
              <span className="text-slate-300 text-xs font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Payment History */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Payment History</h2>
          <Link to="/tenant-portal/history" className="text-emerald-400 text-sm hover:underline">View all</Link>
        </div>
        <div className="space-y-2">
          {data.payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  payment.status === 'completed' ? 'bg-emerald-400' : payment.status === 'pending' ? 'bg-amber-400' : 'bg-red-400'
                }`} />
                <div>
                  <div className="text-white text-sm font-medium">{payment.description}</div>
                  <div className="text-slate-500 text-xs">{new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-semibold text-sm">${payment.amount.toLocaleString()}</div>
                <div className="text-slate-500 text-xs">{payment.token}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
