import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { liveSellerService } from '../services/api';
import { VideoCameraIcon, PlayCircleIcon, MapPinIcon } from '@heroicons/react/24/outline';

export default function LiveSellCustomerPage() {
  const { data } = useQuery('live-sellers-customer', async () => {
    const [tiktok, youtube, shopify] = await Promise.all([
      liveSellerService.getShowState('tiktok-live').catch(() => null),
      liveSellerService.getShowState('youtube-shopping').catch(() => null),
      liveSellerService.getShowState('shopify-live').catch(() => null),
    ]);
    return [tiktok, youtube, shopify].filter(Boolean) as any[];
  });

  const shows = data || [];
  const liveShows = shows.filter(s => s.status === 'live');

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-6">
          <VideoCameraIcon className="h-6 w-6 text-primary" />
          <h1 className="font-headline text-3xl font-black">Live Selling Now</h1>
        </div>

        {liveShows.length === 0 && (
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-8 text-center">
            <p className="text-on-surface-variant">No live shows right now. Check back later or browse sellers.</p>
            <Link to="/" className="mt-3 inline-block text-primary font-bold underline underline-offset-4">Explore businesses</Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {liveShows.map((show: any) => (
            <Link key={`${show.platform}-${show.businessId}`} to={`/s/${show.businessId}?session=${show.sessionId || ''}&mode=instant`} className="block rounded-2xl border border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high transition-colors">
              <div className="relative h-48 bg-surface-variant/30 rounded-t-2xl flex items-center justify-center">
                <PlayCircleIcon className="h-12 w-12 text-primary" />
                <span className="absolute top-3 left-3 bg-[#14F195]/20 border border-[#14F195]/30 text-[#10b981] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Live</span>
                <span className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{show.platform}</span>
              </div>
              <div className="p-4">
                <p className="font-headline font-bold text-base">{show.businessName || 'Seller'}</p>
                <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1"><MapPinIcon className="h-3 w-3" /> Live now</p>
                <button className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-[#06b6d4] text-on-primary font-headline font-bold text-sm">Join Live Show</button>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
