// Sitara OS — Operator reviews
// Google + Sitara-verified reviews merged (see sitaraApi.operatorReviews).
// Verified reviews first — they're the trust signal no one else has.
import { useEffect, useState } from 'react';
import { sitaraApi } from '../api/sitaraApi';

export default function OperatorReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const reload = async () => {
    try {
      const biz = await sitaraApi.myBusiness().catch(() => null);
      if (!biz?.id) return;
      const list = await sitaraApi.operatorReviews(biz.id).catch(() => []);
      setReviews(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await sitaraApi.replyToReview(reviewId, replyText.trim());
      setReplying(null);
      setReplyText('');
      await reload();
    } finally {
      setSending(false);
    }
  };

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
              {r.ownerReply && (
                <div className="mt-3 ml-2 sm:ml-4 pl-3 border-l-2 border-amber-400 bg-amber-50/60 rounded-r-lg p-2.5">
                  <p className="text-xs font-semibold text-amber-800 mb-0.5">Response from the owner</p>
                  <p className="text-sm text-slate-700">{r.ownerReply}</p>
                </div>
              )}
              {r.verified && !r.ownerReply && (
                <div className="mt-3">
                  {replying === String(r.id) ? (
                    <div className="flex gap-2">
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Thank them, address it, invite them back…"
                        className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        onClick={() => void handleReply(String(r.id))}
                        disabled={sending || !replyText.trim()}
                        className="shrink-0 px-3 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                      >
                        {sending ? '…' : 'Reply'}
                      </button>
                      <button
                        onClick={() => { setReplying(null); setReplyText(''); }}
                        className="shrink-0 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReplying(String(r.id))}
                      className="text-xs font-medium text-amber-700 hover:text-amber-800"
                    >
                      ↩ Reply publicly
                    </button>
                  )}
                </div>
              )}
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
