import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STAKING_TIERS = [
  { tier: 'BRONZE', min: 10, max: 99, discount: 0, color: '🥉', perks: ['Basic analytics', 'Standard placement', 'Email support'] },
  { tier: 'SILVER', min: 100, max: 499, discount: 2, color: '🥈', perks: ['Advanced analytics', 'Priority placement', 'WhatsApp support', '2% discount'] },
  { tier: 'GOLD', min: 500, max: 1999, discount: 5, color: '🥇', perks: ['Premium analytics', 'Top placement', 'Phone support', '5% discount', 'Pre-booking'] },
  { tier: 'PLATINUM', min: 2000, max: 9999, discount: 10, color: '💎', perks: ['VIP analytics', 'Guaranteed placement', 'Account manager', '10% discount', 'Cross-venue'] },
  { tier: 'DIAMOND', min: 10000, max: null, discount: 15, color: '💠', perks: ['White-glove', 'Exclusive access', 'Revenue share', '15% discount', 'Global access'] },
];

const REWARD_RATES = [
  { action: 'Attend event (verified entry)', reward: '5 $PAB', icon: '🎉' },
  { action: 'First venue review', reward: '10 $PAB', icon: '⭐' },
  { action: 'Subsequent reviews', reward: '2 $PAB', icon: '📝' },
  { action: 'Refer friend who attends', reward: '3 $PAB', icon: '👥' },
  { action: 'Bottle purchase (5% rebate)', reward: 'Varies', icon: '🍾' },
  { action: 'Cover charge (2% rebate)', reward: 'Varies', icon: '🎫' },
  { action: 'No-show deposit return bonus', reward: '1 $PAB', icon: '✅' },
];

export const NightlifeTokenomics: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState('SILVER');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center font-bold text-sm">$</div>
            <span className="text-lg font-bold">Nightlife Tokenomics</span>
            <span className="text-xs text-gray-500">by Pabandi</span>
          </div>
          <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-white">← Pabandi</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-12">
        {/* Hero */}
        <section className="text-center">
          <h1 className="text-4xl font-bold mb-4">Earn $PAB for Everything You Do</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Attend events, write reviews, refer friends, buy bottles — every action earns you $PAB tokens.
            Stake $PAB to unlock premium tiers with better commissions and perks.
          </p>
        </section>

        {/* How It Works */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-center">How $PAB Flows</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-6 text-center border border-gray-700">
              <div className="text-3xl mb-3">🎉</div>
              <h3 className="font-bold mb-1">Guest</h3>
              <p className="text-sm text-gray-400">Attends event → earns 5 $PAB</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 text-center border border-gray-700">
              <div className="text-3xl mb-3">📋</div>
              <h3 className="font-bold mb-1">Promoter</h3>
              <p className="text-sm text-gray-400">Brings guests → earns $PAB per head</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 text-center border border-gray-700">
              <div className="text-3xl mb-3">🏢</div>
              <h3 className="font-bold mb-1">Venue</h3>
              <p className="text-sm text-gray-400">Pays in $PAB → gets 10% discount</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 text-center border border-gray-700">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="font-bold mb-1">Staking</h3>
              <p className="text-sm text-gray-400">Stake $PAB → unlock tiers + perks</p>
            </div>
          </div>
        </section>

        {/* Earn Rates */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Earn Rates</h2>
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            {REWARD_RATES.map((rate) => (
              <div key={rate.action} className="flex items-center justify-between p-4 border-b border-gray-700 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{rate.icon}</span>
                  <span className="text-sm">{rate.action}</span>
                </div>
                <span className="font-bold text-green-400">{rate.reward}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Staking Tiers */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Staking Tiers</h2>
          <div className="grid md:grid-cols-5 gap-4">
            {STAKING_TIERS.map((tier) => (
              <div
                key={tier.tier}
                onClick={() => setSelectedTier(tier.tier)}
                className={`rounded-lg p-4 border cursor-pointer transition-all ${
                  selectedTier === tier.tier
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="text-3xl mb-2">{tier.color}</div>
                <h3 className="font-bold text-sm mb-1">{tier.tier}</h3>
                <p className="text-xs text-gray-400 mb-2">{tier.min}+ $PAB</p>
                <p className="text-xs text-green-400 font-medium">{tier.discount}% discount</p>
                <ul className="mt-3 space-y-1">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="text-xs text-gray-500">• {perk}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Use Cases */}
        <section>
          <h2 className="text-2xl font-bold mb-6">What You Can Do With $PAB</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-2xl mb-2">🍾</div>
              <h3 className="font-bold mb-1">Bottle Service</h3>
              <p className="text-sm text-gray-400">Pay for bottles with $PAB, get 5% rebate on every purchase</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-2xl mb-2">🎫</div>
              <h3 className="font-bold mb-1">Cover Charges</h3>
              <p className="text-sm text-gray-400">Pay cover with $PAB, get 2% back. Free entry at DIAMOND tier.</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-2xl mb-2">📋</div>
              <h3 className="font-bold mb-1">Guest List Deposits</h3>
              <p className="text-sm text-gray-400">Deposit $PAB to secure your spot, get refunded + bonus when you show up</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default NightlifeTokenomics;
