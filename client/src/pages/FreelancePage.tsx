import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { liveSellerService } from '../services/api';
import { VideoCameraIcon, PlayCircleIcon, TagIcon } from '@heroicons/react/24/outline';

export default function LiveSellCustomerPage() {
  const { data: servicesData } = useQuery('live-sellers-customer-services', async () => {
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

  const services = servicesData || [];
  const liveShows = services.filter(s => s.status === 'live');
  const products = (catalog || []).filter((it: any) => it.active !== false);

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="max-w-7xl mx-auto px-4 py-10 space-y-10">
        <div className="flex items-center gap-3">
          <VideoCameraIcon className="h-6 w-6 text-primary" />
          <h1 className="font-headline text-3xl font-black">Freelance</h1>
        </div>

        {/* Live Now */}
        <section>
          <h2 className="font-headline text-xl font-bold mb-4">Available now</h2>
          {liveShows.length === 0 ? (
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-8 text-center">
              <p className="text-on-surface-variant">No live services right now. Check back later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {liveShows.map((service: any) => (
                <Link key={`${service.platform}-${service.businessId}`} to={`/s/${service.businessId}?session=${service.sessionId || ''}&mode=instant`} className="block rounded-2xl border border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high transition-colors">
                  <div className="relative h-44 bg-surface-variant/30 rounded-t-2xl flex items-center justify-center">
                    <PlayCircleIcon className="h-12 w-12 text-primary" />
                    <span className="absolute top-3 left-3 bg-[#14F195]/20 border border-[#14F195]/30 text-[#10b981] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Live</span>
                    <span className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{service.platform}</span>
                  </div>
                  <div className="p-4">
                    <p className="font-headline font-bold text-base">{service.businessName || 'Seller'}</p>
                    <p className="text-xs text-on-surface-variant mt-1">{service.title || 'Live selling session'}</p>
                    <span className="mt-3 inline-flex px-3 py-2 rounded-xl bg-gradient-to-r from-primary to-[#06b6d4] text-on-primary font-headline font-bold text-sm">Join Live Show</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Catalog */}
        <section>
          <h2 className="font-headline text-xl font-bold mb-4">Seller catalog</h2>
          {products.length === 0 ? (
            <p className="text-on-surface-variant text-sm">No catalog items yet. Sellers can add products in their dashboard.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {products.map((item: any, idx: number) => (
                <Link key={`${item.platform}-${item.id || idx}`} to={`/s/${item.businessId}?item=${encodeURIComponent(item.title || item.name || '')}&price=${item.priceCents ? (item.priceCents/100).toFixed(2) : '0'}&mode=instant`} className="block rounded-2xl border border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high transition-colors">
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-headline font-bold text-base leading-snug">{item.title || item.name || 'Item'}</p>
                        <p className="text-xs text-on-surface-variant mt-1">{item.businessName} • {item.platform}</p>
                      </div>
                      <span className="text-xs font-black text-primary bg-primary-container/70 px-2 py-1 rounded-lg">${item.priceCents ? (item.priceCents/100).toFixed(2) : '0'}</span>
                    </div>
                    {item.description && <p className="text-xs text-on-surface-variant line-clamp-2">{item.description}</p>}
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary"><TagIcon className="h-3.5 w-3.5" /> Buy now</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
