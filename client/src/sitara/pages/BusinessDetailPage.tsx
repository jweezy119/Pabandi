// Sitara OS — Venue detail page (Yelp/OpenTable vibe)
// Photos, verified stars, reviews, menu, and one-tap booking.
// /sitara/place/:source/:id
import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { sitaraApi } from '../api/sitaraApi';

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-500 tracking-tight">
      {'★'.repeat(Math.round(value))}
      <span className="text-slate-300">{'★'.repeat(Math.max(0, 5 - Math.round(value)))}</span>
    </span>
  );
}

export default function BusinessDetailPage() {
  const { source = 'foursquare', id = '' } = useParams();
  const navigate = useNavigate();
  const [venue, setVenue] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [menu, setMenu] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, r, p] = await Promise.allSettled([
          sitaraApi.venueDetails(source, id),
          sitaraApi.venueReviews(source, id),
          sitaraApi.venuePhotos(source, id),
        ]);
        if (cancelled) return;
        const vv = v.status === 'fulfilled' ? v.value : null;
        setVenue(vv);
        if (r.status === 'fulfilled' && Array.isArray(r.value)) setReviews(r.value);
        if (p.status === 'fulfilled' && Array.isArray(p.value)) setPhotos(p.value);
        if (vv?.name) {
          sitaraApi
            .venueMenu(vv.name, vv.lat, vv.lng)
            .then((m) => !cancelled && m && setMenu(m))
            .catch(() => {});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent" />
        <p className="mt-2 text-slate-500">Loading place…</p>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-4xl mb-3">📍</p>
        <p className="font-semibold text-slate-900 mb-1">Couldn't load this place</p>
        <button onClick={() => navigate('/sitara')} className="mt-4 px-6 py-2.5 bg-amber-500 text-white font-medium rounded-lg">
          Back to discovery
        </button>
      </div>
    );
  }

  const hero: string =
    photos[0] || venue.imageUrl || venue.photo || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800';
  const rating = Number(venue.rating ?? 0);
  const reviewCount = Number(venue.reviewCount ?? reviews.length ?? 0);
  const mapsUrl =
    venue.lat && venue.lng
      ? `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`
      : venue.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`
        : null;

  return (
    <div className="max-w-3xl mx-auto pb-28 sm:pb-12">
      {/* Hero */}
      <div className="relative h-60 sm:h-80 bg-slate-200">
        <img src={hero} alt={venue.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center bg-white/90 rounded-full text-slate-800 font-bold shadow"
          aria-label="Back"
        >
          ←
        </button>
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{venue.name}</h1>
          <div className="flex items-center gap-2 mt-1.5 text-sm flex-wrap">
            {rating > 0 && (
              <>
                <Stars value={rating} />
                <span className="font-semibold">{rating.toFixed(1)}</span>
                <span className="opacity-80">({reviewCount} reviews)</span>
              </>
            )}
            {venue.price && <span className="opacity-90">· {venue.price}</span>}
            {venue.isOpenNow && (
              <span className="px-2 py-0.5 bg-green-500 rounded-full text-xs font-medium">Open now</span>
            )}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="px-4 sm:px-0 mt-4 grid grid-cols-3 gap-2">
        <Link
          to={`/sitara/book/${encodeURIComponent(id)}`}
          className="tile col-span-3 sm:col-span-1 px-4 py-3 bg-amber-500 text-white text-center font-semibold rounded-xl"
        >
          📅 Book a visit
        </Link>
        {venue.phone && (
          <a href={`tel:${venue.phone}`} className="tile px-4 py-3 bg-white border border-slate-200 text-center font-medium rounded-xl text-slate-800">
            📞 Call
          </a>
        )}
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="tile px-4 py-3 bg-white border border-slate-200 text-center font-medium rounded-xl text-slate-800">
            🗺️ Directions
          </a>
        )}
      </div>

      <div className="px-4 sm:px-0 mt-6 space-y-6">
        {/* Verified-stars nudge */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          <p className="font-semibold mb-0.5">★ Verified stars wanted</p>
          <p>
            Book, check in, and review — your visit gives this business a verified star and earns
            you Star Power.
          </p>
        </div>

        {/* Photos */}
        {photos.length > 1 && (
          <section>
            <h2 className="font-bold text-slate-900 mb-2">Photos</h2>
            <div className="flex gap-2 overflow-x-auto no-scrollbar mobile-scroll pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {photos.slice(0, 10).map((p, i) => (
                <img
                  key={i}
                  src={p}
                  alt={`${venue.name} photo ${i + 1}`}
                  loading="lazy"
                  className="tile shrink-0 w-40 h-28 object-cover rounded-lg"
                />
              ))}
            </div>
          </section>
        )}

        {/* About */}
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-bold text-slate-900 mb-2">About</h2>
          <div className="space-y-1.5 text-sm text-slate-600">
            {venue.address && <p>📍 {venue.address}{venue.city ? `, ${venue.city}` : ''}</p>}
            {venue.phone && <p>📞 {venue.phone}</p>}
            {venue.categories && Array.isArray(venue.categories) && (
              <p>🏷️ {venue.categories.slice(0, 4).join(' · ')}</p>
            )}
            {venue.hours && <p>🕒 {typeof venue.hours === 'string' ? venue.hours : 'Hours available'}</p>}
          </div>
        </section>

        {/* Menu */}
        {menu && (
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-bold text-slate-900 mb-2">Menu</h2>
            <p className="text-sm text-slate-600">
              {typeof menu === 'string' ? menu : menu.url ? (
                <a href={menu.url} target="_blank" rel="noreferrer" className="text-amber-600 font-medium">
                  View full menu →
                </a>
              ) : 'Menu available at the venue.'}
            </p>
          </section>
        )}

        {/* Reviews */}
        <section>
          <h2 className="font-bold text-slate-900 mb-2">
            Reviews <span className="font-normal text-slate-500 text-sm">({reviews.length})</span>
          </h2>
          {reviews.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-500 mb-3">No reviews yet — be the first verified star.</p>
              <Link to={`/sitara/book/${encodeURIComponent(id)}`} className="inline-block px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg">
                Book to review
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.slice(0, 8).map((r: any, i: number) => (
                <div key={r.id || i} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {r.author_name || r.author || r.user?.name || 'Visitor'}
                    </p>
                    {(r.rating || r.stars) && <Stars value={Number(r.rating ?? r.stars)} />}
                  </div>
                  {(r.text || r.content) && <p className="text-sm text-slate-600">{r.text || r.content}</p>}
                  {(r.time || r.created_at) && (
                    <p className="text-xs text-slate-400 mt-1.5">
                      {new Date(typeof (r.time || r.created_at) === 'number' && (r.time || 0) < 1e12 ? (r.time || r.created_at) * 1000 : (r.time || r.created_at)).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Sticky mobile book bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 p-3 safe-area-bottom">
        <Link
          to={`/sitara/book/${encodeURIComponent(id)}`}
          className="block w-full py-3.5 bg-amber-500 text-white text-center font-semibold rounded-xl active:bg-amber-600"
        >
          📅 Book a visit
        </Link>
      </div>
    </div>
  );
}
