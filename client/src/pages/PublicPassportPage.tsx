import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { businessService } from '../services/api';

type Business = {
  id: string;
  name: string;
  category?: string;
  address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviewCount?: number;
  description?: string | null;
  coverImageUrl?: string | null;
};

export const PublicPassportPage: React.FC = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [seller, setSeller] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        if (!sellerId) return;
        const res = await businessService.getBusiness(sellerId);
        setSeller((res.data?.data?.business as Business) ?? null);
      } catch {
        setSeller(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [sellerId]);

  return (
    <div className="min-h-screen bg-surface pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-40 bg-surface-container rounded" />
            <div className="h-4 w-full bg-surface-container rounded" />
          </div>
        ) : !seller ? (
          <div className="glass-panel p-6 rounded-3xl">
            <h1 className="text-xl font-headline font-bold mb-2">Passport unavailable</h1>
            <p className="text-sm text-on-surface-variant mb-4">
              We couldn’t find a verified seller at that link yet.
            </p>
            <Link to="/search" className="text-sm font-bold text-primary">
              Find sellers on Pabandi
            </Link>
          </div>
        ) : (
          <div className="glass-panel p-6 rounded-3xl">
            <div className="flex gap-5">
              <div className="w-20 h-20 rounded-2xl bg-surface-container-low overflow-hidden shrink-0">
                {seller.coverImageUrl && <img src={seller.coverImageUrl} alt={seller.name} className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-headline font-bold truncate">{seller.name || 'Seller'}</h1>
                <p className="text-sm text-on-surface-variant mt-1 truncate">{seller.address || seller.city || ''}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="px-2 py-1 rounded-full bg-primary-container text-on-primary-container text-[10px] font-bold uppercase tracking-widest">
                    {seller.category || 'Seller'}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">seller ID: {seller.id}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="bg-surface-container-low p-4 rounded-2xl">
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Category</p>
                <p className="text-sm font-bold text-on-surface mt-1">{seller.category || '—'}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl">
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Location</p>
                <p className="text-sm font-bold text-on-surface mt-1">{seller.city || '—'}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link to={`/s/${seller.id}?mode=instant`} className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold">
                Open checkout link
              </Link>
              <Link to={`/business/${seller.id}`} className="px-4 py-2 rounded-xl border border-outline-variant/20 text-xs font-bold text-on-surface">
                Visit business profile
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
