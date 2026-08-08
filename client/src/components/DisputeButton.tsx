import { useState } from 'react';
import { useMutation } from 'react-query';
import { disputeService } from '../services/api';
import { tokens } from '../design-system';

/**
 * One-click dispute entry from a paid-work row (Payroll ledger / Cash-out history).
 * Opens an inline form prefilled with the paid-work context; the viewer supplies the
 * disputed party + reason. Posts to the arbitration engine (POST /disputes/context).
 */
export default function DisputeButton({ contextType, contextId, label = 'Dispute' }: { contextType: 'MILESTONE' | 'OFFRAMP' | 'PAYOUT'; contextId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [againstId, setAgainstId] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation(
    () => disputeService.fileContext({ contextType, contextId, againstId, description }),
    {
      onSuccess: () => { alert('Dispute filed. Jurors and/or the AI Trust Arbitrator will review.'); setOpen(false); setAgainstId(''); setDescription(''); },
      onError: (e: any) => alert(`Error: ${e.response?.data?.error || e.message}`),
    }
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-2 py-1 rounded-lg text-xs font-bold"
        style={{ background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.4)' }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl p-3" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.3)' }}>
      <p className="text-xs font-bold mb-2" style={{ color: '#f87171' }}>File dispute on this {contextType.toLowerCase()}</p>
      <input
        value={againstId}
        onChange={e => setAgainstId(e.target.value)}
        placeholder="Disputed party user id"
        className="w-full px-2 py-1.5 rounded-lg text-xs mb-2"
        style={{ background: 'rgba(0,0,0,0.25)', color: tokens.color.text, border: '1px solid rgba(255,255,255,0.15)' }}
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="What went wrong?"
        rows={2}
        className="w-full px-2 py-1.5 rounded-lg text-xs"
        style={{ background: 'rgba(0,0,0,0.25)', color: tokens.color.text, border: '1px solid rgba(255,255,255,0.15)' }}
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isLoading || !againstId || !description}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: '#f87171', color: '#0a0a0a', opacity: mutation.isLoading ? 0.6 : 1 }}
        >
          {mutation.isLoading ? 'Filing…' : 'Submit'}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'transparent', color: tokens.color.muted, border: '1px solid rgba(255,255,255,0.15)' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
