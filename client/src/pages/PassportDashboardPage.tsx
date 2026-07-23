import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { passportService } from '../services/api';
import { TrustKeyring } from '../components/TrustKeyring';

const TIER_COPY: Record<string, { label: string; grade: string }> = {
  gem: { label: 'Gem', grade: 'Top 5%' },
  platinum: { label: 'Platinum', grade: 'Reliable' },
  gold: { label: 'Gold', grade: 'Trusted' },
  silver: { label: 'Silver', grade: 'Growing' },
  bronze: { label: 'Bronze', grade: 'New' },
};

export const PassportDashboardPage = () => {
  const qc = useQueryClient();
  const [category, setCategory] = useState('general');
  const [targetId, setTargetId] = useState('');
  const [stakeAmount, setStakeAmount] = useState(0);
  const [animatedScore, setAnimatedScore] = useState(0);

  const { data: myData, refetch: refetchMine } = useQuery(['my-passport'], () => passportService.getMyPassport());

  const owner = useMemo(() => myData?.data?.owner ?? '', [myData?.data?.owner]);
  const publicLookup = targetId || owner;
  const { data: publicData, refetch: refetchPublic } = useQuery({
    queryKey: ['public-passport', publicLookup],
    queryFn: () => passportService.getPublicSummary(publicLookup),
    enabled: Boolean(publicLookup),
  });

  const scoreMutation = useMutation((payload: { userId: string; category: string }) => passportService.computeScore(payload.userId, payload.category));
  const stakeMutation = useMutation((payload: { userId: string; stakeAmount: number }) => passportService.recordWeb3Stake(payload));
  const exportMutation = useMutation(() => passportService.exportPassport(), {
    onSuccess: (raw: any) => {
      const passport = raw?.data || raw;
      const blob = new Blob([JSON.stringify(passport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'pabandi-passport.json';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    },
  });

  const my = myData?.data || null;
  const pub = publicData?.data || null;
  const current = pub || my;
  const tier = (current?.tier) || null;
  const score = current?.axes?.length ? current.axes[current.axes.length - 1].compositeScore : 0;

  useEffect(() => {
    if (!score) return;
    const start = animatedScore;
    const end = Number(score);
    if (start === end) return;
    const duration = 800;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const tierConfig = tier ? (TIER_COPY[tier.tier?.toLowerCase()] ?? null) : null;

  const runScore = async () => {
    const userId = my?.owner || publicLookup;
    if (!userId) return;
    await scoreMutation.mutateAsync({ userId, category });
    await Promise.all([refetchMine(), refetchPublic()]);
  };

  const runStake = async () => {
    const userId = my?.owner || publicLookup;
    if (!userId) return;
    await stakeMutation.mutateAsync({ userId, stakeAmount });
    await Promise.all([refetchMine(), refetchPublic()]);
  };

  if (!my) {
    return (
      <div className="min-h-screen bg-surface text-on-surface p-6 text-center">
        <div className="max-w-sm mx-auto mt-20 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6">
          <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Loading</p>
          <p className="font-body text-sm text-on-surface-variant">Pulling your Pabandi passport signals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Breakthrough Trust</p>
            </div>
            <h1 className="font-headline text-2xl font-bold">Passport Dashboard</h1>
            <p className="font-body text-sm text-on-surface-variant mt-1">Multi-axis reliability score, vouches, staked proof, and channel signals.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportMutation.mutate()} disabled={exportMutation.isLoading} type="button" className="px-3 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold">
              {exportMutation.isLoading ? 'Exporting...' : 'Export JSON'}
            </button>
          </div>
        </div>

        {/* Hero Score */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
            <div>
              <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Trust Score</p>
              <div className="flex items-baseline gap-3">
                <p className="font-headline text-5xl font-black tracking-tight">{animatedScore}</p>
                <div className="flex items-center gap-2">
                  {tier && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider font-headline">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                      {tier.tier || 'New'}
                    </span>
                  )}
                </div>
              </div>
              <p className="font-body text-sm text-on-surface-variant mt-1">{`Grade: ${tierConfig?.grade ?? '—'}`}</p>
            </div>
            <div className="bg-surface border border-outline-variant/30 rounded-xl p-4 w-full md:w-80">
              <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Axes Composition</p>
              <div className="space-y-2">
                {(current?.axes || []).map((item: any) => (
                  <div key={item.category} className="flex items-center justify-between text-sm">
                    <span className="font-body text-on-surface-variant capitalize">{item.category.replace('_', ' ')}</span>
                    <span className="font-headline font-bold text-on-surface">{item.compositeScore}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6">
            <h2 className="font-headline text-lg font-bold mb-2">Compute Category Score</h2>
            <p className="font-body text-xs text-on-surface-variant mb-3">Score one category axis for current user or demo profile.</p>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-outline-variant/40 bg-surface p-3 mb-3">
              {['general', 'hospitality', 'live_selling', 'freelance', 'gig'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <button onClick={runScore} disabled={scoreMutation.isLoading} type="button" className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold">
              {scoreMutation.isLoading ? 'Computing...' : 'Compute Score'}
            </button>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6">
            <h2 className="font-headline text-lg font-bold mb-2">Public Passport Lookup</h2>
            <p className="font-body text-xs text-on-surface-variant mb-3">Show a public score snapshot for another user or demo profile.</p>
            <input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="Target user ID" className="w-full rounded-xl border border-outline-variant/40 bg-surface p-3 mb-3" />
            <button onClick={() => qc.invalidateQueries(['public-passport', targetId])} disabled={!targetId} type="button" className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold disabled:opacity-50">
              Refresh Public Passport
            </button>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6">
            <h2 className="font-headline text-lg font-bold mb-2">Web3 Stake</h2>
            <p className="font-body text-xs text-on-surface-variant mb-3">Record stake exposure for trust scoring.</p>
            <input type="number" value={stakeAmount} onChange={(event) => setStakeAmount(Number(event.target.value))} className="w-full rounded-xl border border-outline-variant/40 bg-surface p-3 mb-3" />
            <button onClick={runStake} disabled={stakeMutation.isLoading} type="button" className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold">
              {stakeMutation.isLoading ? 'Recording...' : 'Record Stake'}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <TrustKeyring />
        </div>
      </div>
    </div>
  );
};
