import { useQuery, useQueryClient, useMutation } from 'react-query';
import { liveSellerService } from '../services/api';
import { VideoCameraIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline';

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

  return (
    <div className="space-y-4">
      {!user ? (
        <p className="text-xs text-on-surface-variant">Sign in as a business owner to manage live selling.</p>
      ) : !businessId ? (
        <p className="text-xs text-on-surface-variant">Register a business first.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map((p) => (
              <button key={p.id} type="button" onClick={() => { window.location.href = `/api/v1/integrations/livesell/connect/${p.id}`; }} className={`px-4 py-2 rounded-xl border text-sm font-bold transition-colors ${p.brand}`}>
                {p.label} ↗
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {PLATFORMS.map((p) => {
              const show = stateMap[p.id] || {};
              const isLive = !!show.isLive;
              const orders = (show.recentOrders || []) as any[];
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
                      <span className="font-label text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant uppercase tracking-widest">Offline</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => toggleMutation.mutate({ platform: p.id, patch: { isLive: true, startedAt: new Date().toISOString() } })} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold">
                      <PlayIcon className="h-4 w-4" /> Start Show
                    </button>
                    <button onClick={() => toggleMutation.mutate({ platform: p.id, patch: { isLive: false, viewerCount: 0 } })} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-outline-variant/30 text-xs font-bold text-on-surface">
                      <StopIcon className="h-4 w-4" /> End Show
                    </button>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); const name = (e.target as any).itemName?.value; const price = (e.target as any).itemPrice?.value; if (!name || !price) return; addOrderMutation.mutate({ platform: p.id, order: { buyerName: 'Live buyer', itemName: name, quantity: 1, amount: Number(price), currency: 'USD', status: 'pending', createdAt: new Date().toISOString() } }); (e.target as any).reset(); }} className="mt-3 flex flex-col md:flex-row gap-2">
                    <input name="itemName" placeholder="Buyer / item" className="input-field flex-1 bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-xs" />
                    <input name="itemPrice" placeholder="$" className="input-field w-20 bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-xs" />
                    <button type="submit" className="px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold">Log Order</button>
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

