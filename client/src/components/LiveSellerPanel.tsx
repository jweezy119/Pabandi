import { useQuery, useQueryClient, useMutation } from 'react-query';
import { useState } from 'react';
import { liveSellerService } from '../services/api';
import { VideoCameraIcon, PlayIcon, StopIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

const PLATFORMS = [
  { id: 'tiktok-live', label: 'TikTok Live', brand: 'bg-[#ff0050]/10 text-[#ff0050] border-[#ff0050]/30' },
  { id: 'youtube-shopping', label: 'YouTube Shopping', brand: 'bg-red-600/10 text-red-500 border-red-600/30' },
  { id: 'shopify-live', label: 'Shopify Live', brand: 'bg-[#95BF47]/10 text-[#95BF47] border-[#95BF47]/30' },
];

export default function LiveSellerPanel({ businessId, user }: { businessId?: string; user?: any }) {
  const qc = useQueryClient();

  const { data } = useQuery(['ls-state', businessId], () => Promise.all(PLATFORMS.map(p => liveSellerService.getShowState(p.id).catch(() => ({ data: { data: {} } })))), {
    enabled: !!businessId,
    refetchInterval: 12000,
    retry: false,
  });
  const states = (data as any) || [];
  const stateMap: Record<string, any> = {};
  PLATFORMS.forEach((p, idx) => { stateMap[p.id] = states[idx]?.data?.data || {}; });

  const toggleMutation = useMutation(({ platform, patch }: { platform: string; patch: any }) => liveSellerService.patchShowState(platform, patch), {
    onSuccess: () => qc.invalidateQueries(['ls-state', businessId]),
  });
  const addOrderMutation = useMutation(({ platform, order }: { platform: string; order: any }) => liveSellerService.addOrder(platform, order), {
    onSuccess: () => qc.invalidateQueries(['ls-state', businessId]),
  });
  const disconnectMutation = useMutation((platform: string) => liveSellerService.disconnect(platform), {
    onSuccess: () => qc.invalidateQueries(['ls-state', businessId]),
    onError: () => alert('Disconnect failed. Try again.'),
  });

  return (
    <div className="space-y-4">
      {!user ? (
        <p className="text-xs text-on-surface-variant">Sign in as a business owner to manage live selling.</p>
      ) : !businessId ? (
        <p className="text-xs text-on-surface-variant">Register a business first.</p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            {PLATFORMS.map((p) => (
              <div key={p.id} className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button type="button" onClick={() => { window.location.href = `/api/v1/integrations/livesell/connect/${p.id}`; }} className={`px-4 py-3 sm:py-2 rounded-xl border text-sm font-bold transition-colors touch-target w-full sm:w-auto text-center ${p.brand}`}>
                  {p.label} ↗
                </button>
                <button type="button" onClick={() => { if (confirm(`Disconnect ${p.label}?`)) disconnectMutation.mutate(p.id); }} className="px-4 py-3 sm:py-2 rounded-xl border border-outline-variant/20 text-sm font-bold text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors touch-target w-full sm:w-auto text-center">
                  Disconnect
                </button>
              </div>
            ))}
          </div>

          <StreamSchedule businessId={businessId} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {PLATFORMS.map((p) => {
              const show = stateMap[p.id] || {};
              const isLive = !!show.isLive;
              const orders = (show.recentOrders || []) as any[];
              const platformConnected = !!show?.id;
              return (
                <div key={p.id} className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <VideoCameraIcon className="h-4 w-4 text-primary" />
                      <h3 className="font-headline font-bold text-on-surface">{p.label}</h3>
                    </div>
                    {isLive ? (
                      <span className="flex items-center gap-1.5 font-label text-[10px] font-bold px-2 py-0.5 rounded-full bg-error-container text-on-error-container uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" /> Live
                        {show.viewerCount != null && <span className="text-on-error-container/80">· {show.viewerCount}</span>}
                      </span>
                    ) : (
                      <span className="font-label text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant uppercase tracking-widest">
                        {platformConnected ? 'Offline' : 'Not connected'}
                      </span>
                    )}
                  </div>

                  {!platformConnected && (
                    <p className="text-[11px] text-on-surface-variant mb-2">
                      Complete OAuth setup to start shows. Missing platform credentials will show an error during connect.
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button disabled={!platformConnected} onClick={() => toggleMutation.mutate({ platform: p.id, patch: { isLive: true, startedAt: new Date().toISOString() } })} className="inline-flex items-center justify-center gap-2 px-3 py-3 sm:py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50 touch-target w-full sm:w-auto">
                      <PlayIcon className="h-4 w-4" /> Start Show
                    </button>
                    <button disabled={!platformConnected || !isLive} onClick={() => toggleMutation.mutate({ platform: p.id, patch: { isLive: false, viewerCount: 0 } })} className="inline-flex items-center justify-center gap-2 px-3 py-3 sm:py-2 rounded-xl border border-outline-variant/30 text-xs font-bold text-on-surface disabled:opacity-50 touch-target w-full sm:w-auto">
                      <StopIcon className="h-4 w-4" /> End Show
                    </button>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); const name = (e.target as any).itemName?.value; const price = (e.target as any).itemPrice?.value; if (!name || !price) return; addOrderMutation.mutate({ platform: p.id, order: { buyerName: 'Live buyer', itemName: name, quantity: 1, amount: Number(price), currency: 'USD', status: 'pending', createdAt: new Date().toISOString() } }); (e.target as any).reset(); }} className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input name="itemName" placeholder="Buyer / item" className="input-field flex-1 bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 sm:px-3 sm:py-2 text-xs touch-target w-full" />
                    <input name="itemPrice" placeholder="$" className="input-field w-full sm:w-20 bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 sm:px-3 sm:py-2 text-xs touch-target" />
                    <button type="submit" className="px-3 py-3 sm:py-2 rounded-xl bg-surface-container-highest text-on-surface text-xs font-bold w-full sm:w-auto touch-target">Add</button>
                  </form>

                  <div className="mt-4">
                    <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Recent Orders</p>
                    <div className="space-y-2">
                      {orders.length === 0 && <p className="text-xs text-on-surface-variant">No orders yet.</p>}
                      {orders.map((o) => (
                        <div key={o.id} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-on-surface truncate">{o.buyerName || 'Guest buyer'}</p>
                            <p className="text-[11px] text-on-surface-variant truncate">{o.itemName ? `${o.itemName} · qty ${o.quantity}` : `Order ${o.id}`}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-on-surface">${Number(o.amount).toLocaleString()}</p>
                            <p className="text-[10px] text-on-surface-variant">{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {o.status || 'pending'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StreamSchedule({ businessId }: { businessId?: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(['ls-schedule', businessId], async () => {
    const results = await Promise.allSettled(PLATFORMS.map(p => liveSellerService.getSchedule(p.id).catch(() => ({ data: { data: [] } }))));
    const map: Record<string, any[]> = {};
    results.forEach((r, idx) => { if (r.status === 'fulfilled') map[PLATFORMS[idx].id] = r.value.data?.data ?? []; });
    return map;
  }, { enabled: !!businessId });

  const [form, setForm] = useState({ title: '', startsAt: '', endsAt: '', recurrence: 'once' as 'once' | 'weekly', note: '' });
  const [activePlatform, setActivePlatform] = useState(PLATFORMS[0].id);
  const [open, setOpen] = useState(false);

  const scheduleMutation = useMutation(({ platform, schedule }: { platform: string; schedule: any[] }) => liveSellerService.setSchedule(platform, schedule), {
    onSuccess: () => qc.invalidateQueries(['ls-schedule', businessId]),
    onError: () => alert('Failed to save schedule.'),
  });

  const add = () => {
    if (!form.startsAt || !form.endsAt) return;
    const current = data?.[activePlatform] || [];
    scheduleMutation.mutate(
      { platform: activePlatform, schedule: [...current, { ...form, id: `sch_${Date.now()}` }] },
      { onSuccess: () => setOpen(false) }
    );
  };

  const remove = (platform: string, item: any) => {
    const current = data?.[platform] || [];
    scheduleMutation.mutate({ platform, schedule: current.filter((x: any) => x.id !== item.id) });
  };

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <VideoCameraIcon className="h-4 w-4 text-primary" />
          <h3 className="font-headline font-bold text-on-surface">Stream Schedule</h3>
        </div>
        <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-[11px] font-bold">
          <PlusIcon className="h-3.5 w-3.5" /> Add stream
        </button>
      </div>
      {isLoading ? (
        <p className="text-xs text-on-surface-variant">Loading schedule...</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(data || {}).map(([platform, items]: [string, any[]]) => (
            <div key={platform}>
              <p className="font-label text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{PLATFORMS.find(x => x.id === platform)?.label || platform}</p>
              {!items?.length && <p className="text-[11px] text-on-surface-variant mb-2">No upcoming streams.</p>}
              {items?.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-on-surface truncate">{item.title || 'Untitled stream'}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      {item.startsAt ? new Date(item.startsAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''} → {item.endsAt ? new Date(item.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                    {item.note && <p className="text-[11px] text-on-surface-variant">{item.note}</p>}
                  </div>
                  <button onClick={() => remove(platform, item)} className="shrink-0 text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg p-1.5">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-3 rounded-xl border border-outline-variant/20 bg-surface-container p-4">
          <div className="flex flex-col md:flex-row gap-2 mb-2">
            <select value={activePlatform} onChange={(e) => setActivePlatform(e.target.value)} className="input-field bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-xs">
              {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Stream title" className="input-field flex-1 bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-xs" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="input-field bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-xs" />
            <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="input-field bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-xs" />
          </div>
          <div className="flex flex-col md:flex-row gap-2 mb-3">
            <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value as any })} className="input-field bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-xs">
              <option value="once">Once</option>
              <option value="weekly">Weekly</option>
            </select>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note" className="input-field flex-1 bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-xs" />
          </div>
          <button onClick={add} disabled={!form.startsAt || !form.endsAt} className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50">Save schedule</button>
        </div>
      )}
    </div>
  );
}
