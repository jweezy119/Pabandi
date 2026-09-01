import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';

export const DisputeCenterPage: React.FC = () => {
  const [tab, setTab] = useState<'file' | 'my' | 'jury'>('file');

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-4">⚖️ Dispute Center</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-100 font-headline">
            Fair Resolution
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            File disputes, submit evidence, and let the community jury decide. No corporation — just peers.
          </p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {([
            { id: 'file', label: '📝 File Dispute' },
            { id: 'my', label: '📋 My Disputes' },
            { id: 'jury', label: '👥 Jury Duty' },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'file' && <FileDisputeForm />}
        {tab === 'my' && <MyDisputes />}
        {tab === 'jury' && <JuryDuty />}
      </div>
    </div>
  );
};

const FileDisputeForm: React.FC = () => {
  const [form, setForm] = useState({
    transactionId: '',
    type: 'ITEM_NOT_AS_DESCRIBED',
    description: '',
    evidence: '',
    stake: '10',
  });
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <Surface className="text-center">
        <div className="text-5xl mb-4">⚖️</div>
        <h3 className="text-xl font-bold text-slate-100 mb-2">Dispute Filed!</h3>
        <p className="text-sm" style={{ color: tokens.color.muted }}>
          Dispute ID: <span className="font-mono text-indigo-300">disp-{Date.now().toString(36)}</span>
        </p>
        <p className="text-sm mt-2" style={{ color: tokens.color.muted }}>
          Your stake of {form.stake} $PAB has been locked. A jury will review within 24 hours.
        </p>
      </Surface>
    );
  }

  return (
    <Surface>
      <h3 className="text-lg font-bold text-slate-100 mb-4">File a New Dispute</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Transaction ID *</label>
          <input value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} placeholder="esc-abc123" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Dispute Type *</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
            <option value="ITEM_NOT_AS_DESCRIBED">Item not as described (e.g. blank CD)</option>
            <option value="ITEM_NOT_RECEIVED">Item not received</option>
            <option value="DAMAGED">Item damaged on arrival</option>
            <option value="NO_SHOW">Seller didn't show up</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Description *</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe what happened in detail..." rows={4} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base resize-none" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Evidence (photo URLs, tracking numbers)</label>
          <textarea value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} placeholder="Paste links to photos, videos, or tracking info..." rows={2} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base resize-none" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Stake ($PAB) *</label>
          <input value={form.stake} onChange={(e) => setForm({ ...form, stake: e.target.value })} type="number" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
          <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>Stake is refunded if you win. Lost if you lose (prevents frivolous disputes).</p>
        </div>
        <Button onClick={() => setSubmitted(true)} disabled={!form.transactionId || !form.description} className="w-full">
          ⚖️ File Dispute
        </Button>
      </div>
    </Surface>
  );
};

const MyDisputes: React.FC = () => {
  const mockDisputes = [
    { id: 'disp-001', item: 'PlayStation Game (Blank CD)', amount: 50, status: 'VOTING', filed: '2 days ago', votes: '3/5 jurors' },
    { id: 'disp-002', item: 'iPhone 15 Pro (Fake)', amount: 1100, status: 'UPHELD', filed: '1 week ago', votes: 'Won 4-1' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-100">My Disputes</h3>
      {mockDisputes.map((d) => (
        <Surface key={d.id}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-slate-100">{d.item}</div>
            <Badge tone={d.status === 'UPHELD' ? 'success' : d.status === 'VOTING' ? 'warning' : 'info'}>{d.status}</Badge>
          </div>
          <div className="text-sm space-y-1" style={{ color: tokens.color.muted }}>
            <div>ID: <span className="font-mono text-indigo-300">{d.id}</span></div>
            <div>Amount: <span className="font-bold text-slate-100">${d.amount}</span></div>
            <div>Filed: {d.filed}</div>
            <div>Votes: {d.votes}</div>
          </div>
          {d.status === 'UPHELD' && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/20">
              <p className="text-xs text-emerald-300">✅ You won! Funds refunded + 10 $PAB reward.</p>
            </div>
          )}
        </Surface>
      ))}
    </div>
  );
};

const JuryDuty: React.FC = () => {
  const mockCases = [
    { id: 'disp-101', item: 'PlayStation Game (Blank CD)', amount: 50, description: 'Buyer received blank CD instead of game. Seller claims it was a mistake.', evidence: 3, votesNeeded: 2 },
    { id: 'disp-102', item: 'Nike Sneakers (Fake)', amount: 120, description: 'Buyer says sneakers are counterfeit. Seller says they are authentic.', evidence: 5, votesNeeded: 1 },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-100">Jury Duty</h3>
      <p className="text-sm" style={{ color: tokens.color.muted }}>Review evidence and vote. Earn $PAB for participating.</p>
      {mockCases.map((c) => (
        <Surface key={c.id}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-slate-100">{c.item}</div>
            <Badge tone="warning">{c.votesNeeded} votes needed</Badge>
          </div>
          <div className="text-sm" style={{ color: tokens.color.muted }}>
            <div>Amount: <span className="font-bold text-slate-100">${c.amount}</span></div>
            <div className="mt-2">{c.description}</div>
            <div className="mt-2">📎 {c.evidence} evidence items</div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm">✅ Vote for Buyer</Button>
            <Button variant="ghost" size="sm">❌ Vote for Seller</Button>
          </div>
        </Surface>
      ))}
    </div>
  );
};

export default DisputeCenterPage;
