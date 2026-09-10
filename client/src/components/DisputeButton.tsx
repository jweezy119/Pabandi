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
        className="px-2 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl p-3 bg-rose-500/5 border border-rose-500/20">
      <p className="text-xs font-bold mb-2 text-rose-300">File dispute on this {contextType.toLowerCase()}</p>
      <input
        value={againstId}
        onChange={e => setAgainstId(e.target.value)}
        placeholder="Disputed party user id"
        className="w-full px-2 py-1.5 rounded-lg text-xs mb-2 bg-white/5 text-slate-200 border border-white/10 focus:outline-none focus:border-rose-400"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="What went wrong?"
        rows={2}
        className="w-full px-2 py-1.5 rounded-lg text-xs bg-white/5 text-slate-200 border border-white/10 focus:outline-none focus:border-rose-400"
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isLoading || !againstId || !description}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition-colors"
        >
          {mutation.isLoading ? 'Filing…' : 'Submit'}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
