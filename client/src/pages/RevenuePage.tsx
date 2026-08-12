import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { revenueService } from '../services/api';
import { tokens } from '../design-system';

export default function RevenuePage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const [revenue, setRevenue] = useState<any | null>(null);
  const [loadingRev, setLoadingRev] = useState(true);

  // Underwrite demo
  const [providerId, setProviderId] = useState('');
  const [coverage, setCoverage] = useState(100);
  const [underwriting, setUnderwriting] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { state: { returnTo: '/revenue' } });
  }, [isAuthenticated, navigate]);

  const loadRevenue = async () => {
    setLoadingRev(true);
    try {
      const res = await revenueService.captured();
      setRevenue(res.data?.data || null);
    } catch {
      /* ignore */
    } finally {
      setLoadingRev(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadRevenue();
  }, [isAuthenticated]);

  const underwrite = async () => {
    if (!providerId.trim()) {
      setErr('Provider ID required (your user id, or a business owner id).');
      return;
    }
    setErr('');
    setUnderwriting(true);
    setResult(null);
    try {
      const res = await revenueService.underwriteInsurance({
        providerId: providerId.trim(),
        customerId: user?.id || providerId.trim(),
        reservationId: `rev_${Date.now()}`,
        coverageAmount: coverage,
        coverageType: 'NO_SHOW',
      });
      const d = res.data?.data || res.data;
      setResult(d);
      if (d.approved) loadRevenue();
    } catch (e: any) {
      setErr(e.response?.data?.error || e.message || 'Underwrite failed');
    } finally {
      setUnderwriting(false);
    }
  };

  if (!isAuthenticated) return null;

  const stat = (label: string, value: string, sub?: string) => (
    <div style={{ ...cell }}>
      <div style={{ fontSize: 12, color: tokens.color.muted }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: tokens.color.text, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: tokens.color.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 20px', color: tokens.color.text, fontFamily: tokens.font.body }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>💰</span>
          <h1 style={{ fontSize: 28, margin: 0, letterSpacing: -0.5 }}>Revenue</h1>
        </div>
        <p style={{ color: tokens.color.muted, margin: 0, fontSize: 15, lineHeight: 1.6 }}>
          Pabandi makes money three ways — and every stream is live, not a mockup.
        </p>
      </header>

      {/* LIVE TALLY */}
      <section style={card}>
        <h2 style={h2}>Live captured revenue</h2>
        {loadingRev ? (
          <p style={muted}>Loading…</p>
        ) : revenue ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
            {stat('Total $PAB', revenue.totalPAB?.toFixed(2) ?? '0', `~$${(revenue.totalUSD ?? 0).toFixed(2)}`)}
            {stat('Insurance premiums', (revenue.insurancePAB ?? 0).toFixed(2), 'no-show protection')}
            {stat('Platform / escrow fees', (revenue.platformFeesPAB ?? 0).toFixed(2), 'booking facilitation')}
            {stat('Passport $PAB fees', (revenue.passportFeesPAB ?? 0).toFixed(2), 'agent trust standard')}
          </div>
        ) : (
          <p style={muted}>No revenue captured yet — try the demo below.</p>
        )}
      </section>

      {/* STREAMS */}
      <section style={card}>
        <h2 style={h2}>How Pabandi makes money</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <Stream
            title="1. Platform fee — 2% of booking value"
            body="Every escrow-backed booking pays a 2% facilitation fee (below Stripe's 2.9%+, far below Upwork's 10–20%). Captured on deposit release."
          />
          <Stream
            title="2. Reputation Insurance — 2% of coverage, risk-priced"
            body="Businesses pay a premium (in $PAB) to insure no-shows & cancellations, priced by real-time trust velocity. Captured at underwriting — see the demo below."
          />
          <Stream
            title="3. Agent Passport — 2 $PAB / issue"
            body="AI agents pay a metered $PAB fee to get a verifiable trust passport. Idempotent, daily-capped, fail-closed."
          />
        </div>
      </section>

      {/* DEMO UNDERWRITE */}
      <section style={card}>
        <h2 style={h2}>Capture a real premium (demo)</h2>
        <p style={muted}>Underwrite an insurance policy for a booking. The premium is debited from the provider's $PAB balance — real revenue, recorded on-chain-style.</p>

        <label style={label}>Provider ID (user id owning the balance to debit)</label>
        <input style={input} placeholder={user?.id || 'provider user id'} value={providerId} onChange={(e) => setProviderId(e.target.value)} />

        <label style={label}>Coverage amount (USD)</label>
        <input style={{ ...input, maxWidth: 200 }} type="number" value={coverage} onChange={(e) => setCoverage(Number(e.target.value) || 0)} />

        {err && <div style={errBox}>{err}</div>}

        <button onClick={underwrite} disabled={underwriting} style={{ ...btn, marginTop: 14, opacity: underwriting ? 0.6 : 1 }}>
          {underwriting ? 'Underwriting…' : 'Underwrite & capture premium'}
        </button>

        {result && (
          <div style={{ marginTop: 16, padding: 14, borderRadius: tokens.radius.md, border: `1px solid ${result.approved ? tokens.color.success : tokens.color.danger}`, background: result.approved ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)' }}>
            <strong style={{ color: result.approved ? tokens.color.success : tokens.color.danger }}>
              {result.approved ? '✓ Policy issued — premium captured' : '✕ Not issued'}
            </strong>
            <div style={{ fontSize: 13, color: tokens.color.muted, marginTop: 6 }}>
              {result.reason || `${result.premiumPAB} $PAB premium · ${result.riskBand} · ${result.riskMultiplier}x`}
            </div>
            {result.approved && (
              <div style={{ fontSize: 12, color: tokens.color.muted, marginTop: 6, fontFamily: tokens.font.mono }}>
                premium {result.premiumPAB} $PAB ({result.premiumUSD} USD) · coverage ${result.coverageAmount}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Stream({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ padding: 14, borderRadius: tokens.radius.md, background: tokens.color.background, border: `1px solid ${tokens.color.border}` }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: tokens.color.primary }}>{title}</div>
      <div style={{ fontSize: 13, color: tokens.color.muted, marginTop: 6, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

const card = {
  background: tokens.color.surface,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.lg,
  padding: 22,
  marginBottom: 18,
} as const;
const h2 = { fontSize: 18, margin: '0 0 12px' } as const;
const muted = { color: tokens.color.muted, fontSize: 14, margin: '0 0 12px', lineHeight: 1.6 } as const;
const label = { display: 'block', fontSize: 13, color: tokens.color.muted, margin: '12px 0 6px' } as const;
const input = {
  width: '100%',
  background: tokens.color.background,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md,
  color: tokens.color.text,
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
} as const;
const btn = {
  background: tokens.color.primary,
  color: '#0b1020',
  border: 'none',
  borderRadius: tokens.radius.md,
  padding: '11px 18px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
} as const;
const errBox = {
  marginTop: 12,
  padding: '10px 12px',
  borderRadius: tokens.radius.md,
  background: 'rgba(239,68,68,0.1)',
  border: `1px solid ${tokens.color.danger}`,
  color: tokens.color.danger,
  fontSize: 13,
} as const;
const cell = {
  background: tokens.color.background,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md,
  padding: 14,
} as const;
