import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { liveSellerService } from '../services/api';
import {
  VideoCameraIcon,
  PlayCircleIcon,
  TagIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

const FAQ = [
  {
    q: 'Do I need to download an app to buy from a live show?',
    a: 'No. Buyers can join directly from Pabandi using the seller’s universal booking link. No app install, no signup wall, no account creation.'
  },
  {
    q: 'Can one seller go live across TikTok, YouTube, and Shopify at once?',
    a: 'Pabandi treats the seller’s catalog as the source of truth. Viewers can book from any linked show through the same Pabandi checkout, so inventory stays in sync.'
  },
  {
    q: 'Is there a trust layer for live commerce, or is it just impulse buying?',
    a: 'Every seller has a Pabandi Passport profile with trust signals and verified behavior. Buyers book with escrow-backed commitment, so both sides are protected.'
  },
  {
    q: 'How do I sell without building an app, website, or widget?',
    a: 'Use the seller panel to publish catalog items, then paste the same `pabandi.com/s/:sellerId` link into TikTok, Instagram, YouTube, WhatsApp, or SMS. That’s it.'
  },
  {
    q: 'What does the buyer side actually look like?',
    a: 'Buyer sees the seller profile + item, books in seconds, pays through escrow, and earns $PAB rewards for showing up. It works like instant checkout.'
  },
  {
    q: 'Does the seller get customer support for live selling?',
    a: 'Yes. WhatsApp Business is already integrated. If a buyer messages from the show, the seller gets an official WhatsApp alert. Zero extra setup required.'
  },
];

export default function LiveSellCustomerPage() {
  const { data: showsData } = useQuery('live-sellers-customer-shows', async () => {
    const platforms = ['tiktok-live','youtube-shopping','shopify-live'] as const;
    const results = await Promise.allSettled(platforms.map(p => liveSellerService.getShowState(p)));
    return results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled').map(r => r.value);
  });

  const { data: catalog } = useQuery('live-sellers-customer-catalog', async () => {
    const platforms = ['tiktok-live','youtube-shopping','shopify-live'] as const;
    const results = await Promise.allSettled(platforms.map(p => liveSellerService.getShowCatalog(p).catch(() => ({ items: [] }))));
    const catalogs = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled').map(r => r.value);
    return catalogs.flatMap(c => (c.items || []).map((it: any) => ({ ...it, platform: c.platform, businessId: c.businessId, businessName: c.businessName })));
  });

  const shows = showsData || [];
  const liveShows = shows.filter(s => s.status === 'live');
  const products = (catalog || []).filter((it: any) => it.active !== false);

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10 sm:space-y-12">

        {/* ── HERO ───────────────────────────────────────────────────── */}
        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <div className="flex items-center gap-3 mb-3">
            <VideoCameraIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="font-headline text-3xl sm:text-4xl md:text-5xl font-black leading-[1.05]">Freelance & Live Work</h1>
          </div>
          <p className="text-on-surface-variant max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed">
            One profile for live shows, gigs, and services. Buyers book instantly, pay through escrow, and you earn $PAB rewards for reliable work.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link to="/search?category=FREELANCE" className="px-4 py-3 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm sm:text-base">Find freelancers</Link>
            <Link to="/s/demo" className="px-4 py-3 rounded-2xl border border-outline-variant/20 hover:bg-surface-container-high active:scale-[0.99] transition-colors font-headline font-bold text-sm sm:text-base">Try demo checkout</Link>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
            <div className="flex items-center gap-2 text-primary font-headline font-black text-sm">01</div>
            <h3 className="font-headline font-bold text-base mt-2">Publish once</h3>
            <p className="text-xs text-on-surface-variant mt-1">Create your Pabandi profile and publish gigs or services. One link works everywhere.</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
            <div className="flex items-center gap-2 text-primary font-headline font-black text-sm">02</div>
            <h3 className="font-headline font-bold text-base mt-2">Share anywhere</h3>
            <p className="text-xs text-on-surface-variant mt-1">Drop `pabandi.com/s/:sellerId` into TikTok, YouTube, WhatsApp, or SMS. Buyers book in one tap.</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
            <div className="flex items-center gap-2 text-primary font-headline font-black text-sm">03</div>
            <h3 className="font-headline font-bold text-base mt-2">Escrow + rewards</h3>
            <p className="text-xs text-on-surface-variant mt-1">Trust through escrow-backed booking. Build a Portable Passport with every completed gig.</p>
          </div>
        </section>

        {/* ── LIVE NOW ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-headline text-xl sm:text-2xl font-bold">Available now</h2>
            {liveShows.length > 0 && <span className="text-[10px] font-black uppercase tracking-wider text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded-full">{liveShows.length} live</span>}
          </div>
          {liveShows.length === 0 ? (
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-8 text-center">
              <p className="text-on-surface-variant text-sm">No active live sessions right now. Explore freelancers below or share your own profile.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {liveShows.map((show: any) => (
                <Link key={`${show.platform}-${show.businessId}`} to={`/s/${show.businessId}?session=${show.sessionId || ''}&mode=instant`} className="block rounded-2xl border border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high active:scale-[0.99] transition-all">
                  <div className="relative h-44 bg-surface-variant/30 rounded-t-2xl flex items-center justify-center">
                    <PlayCircleIcon className="h-10 w-10 text-primary" />
                    <span className="absolute top-3 left-3 bg-[#14F195]/20 border border-[#14F195]/30 text-[#10b981] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Live</span>
                    <span className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{show.platform}</span>
                  </div>
                  <div className="p-4">
                    <p className="font-headline font-bold text-base leading-snug">{show.businessName || 'Seller'}</p>
                    <p className="text-xs text-on-surface-variant mt-1">{show.title || 'Live session'}</p>
                    <span className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-[#06b6d4] text-on-primary font-headline font-bold text-sm shadow-lg shadow-primary/20">Join Live Show</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── CATALOG ──────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-headline text-xl sm:text-2xl font-bold">Services & offers</h2>
            {products.length > 0 && <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-full">{products.length} items</span>}
          </div>
          {products.length === 0 ? (
            <p className="text-on-surface-variant text-sm">Sellers haven’t published services yet. Use the seller checkout link to book directly: <code className="bg-surface-container-high px-1 py-0.5 rounded text-xs">/s/:id</code></p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map((item: any, idx: number) => (
                <Link key={`${item.platform}-${item.id || idx}`} to={`/s/${item.businessId}?item=${encodeURIComponent(item.title || item.name || '')}&price=${item.priceCents ? (item.priceCents/100).toFixed(2) : '0'}&mode=instant`} className="block rounded-2xl border border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high active:scale-[0.99] transition-all">
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-headline font-bold text-base leading-snug">{item.title || item.name || 'Item'}</p>
                        <p className="text-xs text-on-surface-variant mt-1">{item.businessName} • {item.platform}</p>
                      </div>
                      <span className="text-xs font-black text-primary bg-primary-container/70 px-2 py-1 rounded-lg shrink-0">${item.priceCents ? (item.priceCents/100).toFixed(2) : '0'}</span>
                    </div>
                    {item.description && <p className="text-xs text-on-surface-variant line-clamp-2">{item.description}</p>}
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary"><TagIcon className="h-3.5 w-3.5" /> Book now</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── WHY BUYERS CHOOSE PABANDI ───────────────────────────── */}
        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <h2 className="font-headline text-xl sm:text-2xl md:text-3xl font-black mb-4">Why buyers choose Pabandi</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="rounded-2xl bg-surface/60 p-5">
              <div className="flex items-center gap-2 text-primary font-headline font-bold text-sm"><CheckCircleIcon className="h-5 w-5" /> Trusted identity</div>
              <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">Every seller profile is a portable Pabandi Passport with verifiable trust behavior, not throwaway social proof.</p>
            </div>
            <div className="rounded-2xl bg-surface/60 p-5">
              <div className="flex items-center gap-2 text-primary font-headline font-bold text-sm"><ShieldCheckIcon className="h-5 w-5" /> Escrow-backed commitment</div>
              <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">Buyers and sellers align on commitment through escrow-backed deposit logic, reducing chargebacks and fake show-ups.</p>
            </div>
            <div className="rounded-2xl bg-surface/60 p-5">
              <div className="flex items-center gap-2 text-primary font-headline font-bold text-sm"><CurrencyDollarIcon className="h-5 w-5" /> $PAB rewards</div>
              <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">Loyal buyers earn $PAB rewards for reliable bookings. Sellers earn verified credibility with every fulfilled show.</p>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────── */}
        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <h2 className="font-headline text-xl sm:text-2xl md:text-3xl font-black mb-4">Live Work FAQ</h2>
          <div className="space-y-3">
            {FAQ.map((item, idx) => (
              <div key={idx} className="rounded-2xl border border-outline-variant/20 bg-surface/60 p-4">
                <p className="font-headline font-bold text-sm mb-1">{item.q}</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}