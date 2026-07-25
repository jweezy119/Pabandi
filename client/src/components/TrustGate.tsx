import { useQuery } from 'react-query';
import { tokens } from '../design-system';
import { checkTrustActionAccess, type TrustActionAccess } from '../services/trustApi';

type TrustGateProps = {
  action: 'BOOKING' | 'REVIEW' | 'AIRDROP_CLAIM' | 'REFERRAL_ACTIVATE' | 'TAP_PAY_CHECKOUT' | 'WAITLIST_JOIN';
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function TrustGate({ action, children, fallback }: TrustGateProps) {
  const { data, isLoading, error } = useQuery(['trust-access', action], () => checkTrustActionAccess(action), {
    retry: false,
    enabled:
      typeof window !== 'undefined' &&
      Boolean(localStorage.getItem('token')),
    staleTime: 1000 * 60,
  });

  if (isLoading || error || !data) {
    return <>{fallback ?? null}</>;
  }

  const access = data as TrustActionAccess;

  if (!access.allowed) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div
        className="rounded-2xl border px-4 py-4 text-sm"
        style={{
          background: `${tokens.color.warning}14`,
          borderColor: `${tokens.color.warning}44`,
          color: tokens.color.text,
        }}
      >
        <p className="font-semibold" style={{ color: tokens.color.warning }}>
          Trust gate: {action.replace('_', ' ').toLowerCase()}
        </p>
        <p className="mt-1 opacity-80">
          Required score: {access.requiredScore}
          <span className="mx-2 opacity-40">|</span>
          <span>Current score: {access.currentScore}</span>
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
