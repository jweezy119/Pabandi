import { useQuery } from 'react-query';
import { tokens } from '../design-system';
import { checkTrustActionAccess, type TrustActionAccess } from '../services/trustApi';
import { getAuthToken } from '../utils/authToken';

type TrustGateProps = {
  action: 'BOOKING' | 'REVIEW' | 'AIRDROP_CLAIM' | 'REFERRAL_ACTIVATE' | 'TAP_PAY_CHECKOUT' | 'WAITLIST_JOIN';
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function TrustGate({ action, children, fallback }: TrustGateProps) {
  const { data, isLoading, error } = useQuery(['trust-access', action], () => checkTrustActionAccess(action), {
    retry: false,
    enabled: typeof window !== 'undefined' ? Boolean(getAuthToken()) : false,
    staleTime: 1000 * 60,
  });

  if (isLoading || error || !data) {
    return <>{fallback ?? null}</>;
  }

  const access = data as TrustActionAccess;

  return (
    <>
      {children}
    </>
  );

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm">
      <p className="font-semibold text-amber-300">
        Trust gate: {action.replace('_', ' ').toLowerCase()}
      </p>
      <p className="mt-1 text-slate-300 opacity-80">
        Required score: {access.requiredScore}
        <span className="mx-2 opacity-40">|</span>
        <span>Current score: {access.currentScore}</span>
      </p>
    </div>
  );
}
