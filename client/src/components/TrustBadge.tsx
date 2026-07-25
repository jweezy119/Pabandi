import { useQuery } from 'react-query';
import { getMyTrustScore } from '../services/trustApi';
import { tokens } from '../design-system';

export function trustTierLabel(tier: string) {
  if (tier === 'SILVER') return 'Silver';
  if (tier === 'GOLD') return 'Gold';
  if (tier === 'PLATINUM') return 'Platinum';
  return 'Bronze';
}

export function TrustBadge() {
  const { data, isLoading, error } = useQuery(['trust-score'], () => getMyTrustScore(), {
    retry: false,
    enabled: typeof window !== 'undefined' && Boolean(localStorage.getItem('token')),
  });

  if (isLoading || error || !data) {
    return null;
  }

  const tier = data.tier || 'BRONZE';
  const tone =
    tier === 'PLATINUM'
      ? tokens.color.primary
      : tier === 'GOLD'
        ? '#fbbf24'
        : tier === 'SILVER'
          ? '#94a3b8'
          : '#cd7f32';

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
      style={{
        background: `${tone}14`,
        color: tone,
        borderColor: `${tone}55`,
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: tone, boxShadow: `0 0 0 4px ${tone}25` }}
      />
      {trustTierLabel(tier)} Trust
      <span className="font-mono" style={{ color: tokens.color.muted }}>
        {Math.round(data.score)}
      </span>
    </span>
  );
}
