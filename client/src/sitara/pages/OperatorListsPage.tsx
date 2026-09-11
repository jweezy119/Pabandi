// Sitara OS — operator door board (guest lists)
// Every list for the business, every join, one tap to check in at the door.
// Plus the source breakdown: link vs code vs flyer — what's filling rooms.
import { useEffect, useState } from 'react';
import { sitaraApi } from '../api/sitaraApi';

export default function OperatorListsPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [lists, setLists] = useState<any[]>([]);
  const [bySource, setBySource] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<string | null>(null);

  const load = async (bizId: string) => {
    const raw: any = await sitaraApi.businessLists(bizId).catch(() => null);
    setLists(raw?.lists || []);
    setBySource(raw?.bySource || {});
  };

  useEffect(() => {
    (async () => {
      try {
        const biz = await sitaraApi.myBusiness().catch(() => null);
        if (!biz?.id) return;
        setBusinessId(biz.id);
        await load(biz.id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCheckin = async (joinId: string) => {
    setChecking(joinId);
    try {
      await sitaraApi.checkinListJoin(joinId);
      if (businessId) await load(businessId);
    } finally {
      setChecking(null);
    }
  };

  if (loading) return <p className="text-slate-500 text-sm p-8">Loading door board…</p>;
  if (!businessId) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">No business yet</h1>
        <p className="text-slate-600">Register your business to run guest lists.</p>
      </div>
    );
  }

  const active = selectedList ? lists.find((l: any) => l.id === selectedList) : lists[0];
  const joins: any[] = active?.joins || [];
  const arrived = joins.filter((j: any) => j.status === 'ARRIVED').length;
  const totalSources = Object.values(bySource).reduce((s: number, n: any) => s + Number(n), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Door Board</h1>
        <p className="text-slate-600 mt-1">Guest lists, arrivals, and what's filling your room.</p>
      </div>

      {totalSources > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Where joins come from</h3>
          <div className="space-y-1.5">
            {Object.entries(bySource).map(([s, n]) => (
              <div key={s} className="flex items-center gap-2 text-sm">
                <span className="w-20 text-slate-600 capitalize">{s}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(Number(n) / Math.max(1, totalSources)) * 100}%` }} />
                </div>
                <span className="w-8 text-right font-medium">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lists.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar mobile-scroll pb-1">
          {lists.map((l: any) => (
            <button
              key={l.id}
              onClick={() => setSelectedList(l.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium ${active?.id === l.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              {l.title}
            </button>
          ))}
        </div>
      )}

      {!active ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="font-semibold text-slate-900 mb-1">No lists yet</p>
          <p className="text-sm text-slate-500">Promoters create lists in the Promoter Hub — they'll appear here with every join.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <p className="font-semibold text-slate-900">{active.title}</p>
            <p className="text-sm text-slate-600">{arrived}/{joins.length} arrived</p>
          </div>
          {joins.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-500 text-center">Nobody joined yet — share the list link to fill it.</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {joins.map((j: any) => (
                <div key={j.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {j.name} <span className="text-slate-500 font-normal">· party of {j.partySize}</span>
                    </p>
                    <p className="text-xs text-slate-400 font-mono">{j.confirmCode} · via {j.source}</p>
                  </div>
                  {j.status === 'ARRIVED' ? (
                    <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium shrink-0">✓ In</span>
                  ) : (
                    <button
                      onClick={() => void handleCheckin(j.id)}
                      disabled={checking === j.id}
                      className="shrink-0 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                    >
                      {checking === j.id ? '…' : 'Check in'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
