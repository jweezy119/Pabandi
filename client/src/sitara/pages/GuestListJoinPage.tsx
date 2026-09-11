// Sitara OS — guest list join page (public)
// /sitara/list/:code — see the night, join the list, get a confirmation code.
// No account needed: name + party size is the whole form.
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { sitaraApi } from '../api/sitaraApi';

export default function GuestListJoinPage() {
  const { code = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<any>(null);

  useEffect(() => {
    sitaraApi
      .listInfo(code)
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [code]);

  const handleJoin = async () => {
    if (!name.trim()) {
      setError('Tell us your name so the door can find you.');
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const res = await sitaraApi.joinList(code, {
        name: name.trim(),
        partySize,
        source: searchParams.get('src') || 'link',
      });
      setConfirmation(res);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not join the list.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent" />
        <p className="mt-2 text-slate-500">Loading list…</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-4xl mb-3">📋</p>
        <p className="font-semibold text-slate-900 mb-1">List not found</p>
        <p className="text-sm text-slate-500 mb-6">The code may be wrong or the list may have closed.</p>
        <Link to="/sitara" className="px-6 py-3 bg-amber-500 text-white font-medium rounded-lg">
          Discover places
        </Link>
      </div>
    );
  }

  if (confirmation) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✓</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">You're on the list!</h1>
        <p className="text-slate-600 mb-6">
          {confirmation.name} · party of {confirmation.partySize} · {info.title}
        </p>
        <div className="bg-slate-900 text-white rounded-2xl p-6 mb-6">
          <p className="text-xs opacity-70 mb-1">SHOW THIS AT THE DOOR</p>
          <p className="text-3xl font-mono font-bold tracking-wider">{confirmation.confirmCode}</p>
        </div>
        <p className="text-sm text-slate-500">Screenshot this page — it works offline at the door.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Guest list</p>
      <h1 className="text-3xl font-bold text-slate-900 mb-1">{info.title}</h1>
      <p className="text-slate-600 mb-6">
        {info.business?.name || info.venueName || ''} · {info.date ? new Date(info.date).toLocaleString() : ''}
      </p>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-slate-600">{info.heads} already in · {info.joined} joins</span>
          {info.capacity && <span className="text-slate-500">cap {info.capacity}</span>}
        </div>
        {info.full ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 text-center font-medium">
            This list is full — try another night.
          </div>
        ) : (
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name *"
              autoComplete="name"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Party size</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPartySize(n)}
                    className={`tile flex-1 py-2.5 rounded-lg text-sm font-semibold border ${
                      partySize === n ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {n}{n === 6 ? '+' : ''}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>
            )}
            <button
              onClick={() => void handleJoin()}
              disabled={joining}
              className="w-full py-3.5 bg-amber-500 text-white font-semibold rounded-xl disabled:opacity-50"
            >
              {joining ? 'Joining…' : 'Join the list'}
            </button>
            <p className="text-xs text-slate-400 text-center">Free · no account · show the code at the door</p>
          </div>
        )}
      </div>
    </div>
  );
}
