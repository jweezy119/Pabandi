import { useState, useEffect, useCallback } from 'react';
import { Badge, tokens } from '../../design-system';
import { apiClient, API_HOST } from '../../services/api';

interface RecentBusiness {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  source?: string;
  isVerified?: boolean;
  trustScore?: number;
  createdAt: string;
}

interface LiveNetworkWidgetProps {
  className?: string;
}

export function LiveNetworkWidget({ className }: LiveNetworkWidgetProps = {}) {
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
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load recent businesses');
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
      <div className={className} style={{ background: tokens.color.surfaceContainer }}>
        <div className="p-4">
          <h3 className="text-sm font-bold mb-3" style={{ color: tokens.color.text }}>
            Live Network
          </h3>
          <div className="h-8 bg-white/5 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} style={{ background: tokens.color.surfaceContainer }}>
        <div className="p-4">
          <h3 className="text-sm font-bold mb-3" style={{ color: tokens.color.text }}>
            Live Network
          </h3>
          <p className="text-xs" style={{ color: tokens.color.danger }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ background: tokens.color.surfaceContainer }}>
      <div className="p-4">
        <h3 className="text-sm font-bold mb-3" style={{ color: tokens.color.text }}>
          Live Network
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {businesses.length === 0 ? (
            <p className="text-xs" style={{ color: tokens.color.textMuted }}>
              No recent activity. Businesses will appear here as they join the network.
            </p>
          ) : (
            businesses.map((b) => (
              <div
                key={b.id}
                className="flex items-start gap-2 p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition"
              >
                <Badge tone="success" className="text-[10px] leading-none">
                  ✅
                </Badge>
                <div className="flex flex-col">
                  <span className="text-xs font-medium" style={{ color: tokens.color.text }}>
                    {b.name}
                  </span>
                  <span className="text-[10px]" style={{ color: tokens.color.textMuted }}>
                    {b.city}, {b.state}{b.country ? `, ${b.country}` : ''}
                  </span>
                  {b.isVerified && (
                    <span className="text-[10px]" style={{ color: tokens.color.success }}>
                      Verified via {b.source || 'Government Registry'}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
