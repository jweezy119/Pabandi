import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';

export const OnRampPage: React.FC = () => {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('SOL');
  const [quote, setQuote] = useState<any>(null);

  const getQuote = () => {
    const rate = currency === 'SOL' ? 50000 : 100; // 1 SOL = 50000 PAB, 1 USD = 100 PAB
    const pab = parseFloat(amount) * rate;
    setQuote({ pab, rate, fee: pab * 0.01, net: pab * 0.99 });
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">⬆️ On-Ramp</Badge>
          <h1 className="text-3xl font-black text-slate-100 font-headline">Buy $PAB</h1>
          <p className="mt-3 text-slate-400">Convert SOL or USD to $PAB tokens instantly.</p>
        </div>

        <Surface className="p-4 md:p-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">You pay</label>
              <div className="flex gap-2">
                <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" type="number" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-100 outline-none" />
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-100 outline-none">
                  <option value="SOL">SOL</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-lg">↓</div>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-1 block">You receive</label>
              <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-100">
                {quote ? `${quote.net.toLocaleString()} $PAB` : '—'}
              </div>
            </div>

            <Button onClick={getQuote} disabled={!amount} className="w-full">Get Quote</Button>

            {quote && (
              <div className="p-3 rounded-xl bg-white/5 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-400">Rate</span><span className="text-slate-100">1 {currency} = {quote.rate.toLocaleString()} $PAB</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Fee (1%)</span><span className="text-slate-100">{quote.fee.toLocaleString()} $PAB</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">You receive</span><span className="text-emerald-300 font-bold">{quote.net.toLocaleString()} $PAB</span></div>
              </div>
            )}
          </div>
        </Surface>

        <Surface className="p-4 mt-4">
          <h3 className="text-sm font-bold text-slate-100 mb-2">Payment Methods</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: '👻', name: 'Phantom', desc: 'SOL from wallet' },
              { icon: '💳', name: 'Card', desc: 'USD via Stripe' },
              { icon: '🏦', name: 'Bank', desc: 'USD via ACH' },
              { icon: '📱', name: 'Apple Pay', desc: 'USD via Apple' },
            ].map((m, i) => (
              <div key={i} className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-xl">{m.icon}</div>
                <div className="text-xs font-semibold text-slate-100">{m.name}</div>
                <div className="text-xs" style={{ color: tokens.color.muted }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
};

export default OnRampPage;
