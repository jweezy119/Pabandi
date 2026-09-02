import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';

interface CalcResult {
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  monthlyRent: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashOnCashReturn: number;
  capRate: number;
}

export const CalculatorPage: React.FC = () => {
  const [mode, setMode] = useState<'mortgage' | 'investment' | 'affordability'>('investment');
  const [purchasePrice, setPurchasePrice] = useState('250000');
  const [downPayment, setDownPayment] = useState('50000');
  const [interestRate, setInterestRate] = useState('7.5');
  const [loanTerm, setLoanTerm] = useState('30');
  const [monthlyRent, setMonthlyRent] = useState('2000');
  const [monthlyExpenses, setMonthlyExpenses] = useState('800');
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const price = parseFloat(purchasePrice) || 0;
    const down = parseFloat(downPayment) || 0;
    const rate = parseFloat(interestRate) / 100 / 12;
    const term = parseFloat(loanTerm) * 12;
    const rent = parseFloat(monthlyRent) || 0;
    const expenses = parseFloat(monthlyExpenses) || 0;

    const loanAmount = price - down;
    const monthlyPayment = loanAmount * (rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);
    const totalCost = monthlyPayment * term + down;
    const totalInterest = totalCost - price;

    const monthlyCashFlow = rent - expenses - monthlyPayment;
    const annualCashFlow = monthlyCashFlow * 12;
    const cashOnCashReturn = (annualCashFlow / down) * 100;
    const noi = (rent - expenses) * 12;
    const capRate = (noi / price) * 100;

    setResult({
      monthlyPayment: Math.round(monthlyPayment),
      totalInterest: Math.round(totalInterest),
      totalCost: Math.round(totalCost),
      monthlyRent: rent,
      monthlyCashFlow: Math.round(monthlyCashFlow),
      annualCashFlow: Math.round(annualCashFlow),
      cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100,
      capRate: Math.round(capRate * 100) / 100,
    });
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🧮 Smart Calculator</Badge>
          <h1 className="text-3xl font-black text-slate-100 font-headline">Real Estate Math</h1>
          <p className="mt-3 text-slate-400">Mortgage, investment, and affordability — all in one place.</p>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6">
          {(['investment', 'mortgage', 'affordability'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 px-4 py-3 rounded-xl text-center transition-all ${mode === m ? 'bg-indigo-500/20 border border-indigo-400/30' : 'bg-white/5 border border-white/10'}`}
            >
              <div className="text-lg">{m === 'investment' ? '💰' : m === 'mortgage' ? '🏠' : '📊'}</div>
              <div className="text-xs font-semibold capitalize">{m}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input */}
          <Surface className="p-4 md:p-6">
            <h3 className="text-base font-bold text-slate-100 mb-4">Property Details</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Purchase Price</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">$</span>
                  <input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} type="number" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Down Payment</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">$</span>
                  <input value={downPayment} onChange={(e) => setDownPayment(e.target.value)} type="number" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
                </div>
                <div className="flex gap-2 mt-1">
                  {[10, 20, 25].map((pct) => (
                    <button key={pct} onClick={() => setPurchasePrice((prev) => (parseFloat(prev) * pct / 100).toString())} className="text-xs px-2 py-1 rounded bg-white/5 text-slate-400 hover:bg-white/10">
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Interest Rate</label>
                  <div className="flex items-center gap-2">
                    <input value={interestRate} onChange={(e) => setInterestRate(e.target.value)} type="number" step="0.1" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
                    <span className="text-slate-400">%</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Loan Term</label>
                  <select value={loanTerm} onChange={(e) => setLoanTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none">
                    <option value="15">15 years</option>
                    <option value="20">20 years</option>
                    <option value="30">30 years</option>
                  </select>
                </div>
              </div>
              {mode === 'investment' && (
                <>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Expected Monthly Rent</label>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">$</span>
                      <input value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} type="number" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Monthly Expenses (tax, insurance, maintenance)</label>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">$</span>
                      <input value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(e.target.value)} type="number" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
                    </div>
                  </div>
                </>
              )}
            </div>
            <Button onClick={calculate} className="w-full mt-4">Calculate</Button>
          </Surface>

          {/* Results */}
          <Surface className="p-4 md:p-6">
            <h3 className="text-base font-bold text-slate-100 mb-4">Results</h3>
            {!result ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-3xl mb-2">📊</div>
                <p>Enter details and click Calculate</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/5">
                  <div className="text-xs text-slate-400">Monthly Mortgage</div>
                  <div className="text-xl font-bold text-slate-100">${result.monthlyPayment.toLocaleString()}</div>
                </div>
                {mode === 'investment' && (
                  <>
                    <div className="p-3 rounded-xl bg-white/5">
                      <div className="text-xs text-slate-400">Monthly Cash Flow</div>
                      <div className={`text-xl font-bold ${result.monthlyCashFlow >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {result.monthlyCashFlow >= 0 ? '+' : ''}${result.monthlyCashFlow.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5">
                      <div className="text-xs text-slate-400">Annual Cash Flow</div>
                      <div className={`text-xl font-bold ${result.annualCashFlow >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {result.annualCashFlow >= 0 ? '+' : ''}${result.annualCashFlow.toLocaleString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-white/5 text-center">
                        <div className="text-xs text-slate-400">Cash-on-Cash</div>
                        <div className="text-lg font-bold text-indigo-300">{result.cashOnCashReturn}%</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 text-center">
                        <div className="text-xs text-slate-400">Cap Rate</div>
                        <div className="text-lg font-bold text-amber-300">{result.capRate}%</div>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5">
                      <div className="text-xs text-slate-400">Total Interest (life of loan)</div>
                      <div className="text-lg font-bold text-rose-300">${result.totalInterest.toLocaleString()}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5">
                      <div className="text-xs text-slate-400">Total Cost (down + all payments)</div>
                      <div className="text-lg font-bold text-slate-100">${result.totalCost.toLocaleString()}</div>
                    </div>
                  </>
                )}
                {mode === 'mortgage' && (
                  <div className="p-3 rounded-xl bg-white/5">
                    <div className="text-xs text-slate-400">Total Interest</div>
                    <div className="text-lg font-bold text-rose-300">${result.totalInterest.toLocaleString()}</div>
                  </div>
                )}
              </div>
            )}
          </Surface>
        </div>
      </div>
    </div>
  );
};

export default CalculatorPage;
