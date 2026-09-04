import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { disputeService } from '../services/api';

export const DisputeCenterPage: React.FC = () => {
  const [tab, setTab] = useState<'file' | 'my'>('file');
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDisputes();
  }, []);

  const loadDisputes = async () => {
    setLoading(true);
    try {
      const res = await disputeService.list();
      setDisputes(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load disputes:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Dispute Resolution</h1>
          <p className="mt-2 text-slate-400">File and track disputes for your transactions.</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('file')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'file' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}
          >
            File Dispute
          </button>
          <button
            onClick={() => setTab('my')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'my' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}
          >
            My Disputes
          </button>
        </div>

        {tab === 'file' && <FileDisputeForm onSuccess={loadDisputes} />}
        {tab === 'my' && (
          <div className="space-y-4">
            {loading ? (
              <p className="text-slate-400">Loading...</p>
            ) : disputes.length === 0 ? (
              <Surface className="p-8 text-center">
                <div className="text-4xl mb-4">✅</div>
                <p className="text-slate-400">No disputes filed. Clean record.</p>
              </Surface>
            ) : (
              disputes.map((d) => (
                <Surface key={d.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-white">{d.type}</div>
                    <Badge tone={d.status === 'UPHELD' ? 'success' : d.status === 'VOTING' ? 'warning' : 'info'}>{d.status}</Badge>
                  </div>
                  <div className="text-sm text-slate-400">{d.description}</div>
                </Surface>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const FileDisputeForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [form, setForm] = useState({
    transactionId: '',
    type: 'ITEM_NOT_AS_DESCRIBED',
    description: '',
    evidence: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    try {
      await disputeService.fileDispute({
        reservationId: form.transactionId,
        againstId: '',
        reason: form.description,
        stakedAmount: 10,
      });
      setSubmitted(true);
      onSuccess();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to file dispute');
    }
  };

  if (submitted) {
    return (
      <Surface className="text-center p-8">
        <div className="text-5xl mb-4">⚖️</div>
        <h3 className="text-xl font-bold text-white mb-2">Dispute Filed</h3>
        <p className="text-slate-400">Your dispute has been submitted for review.</p>
      </Surface>
    );
  }

  return (
    <Surface className="p-6">
      <h3 className="text-lg font-bold text-white mb-4">File a New Dispute</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Transaction ID *</label>
          <input
            value={form.transactionId}
            onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
            placeholder="esc-abc123"
            className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Dispute Type *</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
          >
            <option value="ITEM_NOT_AS_DESCRIBED">Item not as described</option>
            <option value="ITEM_NOT_RECEIVED">Item not received</option>
            <option value="DAMAGED">Item damaged on arrival</option>
            <option value="NO_SHOW">Seller didn't show up</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Description *</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe what happened..."
            rows={4}
            className="w-full rounded-lg px-4 py-3 outline-none resize-none bg-white/5 border border-white/10 text-white"
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!form.transactionId || !form.description}
          className="w-full"
        >
          File Dispute
        </Button>
      </div>
    </Surface>
  );
};

export default DisputeCenterPage;
