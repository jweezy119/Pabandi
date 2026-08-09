import { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { disputeService } from '../services/api';
import { tokens } from '../design-system';

const OUTCOME_LABEL: Record<string, string> = {
  PENDING: 'Open',
  VOTING: 'Voting',
  UPHELD: 'Upheld',
  DISMISSED: 'Dismissed',
  RESOLVED: 'Resolved',
};

export default function ArbitrationPage() {
  const [status, setStatus] = useState<string>('');
  const { data, isLoading } = useQuery(
    ['disputes', status],
    () => disputeService.list(status || undefined),
    { refetchInterval: 15000 }
  );

  const disputes = (data as any)?.disputes || [];

  return (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in pb-20 font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <h1 className="text-3xl font-black font-headline tracking-tight" style={{ color: tokens.color.text }}>
        Community Arbitration
      </h1>
      <p className="text-sm mt-2" style={{ color: tokens.color.muted }}>
        Trust-gated peer jury. High-trust members (Trust Score &gt; 90) vote on open disputes.
        Low-value claims auto-resolve via Pabandi's AI Trust Arbitrator. No chargebacks — just verified work and fair rulings.
      </p>

      <div className="mt-4 flex gap-2 flex-wrap">
        {(['', 'PENDING', 'VOTING', 'UPHELD', 'DISMISSED', 'RESOLVED'] as const).map(s => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{
              background: status === s ? tokens.color.primary : 'transparent',
              color: status === s ? '#0a0a0a' : tokens.color.muted,
              border: `1px solid ${status === s ? tokens.color.primary : 'rgba(255,255,255,0.15)'}`,
            }}
          >
            {s === '' ? 'All' : OUTCOME_LABEL[s] || s}
          </button>
        ))}
      </div>

      <FileDisputeForm />

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-sm" style={{ color: tokens.color.muted }}>Loading disputes…</p>}
        {!isLoading && disputes.length === 0 && (
          <p className="text-sm" style={{ color: tokens.color.muted }}>No disputes {status ? `with status ${status}` : 'filed'}. Clean ledger. 🎉</p>
        )}
        {disputes.map((d: any) => (
          <DisputeCard key={d.id} d={d} />
        ))}
      </div>
    </div>
  );
}

function FileDisputeForm() {
  const [contextType, setContextType] = useState<'MILESTONE' | 'OFFRAMP' | 'PAYOUT'>('MILESTONE');
  const [contextId, setContextId] = useState('');
  const [againstId, setAgainstId] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation(
    () => disputeService.fileContext({ contextType, contextId, againstId, description }),
    {
      onSuccess: () => { alert('Dispute filed. Jurors and/or AI arbitrator will review.'); setContextId(''); setAgainstId(''); setDescription(''); },
      onError: (e: any) => alert(`Error: ${e.response?.data?.error || e.message}`),
    }
  );

  return (
    <div className="mt-4 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h3 className="text-sm font-bold mb-3">File a dispute on paid work</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select value={contextType} onChange={e => setContextType(e.target.value as any)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(0,0,0,0.25)', color: tokens.color.text, border: '1px solid rgba(255,255,255,0.15)' }}>
          <option value="MILESTONE">Milestone release</option>
          <option value="OFFRAMP">Off-ramp payout</option>
          <option value="PAYOUT">Cash-out</option>
        </select>
        <input value={contextId} onChange={e => setContextId(e.target.value)} placeholder="Context ID (milestone / payout id)" className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(0,0,0,0.25)', color: tokens.color.text, border: '1px solid rgba(255,255,255,0.15)' }} />
        <input value={againstId} onChange={e => setAgainstId(e.target.value)} placeholder="Disputed party user id" className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(0,0,0,0.25)', color: tokens.color.text, border: '1px solid rgba(255,255,255,0.15)' }} />
      </div>
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What went wrong?" rows={2} className="w-full mt-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(0,0,0,0.25)', color: tokens.color.text, border: '1px solid rgba(255,255,255,0.15)' }} />
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isLoading || !contextId || !againstId || !description}
        className="mt-3 px-4 py-2 rounded-lg text-sm font-bold"
        style={{ background: tokens.color.primary, color: '#0a0a0a', opacity: mutation.isLoading ? 0.6 : 1 }}
      >
        {mutation.isLoading ? 'Filing…' : 'File dispute'}
      </button>
    </div>
  );
}

function DisputeCard({ d }: { d: any }) {
  const voteMutation = useMutation(
    (voteForId: string) => disputeService.vote(d.id, { voteForId, reason: 'Peer juror review' }),
    { onSuccess: () => { alert('Vote recorded. Thank you for keeping the trust economy honest.'); } }
  );

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>
            {OUTCOME_LABEL[d.outcome] || d.outcome}
          </span>
          <span className="text-xs ml-2" style={{ color: tokens.color.muted }}>
            {d.contextType || 'RESERVATION'} · {d.type}
          </span>
        </div>
        <span className="text-xs" style={{ color: tokens.color.muted }}>{new Date(d.createdAt).toLocaleDateString()}</span>
      </div>
      <p className="text-sm mt-2" style={{ color: tokens.color.text }}>{d.description}</p>
      {/* Real trust signal: disputed party's latest background-check verdict */}
      {d.userId && (
        <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: tokens.color.muted }}>
          <span className="material-symbols-outlined text-[14px]" style={{ color: tokens.color.primary }}>fact_check</span>
          <span>Counterparty: </span>
          {d.check ? (
            <>
              <span className="font-semibold">Background check:</span>
              <span
                className="px-1.5 py-0.25 rounded text-[10px] font-bold"
                style={{
                  background: d.check.recommendation === 'REJECT' ? 'rgba(239,63,63,0.2)' : d.check.recommendation === 'REVIEW' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
                  color: d.check.recommendation === 'REJECT' ? '#fca5a5' : d.check.recommendation === 'REVIEW' ? '#fcd34d' : '#86efac',
                }}
              >
                {d.check.riskBand ? `Band ${d.check.riskBand}` : 'Checked'} · {d.check.recommendation}
              </span>
              {d.check.riskScore != null && <span>({d.check.riskScore}/100)</span>}
            </>
          ) : (
            <span style={{ color: tokens.color.muted }}>No recent verification on file</span>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: tokens.color.muted }}>
        <span>Staked: {d.stakedAmount} PAB</span>
        <span>Votes: {d.votes?.length || 0}</span>
        {d.contextId && <span>Ref: {d.contextId.slice(0, 12)}…</span>}
      </div>

      {d.outcome === 'PENDING' && d.userId && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => voteMutation.mutate(d.userId)}
            disabled={voteMutation.isLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: tokens.color.primary, color: '#0a0a0a' }}
          >
            Uphold dispute (worker at fault)
          </button>
          <button
            onClick={() => voteMutation.mutate(d.reportedById)}
            disabled={voteMutation.isLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'transparent', color: tokens.color.muted, border: '1px solid rgba(255,255,255,0.15)' }}
          >
            Dismiss (worker paid fair)
          </button>
        </div>
      )}
    </div>
  );
}
