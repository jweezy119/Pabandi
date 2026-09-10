// Sitara OS — Star Finder Page
// Discover top customers by Star Power and send them promos.
// Live operator data with mock fallback for demo.

import { useEffect, useState } from 'react';
import { sitaraApi } from '../api/sitaraApi';

const mockCustomers = [
  { userId: '1', name: 'Sarah Chen', tier: 'sitara-e-roshan', tierName: 'Sitara-e-Roshan', totalPoints: 1245, reviewCount: 12, lastReview: '2 days ago', avgRating: 4.9, totalUpvotes: 30 },
  { userId: '2', name: 'Mike Johnson', tier: 'sitara-e-noor', tierName: 'Sitara-e-Noor', totalPoints: 342, reviewCount: 8, lastReview: '1 week ago', avgRating: 4.7, totalUpvotes: 12 },
  { userId: '3', name: 'Emma Davis', tier: 'sitara-e-darakshan', tierName: 'Sitara-e-Darakshan', totalPoints: 5670, reviewCount: 34, lastReview: 'Yesterday', avgRating: 5.0, totalUpvotes: 88 },
];

const tierColors: Record<string, string> = {
  tara: 'bg-slate-100 text-slate-700',
  'sitara-e-noor': 'bg-amber-100 text-amber-700',
  'sitara-e-roshan': 'bg-orange-100 text-orange-700',
  'sitara-e-darakshan': 'bg-red-100 text-red-700',
  'sitara-e-izzat': 'bg-purple-100 text-purple-700',
};

export default function StarFinderPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>(mockCustomers);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(10);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const biz = await sitaraApi.myBusiness().catch(() => null);
        if (biz?.id) {
          setBusinessId(biz.id);
          const [stars, promos] = await Promise.allSettled([
            sitaraApi.getStarFinder(biz.id),
            sitaraApi.listPromos(biz.id),
          ]);
          if (stars.status === 'fulfilled' && stars.value.length > 0) {
            setCustomers(stars.value);
            setLive(true);
          }
          if (promos.status === 'fulfilled') setSentCount(promos.value.length);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSendPromo = async (customer: any) => {
    setSending(true);
    setNotice(null);
    try {
      if (live && businessId) {
        const promo = await sitaraApi.sendPromo({
          businessId,
          targetTier: customer.tier || null,
          title: `${promoDiscount}% Off for Top Guests`,
          description: `Exclusive ${promoDiscount}% off for ${customer.name} — thanks for being a star guest!`,
          value: promoDiscount,
          promoType: 'PERCENT',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        setNotice({ ok: true, text: `Promo sent! Code ${promo?.code || ''} — customer sees it in their inbox.` });
        setSentCount((c) => c + 1);
      } else {
        setNotice({ ok: true, text: `Demo promo (${promoDiscount}% off) noted for ${customer.name}. Connect a business for live sends.` });
      }
    } catch (e: any) {
      setNotice({ ok: false, text: e?.response?.data?.error || 'Could not send promo.' });
    } finally {
      setSending(false);
      setSelectedCustomer(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold text-slate-900">Star Finder</h1>
        {live && (
          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">✓ Live</span>
        )}
      </div>
      <p className="text-slate-600 mb-8">
        Find your best customers and send them exclusive promos.
        {!live && !loading && (
          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
            Demo data — connect a business for live customers
          </span>
        )}
      </p>

      {notice && (
        <div className={`rounded-lg p-4 mb-6 text-sm font-medium ${notice.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {notice.text}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading your customers…</p>
      ) : (
        <div className="space-y-4">
          {customers.map((customer: any) => (
            <div key={customer.userId} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                    {(customer.name || '?').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 truncate">{customer.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierColors[customer.tier] || tierColors.tara}`}>
                        {customer.tierName || customer.tier}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600 mt-1 flex-wrap">
                      <span>★ {customer.totalPoints ?? customer.starPower} SP</span>
                      <span>{customer.reviewCount ?? customer.visits} reviews</span>
                      {customer.avgRating != null && <span>⭐ {Number(customer.avgRating).toFixed(1)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 sm:ml-auto">
                  {selectedCustomer === customer.userId ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={promoDiscount}
                        onChange={(e) => setPromoDiscount(parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-sm"
                        placeholder="%"
                      />
                      <span className="text-sm text-slate-600">% off</span>
                      <button
                        onClick={() => void handleSendPromo(customer)}
                        disabled={sending}
                        className="px-3 py-1 bg-amber-500 text-white text-sm font-medium rounded hover:bg-amber-600 disabled:opacity-50"
                      >
                        {sending ? '…' : 'Send'}
                      </button>
                      <button
                        onClick={() => setSelectedCustomer(null)}
                        className="px-3 py-1 bg-slate-200 text-slate-700 text-sm font-medium rounded hover:bg-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedCustomer(customer.userId)}
                      className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600"
                    >
                      Send Promo
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promo Stats */}
      <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
          <p className="text-3xl font-bold text-slate-900">{live ? sentCount : 24}</p>
          <p className="text-sm text-slate-600">Promos sent</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
          <p className="text-3xl font-bold text-slate-900">{customers.length}</p>
          <p className="text-sm text-slate-600">Ranked customers</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
          <p className="text-3xl font-bold text-slate-900">
            {customers.length > 0
              ? (customers.reduce((s: number, c: any) => s + Number(c.avgRating || 0), 0) / customers.length).toFixed(1)
              : '—'}
          </p>
          <p className="text-sm text-slate-600">Avg rating</p>
        </div>
      </div>
    </div>
  );
}
