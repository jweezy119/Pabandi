import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { linkedinSeedService } from '../services/api';
import { tokens } from '../design-system';

export default function EconomyDashboardPage() {
  const { data: statsData } = useQuery(['linkedin-seed-stats'], async () => {
    const res = await linkedinSeedService.getStats();
    return (res?.data?.data) as any;
  }, { refetchInterval: 15000 });

  const { data: profilesData } = useQuery(['linkedin-seed-profiles'], async () => {
    const res = await linkedinSeedService.getStats();
    const stats = (res?.data?.data) as any;
    const profilesRes = await fetch(`${(linkedinSeedService as any).__base || ''}/linkedin/seed/profiles`);
    const profilesJson = await profilesRes.json();
    return { stats, profiles: profilesJson?.data?.profiles || [] };
  }, { refetchInterval: 15000 });

  const stats = statsData || profilesData?.stats;
  const profiles = profilesData?.profiles || [];

  const categories = [
    { key: 'freelance-dev', label: 'Freelance Devs', emoji: '💻' },
    { key: 'small-biz-owner', label: 'Small Business Owners', emoji: '🏪' },
    { key: 'project-owner', label: 'Project Owners', emoji: '🏗️' },
    { key: 'solopreneur', label: 'Solopreneurs', emoji: '🚀' },
  ];

  const byCategory = Object.fromEntries(categories.map(c => [c.key, 0]));
  for (const p of profiles) {
    if (byCategory[p.category] !== undefined) byCategory[p.category] += 1;
  }

  const totalBookings = stats?.economy?.bookingsMade ?? stats?.economy?.totalBookings ?? 0;
  const totalFees = stats?.economy?.pabFees ?? stats?.economy?.totalFeesCollected ?? 0;
  const totalRewards = stats?.economy?.pabRewarded ?? stats?.economy?.totalRewardsPaid ?? 0;
  const totalBurned = stats?.economy?.pabBurned ?? 0;
  const lastRun = stats?.economy?.lastRunAt ?? stats?.economy?.lastRunAt ?? null;

  return (
    <div className="min-h-screen font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <h1 className="font-headline text-2xl sm:text-3xl md:text-4xl font-black">Self-Economy</h1>
          <p className="mt-2 text-sm sm:text-base text-on-surface-variant max-w-2xl">
            Autonomous bookings, fees, and $PAB circulation from the seeded network.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/profiles" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-headline font-bold text-sm text-white hover:bg-white/10">
              View Profiles
            </Link>
            <Link to="/search" className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2.5 font-headline font-bold text-sm text-white shadow-sm hover:opacity-90">
              Explore Businesses
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Bookings</p>
            <p className="font-headline font-black text-2xl mt-1">{String(totalBookings)}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Fees Collected</p>
            <p className="font-headline font-black text-2xl mt-1">{Number(totalFees).toLocaleString()} PAB</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Rewards Paid</p>
            <p className="font-headline font-black text-2xl mt-1">{Number(totalRewards).toLocaleString()} PAB</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Burned</p>
            <p className="font-headline font-black text-2xl mt-1">{Number(totalBurned).toLocaleString()} PAB</p>
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <h2 className="font-headline text-xl sm:text-2xl font-bold mb-2">Network Coverage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Total Profiles</p>
              <p className="font-headline font-black text-xl mt-1">{String(stats?.totalSeeded ?? profiles.length)}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Wallets</p>
              <p className="font-headline font-black text-xl mt-1">{String(stats?.walletCoverage?.withWallet ?? 0)} / {String(stats?.walletCoverage?.total ?? profiles.length)}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Last Run</p>
              <p className="font-headline font-black text-xl mt-1">{lastRun ? new Date(lastRun).toLocaleString() : '—'}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <h2 className="font-headline text-xl sm:text-2xl font-bold mb-2">By Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categories.map((cat) => (
              <div key={cat.key} className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
                <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">{cat.emoji} {cat.label}</p>
                <p className="font-headline font-black text-xl mt-1">{String(byCategory[cat.key] ?? 0)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
