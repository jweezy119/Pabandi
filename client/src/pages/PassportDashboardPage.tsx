import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { passportService } from '../services/api';

export const PassportDashboardPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [category, setCategory] = useState('general');
  const [targetId, setTargetId] = useState('');
  const [stakeAmount, setStakeAmount] = useState(0);

  const { data: myData, refetch: refetchMine } = useQuery(['my-passport'], () => passportService.getMyPassport());
  const owner = myData?.data?.owner ?? '';
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
  const tier = pub?.tier || my?.tier;
  const axes = pub?.axes || my?.axes || [];

  const runScore = async () => {
    const userId = my?.owner;
    if (!userId) return;
    await scoreMutation.mutateAsync({ userId, category });
    await Promise.all([refetchMine(), refetchPublic()]);
  };

  const runStake = async () => {
    const userId = my?.owner;
    if (!userId) return;
    await stakeMutation.mutateAsync({ userId, stakeAmount });
    await Promise.all([refetchMine(), refetchPublic()]);
  };

  if (!my) {
    return <div className="min-h-screen bg-surface text-on-surface p-6 text-center">Loading passport...</div>;
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
          <div>
            <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Breakthrough Trust</p>
            <h1 className="font-headline text-2xl font-bold">Passport Dashboard</h1>
            <p className="font-body text-sm text-on-surface-variant mt-1">Multi-axis reliability score, vouches, and staked proof.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate(-1)} type="button" className="px-3 py-2 rounded-xl bg-surface-container text-sm font-bold text-on-surface-variant border border-outline-variant/30">Back</button>
            <button onClick={() => exportMutation.mutate()} disabled={exportMutation.isLoading} type="button" className="px-3 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold">
              {exportMutation.isLoading ? 'Exporting...' : 'Export JSON'}
            </button>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 mb-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center justify-between">
            <div>
              <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Trust Score</p>
              <p className="font-headline text-4xl font-bold">{axes[axes.length - 1]?.compositeScore ?? 0}</p>
              <p className="font-body text-sm text-on-surface-variant mt-1">{`Tier: ${tier?.tier || '—'}`}</p>
            </div>
            <div className="bg-surface border border-outline-variant/30 rounded-xl p-4 w-full sm:w-72">
              <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Composition</p>
              {axes.map((item: any) => (
                <div key={item.category} className="flex items-center justify-between text-sm py-1">
                  <span className="font-body text-on-surface-variant">{item.category}</span>
                  <span className="font-headline font-bold text-on-surface">{item.compositeScore}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6">
            <h2 className="font-headline text-lg font-bold mb-2">Compute Category Score</h2>
            <p className="font-body text-xs text-on-surface-variant mb-3">Score a single category axis.</p>
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
            <h2 className="font-headline text-lg font-bold mb-2">Public Passport</h2>
            <p className="font-body text-xs text-on-surface-variant mb-3">Lookup a public passport score for another user.</p>
            <input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="Target user ID" className="w-full rounded-xl border border-outline-variant/40 bg-surface p-3 mb-3" />
            <button onClick={() => qc.invalidateQueries(['public-passport', targetId])} disabled={!targetId} type="button" className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold disabled:opacity-50">
              Refresh Public Passport
            </button>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6">
            <h2 className="font-headline text-lg font-bold mb-2">Web3 Stake</h2>
            <p className="font-body text-xs text-on-surface-variant mb-3">Record stake exposure for proxy trust score.</p>
            <input type="number" value={stakeAmount} onChange={(event) => setStakeAmount(Number(event.target.value))} className="w-full rounded-xl border border-outline-variant/40 bg-surface p-3 mb-3" />
            <button onClick={runStake} disabled={stakeMutation.isLoading} type="button" className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold">
              {stakeMutation.isLoading ? 'Recording...' : 'Record Stake'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
