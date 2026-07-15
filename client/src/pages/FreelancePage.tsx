import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { textSearchService } from '../services/api';

export default function FreelancePage() {
  const navigate = useNavigate();
  const [queryDraft, setQueryDraft] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <h1 className="font-headline text-2xl sm:text-3xl md:text-4xl font-black">Freelance</h1>
          <p className="mt-2 text-sm sm:text-base text-on-surface-variant max-w-2xl">
            Verified freelancers and independent creators, searchable by skill, rate, and availability. Every profile includes a Pabandi Passport trust score and escrow-backed booking.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/search?category=FREELANCE" className="px-4 py-2.5 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm">Browse freelancers</Link>
          </div>
        </section>

        <section>
          <h2 className="font-headline text-lg sm:text-xl font-bold mb-3">Suggested searches</h2>
          <div className="relative">
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
              className="w-full p-3 sm:p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
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

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { title: 'Design', examples: 'UI/UX, branding, motion', href: '/search?category=FREELANCE&q=designer' },
            { title: 'Engineering', examples: 'React, Node, AI/ML', href: '/search?category=FREELANCE&q=developer' },
            { title: 'Creative', examples: 'Video, photo, audio', href: '/search?category=FREELANCE&q=photographer' },
          ].map((item) => (
            <Link key={item.title} to={item.href} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 hover:bg-surface-container-high active:scale-[0.99] transition-colors">
              <p className="font-headline font-bold text-sm">{item.title}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">{item.examples}</p>
            </Link>
          ))}
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
