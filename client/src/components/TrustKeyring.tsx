import { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { passportService } from '../services/api';

type TrustKeyringProps = {
  userId?: string;
};

export const TrustKeyring = ({ userId }: TrustKeyringProps) => {
  const lookup = userId || 'self';
  const { data, isLoading } = useQuery(['trust-keyring', lookup], () => passportService.getMyPassport(), { enabled: Boolean(lookup) });

  const [attestations, setAttestations] = useState<{ category: string; tier: string; score: number }[]>([]);

  useEffect(() => {
    if (!data?.data?.axes?.length) return;
    const mapped = data.data.axes.map((axis: any) => ({
      category: axis.category,
      tier: axis.tier,
      score: axis.compositeScore,
    }));
    setAttestations(mapped);
  }, [data?.data?.axes]);

  const web3Staked = data?.data?.activeStake > 0;

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4">
      <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Trust Keyring</p>
      <div className="flex flex-wrap gap-2">
        {attestations.map((att) => (
          <span key={att.category} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {att.category}: {att.tier}
          </span>
        ))}
      </div>
      {web3Staked && <p className="mt-2 text-[10px] text-on-surface-variant">Web3 Verified — active stake on file</p>}
      {isLoading && <p className="mt-2 text-[10px] text-on-surface-variant">Loading keyring...</p>}
    </div>
  );
};
