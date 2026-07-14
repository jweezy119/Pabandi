import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { businessService } from '../services/api';
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";

const CATEGORIES = [
  'ALL',
  'RESTAURANT',
  'HOTEL',
  'PROPERTY_RENTAL',
  'EVENT_VENUE',
  'OTHER',
];

const CATEGORY_LABELS: Record<string, string> = {
  ALL: 'All stays',
  RESTAURANT: 'Restaurants',
  HOTEL: 'Hotels',
  PROPERTY_RENTAL: 'Short-term rental',
  EVENT_VENUE: 'Event venues',
  OTHER: 'Other',
};

function haversineKm(a: { lat: number; lng: number }, b: { lat?: number | null; lng?: number | null }) {
  if (typeof a.lat !== 'number' || typeof a.lng !== 'number' || typeof b.lat !== 'number' || typeof b.lng !== 'number') return Infinity;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default function HospitalityPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const category = (searchParams.get('category') || 'ALL') as string;

  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLoc({ lat: 41.8781, lng: -87.6298 }),
        { timeout: 5000 }
      );
    }
  }, []);

  const { data, isLoading } = useQuery(
    ['hospitality', q, category, userLoc],
    async () => {
      const params: Record<string, string> = { search: q || 'hospitality', category };
      if (userLoc) {
        params.latitude = String(userLoc.lat);
        params.longitude = String(userLoc.lng);
      }
      const res = await businessService.getPublicBusinesses(params);
      const items = (res?.data?.data?.businesses || []) as any[];
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const b of items) {
        const key = b.id || `${b.name}-${b.address || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(b);
      }
      return deduped;
    },
    { keepPreviousData: true }
  );

  const results = useMemo(() => {
    const base = data || [];
    if (!userLoc) return base;
    return base
      .map((b) => ({ b, meters: haversineKm(userLoc, { lat: b.latitude ?? null, lng: b.longitude ?? null }) * 1000 }))
      .sort((a, b) => a.meters - b.meters)
      .map((x) => x.b);
  }, [data, userLoc]);

  const distanceLabel = (b: any) => {
    if (!userLoc) return '';
    const m = haversineKm(userLoc, { lat: b.latitude ?? null, lng: b.longitude ?? null }) * 1000;
    if (!Number.isFinite(m)) return '';
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1)} km`;
  };

  const title = useMemo(() => {
    if (category === 'ALL') return q ? `“${q}”` : 'Hospitality';
    return CATEGORY_LABELS[category] || category;
  }, [q, category]);

  useEffect(() => {
    document.title = `${title} · Pabandi`;
  }, [title]);

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">

        {/* HERO/CONTEXT */}
        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <div className="flex items-center gap-3 mb-3">
            <BuildingOffice2Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="font-headline text-3xl sm:text-4xl md:text-5xl font-black leading-[1.05]">{title}</h1>
          </div>
          <p className="text-on-surface-variant max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed">
            Book hospitality with trust. Escrow-backed reservations, verified properties, and $PAB rewards for reliable bookings.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link to="/search?category=HOTEL" className="px-4 py-3 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm sm:text-base">Explore hotels</Link>
            <Link to="/search?category=PROPERTY_RENTAL" className="px-4 py-3 rounded-2xl border border-outline-variant/20 hover:bg-surface-container-high active:scale-[0.99] transition-colors font-headline font-bold text-sm sm:text-base">Short-term rentals</Link>
          </div>
        </section>

        {/* FILTERS */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
            <h2 className="font-headline text-xl sm:text-2xl font-bold">Browse</h2>
            <span className="text-xs text-on-surface-variant">{isLoading ? 'Searching…' : `${results.length} result${results.length === 1 ? '' : 's'}`}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => window.history.replaceState(null, '', `/hospitality?category=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ''}`)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                  category === c ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {CATEGORY_LABELS[c] || c}
              </button>
            ))}
          </div>
        </section>

        {/* RESULTS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map((biz: any) => (
            <Link
              key={biz.id || `${biz.name}-${biz.address}`}
              to={`/business/${biz.id}`}
              className="block rounded-3xl border border-outline-variant/10 bg-surface-container-low hover:bg-surface-container-high active:scale-[0.99] transition-all"
            >
              <div
                className="h-36 sm:h-40 rounded-t-3xl"
                style={{
                  backgroundImage: biz.coverImageUrl ? `url(${biz.coverImageUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div className="p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-headline font-bold text-sm leading-snug">{biz.name}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5 truncate">{biz.city || ''}{biz.address ? ` · ${biz.address}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-1 rounded">{biz.category}</p>
                    {typeof biz.rating === 'number' && (
                      <p className="text-[10px] font-bold text-on-surface-variant mt-1">{biz.rating.toFixed(1)} ★ {biz.reviewCount || 0}</p>
                    )}
                    {distanceLabel(biz) && <p className="text-[10px] font-bold text-on-surface-variant mt-1">{distanceLabel(biz)}</p>}
                  </div>
                </div>
                {biz.description && <p className="text-xs text-on-surface-variant line-clamp-2 mt-2">{biz.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}