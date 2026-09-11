// Sitara OS — Business Star Card (operator)
// The stars THIS business has earned from verified customers.
// Sitara = star: every star here traces to a real checked-in visit,
// paid out in Pabandi trust + $PAB tokenomics. Nothing anonymous counts.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sitaraApi } from '../api/sitaraApi';

interface StarsData {
  businessId: string;
  name: string;
  verifiedAvg: number;
  verifiedCount: number;
  distribution: Record<string, number>;
  trustScore: number;
  recent: { id: string; rating: number; text?: string; date: string; author: string }[];
}

export default function BusinessStarCardPage() {
  const [stars, setStars] = useState<StarsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noBusiness, setNoBusiness] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const biz = await sitaraApi.myBusiness().catch(() => null);
        if (!biz?.id) {
          setNoBusiness(true);
          return;
        }
        const s = await sitaraApi.businessStars(biz.id).catch(() => null);
        if (s) setStars(s);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-slate-500 text-sm p-8">Counting your stars…</p>;
  if (noBusiness || !stars) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">No business yet</h1>
        <p className="text-slate-600 mb-6">Register your business — every verified visit earns you a star.</p>
        <Link to="/sitara" className="px-6 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
          Back to Sitara
        </Link>
      </div>
    );
  }

  const maxBucket = Math.max(1, ...Object.values(stars.distribution || {}));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Your Stars</h1>
      <p className="text-slate-600 mb-8">
        Earned from verified customers only — each star is a real visit, backed by Pabandi trust.
      </p>

      {/* Star Card Visual */}
      <div className="tile rise bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-8 text-white shadow-xl mb-6">
        <div className="flex items-center justify-between mb-6">
          <span className="font-bold text-xl">★ {stars.name}</span>
          <span className="text-sm opacity-80">Verified on Pabandi</span>
        </div>
        <div className="flex items-end gap-3 mb-1">
          <p className="text-5xl font-bold">{Number(stars.verifiedAvg || 0).toFixed(1)}</p>
          <p className="text-lg opacity-90 mb-1">★ average</p>
        </div>
        <p className="text-sm opacity-80 mb-6">
          {stars.verifiedCount} verified visit{stars.verifiedCount === 1 ? '' : 's'} · Trust {Math.round(stars.trustScore)}/100
        </p>
        <div className="space-y-2">
          {['5', '4', '3', '2', '1'].map((k) => {
            const n = stars.distribution?.[k] ?? 0;
            return (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="w-6 opacity-90">{k}★</span>
                <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${(n / maxBucket) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right opacity-90">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* How stars are earned */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-6 text-sm text-amber-900">
        <p className="font-semibold mb-1">How you earn stars</p>
        <p>
          1 verified visit + 1 honest review = stars on your card. 5★ visits raise your Pabandi
          trust score; low verified ratings lower it. Fake reviews can't exist here — no
          check-in, no star.
        </p>
      </div>

      {/* Recent verified reviews */}
      <h2 className="font-semibold text-slate-900 mb-3">Latest verified reviews</h2>
      {stars.recent.length === 0 ? (
        <p className="text-sm text-slate-500">No verified reviews yet — your first star is one great visit away.</p>
      ) : (
        <div className="space-y-3">
          {stars.recent.map((r) => (
            <div key={r.id} className="tile bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-slate-900">{r.author}</p>
                <span className="text-amber-500 text-sm">{'★'.repeat(Math.round(r.rating))}</span>
              </div>
              {r.text && <p className="text-sm text-slate-600">{r.text}</p>}
              {(r as any).ownerReply && (
                <p className="text-sm text-slate-600 mt-1.5 pl-3 border-l-2 border-amber-400">
                  <span className="font-semibold text-amber-800">Owner: </span>{(r as any).ownerReply}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1">✓ Verified visit · {new Date(r.date).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
