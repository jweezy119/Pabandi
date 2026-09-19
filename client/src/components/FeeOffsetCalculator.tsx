import { useState } from 'react';

interface FeeCalculation {
  squareFee: number;
  pabandiFee: number;
  customerReward: number;
  businessReward: number;
  effectiveCost: number;
  savingsVsTraditional: number;
}

export default function FeeOffsetCalculator() {
  const [amount, setAmount] = useState<number>(25);
  const [calculation, setCalculation] = useState<FeeCalculation | null>(null);

  const calculate = async () => {
    try {
      const res = await fetch('/api/v1/rewards/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseAmount: amount }),
      });
      const data = await res.json();
      if (data.success) {
        const squareFee = amount * 0.029 + 0.30;
        const pabandiFee = amount * 0.02;
        const customerRewardUsd = data.rewards.customerRewardUsd;
        setCalculation({
          squareFee,
          pabandiFee,
          customerReward: customerRewardUsd,
          businessReward: data.rewards.businessRewardUsd,
          effectiveCost: amount - customerRewardUsd,
          savingsVsTraditional: customerRewardUsd,
        });
      }
    } catch (err) {
      console.error('Calculation failed:', err);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700 mb-8">
      <h2 className="text-xl font-bold text-white mb-4">Fee Offset Calculator</h2>
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="text-slate-400 text-sm mb-1 block">Purchase Amount ($)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
            min="1"
          />
        </div>
        <button
          onClick={calculate}
          className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-all self-end"
        >
          Calculate Savings
        </button>
      </div>

      {calculation && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-700/50 rounded-xl p-4">
            <p className="text-slate-400 text-sm mb-1">Square Fee (2.9% + $0.30)</p>
            <p className="text-white text-xl font-bold">${calculation.squareFee.toFixed(2)}</p>
          </div>
          <div className="bg-slate-700/50 rounded-xl p-4">
            <p className="text-slate-400 text-sm mb-1">Pabandi Platform Fee (2%)</p>
            <p className="text-white text-xl font-bold">${calculation.pabandiFee.toFixed(2)}</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <p className="text-green-400 text-sm mb-1">$PAB Reward (Customer)</p>
            <p className="text-white text-xl font-bold">+${calculation.customerReward.toFixed(2)}</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <p className="text-green-400 text-sm mb-1">$PAB Reward (Business)</p>
            <p className="text-white text-xl font-bold">+${calculation.businessReward.toFixed(2)}</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 md:col-span-2">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-amber-400 text-sm mb-1">Your Effective Cost</p>
                <p className="text-white text-2xl font-bold">${calculation.effectiveCost.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-green-400 text-sm mb-1">Net Savings</p>
                <p className="text-green-400 text-2xl font-bold">-${calculation.savingsVsTraditional.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
