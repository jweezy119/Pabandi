// Sitara OS — Star Card Page
// Shareable on-chain reputation card

import { useSitaraStore } from '../store/sitaraStore';

const tierInfo = {
  'tara': { name: 'Tara', color: 'from-slate-400 to-slate-500', min: 0, max: 99 },
  'sitara-e-noor': { name: 'Sitara-e-Noor', color: 'from-amber-400 to-amber-500', min: 100, max: 499 },
  'sitara-e-roshan': { name: 'Sitara-e-Roshan', color: 'from-amber-500 to-orange-500', min: 500, max: 1999 },
  'sitara-e-darakshan': { name: 'Sitara-e-Darakshan', color: 'from-orange-500 to-red-500', min: 2000, max: 9999 },
  'sitara-e-izzat': { name: 'Sitara-e-Izzat', color: 'from-purple-500 to-pink-500', min: 10000, max: Infinity },
};

export default function StarCardPage() {
  const { user } = useSitaraStore();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-slate-600">Please sign in to view your Star Card.</p>
      </div>
    );
  }

  const tier = tierInfo[user.starTier];
  const nextTier = user.starTier === 'tara' ? tierInfo['sitara-e-noor'] : 
                   user.starTier === 'sitara-e-noor' ? tierInfo['sitara-e-roshan'] :
                   user.starTier === 'sitara-e-roshan' ? tierInfo['sitara-e-darakshan'] :
                   user.starTier === 'sitara-e-darakshan' ? tierInfo['sitara-e-izzat'] : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Your Star Card</h1>
      <p className="text-slate-600 mb-8">Your portable, on-chain reputation. Share it anywhere.</p>

      {/* Star Card Visual */}
      <div className={`bg-gradient-to-br ${tier.color} rounded-2xl p-8 text-white shadow-xl`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">★</span>
            </div>
            <span className="font-bold text-xl">Sitara</span>
          </div>
          <span className="text-sm opacity-80">Verified on Solana</span>
        </div>

        <div className="mb-6">
          <p className="text-sm opacity-80 mb-1">Star Tier</p>
          <h2 className="text-3xl font-bold">{tier.name}</h2>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{user.starPower}</p>
            <p className="text-xs opacity-80">Star Power</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{user.verifiedCheckIns}</p>
            <p className="text-xs opacity-80">Check-ins</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{user.reliabilityScore}%</p>
            <p className="text-xs opacity-80">Reliability</p>
          </div>
        </div>

        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm">
            <span>Next Tier: {nextTier?.name || 'MAX'}</span>
            <span>{nextTier ? `${nextTier.min - user.starPower} SP away` : 'You\'ve reached the top!'}</span>
          </div>
          {nextTier && (
            <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${Math.min(100, ((user.starPower - tier.min) / (nextTier.min - tier.min)) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Card Info */}
      <div className="mt-6 space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-2">What is a Star Card?</h3>
          <p className="text-sm text-slate-600">
            Your Star Card is an on-chain reputation artifact. It proves you're a real, verified person with a history of showing up and leaving honest reviews. Businesses can scan your Star Card to instantly see your trustworthiness.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-2">How to use it</h3>
          <ul className="text-sm text-slate-600 space-y-2">
            <li>• Share your Star Card URL on social media or WhatsApp</li>
            <li>• Show it to businesses for priority service</li>
            <li>• Use it to negotiate better terms as a verified customer</li>
            <li>• Link it to your Pabandi Passport for full reputation</li>
          </ul>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900 mb-2">Share your Star Card</h3>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={`https://pabandi.com/star-card/${user.id}`}
              className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm"
            />
            <button className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600">
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
