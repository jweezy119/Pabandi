// Sitara OS — Operator reviews
// Google + Sitara-verified reviews merged (see sitaraApi.operatorReviews).
// Verified reviews first — they're the trust signal no one else has.
import { useEffect, useState } from 'react';
import { sitaraApi } from '../api/sitaraApi';

export default function OperatorReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const biz = await sitaraApi.myBusiness().catch(() => null);
        if (!biz?.id) return;
        const list = await sitaraApi.operatorReviews(biz.id).catch(() => []);
        setReviews(Array.isArray(list) ? list : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rated = reviews.filter((r) => typeof r.rating === 'number');
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;

  if (loading) return <p className="text-slate-500 text-sm p-8">Loading reviews…</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Reviews</h1>
        <p className="text-slate-600 mt-1">
          {rated.length > 0 ? (
            <>★ {avg.toFixed(1)} average across {rated.length} reviews — every verified one earned you a star</>
          ) : (
            'Verified reviews from checked-in guests earn you stars here.'
          )}
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-slate-500">No reviews yet — every completed visit with a review builds this wall.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={String(r.id)} className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 text-sm">{r.author}</p>
                  {r.verified ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      ✓ Verified visit
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
                      {r.source}
                    </span>
                  )}
                </div>
                <span className="text-amber-500 text-sm font-medium">
                  {'★'.repeat(Math.round(r.rating || 0))}{' '}
                  <span className="text-slate-400">{Number(r.rating || 0).toFixed(1)}</span>
                </span>
              </div>
              {r.text && <p className="text-sm text-slate-700">{r.text}</p>}
              <p className="text-xs text-slate-400 mt-2">
                {r.date ? new Date(r.date).toLocaleDateString() : ''}
                {typeof r.starPoints === 'number' && r.starPoints > 0 && ` · +${r.starPoints} SP earned`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
