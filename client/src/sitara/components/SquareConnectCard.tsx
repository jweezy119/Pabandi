// Sitara OS — Square connect card (operator)
// Links a Square merchant account → imports locations (geo) into the
// business profile. Same rails future POS payments will run on.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sitaraApi } from '../api/sitaraApi';

export default function SquareConnectCard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const sq = searchParams.get('square');
    if (sq === 'connected') {
      const n = searchParams.get('locations') || '0';
      setNotice({ ok: true, text: `Square connected — ${n} location(s) imported with geo coordinates.` });
    } else if (sq === 'error') {
      setNotice({ ok: false, text: `Square connection failed: ${searchParams.get('message') || 'unknown error'}` });
    }
    if (sq) {
      searchParams.delete('square');
      searchParams.delete('message');
      searchParams.delete('locations');
      searchParams.delete('business');
      setSearchParams(searchParams, { replace: true });
    }
    sitaraApi
      .myBusiness()
      .then((biz) => {
        if (!biz?.id) return;
        setBusinessId(biz.id);
        return sitaraApi.squareStatus(biz.id);
      })
      .then((s) => s && setStatus(s))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    if (!businessId) return;
    setBusy(true);
    try {
      const url = await sitaraApi.squareConnect(businessId);
      window.location.href = url;
    } catch (e: any) {
      setNotice({
        ok: false,
        text: e?.response?.data?.message || 'Square is not configured yet (SQUARE_APP_ID / SQUARE_APP_SECRET).',
      });
      setBusy(false);
    }
  };

  const handleSync = async () => {
    if (!businessId) return;
    setBusy(true);
    try {
      const r = await sitaraApi.squareSync(businessId);
      setNotice({ ok: true, text: `Synced ${r?.count ?? 0} Square location(s) into your profile.` });
      const s = await sitaraApi.squareStatus(businessId);
      setStatus(s);
    } catch (e: any) {
      setNotice({ ok: false, text: e?.response?.data?.error || 'Sync failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <h3 className="font-semibold text-slate-900 mb-2">■ Square</h3>
      <p className="text-sm text-slate-600 mb-4">
        Import your Square locations with geo coordinates — and unlock Square payments later.
      </p>
      {notice && (
        <div className={`rounded-lg p-3 mb-4 text-sm font-medium ${notice.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {notice.text}
        </div>
      )}
      {status?.connected ? (
        <div className="space-y-3">
          <p className="text-sm text-green-700 font-medium">
            ✓ Connected
            {status.lastSyncedAt && ` · synced ${new Date(status.lastSyncedAt).toLocaleDateString()}`}
          </p>
          <button
            onClick={() => void handleSync()}
            disabled={busy}
            className="w-full px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 disabled:opacity-50"
          >
            {busy ? 'Syncing…' : '↻ Re-sync locations'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => void handleConnect()}
          disabled={busy || !businessId}
          className="w-full px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Opening Square…' : businessId ? 'Connect Square' : 'Register a business first'}
        </button>
      )}
      {!status?.configured && businessId && (
        <p className="text-xs text-slate-500 mt-3">
          Backend note: set SQUARE_APP_ID / SQUARE_APP_SECRET on the server to enable.
        </p>
      )}
    </div>
  );
}
