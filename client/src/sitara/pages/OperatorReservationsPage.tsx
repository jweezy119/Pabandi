// Sitara OS — Operator reservations
// Real booking list per business type (reservations / appointments / stays /
// viewings). Data: GET /businesses/:id/reservations. Vocabulary: profile.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sitaraApi } from '../api/sitaraApi';
import { profileForCategory, OperatorProfile } from '../utils/operatorProfile';

type Filter = 'today' | 'upcoming' | 'all';

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes('confirm') || s.includes('complete') || s.includes('check')) return 'bg-green-100 text-green-800';
  if (s.includes('pend')) return 'bg-yellow-100 text-yellow-800';
  if (s.includes('cancel') || s.includes('no_show') || s.includes('noshow')) return 'bg-slate-100 text-slate-500';
  return 'bg-blue-100 text-blue-800';
}

export default function OperatorReservationsPage() {
  const [profile, setProfile] = useState<OperatorProfile>(profileForCategory(null));
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('today');
  const [noBusiness, setNoBusiness] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchList = async (bizId: string) => {
    const list = await sitaraApi.businessReservations(bizId).catch(() => []);
    setReservations(Array.isArray(list) ? list : []);
    setUpdatedAt(new Date());
  };

  const [onSite, setOnSite] = useState<any[]>([]);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  const fetchOnSite = async (bizId: string) => {
    const raw: any = await sitaraApi.activeCheckins(bizId).catch(() => null);
    const list = raw?.activeCheckIns || raw?.data?.activeCheckIns || (Array.isArray(raw) ? raw : []);
    setOnSite(Array.isArray(list) ? list : []);
  };

  /** Staff taps when the guest leaves — completes the visit, unlocks review + rewards. */
  const handleCheckoutGuest = async (reservationId: string) => {
    setCheckingOut(reservationId);
    setActionError(null);
    try {
      await sitaraApi.checkoutReservation(reservationId);
      if (businessId) {
        await Promise.all([fetchList(businessId), fetchOnSite(businessId)]);
      }
    } catch (e: any) {
      setActionError(e?.response?.data?.message || e?.message || 'Check-out failed.');
    } finally {
      setCheckingOut(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let onFocus: (() => void) | null = null;
    (async () => {
      try {
        const biz = await sitaraApi.myBusiness().catch(() => null);
        if (cancelled) return;
        if (!biz?.id) {
          setNoBusiness(true);
          return;
        }
        if (biz.category) setProfile(profileForCategory(biz.category));
        setBusinessId(biz.id);
        await Promise.all([fetchList(biz.id), fetchOnSite(biz.id)]);
        // Live book: refresh every 30s + on tab focus so walk-ins show up.
        timer = setInterval(() => {
          void fetchList(biz.id);
          void fetchOnSite(biz.id);
        }, 30000);
        onFocus = () => {
          if (!document.hidden) {
            void fetchList(biz.id);
            void fetchOnSite(biz.id);
          }
        };
        window.addEventListener('focus', onFocus);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (onFocus) window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    if (!businessId) return;
    setRefreshing(true);
    try {
      await fetchList(businessId);
    } finally {
      setRefreshing(false);
    }
  };

  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState<string | null>(null);

  /** Open a Square-hosted checkout (merchant's own account) for a due deposit. */
  const handleSquareCollect = async (r: any) => {
    if (!businessId || !r?.depositAmount) return;
    setCollecting(r.id);
    setActionError(null);
    try {
      const link = await sitaraApi.squarePaymentLink({
        businessId,
        amount: Number(r.depositAmount),
        reservationId: r.id,
        label: `Deposit — ${r.customerName || 'booking'} ${r.reservationDate ? new Date(r.reservationDate).toLocaleDateString() : ''}`,
      });
      if (link?.url) window.open(link.url, '_blank', 'noopener');
      else setActionError('No checkout URL returned.');
    } catch (e: any) {
      setActionError(e?.response?.data?.error || 'Square checkout failed — is Square connected?');
    } finally {
      setCollecting(null);
    }
  };

  /** Staff taps when the guest walks in — marks arrival on the live book. */
  const handleCheckInGuest = async (reservationId: string) => {
    setCheckingIn(reservationId);
    setActionError(null);
    try {
      await sitaraApi.verifyCheckIn({ reservationId, method: 'manual' });
      if (businessId) await fetchList(businessId);
    } catch (e: any) {
      setActionError(e?.response?.data?.message || e?.message || 'Check-in failed.');
    } finally {
      setCheckingIn(null);
    }
  };

  const canCheckIn = (r: any) =>
    ['PENDING', 'CONFIRMED'].includes(String(r.status || '').toUpperCase());

  const today = dayKey(new Date());
  const visible = useMemo(() => {
    const sorted = [...reservations].sort(
      (a, b) => +new Date(a.reservationDate || 0) - +new Date(b.reservationDate || 0)
    );
    if (filter === 'today') return sorted.filter((r) => dayKey(new Date(r.reservationDate)) === today);
    if (filter === 'upcoming')
      return sorted.filter(
        (r) =>
          dayKey(new Date(r.reservationDate)) >= today &&
          !['CANCELLED', 'NO_SHOW'].includes(String(r.status || '').toUpperCase())
      );
    return sorted;
  }, [reservations, filter, today]);

  const tabs: { id: Filter; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'upcoming', label: `Upcoming` },
    { id: 'all', label: 'All' },
  ];

  if (loading) return <p className="text-slate-500 text-sm p-8">Loading {profile.bookingNounPlural.toLowerCase()}…</p>;
  if (noBusiness) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">No business yet</h1>
        <p className="text-slate-600 mb-6">Register your business to see {profile.bookingNounPlural.toLowerCase()} here.</p>
        <Link to="/sitara" className="px-6 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
          Back to Sitara
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{profile.bookingNounPlural}</h1>
          <p className="text-slate-600 mt-1">
            {reservations.length} total · who is coming, when, and party size
            {updatedAt && (
              <span className="text-slate-400"> · updated {updatedAt.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="shrink-0 px-3 py-2 bg-white border border-slate-200 text-sm font-medium rounded-lg text-slate-700 active:bg-slate-100 disabled:opacity-50"
        >
          {refreshing ? '…' : '↻ Refresh'}
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === t.id ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 mb-4">
          {actionError}
        </div>
      )}

      {/* On-site now — checked-in guests, one tap to complete their visit */}
      {onSite.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-green-900 mb-3">
            🟢 On-site now ({onSite.length})
          </h2>
          <div className="space-y-2">
            {onSite.map((g: any) => (
              <div key={g.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {g.customerName || 'Guest'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {g.checkInDate ? `since ${new Date(g.checkInDate).toLocaleTimeString()}` : 'checked in'}
                    {g.numberOfGuests ? ` · ${g.numberOfGuests} guests` : ''}
                  </p>
                </div>
                <button
                  onClick={() => void handleCheckoutGuest(g.id)}
                  disabled={checkingOut === g.id}
                  className="shrink-0 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                >
                  {checkingOut === g.id ? '…' : 'Check out'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-slate-500">No {profile.bookingNounPlural.toLowerCase()} in this view yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">{profile.clientNoun}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">When</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Party</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Deposit</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{r.customerName || '—'}</p>
                    <p className="text-xs text-slate-500">{r.customerPhone || r.customerEmail || ''}</p>
                    {r.specialRequests && (
                      <p className="text-xs text-slate-500 italic mt-0.5">“{r.specialRequests}”</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {r.reservationDate ? new Date(r.reservationDate).toLocaleDateString() : '—'}
                    {r.reservationTime && ` · ${r.reservationTime}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{r.numberOfGuests ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {r.depositRequired ? (r.depositPaid ? `✓ $${r.depositAmount ?? ''} paid` : (
                      <>
                        <span>${r.depositAmount ?? ''} due</span>
                        <button
                          onClick={() => void handleSquareCollect(r)}
                          disabled={collecting === r.id}
                          title="Send the guest a Square checkout on your account"
                          className="block mt-1.5 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded disabled:opacity-50"
                        >
                          {collecting === r.id ? '…' : '■ Collect via Square'}
                        </button>
                      </>
                    )) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(String(r.status || ''))}`}>
                      {String(r.status || 'pending').replace(/_/g, ' ').toLowerCase()}
                    </span>
                    {canCheckIn(r) && (
                      <button
                        onClick={() => void handleCheckInGuest(r.id)}
                        disabled={checkingIn === r.id}
                        className="block mt-1.5 px-2.5 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {checkingIn === r.id ? '…' : '✓ Check in'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
