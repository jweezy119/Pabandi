import React from 'react';
import { Surface, Badge, tokens } from '../design-system';

export const TrustPassportPage: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🛂 Trust Passport</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-100 font-headline">
            One Reputation. Every Transaction.
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            Your Trust Passport follows you across buying, selling, renting, and hiring. Build it once, use it everywhere.
          </p>
        </div>

        {/* Passport Card */}
        <Surface className="p-6 mb-6 text-center" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))', border: '1px solid rgba(99,102,241,0.3)' }}>
          <div className="text-5xl mb-3">🛂</div>
          <div className="text-sm" style={{ color: tokens.color.muted }}>Trust Score</div>
          <div className="text-6xl font-black text-slate-100 my-2">73.8</div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Badge tone="success">Tier: Silver</Badge>
            <Badge tone="info">Verified</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-xs" style={{ color: tokens.color.muted }}>Transactions</div>
              <div className="font-bold text-slate-100">127</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-xs" style={{ color: tokens.color.muted }}>Success Rate</div>
              <div className="font-bold text-emerald-300">98.4%</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-xs" style={{ color: tokens.color.muted }}>Member Since</div>
              <div className="font-bold text-slate-100">Jan 2025</div>
            </div>
          </div>
        </Surface>

        {/* Reputation Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Surface className="p-4 md:p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">📊 Reputation Breakdown</h2>
            <div className="space-y-3">
              {[
                { label: 'Commerce', score: 73.75, color: '#6366f1', desc: 'Buying & selling' },
                { label: 'Hospitality', score: 73.75, color: '#10b981', desc: 'Renting & hosting' },
                { label: 'Freelance', score: 73.75, color: '#f59e0b', desc: 'Hiring & working' },
                { label: 'Appointments', score: 73.75, color: '#ec4899', desc: 'Showing & visiting' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div>
                    <div className="font-semibold text-slate-100 text-sm">{item.label}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{item.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold" style={{ color: item.color }}>{item.score}</div>
                    <div className="w-20 h-2 rounded-full bg-white/10 mt-1">
                      <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: item.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="p-4 md:p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">🏆 Badges & Verification</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '🪪', label: 'ID Verified', desc: 'Government ID' },
                { icon: '📱', label: 'Phone Verified', desc: 'SMS confirmed' },
                { icon: '📧', label: 'Email Verified', desc: 'Email confirmed' },
                { icon: '🔗', label: 'Wallet Connected', desc: 'Solana wallet' },
                { icon: '🏠', label: 'Property Owner', desc: '1+ properties' },
                { icon: '⭐', label: 'Top Rated', desc: '4.8+ avg rating' },
              ].map((b, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/5 text-center">
                  <div className="text-2xl mb-1">{b.icon}</div>
                  <div className="font-semibold text-slate-100 text-xs">{b.label}</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>{b.desc}</div>
                </div>
              ))}
            </div>
          </Surface>
        </div>

        {/* How Trust Score Works */}
        <Surface className="p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4">🔬 How Your Trust Score Is Calculated</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: '✅', title: 'Positive Actions', items: ['Complete a sale (+5)', 'Pass screening (+10)', 'Win dispute (+15)', 'Good review (+2)', 'On-time payment (+3)'] },
              { icon: '❌', title: 'Negative Actions', items: ['No-show (-20)', 'Failed dispute (-15)', 'Late payment (-5)', 'Bad review (-10)', 'Cancel deal (-3)'] },
              { icon: '⚖️', title: 'Weighting', items: ['Recent activity matters most', 'Severity weighted', 'Volume matters', 'Dispute history tracked', 'Recovery possible'] },
            ].map((cat, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/5">
                <div className="text-xl mb-2">{cat.icon}</div>
                <div className="font-semibold text-slate-100 text-sm mb-2">{cat.title}</div>
                <ul className="space-y-1">
                  {cat.items.map((item, j) => (
                    <li key={j} className="text-xs" style={{ color: tokens.color.muted }}>• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Surface>

        {/* Portable Reputation */}
        <Surface className="p-4 md:p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4">🌍 Portable Reputation</h2>
          <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>
            Your Trust Passport works across ALL Pabandi services. A high score here means better deals everywhere.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: '🛒', label: 'Marketplace', benefit: 'Buy with escrow protection' },
              { icon: '🏠', label: 'Rentals', benefit: 'Skip security deposit' },
              { icon: '🔧', label: 'Services', benefit: 'Hire with confidence' },
              { icon: '🏨', label: 'Hotels', benefit: 'Instant booking' },
            ].map((s, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/5 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="font-semibold text-slate-100 text-sm">{s.label}</div>
                <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{s.benefit}</div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
};

export default TrustPassportPage;
