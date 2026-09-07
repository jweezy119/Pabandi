import React, { useState } from 'react';
import { tokens, Surface, Button, Badge } from '../design-system';

interface PromoBooking {
  id: string;
  date: string;
  venue: string;
  guest: string;
  commission: number;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  bookings: number;
  commission: number;
}

const MOCK_RECENT_BOOKINGS: PromoBooking[] = [
  { id: '1', date: '2026-09-05', venue: 'Eclipse Nightclub', guest: 'Mike R.', commission: 45 },
  { id: '2', date: '2026-09-03', venue: 'Skyline Rooftop', guest: 'Sarah K.', commission: 30 },
  { id: '3', date: '2026-09-01', venue: 'Velvet Lounge', guest: 'James T.', commission: 25 },
  { id: '4', date: '2026-08-28', venue: 'Bass Drop', guest: 'Lisa M.', commission: 60 },
  { id: '5', date: '2026-08-25', venue: 'Neon Garden', guest: 'Tom W.', commission: 50 },
];

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: 'Alex M.', bookings: 47, commission: 2350 },
  { rank: 2, name: 'Jordan K.', bookings: 38, commission: 1900 },
  { rank: 3, name: 'Sam L.', bookings: 29, commission: 1450 },
  { rank: 4, name: 'Casey R.', bookings: 22, commission: 1100 },
  { rank: 5, name: 'Riley P.', bookings: 18, commission: 900 },
];

const TIER_THRESHOLDS = { Bronze: 0, Silver: 500, Gold: 1500, Platinum: 5000 };

export const PromoterDashboardPage: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const referralLink = 'https://pabandi.com/r/PROMO2026';
  const currentTier = 'Silver';
  const totalCommission = 1250;
  const nextTier = 'Gold';
  const nextTierThreshold = TIER_THRESHOLDS[nextTier as keyof typeof TIER_THRESHOLDS];
  const progress = (totalCommission / nextTierThreshold) * 100;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = [
    { label: 'Total Bookings', value: '24', icon: 'confirmation_number', color: 'text-indigo-300' },
    { label: 'Total Commission', value: `$${totalCommission}`, icon: 'payments', color: 'text-emerald-300' },
    { label: 'Conversion Rate', value: '18.5%', icon: 'trending_up', color: 'text-amber-300' },
    { label: 'Active Promo Code', value: 'PROMO2026', icon: 'local_offer', color: 'text-purple-300' },
  ];

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 60%)' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Promoter Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Track your referrals, commissions, and tier progress</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(stat => (
            <Surface key={stat.label} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`material-symbols-outlined ${stat.color}`}>{stat.icon}</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{stat.value}</p>
              <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>{stat.label}</p>
            </Surface>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Referral Link */}
          <Surface className="p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-300">link</span>
              Your Referral Link
            </h3>
            <div className="flex gap-2 mb-4">
              <input
                value={referralLink}
                readOnly
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-100 text-sm font-mono"
              />
              <Button variant="ghost" onClick={handleCopy}>
                <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-slate-400">share</span>
                <span className="text-xs" style={{ color: tokens.color.muted }}>Share on social media</span>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <span className="material-symbols-outlined text-slate-400 text-sm">mail</span>
                </button>
                <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <span className="material-symbols-outlined text-slate-400 text-sm">chat</span>
                </button>
                <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <span className="material-symbols-outlined text-slate-400 text-sm">link</span>
                </button>
              </div>
            </div>
          </Surface>

          {/* Tier Badge */}
          <Surface className="p-5">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">Current Tier</h3>
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-400/30 flex items-center justify-center mx-auto mb-2">
                <span className="material-symbols-outlined text-amber-300 text-3xl">workspace_premium</span>
              </div>
              <Badge tone="warning" className="text-sm">{currentTier}</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span style={{ color: tokens.color.muted }}>Progress to {nextTier}</span>
                <span className="text-slate-100">${totalCommission} / ${nextTierThreshold}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <p className="text-xs text-center" style={{ color: tokens.color.muted }}>${nextTierThreshold - totalCommission} more to unlock {nextTier}</p>
            </div>
          </Surface>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Bookings Table */}
          <Surface className="p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-300">history</span>
              Recent Bookings
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-xs font-medium text-slate-400 pb-2">Date</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-2">Venue</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-2">Guest</th>
                    <th className="text-right text-xs font-medium text-slate-400 pb-2">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_RECENT_BOOKINGS.map(booking => (
                    <tr key={booking.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5 text-xs text-slate-300">{booking.date}</td>
                      <td className="py-2.5 text-xs text-slate-100">{booking.venue}</td>
                      <td className="py-2.5 text-xs text-slate-300">{booking.guest}</td>
                      <td className="py-2.5 text-xs text-emerald-300 text-right font-medium">${booking.commission}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>

          {/* Wallet & Leaderboard */}
          <div className="space-y-6">
            {/* Wallet */}
            <Surface className="p-5">
              <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-300">account_balance_wallet</span>
                Wallet
              </h3>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-emerald-300">${totalCommission}</p>
                <p className="text-xs" style={{ color: tokens.color.muted }}>Available Balance</p>
              </div>
              <Button className="w-full" variant="outline">
                <span className="material-symbols-outlined text-sm">arrow_downward</span>
                Withdraw Funds
              </Button>
            </Surface>

            {/* Leaderboard */}
            <Surface className="p-5">
              <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-300">emoji_events</span>
                Top Promoters
              </h3>
              <div className="space-y-3">
                {MOCK_LEADERBOARD.map(entry => (
                  <div key={entry.rank} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${entry.rank === 1 ? 'bg-amber-500/20 text-amber-300' : entry.rank === 2 ? 'bg-slate-400/20 text-slate-300' : entry.rank === 3 ? 'bg-orange-500/20 text-orange-300' : 'bg-white/5 text-slate-400'}`}>
                      {entry.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-100 truncate">{entry.name}</p>
                      <p className="text-[10px]" style={{ color: tokens.color.muted }}>{entry.bookings} bookings</p>
                    </div>
                    <span className="text-xs font-medium text-emerald-300">${entry.commission}</span>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoterDashboardPage;
