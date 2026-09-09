// Sitara OS — Promos Inbox (consumer)
// Offers sent to you by businesses, matched to your Star tier.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { sitaraApi, StarPromoItem } from '../api/sitaraApi';

export default function PromosInboxPage() {
  const { isAuthenticated } = useAuthStore();
  const [promos, setPromos] = useState<StarPromoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setPromos(await sitaraApi.getMyPromos());
    } catch {
      setPromos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) void load();
    else setLoading(false);
  }, [isAuthenticated]);

  const redeem = async (promoCode: string) => {
    setRedeeming(promoCode);
    setNotice(null);
    try {
      const result = await sitaraApi.redeemPromo(promoCode);
      setNotice({ ok: true, text: `Redeemed! Show code ${promoCode} at the venue.` });
      void result;
      await load();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.response?.data?.error || 'Could not redeem this code.' });
    } finally {
      setRedeeming(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🎁</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Your promos live here</h1>
        <p className="text-slate-600 mb-6">Sign in to see offers matched to your Star tier.</p>
        <Link to="/login" className="inline-block px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">My Promos</h1>
      <p className="text-slate-600 mb-8">Exclusive offers from businesses you actually visit.</p>

      {/* Redeem by code */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Have a code? Enter it here (e.g. SITARA_X7K2)"
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm uppercase"
        />
        <button
          onClick={() => code.trim() && void redeem(code.trim())}
          disabled={!code.trim() || redeeming !== null}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50"
        >
          Redeem
        </button>
      </div>

      {notice && (
        <div className={`rounded-lg p-4 mb-6 text-sm font-medium ${notice.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {notice.text}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-center py-12">Loading your promos…</p>
      ) : promos.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No promos yet</h3>
          <p className="text-slate-600 mb-6">Check in and review businesses to earn Star Power — offers unlock as you climb tiers.</p>
          <Link to="/sitara" className="inline-block px-6 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
            Discover
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {promos.map((promo) => (
            <div key={promo.id} className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs font-medium text-amber-600 mb-1">
                    {promo.business?.name || 'Sitara partner'}
                    {promo.targetTier ? ` · ${promo.targetTier} and up` : ' · All tiers'}
                  </p>
                  <h3 className="font-semibold text-slate-900 text-lg">{promo.title}</h3>
                  <p className="text-sm text-slate-600 mt-1">{promo.description}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Expires {new Date(promo.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-slate-900">
                    {promo.promoType === 'PERCENT' ? `${promo.value}%` : promo.value > 0 ? `$${promo.value}` : '★'}
                  </p>
                  <p className="text-xs text-slate-500">off</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <code className="px-3 py-1.5 bg-slate-100 rounded text-sm font-mono font-semibold tracking-wide">
                  {promo.code}
                </code>
                {promo.alreadyRedeemed ? (
                  <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                    ✓ Redeemed — show this code at the venue
                  </span>
                ) : (
                  <button
                    onClick={() => void redeem(promo.code)}
                    disabled={redeeming === promo.code}
                    className="px-4 py-1.5 bg-amber-500 text-white text-sm font-medium rounded hover:bg-amber-600 disabled:opacity-50"
                  >
                    {redeeming === promo.code ? 'Redeeming…' : 'Redeem'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
