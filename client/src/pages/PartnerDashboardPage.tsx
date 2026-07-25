import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  UserGroupIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Surface, Button, tokens } from '../design-system';

function StatChip({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Surface className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">{icon}</div>
      <div>
        <p className="font-label text-[10px] font-bold uppercase tracking-widest text-white/70">{label}</p>
        <p className="font-headline text-2xl font-bold leading-none text-white">{value}</p>
      </div>
    </Surface>
  );
}

export default function PartnerDashboardPage() {
  const { user } = useAuthStore();
  const isPartner = useMemo(() => ['PARTNER', 'ADMIN'].includes(user?.role || ''), [user?.role]);

  const inviteLink = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/register?ref=${user?.id || 'partner'}`;
  }, [user?.id]);

  if (!user || !isPartner) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center shadow-sm">
          <h3 className="mb-2 font-bold text-lg text-white">Partner access required</h3>
          <p className="mb-6 text-xs leading-relaxed text-white/70">
            This dashboard is for approved Growth Partners. Request access to start tracking referrals and commissions.
          </p>
          <Link to="/business/join" className="block w-full rounded-xl bg-indigo-500 py-2.5 text-center font-bold text-white hover:opacity-90 transition-opacity">Apply for Partner Program</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 md:mb-8 flex flex-col gap-6 sm:gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-headline text-[2rem] font-bold tracking-tight text-indigo-300">Growth Partner Hub</h1>
          <p className="font-body text-sm text-white/70">Track referrals, verified sign-ups, and commission estimates.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatChip label="Invited" value={0} icon={<UserGroupIcon className="h-5 w-5" />} />
          <StatChip label="Verified" value={0} icon={<SparklesIcon className="h-5 w-5" />} />
          <StatChip label="Payouts" value={0} icon={<CurrencyDollarIcon className="h-5 w-5" />} />
          <StatChip label="7d Earnings" value="$0" icon={<ArrowTrendingUpIcon className="h-5 w-5" />} />
        </div>

        <Surface>
          <h2 className="font-headline mb-3 text-lg font-bold text-white">Your invite link</h2>
          <p className="mb-3 text-xs text-white/70">Share this link merchants can use to sign up.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly value={inviteLink} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80" />
            <Button onClick={() => navigator.clipboard.writeText(inviteLink)} variant="outline" className="w-full sm:w-auto" type="button">
              Copy
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-white/70">Commission applies to verified cleared bookings only.</p>
        </Surface>

        <Surface>
          <h2 className="font-headline mb-3 text-lg font-bold text-white">Program terms</h2>
          <ul className="space-y-1 text-sm text-white/70">
            <li>• Bounty: $5 per verified account sign-up</li>
            <li>• Commission: 3% of verified completed booking escrow value</li>
            <li>• Limits: $250 monthly per-merchant payout, $5,000 global monthly cap</li>
            <li>• Decay: Year 1 3%, Year 2 2%, Year 3+ 1%</li>
          </ul>
        </Surface>
      </main>
    </div>
  );
}
