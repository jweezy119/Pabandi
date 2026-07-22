import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  UserGroupIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export default function PartnerDashboardPage() {
  const { user } = useAuthStore();
  const isPartner = useMemo(() => ['PARTNER', 'ADMIN'].includes(user?.role || ''), [user?.role]);

  const inviteLink = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/register?ref=${user?.id || 'partner'}`;
  }, [user?.id]);

  if (!user || !isPartner) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-surface text-on-surface p-6">
        <div className="text-center max-w-sm bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20 shadow-sm">
          <h3 className="font-headline font-bold text-lg mb-2">Partner access required</h3>
          <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
            This dashboard is for approved Growth Partners. Request access to start tracking referrals and commissions.
          </p>
          <Link to="/business/join" className="w-full bg-primary text-on-primary font-headline text-sm font-bold py-2.5 rounded-xl hover:opacity-90 transition-opacity block">
            Apply for Partner Program
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen text-on-surface flex flex-col">
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 mb-24 md:mb-8 flex flex-col gap-6 sm:gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-headline text-[2rem] font-bold text-primary tracking-tight leading-tight">
            Growth Partner Hub
          </h1>
          <p className="font-body text-on-surface-variant text-sm">
            Track referrals, verified sign-ups, and commission estimates.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatChip label="Invited" value={0} icon={<UserGroupIcon className="h-5 w-5" />} />
          <StatChip label="Verified" value={0} icon={<SparklesIcon className="h-5 w-5" />} />
          <StatChip label="Payouts" value={0} icon={<CurrencyDollarIcon className="h-5 w-5" />} />
          <StatChip label="7d Earnings" value="$0" icon={<ArrowTrendingUpIcon className="h-5 w-5" />} />
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-on-surface mb-3">Your invite link</h2>
          <p className="text-xs text-on-surface-variant mb-3">Share this link merchants can use to sign up.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input readOnly value={inviteLink} className="input-field flex-1" />
          </div>
          <p className="text-[11px] text-on-surface-variant mt-2">Commission applies to verified cleared bookings only.</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-on-surface mb-3">Program terms</h2>
          <ul className="space-y-1 text-sm text-on-surface-variant">
            <li>• Bounty: $5 per verified account sign-up</li>
            <li>• Commission: 3% of verified completed booking escrow value</li>
            <li>• Limits: $250 monthly per-merchant payout, $5,000 global monthly cap</li>
            <li>• Decay: Year 1 3%, Year 2 2%, Year 3+ 1%</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

function StatChip({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
          <p className="font-headline text-2xl font-bold text-on-surface leading-none">{value}</p>
        </div>
      </div>
    </div>
  );
}
