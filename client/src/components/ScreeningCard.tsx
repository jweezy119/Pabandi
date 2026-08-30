import { useState } from 'react';
import { courtCheckService } from '../services/api';

type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';

interface CheckResult {
  id?: string;
  subjectType: 'TENANT' | 'LANDLORD';
  name: string;
  state?: string;
  found: boolean;
  count: number;
  recentEviction: boolean;
  riskBand: RiskBand;
  reductionPct: number;
  cases: any[];
}

const BAND_STYLES: Record<RiskBand, { color: string; bg: string; label: string; note: string }> = {
  LOW: { color: '#34d399', bg: 'rgba(52,211,153,0.12)', label: 'LOW RISK', note: 'No eviction / housing litigation found.' },
  MEDIUM: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', label: 'MEDIUM RISK', note: 'Some housing/litigation history — deposit +10%.' },
  HIGH: { color: '#f87171', bg: 'rgba(248,113,113,0.14)', label: 'HIGH RISK', note: 'Recent eviction on record — deposit +25%.' },
};

function BandPill({ band }: { band: RiskBand }) {
  const s = BAND_STYLES[band];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: s.bg,
        color: s.color,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.4,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  );
}

function PartyCard({ title, result }: { title: string; result?: CheckResult }) {
  if (!result) {
    return (
      <div style={{ flex: 1, padding: 16, borderRadius: 14, background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)' }}>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 8 }}>Not screened yet.</div>
      </div>
    );
  }
  const s = BAND_STYLES[result.riskBand];
  return (
    <div style={{ flex: 1, padding: 16, borderRadius: 14, background: 'rgba(148,163,184,0.06)', border: `1px solid ${s.color}33` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 600 }}>{title}</div>
        <BandPill band={result.riskBand} />
      </div>
      <div style={{ fontSize: 14, color: 'var(--foreground)', marginTop: 8, fontWeight: 600 }}>
        {result.name || '—'} {result.state ? `· ${result.state}` : ''}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
        {result.found ? `${result.count} matched docket(s)` : 'No matched dockets'} · deposit adj. {(result.reductionPct * 100).toFixed(0)}%
      </div>
      {result.cases && result.cases.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {result.cases.slice(0, 3).map((c: any, i: number) => (
            <div key={i} style={{ fontSize: 11.5, color: 'var(--muted-foreground)', padding: '6px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.18)' }}>
              <span style={{ color: s.color, fontWeight: 600 }}>{c.caseName || 'Case'}</span>
              {c.court ? ` · ${c.court}` : ''}
              {c.dateFiled ? ` · ${c.dateFiled}` : ''}
            </div>
          ))}
          {result.cases.length > 3 && <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>+{result.cases.length - 3} more</div>}
        </div>
      )}
    </div>
  );
}

export default function ScreeningCard({ reservationId }: { reservationId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screened, setScreened] = useState(false);
  const [tenant, setTenant] = useState<CheckResult | undefined>();
  const [landlord, setLandlord] = useState<CheckResult | undefined>();

  const runScreen = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await courtCheckService.screenBooking(reservationId);
      const data = res.data;
      if (data?.success) {
        setTenant(data.tenant);
        setLandlord(data.landlord);
        setScreened(true);
      } else {
        setError(data?.error || 'Screening failed.');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Screening request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: 20,
        borderRadius: 18,
        background: 'linear-gradient(160deg, rgba(99,102,241,0.10), rgba(139,92,246,0.06))',
        border: '1px solid rgba(139,92,246,0.25)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>🏛️ Court & Eviction Screening</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 4 }}>
            Live check against U.S. court records (CourtListener). Risk band adjusts the security deposit.
          </div>
        </div>
        <button
          onClick={runScreen}
          disabled={loading}
          style={{
            padding: '10px 16px',
            borderRadius: 12,
            border: 'none',
            cursor: loading ? 'wait' : 'pointer',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Screening…' : screened ? 'Re-screen' : 'Run screening'}
        </button>
      </div>

      {error && <div style={{ marginTop: 12, fontSize: 13, color: '#f87171' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <PartyCard title="Tenant" result={tenant} />
        <PartyCard title="Landlord" result={landlord} />
      </div>

      {screened && tenant && landlord && (
        <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
          {tenant.riskBand === 'HIGH' || landlord.riskBand === 'HIGH'
            ? '⚠️ A recent eviction was found — the platform recommends a higher security deposit before releasing the booking.'
            : tenant.riskBand === 'MEDIUM' || landlord.riskBand === 'MEDIUM'
            ? 'ℹ️ Some court history found — a moderate deposit adjustment applies.'
            : '✅ Both parties cleared — standard deposit terms apply.'}
        </div>
      )}
    </div>
  );
}
