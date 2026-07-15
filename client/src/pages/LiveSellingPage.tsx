import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { liveSellerService } from '../services/api';
import {
  VideoCameraIcon,
  PlayCircleIcon,
  ArrowRightIcon,
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
        .map(r => (r.value as any)?.data || {});
    },
    { enabled: isAuthenticated, refetchInterval: 15000 }
  );

  const connected = integrations || [];
  const liveNow = (liveStatus || []).filter((s: any) => s?.isLive).length;

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10 sm:space-y-12">
        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <div className="flex items-center gap-3 mb-3">
            <VideoCameraIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="font-headline text-3xl sm:text-4xl md:text-5xl font-black leading-[1.05]">Sell Live</h1>
          </div>
          <p className="text-on-surface-variant max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed">
            One catalog. One link. Escrow-backed instant checkout from TikTok, YouTube, or Shopify.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            {isAuthenticated ? (
              <>
                <Link to="/business/settings?tab=live-selling" className="px-4 py-3 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm sm:text-base">Open Dashboard</Link>
                <Link to="/live-sell" className="px-4 py-3 rounded-2xl border border-outline-variant/20 hover:bg-surface-container-high active:scale-[0.99] transition-colors font-headline font-bold text-sm sm:text-base">Public Buyer Hub</Link>
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
          {[
            { label: '01', title: 'Connect your platform', text: 'Link TikTok, YouTube, or Shopify in seconds from your dashboard.', href: '/business/settings?tab=live-selling', cta: isAuthenticated ? 'Connect now' : 'Create account' },
            { label: '02', title: 'Publish catalog + schedule', text: 'Add items, set show times, and share one booking link.', href: '/live-sell', cta: 'Browse buyers' },
            { label: '03', title: 'Sell with escrow trust', text: 'Buyers book instantly with $PAB rewards and escrow protection.', href: '/live-sell', cta: 'See how' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
              <div className="flex items-center gap-2 text-primary font-headline font-black text-sm">{item.label}</div>
              <h3 className="font-headline font-bold text-base mt-2">{item.title}</h3>
              <p className="text-xs text-on-surface-variant mt-1">{item.text}</p>
              <Link to={item.href} className="inline-flex items-center gap-1 mt-4 text-xs font-black uppercase tracking-widest text-primary">
                {item.cta} <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </section>

        {isAuthenticated && (
          <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8">
            <h2 className="font-headline text-xl sm:text-2xl font-bold mb-4">Connected Platforms</h2>
            {connected.length === 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-on-surface-variant">No platforms connected yet. Add your first integration in the dashboard.</p>
                <Link to="/business/settings?tab=live-selling" className="px-4 py-2.5 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm">Go to Live Seller Settings</Link>
              </div>
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
          <h2 className="font-headline text-xl sm:text-2xl font-bold mb-3">Current live shows</h2>
          <LiveNowList />
        </section>

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

function LiveNowList() {
  const { data } = useQuery('ls-customer-status', async () => {
    const platforms = ['tiktok-live','youtube-shopping','shopify-live'] as const;
    const results = await Promise.allSettled(platforms.map(p => liveSellerService.getShowState(p).catch(() => ({ data: { data: {} } }))));
    return results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled').map(r => r.value.data?.data || {});
  });

  const shows = (data || []).filter((s: any) => s?.isLive);
  if (!shows.length) {
    return (
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-8 text-center">
        <p className="text-on-surface-variant text-sm">No shows are live right now. Browse seller catalogs on the public hub.</p>
        <Link to="/live-sell" className="mt-3 inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-primary">Open Live Hub</Link>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {shows.map((show: any) => (
        <Link key={`${show.platform}-${show.businessId}`} to={`/s/${show.businessId}?session=${show.sessionId || ''}&mode=instant`} className="block rounded-2xl border border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high active:scale-[0.99] transition-all">
          <div className="relative h-40 bg-surface-variant/30 rounded-t-2xl flex items-center justify-center">
            <PlayCircleIcon className="h-10 w-10 text-primary" />
            <span className="absolute top-3 left-3 bg-[#14F195]/20 border border-[#14F195]/30 text-[#10b981] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Live</span>
            <span className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{show.platform}</span>
          </div>
          <div className="p-4">
            <p className="font-headline font-bold text-base leading-snug">{show.businessName || 'Seller'}</p>
            <p className="text-xs text-on-surface-variant mt-1">{show.title || 'Live selling session'}</p>
            <span className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-[#06b6d4] text-on-primary font-headline font-bold text-sm shadow-lg shadow-primary/20">Join Live Show</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
