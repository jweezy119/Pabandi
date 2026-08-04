import { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { linkedinSeedService } from '../services/api';
import { tokens } from '../design-system';

type Category = 'freelance-dev' | 'small-biz-owner' | 'project-owner' | 'solopreneur';

const CATEGORY_META: Record<Category, { label: string; emoji: string; href: string }> = {
  'freelance-dev': { label: 'Freelance Devs', emoji: '💻', href: '/profiles/freelance-dev' },
  'small-biz-owner': { label: 'Small Business Owners', emoji: '🏪', href: '/profiles/small-biz-owner' },
  'project-owner': { label: 'Project Owners', emoji: '🏗️', href: '/profiles/project-owner' },
  'solopreneur': { label: 'Solopreneurs', emoji: '🚀', href: '/profiles/solopreneur' },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function ProfilesPage() {
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');

  const { data, isLoading } = useQuery(
    ['linkedin-seed-stats'],
    async () => {
      const res = await linkedinSeedService.getStats();
      return (res?.data?.data) as any;
    },
    { refetchInterval: 30000 }
  );

  const categories = useMemo(() => {
    const raw = (data?.categories || {}) as Record<string, any>;
    const out: { key: string; label: string; emoji: string; count: number; href: string }[] = [];
    for (const [key, value] of Object.entries(raw)) {
      const meta = CATEGORY_META[key as Category];
      out.push({
        key,
        label: meta?.label || key,
        emoji: meta?.emoji || '👤',
        href: meta?.href || `/profiles/${key}`,
        count: typeof value === 'number' ? value : (value as any)?.count || 0,
      });
    }
    return out.sort((a, b) => b.count - a.count);
  }, [data]);

  const totalSeeded = data?.totalSeeded ?? 0;
  const walletCoverage = data?.walletCoverage ?? { total: 0, withWallet: 0 };
  const totalFundedPab = data?.totalFundedPab ?? 0;
  const economy: any = data?.economy ?? null;

  return (
    <div className="min-h-screen font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="font-headline text-2xl sm:text-3xl md:text-4xl font-black">Pabandi Network</h1>
              <p className="mt-2 text-sm sm:text-base text-on-surface-variant max-w-2xl">
                Real verified professionals and businesses on Pabandi. Book services, collect rewards, and grow trust.
              </p>
            </div>
            <div className="flex gap-2">
              {(['all', ...Object.keys(CATEGORY_META)] as Array<Category | 'all'>).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-2 rounded-2xl text-xs font-bold border transition-colors ${
                    categoryFilter === cat
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-low text-on-surface border-outline-variant/20 hover:bg-surface-container-high'
                  }`}
                >
                  {cat === 'all' ? 'All' : (CATEGORY_META[cat as Category]?.label || cat)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Total Profiles</p>
            <p className="font-headline font-black text-2xl mt-1">{String(totalSeeded)}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Wallets Created</p>
            <p className="font-headline font-black text-2xl mt-1">{String(walletCoverage.withWallet)}</p>
            <p className="text-[11px] text-on-surface-variant mt-1">{String(walletCoverage.total)} total</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">$PAB Funded</p>
            <p className="font-headline font-black text-2xl mt-1">{Number(totalFundedPab).toLocaleString()}</p>
          </div>
        </section>

        {economy && (
          <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
            <h2 className="font-headline text-xl sm:text-2xl font-bold mb-2">Self-Economy</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Bookings</p>
                <p className="font-headline font-black text-xl">{String(economy.totalBookings ?? 0)}</p>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Fees Collected</p>
                <p className="font-headline font-black text-xl">{String(economy.totalFeesCollected ?? 0)} PAB</p>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Rewards</p>
                <p className="font-headline font-black text-xl">{String(economy.totalRewardsPaid ?? 0)} PAB</p>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Last Run</p>
                <p className="font-headline font-black text-xl">{typeof economy.lastRunAt === 'string' ? formatDate(economy.lastRunAt) : '—'}</p>
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-headline text-lg sm:text-xl font-bold">Categories</h2>
          </div>
          {isLoading && <p className="text-sm text-on-surface-variant">Loading...</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <Link key={cat.key} to={categoryFilter === 'all' || categoryFilter === cat.key ? cat.href : `/profiles?category=${cat.key}`} className="block rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 hover:bg-surface-container-high active:scale-[0.99] transition-colors">
                <p className="font-headline font-bold text-sm">{cat.emoji} {cat.label}</p>
                <p className="text-xs text-on-surface-variant mt-1">{String(cat.count)} profiles</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
