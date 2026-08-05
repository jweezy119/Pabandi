import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { textSearchService } from '../services/api';
import { tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';
import profilesJson from '../data/profiles.json';

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

function getProfiles(category?: string): Profile[] {
  const list = profilesJson as Profile[];
  if (!category || category === 'all') return list;
  return list.filter(p => p.category === category);
}

export default function FreelancePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [queryDraft, setQueryDraft] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [profileCategory, setProfileCategory] = useState<string>('all');
  const [profileSearch, setProfileSearch] = useState('');

  const filteredProfiles = getProfiles(profileCategory).filter((p: Profile) => {
    if (!profileSearch.trim()) return true;
    const q = profileSearch.toLowerCase();
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
    <div className="min-h-screen font-body relative" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .anim-fade-up { animation: fadeUp .45s ease-out both; }
        .anim-delay-1 { animation-delay: .05s; }
        .anim-delay-2 { animation-delay: .12s; }
        .anim-delay-3 { animation-delay: .18s; }
        .card-lift { transition: transform .2s ease, box-shadow .2s ease; }
        .card-lift:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(0,0,0,0.25); }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <section className="relative overflow-hidden rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10 anim-fade-up">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="font-headline text-2xl sm:text-3xl md:text-4xl font-black">Freelance</h1>
                <p className="mt-2 text-sm sm:text-base text-on-surface-variant max-w-2xl">
                  Verified freelancers and independent creators, searchable by skill, rate, and availability. Every profile includes a Pabandi Passport trust score and escrow-backed booking.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isAuthenticated && (
                  <Link to="/login" className="px-4 py-2.5 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm">Log in to book</Link>
                )}
                <Link to="/search?category=FREELANCE" className="px-4 py-2.5 rounded-2xl border border-outline-variant/20 bg-surface-container-high font-headline font-bold text-sm">Browse freelancers</Link>
              </div>
            </div>

            <div className="mt-4">
              <input
                value={queryDraft}
                onChange={(e) => {
                  setQueryDraft(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const q = queryDraft.trim();
                    if (q) navigate({ pathname: '/search', search: `?category=FREELANCE&q=${encodeURIComponent(q)}` });
                    else navigate({ pathname: '/search', search: '?category=FREELANCE' });
                  }
                }}
                placeholder="Try: React developer, wedding photographer, tutor"
                className="w-full p-3 sm:p-4 rounded-2xl bg-surface-container-low/80 border border-outline-variant/20 text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {showDropdown && (
                <FreelanceSuggestions query={queryDraft} onSelect={(q) => {
                  navigate({ pathname: '/search', search: `?category=FREELANCE&q=${encodeURIComponent(q)}` });
                  setQueryDraft(q);
                  setShowDropdown(false);
                }} />
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 anim-fade-up anim-delay-1">
          {[
            { title: 'Design', examples: 'UI/UX, branding, motion', href: '/search?category=FREELANCE&q=designer' },
            { title: 'Engineering', examples: 'React, Node, AI/ML', href: '/search?category=FREELANCE&q=developer' },
            { title: 'Creative', examples: 'Video, photo, audio', href: '/search?category=FREELANCE&q=photographer' },
            { title: 'Biz support', examples: 'CRM, ops, growth', href: '/search?category=FREELANCE&q=ops' },
          ].map((item) => (
            <Link key={item.title} to={item.href} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 hover:bg-surface-container-high active:scale-[0.99] transition-colors card-lift">
              <p className="font-headline font-bold text-sm">{item.title}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">{item.examples}</p>
            </Link>
          ))}
        </section>

        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10 anim-fade-up anim-delay-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="font-headline text-lg sm:text-xl font-bold">Seeded profiles</h2>
            <input
              value={profileSearch}
              onChange={(e) => setProfileSearch(e.target.value)}
              placeholder="Search profiles..."
              className="w-full sm:w-72 rounded-2xl border border-outline-variant/20 bg-surface-container-high p-3 text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['all', ...categories.map(([k]) => k)].map((cat) => (
              <button
                key={cat}
                onClick={() => setProfileCategory(cat)}
                className={`px-3 py-2 rounded-2xl text-xs font-bold border transition-colors ${
                  profileCategory === cat
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-on-surface border-outline-variant/20 hover:bg-surface-container-high'
                }`}
              >
                {cat === 'all' ? 'All' : `${CATEGORY_META[cat]?.emoji || ''} ${CATEGORY_META[cat]?.label || cat}`}
              </button>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredProfiles.map((p, idx) => (
              <Link key={p.id} to={`/profiles/${p.id}`} className={`block rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 card-lift anim-fade-up ${idx < 6 ? 'anim-delay-' + Math.min(idx, 3) : ''}`}>
                <p className="font-headline font-bold text-sm">{`${CATEGORY_META[p.category]?.emoji || '👤'} ${p.firstName} ${p.lastName}`}</p>
                <p className="text-xs text-on-surface-variant mt-1">{p.headline}</p>
                <p className="text-xs text-on-surface-variant mt-1">{`${p.company} ${p.location}`}</p>
                {p.walletAddress && (
                  <p className="text-[11px] text-primary mt-2 font-mono">{`Wallet: ${p.walletAddress.substring(0, 8)}...${p.walletAddress.substring(p.walletAddress.length - 6)}`}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function FreelanceSuggestions({ query, onSelect }: { query: string; onSelect: (q: string) => void }) {
  const { data } = useQuery(['freelance-suggestions', query], async () => {
    const q = String(query || '');
    if (!q || q.length < 2) return [];
    const res = await textSearchService.getSuggestions(q);
    return (((res as any)?.data?.data?.suggestions) as string[]) || [];
  }, { enabled: query.trim().length >= 2 });
  const items = (data || []).slice(0, 6);
  if (!items.length) return null;
  return (
    <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-outline-variant/20 bg-surface shadow-xl shadow-black/40 z-30 overflow-hidden">
      {items.map((suggestion, idx) => (
        <button
          key={`${suggestion}-${idx}`}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(suggestion);
          }}
          className="w-full text-left px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-high"
        >
          <span className="text-primary mr-2">🔎</span>
          {suggestion}
        </button>
      ))}
    </div>
  );
}
