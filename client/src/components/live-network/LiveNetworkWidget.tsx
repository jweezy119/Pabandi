import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/api';

interface RecentBusiness {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  source?: string;
  isVerified?: boolean;
  trustScore?: number;
  createdAt?: string;
}

interface LiveNetworkWidgetProps {
  className?: string;
  style?: React.CSSProperties;
}

export function LiveNetworkWidget({ className = '', style }: LiveNetworkWidgetProps) {
  const [businesses, setBusinesses] = useState<RecentBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecent = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/businesses/recent');
      const data: RecentBusiness[] = res.data.data || [];
      setBusinesses(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load recent businesses';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
    const interval = setInterval(fetchRecent, 30_000);
    return () => clearInterval(interval);
  }, [fetchRecent]);

  if (loading) {
    return (
      <div
        className={`bg-[var(--warm-sand)] text-[var(--warm-ink)] border border-[rgba(191,179,163,0.35)] rounded-2xl p-4 ${className}`}
        style={style}
      >
        <h3 className="text-sm font-bold mb-3 text-[var(--warm-ink)]">
          Live Network Activity
        </h3>
        <div className="h-8 bg-[rgba(191,179,163,0.2)] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`bg-[var(--warm-sand)] text-[var(--warm-ink)] border border-[rgba(191,179,163,0.35)] rounded-2xl p-4 ${className}`}
        style={style}
      >
        <h3 className="text-sm font-bold mb-2 text-[var(--warm-ink)]">
          Live Network Activity
        </h3>
        <p className="text-xs text-[var(--clay)]">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-[var(--warm-sand)] text-[var(--warm-ink)] border border-[rgba(191,179,163,0.35)] rounded-2xl p-4 ${className}`}
      style={style}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[var(--warm-ink)] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--sage)] animate-pulse" />
          Live Network Activity
        </h3>
        <span className="text-[11px] font-semibold text-[var(--soft-stone)]">
          {businesses.length} Verified Providers
        </span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {businesses.length === 0 ? (
          <p className="text-xs text-[var(--soft-stone)]">
            No recent activity. Real businesses will appear here as they join the network.
          </p>
        ) : (
          businesses.map((b) => (
            <div
              key={b.id}
              className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-white/80 border border-[rgba(191,179,163,0.3)] hover:bg-white transition-all shadow-sm"
            >
              <div className="flex items-start gap-2.5">
                <span className="text-xs leading-none mt-0.5">
                  {b.source === 'github' ? '🐙' : b.source === 'opendirectories' ? '🏛️' : '🗺️'}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[var(--warm-ink)] line-clamp-1">
                    {b.name}
                  </span>
                  <span className="text-[11px] text-[var(--soft-stone)]">
                    {b.city || 'Austin'}{b.state ? `, ${b.state}` : ''}{b.country ? `, ${b.country}` : ''}
                  </span>
                  {b.isVerified && (
                    <span className="text-[10px] font-medium text-[var(--sage)] mt-0.5">
                      ✓ Verified Profile & Escrow Guarantee
                    </span>
                  )}
                </div>
              </div>

              {b.trustScore && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--warm-sand)] text-[var(--clay)] shrink-0">
                  {Math.round(b.trustScore)} Trust
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
