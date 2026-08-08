import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { ppdService, backgroundCheckService, trustPassportService } from '../services/api';
import { tokens } from '../design-system';

type Tab = 'BUILDER' | 'HOA';

interface MilestoneDraft {
  name: string;
  amountUSD: number;
  sequence: number;
  requiresLienWaiver: boolean;
}

export default function PpdWizardPage() {
  const { isAuthenticated } = useAuthStore();
  const [tab, setTab] = useState<Tab>('BUILDER');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Builder form
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [assetDesc, setAssetDesc] = useState('');
  const [requiredAmount, setRequiredAmount] = useState('100000');
  const [retentionPct, setRetentionPct] = useState('10');
  const [yieldOptIn, setYieldOptIn] = useState(true);
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { name: 'Demo & Site Prep', amountUSD: 20000, sequence: 1, requiresLienWaiver: false },
    { name: 'Framing', amountUSD: 30000, sequence: 2, requiresLienWaiver: true },
    { name: 'Rough-in (MEP)', amountUSD: 30000, sequence: 3, requiresLienWaiver: true },
    { name: 'Finish & Punch', amountUSD: 20000, sequence: 4, requiresLienWaiver: false },
  ]);
  const [result, setResult] = useState<any>(null);
  const [passportHandle, setPassportHandle] = useState('');
  const [passportUrl, setPassportUrl] = useState('');

  // HOA form
  const [communityName, setCommunityName] = useState('');
  const [treasuryWallet, setTreasuryWallet] = useState('');
  const [poolId, setPoolId] = useState('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [grantTitle, setGrantTitle] = useState('');
  const [grantAmount, setGrantAmount] = useState('500');

  useEffect(() => { setMsg(''); setErr(''); }, [tab]);

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const addMilestone = () => setMilestones((m) => [...m, { name: '', amountUSD: 0, sequence: m.length + 1, requiresLienWaiver: false }]);
  const updateMilestone = (i: number, patch: Partial<MilestoneDraft>) =>
    setMilestones((m) => m.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeMilestone = (i: number) => setMilestones((m) => m.filter((_, idx) => idx !== i));

  const milestoneSum = milestones.reduce((s, m) => s + (Number(m.amountUSD) || 0), 0);
  const retentionUSD = +(Number(requiredAmount) * (Number(retentionPct) / 100)).toFixed(2);
  const escrowTotal = +(milestoneSum + retentionUSD).toFixed(2);

  const runBuilder = async () => {
    setErr(''); setMsg(''); setResult(null);
    if (!beneficiaryName || !assetDesc || !requiredAmount) { setErr('Builder name, asset description, and total required'); return; }
    setLoading(true);
    try {
      // 1. Background-check the builder (linked to subjectId for bond pricing)
      const bc = await backgroundCheckService.preBooking({
        subjectType: 'BUSINESS',
        subjectName: beneficiaryName,
        subjectId: beneficiaryId || undefined,
        subjectCompany: beneficiaryName,
      });
      const bcId = bc.data?.data?.checkId;
      // 2. Create milestone project
      const res = await ppdService.createMilestoneProject({
        landlordId: beneficiaryId || beneficiaryName.replace(/\s/g, '_').toLowerCase(),
        depositContext: 'BUILDER',
        assetDescription: assetDesc,
        requiredAmountUSD: Number(requiredAmount),
        yieldOptIn,
        retentionPct: Number(retentionPct),
        beneficiaryBackgroundCheckId: bcId,
        milestones: milestones.map((m) => ({
          name: m.name, amountUSD: Number(m.amountUSD), sequence: m.sequence, requiresLienWaiver: m.requiresLienWaiver,
        })),
      });
      setResult({ ...res.data?.data, bcId, bcRecommendation: bc.data?.data?.recommendation });
      setMsg('Project escrow created. Draws + retention scheduled.');
    } catch (e: any) {
      setErr(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  };

  const quoteBond = async () => {
    if (!result?.deposit?.id) { setErr('Create the project first'); return; }
    setLoading(true);
    try {
      const bond = await ppdService.underwriteBond({
        depositId: result.deposit.id,
        beneficiaryId: beneficiaryId || beneficiaryName.replace(/\s/g, '_').toLowerCase(),
        depositContext: 'BUILDER',
        coverageUSD: Number(requiredAmount),
      });
      setResult((r: any) => ({ ...r, bond: bond.data?.data }));
      setMsg('Performance bond underwritten — capital freed from deposit.');
    } catch (e: any) {
      setErr(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  };

  const mintPassport = async () => {
    if (!result?.deposit?.id) { setErr('Create the project first'); return; }
    if (!passportHandle) { setErr('Enter a passport handle'); return; }
    setLoading(true);
    try {
      const ref = beneficiaryId || beneficiaryName.replace(/\s/g, '_').toLowerCase();
      await trustPassportService.create({
        handle: passportHandle,
        displayName: beneficiaryName,
        category: 'BUILDER',
        providerRef: ref,
        bio: assetDesc,
      });
      const url = `${window.location.origin}/trust/${passportHandle}`;
      setPassportUrl(url);
      setMsg('Trust Passport live — share the link with clients.');
    } catch (e: any) {
      setErr(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  };

  const createPool = async () => {
    if (!communityName) { setErr('Community name required'); return; }
    setLoading(true);
    try {
      const res = await ppdService.createCommunityPool({ communityName, treasuryWallet: treasuryWallet || undefined });
      setPoolId(res.data?.data?.id);
      setMsg('Community pool created.');
    } catch (e: any) { setErr(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  const loadDashboard = async (id: string) => {
    try {
      const res = await ppdService.getCommunityDashboard(id);
      setDashboard(res.data?.data);
    } catch (e: any) { setErr(e.response?.data?.error || e.message); }
  };

  const proposeGrant = async () => {
    if (!poolId || !grantTitle) { setErr('Pool + grant title required'); return; }
    setLoading(true);
    try {
      await ppdService.proposeGrant(poolId, { title: grantTitle, amountUSD: Number(grantAmount) });
      setMsg('Grant proposed to community.');
      await loadDashboard(poolId);
    } catch (e: any) { setErr(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  const approveGrant = async (gid: string) => {
    try {
      await ppdService.approveGrant(gid, { approvedBy: 'hoa_member' });
      if (poolId) await loadDashboard(poolId);
    } catch (e: any) { setErr(e.response?.data?.error || e.message); }
  };

  return (
    <div className="min-h-screen font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .anim-fade-up { animation: fadeUp .45s ease-out both; }
        .card-lift { transition: transform .2s ease, box-shadow .2s ease; }
        .card-lift:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(0,0,0,0.25); }
        .input-pab { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 10px 12px; color: inherit; width: 100%; outline: none; }
        .input-pab:focus { border-color: ${tokens.color.primary}; }
        .btn-pab { background: ${tokens.color.primary}; color: #0a0a0a; font-weight: 700; border-radius: 12px; padding: 11px 18px; cursor: pointer; border: none; }
        .btn-pab:disabled { opacity: .5; cursor: not-allowed; }
        .btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: inherit; border-radius: 12px; padding: 11px 18px; cursor: pointer; }
        .tab-on { border-color: ${tokens.color.primary}; color: ${tokens.color.primary}; }
      `}</style>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="anim-fade-up">
          <p className="text-xs uppercase tracking-widest opacity-60 mb-2">Protected Deposit</p>
          <h1 className="font-headline text-3xl sm:text-4xl font-bold">Pabandi Protected Deposit</h1>
          <p className="opacity-70 mt-2 max-w-2xl">
            Milestone-gated escrow for builders, performance bonds that free up capital, and HOA
            community pools where idle deposit yield funds local amenities. Trust discount + yield,
            not custodial risk.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 anim-fade-up">
          {(['BUILDER', 'HOA'] as Tab[]).map((t) => (
            <button key={t} className={`px-4 py-2 rounded-xl border font-semibold text-sm ${tab === t ? 'tab-on' : ''}`} onClick={() => setTab(t)}>
              {t === 'BUILDER' ? 'Builders / Construction' : 'HOA Community'}
            </button>
          ))}
        </div>

        {err && <p className="text-red-400 text-sm">{err}</p>}
        {msg && <p className="text-green-400 text-sm">{msg}</p>}

        {/* BUILDER TAB */}
        {tab === 'BUILDER' && (
          <div className="anim-fade-up card-lift rounded-3xl p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="text-xs uppercase opacity-60">Builder / Company</label>
                <input className="input-pab mt-1" placeholder="Apex Builders LLC" value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} /></div>
              <div><label className="text-xs uppercase opacity-60">Builder ID (for bond pricing)</label>
                <input className="input-pab mt-1" placeholder="builder_apex_001" value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)} /></div>
              <div className="sm:col-span-2"><label className="text-xs uppercase opacity-60">Project</label>
                <input className="input-pab mt-1" placeholder="123 Main St full build" value={assetDesc} onChange={(e) => setAssetDesc(e.target.value)} /></div>
              <div><label className="text-xs uppercase opacity-60">Total Contract ($)</label>
                <input className="input-pab mt-1" type="number" value={requiredAmount} onChange={(e) => setRequiredAmount(e.target.value)} /></div>
              <div><label className="text-xs uppercase opacity-60">Retention % (warranty hold)</label>
                <input className="input-pab mt-1" type="number" value={retentionPct} onChange={(e) => setRetentionPct(e.target.value)} /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold">Milestone Draws</label>
                <button className="btn-ghost text-xs" onClick={addMilestone}>+ Add draw</button>
              </div>
              <div className="space-y-2">
                {milestones.map((m, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input className="input-pab" style={{ flex: 2 }} placeholder="Phase name" value={m.name} onChange={(e) => updateMilestone(i, { name: e.target.value })} />
                    <input className="input-pab" style={{ flex: 1 }} type="number" placeholder="USD" value={m.amountUSD} onChange={(e) => updateMilestone(i, { amountUSD: Number(e.target.value) })} />
                    <label className="text-xs opacity-60 flex items-center gap-1">
                      <input type="checkbox" checked={m.requiresLienWaiver} onChange={(e) => updateMilestone(i, { requiresLienWaiver: e.target.checked })} /> lien
                    </label>
                    <button className="text-red-400 text-xs" onClick={() => removeMilestone(i)}>✕</button>
                  </div>
                ))}
              </div>
              <p className="text-xs opacity-60 mt-2">
                Draws: {fmt(milestoneSum)} · Retention: {fmt(retentionUSD)} · <b>Escrowed: {fmt(escrowTotal)}</b>
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={yieldOptIn} onChange={(e) => setYieldOptIn(e.target.checked)} /> Route idle deposit into yield (lower net cost)
            </label>

            {/* Mint passport */}
            <div className="rounded-2xl p-4 mt-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-sm font-semibold">Trust Passport</p>
              <p className="text-xs opacity-60 mt-1">Turn this provider's verified trust into a shareable link. Counterparties verify with one click — no login.</p>
              <div className="flex gap-2 mt-3 items-end">
                <div className="flex-1"><label className="text-xs uppercase opacity-60">Passport handle</label>
                  <input className="input-pab mt-1" placeholder="apex-builders" value={passportHandle} onChange={(e) => setPassportHandle(e.target.value)} /></div>
                <button className="btn-ghost text-sm" onClick={mintPassport} disabled={loading || !result}>{result ? 'Create Passport' : 'Create Escrow First'}</button>
              </div>
              {passportUrl && <p className="text-xs text-green-400 mt-2">Passport live: <a href={passportUrl} className="underline">{passportUrl}</a></p>}
            </div>

            <div className="flex gap-3">
              <button className="btn-pab" onClick={runBuilder} disabled={loading}>{loading ? 'Working…' : 'Create Protected Escrow'}</button>
              <button className="btn-ghost" onClick={quoteBond} disabled={loading || !result}>Underwrite Performance Bond</button>
            </div>

            {result && (
              <div className="rounded-2xl p-4 mt-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-sm"><b>BC:</b> {result.bcRecommendation} · <b>Deposit:</b> {fmt(result.deposit?.actualDepositUSD)} actual (trust-discounted)</p>
                <p className="text-xs opacity-60 mt-1">{result.milestones?.length} draws scheduled (incl. retention)</p>
                {result.bond && (
                  <p className="text-sm mt-2"><b>Bond:</b> coverage {fmt(result.bond.coverageUSD)} · premium {fmt(result.bond.premiumUSD)} · velocity×{result.bond.velocityMult}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* HOA TAB */}
        {tab === 'HOA' && (
          <div className="anim-fade-up card-lift rounded-3xl p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="text-xs uppercase opacity-60">Community / HOA name</label>
                <input className="input-pab mt-1" placeholder="Sunny Acres HOA" value={communityName} onChange={(e) => setCommunityName(e.target.value)} /></div>
              <div><label className="text-xs uppercase opacity-60">Treasury wallet (optional)</label>
                <input className="input-pab mt-1" placeholder="Solana wallet" value={treasuryWallet} onChange={(e) => setTreasuryWallet(e.target.value)} /></div>
            </div>
            <div className="flex gap-3">
              <button className="btn-pab" onClick={createPool} disabled={loading}>{loading ? 'Working…' : 'Create Community Pool'}</button>
              {poolId && <button className="btn-ghost" onClick={() => loadDashboard(poolId)}>Refresh Dashboard</button>}
            </div>

            {poolId && (
              <>
                <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-sm font-semibold mb-2">Community Dashboard (public)</p>
                  {dashboard ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div><p className="text-lg font-bold">{fmt(dashboard.totalDepositsUSD || 0)}</p><p className="text-xs opacity-60">Deposits</p></div>
                      <div><p className="text-lg font-bold text-green-400">{fmt(dashboard.totalYieldUSD || 0)}</p><p className="text-xs opacity-60">Yield earned</p></div>
                      <div><p className="text-lg font-bold text-blue-400">{fmt(dashboard.totalDistributedUSD || 0)}</p><p className="text-xs opacity-60">Distributed</p></div>
                      <div><p className="text-lg font-bold">{fmt(dashboard.availableYieldUSD || 0)}</p><p className="text-xs opacity-60">Available</p></div>
                    </div>
                  ) : <p className="text-xs opacity-60">Click refresh to load.</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <div className="sm:col-span-2"><label className="text-xs uppercase opacity-60">Grant / amenity proposal</label>
                    <input className="input-pab mt-1" placeholder="Park bench repair" value={grantTitle} onChange={(e) => setGrantTitle(e.target.value)} /></div>
                  <div><label className="text-xs uppercase opacity-60">USD</label>
                    <input className="input-pab mt-1" type="number" value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} /></div>
                </div>
                <button className="btn-ghost" onClick={proposeGrant} disabled={loading}>Propose Grant</button>

                {dashboard?.grants?.length > 0 && (
                  <div className="space-y-2">
                    {dashboard.grants.map((g: any) => (
                      <div key={g.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div><p className="text-sm font-semibold">{g.title}</p><p className="text-xs opacity-60">{fmt(g.amountUSD)} · {g.status}</p></div>
                        {g.status === 'PROPOSED' && <button className="btn-pab text-xs" onClick={() => approveGrant(g.id)}>Approve & Fund</button>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!isAuthenticated && <p className="text-sm opacity-60">Log in to create escrows and manage community pools.</p>}
      </div>
    </div>
  );
}
