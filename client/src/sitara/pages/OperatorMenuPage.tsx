// Sitara OS — Operator menu (Square Catalog import)
// The merchant's real items, variations, and modifiers — the bread, fillings,
// and extras the walk-in story depends on. Synced from Square, cached locally.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sitaraApi } from '../api/sitaraApi';

function money(v: number | null | undefined): string {
  if (v == null) return '';
  return `$${Number(v).toFixed(2)}`;
}

export default function OperatorMenuPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [menu, setMenu] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [noBusiness, setNoBusiness] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (bizId: string, refresh = false) => {
    try {
      const m = await sitaraApi.squareCatalog(bizId, refresh);
      setMenu(m);
      setNeedsReconnect(false);
    } catch (e: any) {
      if (e?.response?.data?.error === 'NO_CATALOG_SCOPE') setNeedsReconnect(true);
      else setError(e?.response?.data?.error || 'Could not load menu.');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const biz = await sitaraApi.myBusiness().catch(() => null);
        if (!biz?.id) {
          setNoBusiness(true);
          return;
        }
        setBusinessId(biz.id);
        await load(biz.id);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    if (!businessId) return;
    setSyncing(true);
    setError(null);
    try {
      await load(businessId, true);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <p className="text-slate-500 text-sm p-8">Loading menu…</p>;
  if (noBusiness) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">No business yet</h1>
        <p className="text-slate-600 mb-6">Register your business, connect Square, and your menu imports itself.</p>
        <Link to="/sitara" className="px-6 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
          Back to Sitara
        </Link>
      </div>
    );
  }

  const items: any[] = menu?.items || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Menu</h1>
          <p className="text-slate-600 mt-1">
            {menu ? (
              <>{menu.itemCount} items · {menu.modifierListCount} modifier groups · synced {menu.syncedAt ? new Date(menu.syncedAt).toLocaleDateString() : 'just now'}</>
            ) : (
              'Synced live from your Square catalog'
            )}
          </p>
        </div>
        <button
          onClick={() => void handleSync()}
          disabled={syncing || !businessId}
          className="shrink-0 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : '↻ Sync from Square'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 mb-4">{error}</div>
      )}

      {needsReconnect && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-900">
          <p className="font-semibold mb-1">Square needs one more permission</p>
          <p className="mb-3">Your connection predates menu import. Reconnect and grant Items access — 30 seconds.</p>
          <button
            onClick={async () => {
              if (!businessId) return;
              const url = await sitaraApi.squareConnect(businessId);
              window.location.href = url;
            }}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg"
          >
            Reconnect Square
          </button>
        </div>
      )}

      {!menu && !needsReconnect && !error && (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold text-slate-900 mb-1">No menu synced yet</p>
          <p className="text-sm text-slate-500 mb-4">Connect Square, then hit Sync — items, prices, and modifiers import themselves.</p>
          <Link to="/sitara/operator" className="inline-block px-5 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-lg">
            Go to Dashboard
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-4 mt-6">
          {items.map((item: any) => (
            <div key={item.id} className="tile bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900">{item.name}</h3>
                  {item.description && <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>}
                  {item.category && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                      {item.category}
                    </span>
                  )}
                </div>
                {item.variations?.length > 0 && (
                  <div className="text-right shrink-0 text-sm">
                    {item.variations.slice(0, 3).map((v: any) => (
                      <p key={v.id} className="text-slate-700">
                        {item.variations.length > 1 && <span className="text-slate-500">{v.name} </span>}
                        <strong>{money(v.price)}</strong>
                      </p>
                    ))}
                  </div>
                )}
              </div>
              {(item.modifierLists || []).length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  {item.modifierLists.map((ml: any) => (
                    <div key={ml.id}>
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                        {ml.name}
                        <span className="normal-case font-normal text-slate-400">
                          {' '}· {ml.selectionType === 'SINGLE' ? 'pick 1' : `pick ${ml.minSelected || 0}${ml.maxSelected ? `–${ml.maxSelected}` : '+'}`}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {ml.modifiers.map((m: any) => (
                          <span key={m.id} className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-full text-xs">
                            {m.name}{m.price ? ` +${money(m.price)}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
