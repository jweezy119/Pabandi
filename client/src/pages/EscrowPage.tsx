import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';

export const EscrowPage: React.FC = () => {
  const [tab, setTab] = useState<'how' | 'new' | 'active' | 'disputes'>('how');

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-4">🔒 Secured Escrow</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-100 font-headline">
            Pabandi Escrow
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            Every transaction is protected by smart-contract escrow. Funds are locked until both parties confirm the exchange.
          </p>
        </div>

        {/* Tab Nav */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {([
            { id: 'how', label: '🔍 How It Works' },
            { id: 'new', label: '➕ New Transaction' },
            { id: 'active', label: '📋 Active' },
            { id: 'disputes', label: '⚖️ Disputes' },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'how' && (
          <div className="space-y-6">
            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-4">How Pabandi Escrow Protects You</h3>
              <div className="space-y-4">
                {[
                  { step: 1, icon: '🤝', title: 'Agree on Terms', desc: 'Buyer and seller agree on item, price, and meetup details.' },
                  { step: 2, icon: '🔒', title: 'Fund Escrow', desc: 'Buyer locks funds in a smart contract. Seller sees the money is secured.' },
                  { step: 3, icon: '📦', title: 'Seller Ships/Meets', desc: 'Seller delivers the item or meets at a SafeMeet spot.' },
                  { step: 4, icon: '✅', title: 'Buyer Confirms', desc: 'Buyer inspects and confirms. Funds release to seller.' },
                  { step: 5, icon: '⚖️', title: 'Dispute if Needed', desc: 'If something is wrong, file a dispute. Community jury decides.' },
                ].map((s) => (
                  <div key={s.step} className="flex gap-4 p-4 rounded-xl bg-white/5">
                    <div className="text-3xl">{s.icon}</div>
                    <div>
                      <div className="font-bold text-slate-100">Step {s.step}: {s.title}</div>
                      <div className="text-sm" style={{ color: tokens.color.muted }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>

            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-4">Why Use Escrow?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl mb-2">🛡️</div>
                  <div className="font-bold text-slate-100">No More Scams</div>
                  <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Seller can't run away with your money</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">👁️</div>
                  <div className="font-bold text-slate-100">Inspect Before Paying</div>
                  <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Check the item before funds release</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">⚖️</div>
                  <div className="font-bold text-slate-100">Fair Disputes</div>
                  <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Community jury, not a corporation</p>
                </div>
              </div>
            </Surface>

            <div className="text-center">
              <Button onClick={() => setTab('new')} size="lg">Start a Secured Transaction →</Button>
            </div>
          </div>
        )}

        {tab === 'new' && (
          <NewTransactionForm />
        )}

        {tab === 'active' && (
          <ActiveTransactions />
        )}

        {tab === 'disputes' && (
          <DisputesTab />
        )}
      </div>
    </div>
  );
};

const NewTransactionForm: React.FC = () => {
  const [form, setForm] = useState({
    itemTitle: '',
    amount: '',
    sellerEmail: '',
    meetupLocation: '',
    meetupDate: '',
    notes: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!form.itemTitle || !form.amount) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Surface className="text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-slate-100 mb-2">Escrow Created!</h3>
        <p className="text-sm" style={{ color: tokens.color.muted }}>
          Transaction ID: <span className="font-mono text-indigo-300">esc-{Date.now().toString(36)}</span>
        </p>
        <p className="text-sm mt-2" style={{ color: tokens.color.muted }}>
          Share this with your counterparty to fund the escrow.
        </p>
        <div className="mt-4 p-4 rounded-xl bg-white/5">
          <div className="text-sm" style={{ color: tokens.color.muted }}>Status</div>
          <div className="font-bold text-amber-300">⏳ Awaiting Funding</div>
        </div>
      </Surface>
    );
  }

  return (
    <Surface>
      <h3 className="text-lg font-bold text-slate-100 mb-4">New Secured Transaction</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Item Title *</label>
          <input value={form.itemTitle} onChange={(e) => setForm({ ...form, itemTitle: e.target.value })} placeholder="e.g. PlayStation 5 Digital Edition" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Amount (USD) *</label>
          <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" type="number" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Counterparty Email</label>
          <input value={form.sellerEmail} onChange={(e) => setForm({ ...form, sellerEmail: e.target.value })} placeholder="seller@email.com" type="email" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">SafeMeet Location</label>
            <input value={form.meetupLocation} onChange={(e) => setForm({ ...form, meetupLocation: e.target.value })} placeholder="Police station, bank..." className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Meetup Date</label>
            <input value={form.meetupDate} onChange={(e) => setForm({ ...form, meetupDate: e.target.value })} type="datetime-local" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Condition, serial number, special terms..." rows={3} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base resize-none" />
        </div>
        <Button onClick={handleSubmit} disabled={!form.itemTitle || !form.amount} className="w-full">
          🔒 Create Escrow Transaction
        </Button>
      </div>
    </Surface>
  );
};

const ActiveTransactions: React.FC = () => {
  const mockTransactions = [
    { id: 'esc-abc123', item: 'PlayStation 5 Digital', amount: 450, status: 'FUNDED', counterparty: 'ahmed_seller@email.com', meetup: 'Sep 15, 2026 2:00 PM · Lahore SafeMeet Hub' },
    { id: 'esc-def456', item: 'iPhone 15 Pro Max', amount: 1100, status: 'PENDING', counterparty: 'techstore_pk@email.com', meetup: 'Not scheduled' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-100">Active Transactions</h3>
      {mockTransactions.map((t) => (
        <Surface key={t.id}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-slate-100">{t.item}</div>
            <Badge tone={t.status === 'FUNDED' ? 'success' : 'warning'}>{t.status}</Badge>
          </div>
          <div className="text-sm space-y-1" style={{ color: tokens.color.muted }}>
            <div>ID: <span className="font-mono text-indigo-300">{t.id}</span></div>
            <div>Amount: <span className="font-bold text-slate-100">${t.amount}</span></div>
            <div>Counterparty: {t.counterparty}</div>
            <div>Meetup: {t.meetup}</div>
          </div>
          <div className="flex gap-2 mt-4">
            {t.status === 'FUNDED' && (
              <>
                <Button size="sm">✅ Confirm & Release Funds</Button>
                <Button variant="ghost" size="sm">⚖️ File Dispute</Button>
              </>
            )}
            {t.status === 'PENDING' && (
              <Button size="sm">🔒 Fund This Escrow</Button>
            )}
          </div>
        </Surface>
      ))}
    </div>
  );
};

const DisputesTab: React.FC = () => {
  const mockDisputes = [
    { id: 'disp-001', item: 'PlayStation Game (Blank CD)', amount: 50, status: 'PENDING', filed: '2 days ago', against: 'ahmed_seller@email.com' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-100">My Disputes</h3>
        <Button size="sm">+ File New Dispute</Button>
      </div>
      {mockDisputes.map((d) => (
        <Surface key={d.id}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-slate-100">{d.item}</div>
            <Badge tone="warning">{d.status}</Badge>
          </div>
          <div className="text-sm space-y-1" style={{ color: tokens.color.muted }}>
            <div>Dispute ID: <span className="font-mono text-indigo-300">{d.id}</span></div>
            <div>Amount in dispute: <span className="font-bold text-slate-100">${d.amount}</span></div>
            <div>Against: {d.against}</div>
            <div>Filed: {d.filed}</div>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-400/20">
            <p className="text-xs text-amber-300">⏳ Awaiting community jury review. 3 of 5 jurors have voted.</p>
          </div>
        </Surface>
      ))}
    </div>
  );
};

export default EscrowPage;
