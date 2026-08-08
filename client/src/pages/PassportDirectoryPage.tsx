import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { trustPassportService } from '../services/api';
import { tokens } from '../design-system';

const CATS = ['ALL', 'FREELANCER', 'BUILDER', 'FLEET', 'HOA', 'PROPERTY_MANAGER'];
const bandColor: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444',
};

export default function PassportDirectoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = (cat: string, q: string) => {
    setLoading(true);
    trustPassportService
      .list({ category: cat, search: q || undefined })
      .then((r) => setItems(r.data?.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(category, search); /* eslint-disable-next-line */ }, [category]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(category, search);
  };

  return (
    <div className="min-h-screen font-body px-4 sm:px-6 py-10" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .anim-fade-up { animation: fadeUp .4s ease-out both; }
        .card-lift { transition: transform .2s ease, box-shadow .2s ease; }
        .card-lift:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(0,0,0,0.25); }
      `}</style>
      <div className="max-w-5xl mx-auto">
        <div className="anim-fade-up">
          <p className="text-xs uppercase tracking-widest opacity-60 mb-2">Trust Directory</p>
          <h1 className="font-headline text-3xl sm:text-4xl font-bold">Verified Providers</h1>
          <p className="opacity-70 mt-2 max-w-2xl">
            Every provider here carries a Pabandi Trust Passport — background-checked, deposit-backed,
            bond-covered. Browse, then open any passport to request a protected deal.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-6 anim-fade-up">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-xl border text-sm font-semibold ${category === c ? 'tab-on' : ''}`} style={{ borderColor: category === c ? tokens.color.primary : 'rgba(255,255,255,0.15)' }}>
              {c.replace('_', ' ')}
            </button>
          ))}
        </div>
        <form onSubmit={onSearch} className="mt-3 anim-fade-up">
          <input className="input-pab" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 12px', color: 'inherit', width: '100%', outline: 'none' }} placeholder="Search providers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {loading && <p className="opacity-60">Loading…</p>}
          {!loading && items.length === 0 && <p className="opacity-60">No passports yet. Be the first to mint one from the Protected Deposit wizard.</p>}
          {!loading && items.map((p) => (
            <Link key={p.handle} to={`/trust/${p.handle}`} className="card-lift rounded-2xl p-4 anim-fade-up" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none', color: 'inherit' }}>
              <div className="flex items-center justify-between">
                <p className="font-semibold truncate">{p.displayName}</p>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: bandColor[p.trustBand] || '#888', color: '#0a0a0a' }}>{p.trustBand}</span>
              </div>
              <p className="text-xs opacity-60 mt-1">{p.category.replace('_', ' ')} · @{p.handle}</p>
              {p.bio && <p className="text-sm opacity-70 mt-2 line-clamp-2">{p.bio}</p>}
              <p className="text-xs opacity-50 mt-2">{p.claimsCount} verifications</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
