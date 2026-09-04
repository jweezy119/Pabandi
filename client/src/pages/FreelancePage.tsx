import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { textSearchService, businessService } from '../services/api';
import { tokens, GlassCard } from '../design-system';
import PageHeader from '../components/PageHeader';
import { useAuthStore } from '../store/authStore';

type BadgeType = 'genesis-partner' | 'early-adopter' | 'trust-flux';

const BADGE_META: Record<BadgeType, { label: string; price: number; color: string; icon: string; desc: string }> = {
  'genesis-partner': { label: 'Genesis Partner', price: 50, color: 'from-amber-500 to-orange-600', icon: '👑', desc: 'Founding member badge — highest trust weight' },
  'early-adopter': { label: 'Early Adopter', price: 20, color: 'from-blue-500 to-indigo-600', icon: '⚡', desc: 'Early ecosystem participant — priority access' },
  'trust-flux': { label: 'Trust Flux', price: 10, color: 'from-emerald-500 to-teal-600', icon: '🔄', desc: 'Trust signal badge — boosted visibility' },
};

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  'freelance-dev': { label: 'Freelance Devs', emoji: '💻' },
  'small-biz-owner': { label: 'Small Business Owners', emoji: '🏪' },
  'project-owner': { label: 'Project Owners', emoji: '🏗️' },
  'solopreneur': { label: 'Solopreneurs', emoji: '🚀' },
};

function ProfileSkeletonCard() {
  return (
    <GlassCard hover={false} lift={false}>
      <div className="flex items-start gap-3 p-4">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-white/10" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
          <div className="mt-2 flex gap-1">
            <div className="h-6 w-20 animate-pulse rounded-full bg-white/10" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function FreelanceSuggestions({ query, onSelect }: { query: string; onSelect: (q: string) => void }) {
  const { data } = useQuery(['freelance-suggestions', query], async () => {
    if (!query.trim()) return [];
    const res = await textSearchService.getSuggestions(query);
    return res.data?.data || [];
  });

  if (!data || !data.length) return null;

  return (
    <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface shadow-xl shadow-black/40">
      {data.map((item: any) => (
        <button
          key={item}
          type="button"
          className="w-full text-left px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-high"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export default function FreelancePage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [queryDraft, setQueryDraft] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [profileCategory, setProfileCategory] = useState<string>('all');
  const [profileSearch, setProfileSearch] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 120);
    return () => clearTimeout(t);
  }, []);

  // Live data: pull real FREELANCE businesses from the backend (same source as /search).
  const { data: freelanceBiz = [] } = useQuery(['freelance-businesses'], async () => {
    const res = await businessService.getPublicBusinesses({ category: 'FREELANCE', limit: 60 });
    return (res?.data?.data?.businesses || []) as any[];
  });
  const toProfile = (b: any) => {
    const ext = b.externalDetails || {};
    return {
      id: b.id,
      firstName: (b.name || '').split(' ')[0] || 'Pro',
      lastName: (b.name || '').split(' ').slice(1).join(' ') || '',
      headline: ext.headline || b.description || b.category,
      company: b.city || 'Remote',
      location: b.address || b.city || 'Remote',
      category: ext.category || b.category,
      rate: ext.hourlyRate || 65,
      skills: ext.skills || ['React', 'TypeScript', 'Node.js'],
      trustBand: ext.trustBand || 'A',
      trustScore: b.trustScore || 92,
      availability: ext.availability || 'Available',
      portfolioCount: (ext.portfolio || []).length,
    };
  };
  const filteredProfiles = (freelanceBiz as any[]).map(toProfile).filter((p: any) => {
    if (profileCategory !== 'all' && p.category !== profileCategory) return false;
    if (!profileSearch.trim()) return true;
    const q = profileSearch.toLowerCase();
    return (
      (p.firstName + ' ' + p.lastName + ' ' + p.headline + ' ' + p.company + ' ' + p.location + ' ' + p.skills.join(' ')).toLowerCase().includes(q)
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
        <PageHeader
          title="Freelance"
          description="Verified freelancers and independent creators, searchable by skill, rate, and availability. Every profile includes a Pabandi Passport trust score and escrow-backed booking."
          eyebrow="Network"
          actions={
            <>
              {!isAuthenticated && <Link to="/login" className="px-4 py-2.5 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm">Log in to book</Link>}
              <Link to="/search?category=FREELANCE" className="px-4 py-2.5 rounded-2xl border border-outline-variant/20 bg-surface-container-high font-headline font-bold text-sm">Browse freelancers</Link>
            </>
          }
        />

        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10 anim-fade-up anim-delay-1">
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
          {!isAuthenticated && (
            <div className="mt-4 rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4 sm:p-5 anim-fade-up">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-headline font-bold text-sm sm:text-base">Log in to book freelancers with escrow</p>
                  <p className="mt-1 text-xs text-on-surface-variant">Create an account to access verified profiles, trusted payments, and $PAB rewards.</p>
                </div>
                <Link to="/login" className="shrink-0 rounded-2xl bg-primary px-5 py-3 text-center font-headline font-bold text-sm text-on-primary">Log in to book</Link>
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setProfileCategory('all')}
              className={`whitespace-nowrap rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${profileCategory === 'all' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-white hover:bg-white/10'}`}
            >
              All
            </button>
            {categories.map(([key, { label, emoji }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setProfileCategory(key)}
                className={`whitespace-nowrap rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${profileCategory === key ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-white hover:bg-white/10'}`}
              >
                {emoji} {label}
              </button>
            ))}
          </div>

          {/* Badge purchase cards */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.entries(BADGE_META) as [BadgeType, typeof BADGE_META[BadgeType]][]).map(([type, meta]) => (
              <GlassCard key={type} className="p-4 cursor-pointer card-lift" hover>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <p className="font-headline font-bold text-sm">{meta.label}</p>
                    <p className="text-[11px] text-on-surface-variant">{meta.desc}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-headline font-bold text-lg">{meta.price} PAB</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAuthenticated) { navigate('/login'); return; }
                      fetch('/api/v1/linkedin/seed/badge/purchase', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ linkedinId: 'self', badgeType: type, purchaserWallet: 'treasury' }),
                      }).then(r => r.json()).then(res => {
                        if (res.success) alert(`Badge purchased: ${meta.label} for ${meta.price} PAB`);
                        else alert(`Purchase failed: ${res.error}`);
                      }).catch(() => alert('Purchase request failed'));
                    }}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/80 transition-colors"
                  >
                    Buy
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {!isReady && Array.from({ length: 6 }).map((_, idx) => <ProfileSkeletonCard key={`skeleton-${idx}`} />)}
            {isReady && filteredProfiles.map((p, idx) => {
              const initials = `${p.firstName[0]}${p.lastName[0]}`.toUpperCase();
              const bandColor = p.trustBand === 'A' ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10';
              return (
                <GlassCard key={p.id} className={`p-5 anim-fade-up card-lift ${idx < 6 ? 'anim-delay-' + Math.min(idx, 3) : ''}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                        {initials}
                      </div>
                      <div>
                        <h3 className="font-headline font-bold text-base text-white truncate max-w-[180px]">{`${p.firstName} ${p.lastName}`}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          📍 {p.location}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${bandColor}`}>
                      Band {p.trustBand} ({p.trustScore})
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-medium line-clamp-2 mb-3 leading-relaxed">
                    {p.headline}
                  </p>

                  {/* Skills tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {p.skills.slice(0, 4).map((skill: string) => (
                      <span key={skill} className="bg-white/5 border border-white/5 text-slate-300 px-2 py-0.5 rounded-md text-[11px] font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Footer with rate & action */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Rate</span>
                      <p className="text-lg font-black text-white">${p.rate}<span className="text-xs font-normal text-slate-400">/hr</span></p>
                    </div>
                    <Link
                      to={`/business/${p.id}`}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-headline text-xs font-bold shadow-md hover:opacity-90 transition-opacity"
                    >
                      Book Now
                    </Link>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
