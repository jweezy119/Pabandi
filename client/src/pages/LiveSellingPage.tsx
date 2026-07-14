import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { liveSellerService } from '../services/api';
import {
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';

const PLATFORMS = [
  { id: 'tiktok-live', label: 'TikTok Live', brand: 'bg-[#ff0050]/10 text-[#ff0050] border-[#ff0050]/30' },
  { id: 'youtube-shopping', label: 'YouTube Shopping', brand: 'bg-red-600/10 text-red-500 border-red-600/30' },
  { id: 'shopify-live', label: 'Shopify Live', brand: 'bg-[#95BF47]/10 text-[#95BF47] border-[#95BF47]/30' },
];

const FAQ = [
  { q: 'Do I need an app to buy?', a: 'No. Buyers checkout directly from your seller profile with escrow protection.' },
  { q: 'Do I need separate integrations for each platform?', a: 'Connect TikTok, YouTube, or Shopify in seconds. One catalog syncs across shows.' },
  { q: 'What if a buyer ghosts the show?', a: 'Escrow holds commitment. Missed bookings hurt buyer trust, not your revenue.' },
];

export default function LiveSellingPage() {
  const { isAuthenticated, user } = useAuthStore();
  const { data: integrations } = useQuery(
    ['ls-integrations'],
    async () => {
      const r = await liveSellerService.list();
      return r.data?.data || [];
    },
    { enabled: isAuthenticated }
  );

  const { data: liveStatus } = useQuery(
    ['ls-status'],
    async () => {
      const results = await Promise.allSettled(
        PLATFORMS.map(p => liveSellerService.getShowState(p.id).catch(() => ({ data: { data: {} } })))
      );
      return results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value.data?.data || {});
    },
    { enabled: isAuthenticated, refetchInterval: 15000 }
  );

  const connected = integrations || [];
  const liveNow = (liveStatus || []).filter(s => s?.isLive).length;

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10 sm:space-y-12">
        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <div className="flex items-center gap-3 mb-3">
            <VideoCameraIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="font-headline text-3xl sm:text-4xl md:text-5xl font-black leading-[1.05]">Live Selling</h1>
          </div>
          <p className="text-on-surface-variant max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed">
            Trust-first live commerce. Connect your shows, sync your catalog, and let buyers book with escrow-backed commitment—no app install required.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            {isAuthenticated ? (
              <>
                <Link to="/business/settings?tab=live-selling" className="px-4 py-3 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm sm:text-base">Open Live Seller Dashboard</Link>
                <Link to="/live-sell" className="px-4 py-3 rounded-2xl border border-outline-variant/20 hover:bg-surface-container-high active:scale-[0.99] transition-colors font-headline font-bold text-sm sm:text-base">Browse Public Hub</Link>
              </>
            ) : (
              <>
                <Link to="/login?redirect=/business/settings%3Ftab=live-selling" className="px-4 py-3 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm sm:text-base">Join as Seller</Link>
                <Link to="/live-sell" className="px-4 py-3 rounded-2xl border border-outline-variant/20 hover:bg-surface-container-high active:scale-[0.99] transition-colors font-headline font-bold text-sm sm:text-base">Browse Live Sellers</Link>
              </>
            )}
          </div>
        </section>

        {isAuthenticated && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
              <div className="flex items-center gap-2 text-primary font-headline font-black text-xs uppercase tracking-widest mb-2">Connected</div>
              <p className="font-headline font-bold text-2xl">{connected.length}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
              <div className="flex items-center gap-2 text-[#10b981] font-headline font-black text-xs uppercase tracking-widest mb-2">Live Now</div>
              <p className="font-headline font-bold text-2xl">{liveNow}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
              <div className="flex items-center gap-2 text-primary font-headline font-black text-xs uppercase tracking-widest mb-2">Seller Profile</div>
              <p className="font-headline font-bold text-sm">pabandi.com/s/{user?.id || '...'}</p>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
            <div className="flex items-center gap-2 text-primary font-headline font-black text-sm">01</div>
            <h3 className="font-headline font-bold text-base mt-2">Connect your platform</h3>
            <p className="text-xs text-on-surface-variant mt-1">Link TikTok, YouTube, or Shopify in seconds from your dashboard.</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
            <div className="flex items-center gap-2 text-primary font-headline font-black text-sm">02</div>
            <h3 className="font-headline font-bold text-base mt-2">Publish catalog + schedule</h3>
            <p className="text-xs text-on-surface-variant mt-1">Add items, set show times, and share one booking link.</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
            <div className="flex items-center gap-2 text-primary font-headline font-black text-sm">03</div>
            <h3 className="font-headline font-bold text-base mt-2">Sell with escrow trust</h3>
            <p className="text-xs text-on-surface-variant mt-1">Buyers book instantly with escrow protection and earn $PAB rewards.</p>
          </div>
        </section>

        {isAuthenticated && (
          <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8">
            <h2 className="font-headline text-xl sm:text-2xl font-bold mb-4">Connected Platforms</h2>
            {connected.length === 0 ? (
              <p className="text-xs text-on-surface-variant">No platforms connected yet. Add your first integration in the dashboard.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {connected.map((c: any) => {
                  const brand = PLATFORMS.find(p => p.id === c.platform)?.brand || 'bg-surface-container-high';
                  return (
                    <div key={c.platform} className={`rounded-2xl border border-outline-variant/20 p-4 ${brand}`}>
                      <div className="font-headline font-bold text-sm">{PLATFORMS.find(p => p.id === c.platform)?.label || c.platform}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest mt-1">Connected</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="font-headline text-xl sm:text-2xl font-bold mb-3">FAQ</h2>
          <div className="space-y-2">
            {FAQ.map(item => (
              <details key={item.q} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
                <summary className="font-headline font-bold text-sm cursor-pointer list-none">{item.q}</summary>
                <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8">
          <h2 className="font-headline text-xl sm:text-2xl font-bold mb-2">Built for trust</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Pabandi Passport credentials, escrow-backed checkout, and $PAB rewards make live commerce accountable—from stream to delivery.
          </p>
        </section>
      </div>
    </div>
  );
}
