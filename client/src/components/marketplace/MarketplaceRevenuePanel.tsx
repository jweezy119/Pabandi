import { useQuery } from 'react-query';
import apiClient from '../../services/api';
import { tokens } from '../../design-system';
import { DollarSign, PiggyBank, Hourglass, Wallet } from 'lucide-react';

/** Response shape for GET /agent-marketplace/revenue (ADMIN only). */
interface RevenueResponse {
  success: boolean;
  data?: {
    lifetime: {
      volumeUsd: number;
      platformFeesUsd: number;
      pabRewards: number;
      completedProjects: number;
      escrowReleases: number;
    };
    escrow: { outstandingCount: number; outstandingUsd: number; committedFeesUsd: number };
    series30d: { day: string; fees: number; volume: number }[];
  };
}

/**
 * MarketplaceRevenuePanel — the operator's money tile: what the 2% marketplace
 * fee has actually produced, and what is still parked in escrow. Feeds from
 * GET /agent-marketplace/revenue; hidden for non-admins (endpoint refuses
 * them, so the panel refuses to render rather than showing a dead number).
 */
export default function MarketplaceRevenuePanel() {
  const { data, isLoading, isError } = useQuery<RevenueResponse['data']>(
    ['agent-market-revenue'],
    () =>
      apiClient
        .get('/api/v1/agent-marketplace/revenue')
        .then((r) => r.data?.data)
        .catch(() => {
          throw new Error('forbidden');
        }),
    { staleTime: 60000, retry: false }
  );

  // Non-admins hit a 403 here — an empty tile would look like zero revenue,
  // which is a worse lie than no tile.
  if (isError || (!isLoading && !data)) return null;

  const lifetime = data?.lifetime;
  const escrow = data?.escrow;
  const fees30d = (data?.series30d ?? []).reduce((s, d) => s + (d.fees || 0), 0);

  const stats = [
    {
      label: 'Platform Fees (lifetime)',
      value: loading(lifetime?.platformFeesUsd, isLoading) ?? `$${(lifetime?.platformFeesUsd ?? 0).toFixed(2)}`,
      icon: DollarSign,
      color: tokens.color.success,
    },
    {
      label: 'Marketplace Volume',
      value: loading(lifetime?.volumeUsd, isLoading) ?? `$${(lifetime?.volumeUsd ?? 0).toFixed(2)}`,
      icon: Wallet,
      color: tokens.color.primary,
    },
    { label: 'Fees (30 days)', value: loading(fees30d, isLoading) ?? `$${fees30d.toFixed(2)}`, icon: PiggyBank, color: tokens.color.warning },
    {
      label: 'Escrow Outstanding',
      value:
        loading(escrow?.outstandingUsd, isLoading) ??
        `${(escrow?.outstandingUsd ?? 0).toFixed(2)}$ (${escrow?.outstandingCount ?? 0} open)`,
      icon: Hourglass,
      color: tokens.color.warning,
    },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
        Agent Marketplace Revenue
      </h4>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="flex items-center gap-2">
              <s.icon size={14} style={{ color: s.color }} />
              <span className="text-[11px] text-slate-400">{s.label}</span>
            </div>
            <div className="text-base font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        {lifetime?.completedProjects ?? 0} completed jobs · {escrow?.outstandingCount ?? 0} escrows awaiting
        release · fees committed in open escrow: ${(escrow?.committedFeesUsd ?? 0).toFixed(2)}
      </p>
    </div>
  );
}

function loading(value: unknown, isLoading: boolean): string | undefined {
  if (isLoading) return '...';
  if (value == null) return '$0.00';
  return undefined;
}
