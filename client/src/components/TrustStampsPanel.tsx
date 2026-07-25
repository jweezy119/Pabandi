import { useQuery } from 'react-query';
import { tokens } from '../design-system';
import { listMyTrustStamps, type TrustStamp } from '../services/trustApi';
import { getAuthToken } from '../utils/authToken';

type TrustStampsPanelProps = {
  title?: string;
  emptyText?: string;
};

type StampRow = TrustStamp & {
  effectiveWeight: number;
  isTrusted: boolean;
  isExpired: boolean;
};

function isExpired(stamp: TrustStamp) {
  if (!stamp.expiresAt) return false;
  const exp = new Date(stamp.expiresAt).getTime();
  return Number.isFinite(exp) && exp <= Date.now();
}

const TRUSTED_TYPES = new Set([
  'EMAIL_CONFIRMED',
  'PHONE_VERIFIED',
  'WALLET_CONNECTED',
  'BOOKING_HISTORY',
  'POP_COMPLETION',
  'BUSINESS_PROFILE_COMPLETE',
]);

function mapStamps(stamps: TrustStamp[]): StampRow[] {
  return stamps.map((stamp) => ({
    ...stamp,
    effectiveWeight: stamp.revoked || isExpired(stamp) ? 0 : Math.max(0, stamp.weight ?? 0),
    isTrusted: TRUSTED_TYPES.has(stamp.stampType) && !stamp.revoked && !isExpired(stamp),
    isExpired: isExpired(stamp),
  }));
}

export function TrustStampsPanel({
  title = 'Trust Stamps',
  emptyText = 'No stamps yet. Verify your account to earn trust.',
}: TrustStampsPanelProps) {
  const { data, isLoading, error } = useQuery(['trust-stamps'], () => listMyTrustStamps(), {
    retry: false,
    enabled: typeof window !== 'undefined' ? Boolean(getAuthToken()) : false,
    staleTime: 1000 * 60,
  });

  const stamps = (data as TrustStamp[] | undefined) ?? [];
  const mapped = mapStamps(stamps);
  const effectiveScore = mapped.reduce((sum, stamp) => sum + stamp.effectiveWeight, 0);

  if (isLoading) {
    return (
      <div
        className="rounded-2xl border px-4 py-6 text-sm"
        style={{ background: `${tokens.color.surface}66`, borderColor: `${tokens.color.border}88`, color: tokens.color.muted }}
      >
        {title} — loading...
      </div>
    );
  }

  if (error || !stamps.length) {
    return (
      <div
        className="rounded-2xl border px-4 py-6 text-sm"
        style={{ background: `${tokens.color.surface}66`, borderColor: `${tokens.color.border}88`, color: tokens.color.muted }}
      >
        <div className="font-semibold" style={{ color: tokens.color.text }}>
          {title}
        </div>
        <p className="mt-1">{emptyText}</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: `${tokens.color.surface}66`, borderColor: `${tokens.color.border}88`, color: tokens.color.text }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${tokens.color.border}66` }}>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs font-mono" style={{ color: tokens.color.muted }}>
          {effectiveScore} pts
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: `${tokens.color.border}55` }}>
        {mapped.map((stamp) => (
          <div key={stamp.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm">{stamp.stampType.replace(/_/g, ' ').toLowerCase()}</span>
              <span className="text-xs" style={{ color: tokens.color.muted }}>
                {stamp.issuer ? `via ${stamp.issuer}` : stamp.context || '—'}
              </span>
            </div>
            <div className="text-right text-xs">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 font-mono"
                style={{
                  background: `${tokens.color[stamp.isTrusted ? 'primary' : 'muted']}18`,
                  color: tokens.color[stamp.isTrusted ? 'primary' : 'muted'],
                }}
              >
                {stamp.revoked ? 'revoked' : stamp.isExpired ? 'expired' : `${stamp.effectiveWeight} pts`}
              </span>
              {stamp.expiresAt && !stamp.revoked && !stamp.isExpired && (
                <div style={{ color: tokens.color.muted }}>
                  expires {new Date(stamp.expiresAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
