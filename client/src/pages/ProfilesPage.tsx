import profiles from '../data/profiles.json';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { tokens } from '../design-system';

type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  company: string;
  location: string;
  category: string;
  githubUrl: string;
  walletAddress: string;
  trustVelocity: number;
  connectionCount: number;
};

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  'freelance-dev': { label: 'Freelance Devs', emoji: '💻' },
  'small-biz-owner': { label: 'Small Business Owners', emoji: '🏪' },
  'project-owner': { label: 'Project Owners', emoji: '🏗️' },
  'solopreneur': { label: 'Solopreneurs', emoji: '🚀' },
};

export function getProfiles(category?: string): Profile[] {
  const list = profiles as Profile[];
  if (!category || category === 'all') return list;
  return list.filter(p => p.category === category);
}

export function getProfile(id: string): Profile | undefined {
  return (profiles as Profile[]).find(p => p.id === id);
}

export default function ProfilesPage() {
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = getProfiles(category).filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.headline.toLowerCase().includes(q) ||
      p.company.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q)
    );
  });

  const categories = Object.entries(CATEGORY_META);

  return (
    <div className="min-h-screen font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <h1 className="font-headline text-2xl sm:text-3xl md:text-4xl font-black">Pabandi Network</h1>
          <p className="mt-2 text-sm sm:text-base text-on-surface-variant max-w-2xl">
            Real verified professionals and businesses on Pabandi. Book services, collect rewards, and grow trust.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {['all', ...categories.map(([k]) => k)].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-2 rounded-2xl text-xs font-bold border transition-colors ${
                  category === cat
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-on-surface border-outline-variant/20 hover:bg-surface-container-high'
                }`}
              >
                {cat === 'all' ? 'All' : `${CATEGORY_META[cat]?.emoji || ''} ${CATEGORY_META[cat]?.label || cat}`}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search profiles..."
              className="w-full rounded-2xl border border-outline-variant/20 bg-surface-container-high p-3 text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Total Profiles</p>
            <p className="font-headline font-black text-2xl mt-1">{String(profiles.length)}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Wallets Created</p>
            <p className="font-headline font-black text-2xl mt-1">{String(profiles.filter(p => p.walletAddress).length)}</p>
            <p className="text-[11px] text-on-surface-variant mt-1">{String(profiles.length)} total</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">$PAB Funded</p>
            <p className="font-headline font-black text-2xl mt-1">{Number(profiles.length * 100).toLocaleString()}</p>
          </div>
        </section>

        <section>
          <h2 className="font-headline text-lg sm:text-xl font-bold mb-3">Profiles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((p) => (
              <Link key={p.id} to={`/profiles/${p.id}`} className="block rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 hover:bg-surface-container-high active:scale-[0.99] transition-colors">
                <p className="font-headline font-bold text-sm">{(CATEGORY_META[p.category]?.emoji || '👤')} {p.firstName} {p.lastName}</p>
                <p className="text-xs text-on-surface-variant mt-1">{p.headline}</p>
                <p className="text-xs text-on-surface-variant mt-1">{p.company} {p.location}</p>
                {p.walletAddress && <p className="text-[11px] text-primary mt-2 font-mono">Wallet: {p.walletAddress.substring(0, 8)}...{p.walletAddress.substring(p.walletAddress.length - 6)}</p>}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
