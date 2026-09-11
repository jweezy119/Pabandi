// Sitara OS — Promoter Hub
// Become a promoter, fill rooms, track referrals and earnings —
// wired to the real /promoters/* backend, in Sitara branding.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { sitaraApi } from '../api/sitaraApi';

export default function PromoterDashboardPage() {
  const { isAuthenticated, user: authUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [refLink, setRefLink] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [showListForm, setShowListForm] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [listVenue, setListVenue] = useState('');
  const [listDate, setListDate] = useState('');
  const [listCap, setListCap] = useState('');
  const [savingList, setSavingList] = useState(false);
  const [listNotice, setListNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);
  const [stageName, setStageName] = useState('');
  const [instagram, setInstagram] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await sitaraApi.promoterMe().catch((e: any) => {
        if (e?.response?.status === 404) return null;
        throw e;
      });
      setProfile(me);
      if (me) {
        const [st, w, ref, books, lb, li] = await Promise.allSettled([
          sitaraApi.promoterStats(),
          sitaraApi.promoterWallet(),
          sitaraApi.promoterRefLink(),
          sitaraApi.promoterBookings(),
          sitaraApi.promoterLeaderboard(10),
          sitaraApi.myLists(),
        ]);
        if (st.status === 'fulfilled') setStats(st.value);
        if (w.status === 'fulfilled') setWallet(w.value);
        if (ref.status === 'fulfilled') setRefLink(ref.value);
        if (books.status === 'fulfilled') setBookings(Array.isArray(books.value) ? books.value : []);
        if (lb.status === 'fulfilled') setLeaders(Array.isArray(lb.value) ? lb.value : []);
        if (li.status === 'fulfilled') setLists(Array.isArray(li.value) ? li.value : []);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not load promoter data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setStageName(authUser ? `${authUser.firstName} ${authUser.lastName}`.trim() : '');
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleJoin = async () => {
    if (!stageName.trim()) {
      setError('Give yourself a promoter name to get started.');
      return;
    }
    setJoining(true);
    setError(null);
    try {
      await sitaraApi.promoterRegister({
        name: stageName.trim(),
        instagram: instagram.trim() || undefined,
      });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not create promoter profile.');
    } finally {
      setJoining(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🎤</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Promote. Fill rooms. Earn.</h1>
        <p className="text-slate-600 mb-6">Sign in to access your promoter hub.</p>
        <Link to="/login" className="inline-block px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800">
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-slate-500">Loading your promoter hub…</p>
      </div>
    );
  }

  // Onboarding — signed in but no promoter profile yet
  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Become a Promoter</h1>
        <p className="text-slate-600 mb-8">
          Bring the crowd, keep the night alive. Earn commission on every guest plus Star Power on referrals.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 mb-6">{error}</div>
        )}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Promoter name</label>
            <input
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              placeholder="e.g. DJ Nights by Ali"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Instagram (optional)</label>
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@yourhandle"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={() => void handleJoin()}
            disabled={joining}
            className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {joining ? 'Creating your profile…' : 'Start Promoting'}
          </button>
        </div>
      </div>
    );
  }

  const referralCode: string | null =
    (typeof refLink === 'string' ? refLink : refLink?.code || refLink?.referralCode || refLink?.link) || null;
  const referralUrl = referralCode
    ? referralCode.startsWith('http')
      ? referralCode
      : `https://pabandi.com/r/${referralCode}`
    : null;

  const copyReferral = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleCreateList = async () => {
    if (!listTitle.trim() || !listDate) return;
    setSavingList(true);
    setListNotice(null);
    try {
      const created = await sitaraApi.createList({
        title: listTitle.trim(),
        date: new Date(listDate).toISOString(),
        capacity: listCap ? Number(listCap) : null,
        venueName: listVenue.trim() || undefined,
      });
      setListNotice({ ok: true, text: `List live — share code ${created?.code} or the link below.` });
      setListTitle('');
      setListVenue('');
      setListDate('');
      setListCap('');
      setShowListForm(false);
      const mine = await sitaraApi.myLists().catch(() => []);
      setLists(Array.isArray(mine) ? mine : []);
    } catch (e: any) {
      setListNotice({ ok: false, text: e?.response?.data?.error || 'Could not create list.' });
    } finally {
      setSavingList(false);
    }
  };

  const listUrl = (code: string) => `https://pabandi.com/sitara/list/${code}`;

  const cards = [
    { label: 'Total Guests', value: stats?.totalGuests ?? stats?.guests ?? 0, icon: '👥' },
    { label: 'Arrived', value: stats?.arrivedGuests ?? stats?.arrived ?? 0, icon: '✅' },
    { label: 'Arrival Rate', value: stats?.arrivalRate != null ? `${Math.round(Number(stats.arrivalRate) * 100)}%` : '—', icon: '📈' },
    { label: 'Wallet Balance', value: wallet?.balance != null ? `$${Number(wallet.balance).toFixed(2)}` : '—', icon: '💰' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Promoter Hub</h1>
          <p className="text-slate-600 mt-1">
            {profile?.name || 'Promoter'} · your lists, your crowd, your cut
          </p>
        </div>
        <Link to="/promoter" className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800">
          Full PromoterOS →
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 my-6">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-1">
              <span>{c.icon}</span>
              <span className="text-sm text-slate-600">{c.label}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white mb-8">
        <h3 className="font-semibold mb-1">Your referral link</h3>
        <p className="text-sm opacity-80 mb-4">
          Every guest who books through it earns you commission — plus +50 Star Power when they check in.
        </p>
        {referralUrl ? (
          <>
            <div className="flex gap-2">
              <input readOnly value={referralUrl} className="flex-1 px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-sm text-white" />
              <button onClick={() => void copyReferral()} className="px-4 py-2 bg-white text-orange-600 text-sm font-semibold rounded-lg hover:bg-orange-50">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Join me on Pabandi — verified bookings, real reviews: ${referralUrl}`)}`}
                target="_blank"
                rel="noreferrer"
                className="tile flex-1 px-3 py-2 bg-white/20 border border-white/30 text-center text-sm font-semibold rounded-lg"
              >
                WhatsApp
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Verified bookings, real reviews — join me on Pabandi: ${referralUrl}`)}`}
                target="_blank"
                rel="noreferrer"
                className="tile flex-1 px-3 py-2 bg-white/20 border border-white/30 text-center text-sm font-semibold rounded-lg"
              >
                Post on X
              </a>
              {(navigator as any)?.share && (
                <button
                  onClick={() => (navigator as any).share({ title: 'Pabandi', text: 'Verified bookings, real reviews', url: referralUrl }).catch(() => {})}
                  className="tile flex-1 px-3 py-2 bg-white/20 border border-white/30 text-sm font-semibold rounded-lg"
                >
                  Share…
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm opacity-80">Referral link unavailable right now.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attributed bookings */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Your guests</h3>
          </div>
          {bookings.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500 text-center">
              No guests yet — share your referral link to fill your first list.
            </p>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-sm font-medium text-slate-600">Guest</th>
                  <th className="px-5 py-3 text-left text-sm font-medium text-slate-600">Event</th>
                  <th className="px-5 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {bookings.slice(0, 10).map((b: any, i: number) => (
                  <tr key={b.id || i} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm text-slate-900">{b.guestName || b.name || b.email || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{b.eventName || b.event || b.venue || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{b.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Promoter leaderboard</h3>
          </div>
          {leaders.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500 text-center">No rankings yet.</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {leaders.map((l: any, i: number) => (
                <div key={l.id || l.userId || i} className="px-5 py-3 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-900">
                    {l.name || l.promoterName || l.user?.firstName || 'Promoter'}
                  </span>
                  <span className="text-sm text-slate-600">
                    {l.totalGuests ?? l.guests ?? l.earnings ?? ''} {l.earnings != null ? `$ earned` : 'guests'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Guest lists — create in seconds, see exactly what each list pulls */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Guest lists</h3>
            <p className="text-xs text-slate-500">Name it, date it, share the link — the door board fills itself.</p>
          </div>
          <button
            onClick={() => setShowListForm(!showListForm)}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 shrink-0"
          >
            + New list
          </button>
        </div>
        {listNotice && (
          <div className={`mx-5 mt-4 rounded-lg p-3 text-sm font-medium ${listNotice.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {listNotice.text}
          </div>
        )}
        {showListForm && (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-slate-200">
            <input value={listTitle} onChange={(e) => setListTitle(e.target.value)} placeholder="List title — e.g. Friday Rooftop *" className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
            <input value={listVenue} onChange={(e) => setListVenue(e.target.value)} placeholder="Venue (if not your business)" className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
            <input type="datetime-local" value={listDate} onChange={(e) => setListDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
            <input value={listCap} onChange={(e) => setListCap(e.target.value)} placeholder="Capacity (blank = unlimited)" inputMode="numeric" className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
            <button onClick={() => void handleCreateList()} disabled={savingList} className="sm:col-span-2 px-4 py-2.5 bg-slate-900 text-white font-medium rounded-lg disabled:opacity-50">
              {savingList ? 'Creating…' : 'Create list'}
            </button>
          </div>
        )}
        {lists.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 text-center">
            No lists yet — create one above and every join, arrival, and source shows up here.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {lists.map((l: any) => (
              <div key={l.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{l.title}</p>
                    <p className="text-xs text-slate-500">
                      {l.business?.name || l.venueName || ''} · {l.date ? new Date(l.date).toLocaleString() : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-900 text-white rounded-full text-xs font-mono">{l.code}</span>
                    <a href={listUrl(l.code)} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg">Open link ↗</a>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`You're on my list for ${l.title} — join here: ${listUrl(l.code)}`)}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg">WhatsApp</a>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 flex-wrap">
                  <span><strong className="text-slate-900">{l.heads}</strong> heads · <strong className="text-slate-900">{l.joins}</strong> joins</span>
                  <span><strong className="text-green-700">{l.arrived}</strong> arrived ({l.showRate}%)</span>
                  {l.bySource && Object.keys(l.bySource).length > 0 && (
                    <span className="text-xs text-slate-500">
                      {Object.entries(l.bySource).map(([s, n]) => `${s}: ${n}`).join(' · ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Commission feed — every dollar the ledger owes you */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Commission feed</h3>
          {wallet?.totalEarnings != null && (
            <span className="text-sm text-slate-600">
              Lifetime <strong className="text-green-700">${Number(wallet.totalEarnings).toFixed(2)}</strong>
            </span>
          )}
        </div>
        {!(wallet?.history || []).length ? (
          <p className="px-5 py-8 text-sm text-slate-500 text-center">
            No commissions yet — they land here when your guests complete visits.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {(wallet.history || []).slice(0, 10).map((e: any, i: number) => (
              <div key={e.id || i} className="px-5 py-3 flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${e.isReversed ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                  {e.isReversed ? '↩' : '$'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {e.isReversed ? 'Reversed' : 'Booking commission'}
                    {e.description || e.note ? ` — ${e.description || e.note}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    {e.createdAt ? new Date(e.createdAt).toLocaleDateString() : ''}
                    {e.type ? ` · ${String(e.type).replace(/_/g, ' ')}` : ''}
                  </p>
                </div>
                <span className={`text-sm font-bold ${e.isReversed ? 'text-red-600' : 'text-green-700'}`}>
                  {e.isReversed ? '−' : '+'}${Number(e.amount || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
