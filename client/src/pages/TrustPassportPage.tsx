import React, { useState } from 'react';
import { Surface, Badge, tokens } from '../design-system';
import { FileText, Download, ShieldCheck, CheckCircle } from 'lucide-react';
import { apiUrl } from '@/utils/apiHost';
import { getAuthToken } from '@/utils/authToken';

export const TrustPassportPage: React.FC = () => {
  const [issuingVC, setIssuingVC] = useState(false);
  const [vcData, setVcData] = useState<any>(null);
  const token = getAuthToken();

  const issueTrustPassportVC = async () => {
    if (!token) return;
    setIssuingVC(true);
    try {
      const res = await fetch(apiUrl('/api/v1/vc/issue/trust-passport'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setVcData(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIssuingVC(false);
    }
  };

  const downloadVC = () => {
    if (!vcData) return;
    const blob = new Blob([JSON.stringify(vcData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pabandi-trust-passport-vc-${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };
  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🛂 Trust Passport</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--warm-ink)] font-headline">
            One Reputation. Every Transaction.
          </h1>
          <p className="mt-3 text-[var(--soft-stone)] max-w-2xl mx-auto">
            Your Trust Passport follows you across buying, selling, renting, and hiring. Build it once, use it everywhere.
          </p>
        </div>

        {/* Passport Card */}
        <Surface className="p-6 mb-6 text-center" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))', border: '1px solid rgba(99,102,241,0.3)' }}>
          <div className="text-5xl mb-3">🛂</div>
          <div className="text-sm" style={{ color: tokens.color.textDim }}>Trust Score</div>
          <div className="text-6xl font-black text-[var(--warm-ink)] my-2">73.8</div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Badge tone="success">Tier: Silver</Badge>
            <Badge tone="info">Verified</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            <div className="p-2 rounded-lg bg-[var(--warm-sand)]">
              <div className="text-xs" style={{ color: tokens.color.textDim }}>Transactions</div>
              <div className="font-bold text-[var(--warm-ink)]">127</div>
            </div>
            <div className="p-2 rounded-lg bg-[var(--warm-sand)]">
              <div className="text-xs" style={{ color: tokens.color.textDim }}>Success Rate</div>
              <div className="font-bold text-[var(--sage)]">98.4%</div>
            </div>
            <div className="p-2 rounded-lg bg-[var(--warm-sand)]">
              <div className="text-xs" style={{ color: tokens.color.textDim }}>Member Since</div>
              <div className="font-bold text-[var(--warm-ink)]">Jan 2025</div>
            </div>
          </div>
        </Surface>

        {/* Verifiable Credential */}
        <Surface className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--clay)]" />
              <h2 className="text-lg font-bold text-[var(--warm-ink)]">Verifiable Credential (Portable Trust)</h2>
            </div>
            {token && (
              <button
                onClick={issueTrustPassportVC}
                disabled={issuingVC}
                className="px-4 py-2 rounded-[var(--radius-btn)] bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {issuingVC ? 'Issuing...' : vcData ? 'Re-issue VC' : 'Get Verifiable Credential'}
              </button>
            )}
          </div>
          <p className="text-sm mb-4" style={{ color: tokens.color.textDim }}>
            Issue a W3C Verifiable Credential signed by <code className="text-xs bg-[var(--warm-sand)] px-1 py-0.5 rounded">did:web:pabandi.com</code>. 
            Take it anywhere and verify it at <a href="/verify" className="text-[var(--clay)] hover:underline">/verify</a> with no login required.
          </p>
          {vcData && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-800 flex-1">VC issued successfully</span>
              <button
                onClick={downloadVC}
                className="px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Download VC
              </button>
            </div>
          )}
        </Surface>

        {/* Reputation Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Surface className="p-4 md:p-6">
            <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">📊 Reputation Breakdown</h2>
            <div className="space-y-3">
              {[
                { label: 'Commerce', score: 73.75, color: 'var(--clay)', desc: 'Buying & selling' },
                { label: 'Hospitality', score: 73.75, color: 'var(--sage)', desc: 'Renting & hosting' },
                { label: 'Freelance', score: 73.75, color: 'var(--muted-ochre)', desc: 'Hiring & working' },
                { label: 'Appointments', score: 73.75, color: '#ec4899', desc: 'Showing & visiting' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--warm-sand)]">
                  <div>
                    <div className="font-semibold text-[var(--warm-ink)] text-sm">{item.label}</div>
                    <div className="text-xs" style={{ color: tokens.color.textDim }}>{item.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold" style={{ color: item.color }}>{item.score}</div>
                    <div className="w-20 h-2 rounded-full bg-[var(--warm-sand)] mt-1">
                      <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: item.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="p-4 md:p-6">
            <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">🏆 Badges & Verification</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '🪪', label: 'ID Verified', desc: 'Government ID' },
                { icon: '📱', label: 'Phone Verified', desc: 'SMS confirmed' },
                { icon: '📧', label: 'Email Verified', desc: 'Email confirmed' },
                { icon: '🔗', label: 'Wallet Connected', desc: 'Solana wallet' },
                { icon: '🏠', label: 'Property Owner', desc: '1+ properties' },
                { icon: '⭐', label: 'Top Rated', desc: '4.8+ avg rating' },
              ].map((b, i) => (
                <div key={i} className="p-3 rounded-xl bg-[var(--warm-sand)] text-center">
                  <div className="text-2xl mb-1">{b.icon}</div>
                  <div className="font-semibold text-[var(--warm-ink)] text-xs">{b.label}</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>{b.desc}</div>
                </div>
              ))}
            </div>
          </Surface>
        </div>

        {/* How Trust Score Works */}
        <Surface className="p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">🔬 How Your Trust Score Is Calculated</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: '✅', title: 'Positive Actions', items: ['Complete a sale (+5)', 'Pass screening (+10)', 'Win dispute (+15)', 'Good review (+2)', 'On-time payment (+3)'] },
              { icon: '❌', title: 'Negative Actions', items: ['No-show (-20)', 'Failed dispute (-15)', 'Late payment (-5)', 'Bad review (-10)', 'Cancel deal (-3)'] },
              { icon: '⚖️', title: 'Weighting', items: ['Recent activity matters most', 'Severity weighted', 'Volume matters', 'Dispute history tracked', 'Recovery possible'] },
            ].map((cat, i) => (
              <div key={i} className="p-3 rounded-xl bg-[var(--warm-sand)]">
                <div className="text-xl mb-2">{cat.icon}</div>
                <div className="font-semibold text-[var(--warm-ink)] text-sm mb-2">{cat.title}</div>
                <ul className="space-y-1">
                  {cat.items.map((item, j) => (
                    <li key={j} className="text-xs" style={{ color: tokens.color.textDim }}>• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Surface>

        {/* Portable Reputation */}
        <Surface className="p-4 md:p-6">
          <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">🌍 Portable Reputation</h2>
          <p className="text-sm mb-4" style={{ color: tokens.color.textDim }}>
            Your Trust Passport works across ALL Pabandi services. A high score here means better deals everywhere.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: '🛒', label: 'Marketplace', benefit: 'Buy with escrow protection' },
              { icon: '🏠', label: 'Rentals', benefit: 'Skip security deposit' },
              { icon: '🔧', label: 'Services', benefit: 'Hire with confidence' },
              { icon: '🏨', label: 'Hotels', benefit: 'Instant booking' },
            ].map((s, i) => (
              <div key={i} className="p-3 rounded-xl bg-[var(--warm-sand)] text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="font-semibold text-[var(--warm-ink)] text-sm">{s.label}</div>
                <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{s.benefit}</div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
};

export default TrustPassportPage;


/* Enhanced with VC support - appended */
