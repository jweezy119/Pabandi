import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { trustPassportService } from '../services/api';
import { tokens } from '../design-system';

const bandColor: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444',
};

export default function TrustPassportPage() {
  const { handle } = useParams<{ handle: string }>();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!handle) return;
    trustPassportService.getPublic(handle)
      .then((r) => setData(r.data?.data))
      .catch((e) => setErr(e.response?.data?.error || e.message));
  }, [handle]);

  const share = async () => {
    const url = `${window.location.origin}/trust/${handle}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setCopied(false); }
  };

  const band = data?.trust?.trustBand || 'D';
  const bc = data?.backgroundCheck;
  const prot = data?.protections || {};

  return (
    <div className="min-h-screen font-body flex items-center justify-center px-4 py-10" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .anim-fade-up { animation: fadeUp .5s ease-out both; }
        .band-glow { box-shadow: 0 0 40px ${bandColor[band] || '#888'}33; }
      `}</style>
      {err && <div className="text-red-400">{err}</div>}
      {!data && !err && <div className="opacity-60">Loading passport…</div>}
      {data && (
        <div className="anim-fade-up w-full max-w-xl rounded-3xl p-7 band-glow" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${bandColor[band]}55` }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest opacity-60">Pabandi Trust Passport</p>
              <h1 className="font-headline text-2xl font-bold mt-1">{data.displayName}</h1>
              <p className="text-sm opacity-60">{data.category} · @{data.handle}</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg" style={{ background: bandColor[band], color: '#0a0a0a' }}>{band}</div>
              <p className="text-xs opacity-60 mt-1">Trust Band</p>
            </div>
          </div>

          {data.bio && <p className="text-sm opacity-80 mt-4">{data.bio}</p>}

          {/* Headline trust */}
          <div className="grid grid-cols-3 gap-3 mt-5 text-center">
            <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-lg font-bold">{data.trust?.trustVelocity?.toFixed?.(2) ?? '0.00'}</p>
              <p className="text-xs opacity-60">Velocity</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-lg font-bold">{data.trust?.reliabilityScore ?? '—'}</p>
              <p className="text-xs opacity-60">Reliability</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-lg font-bold">{Math.round((data.trust?.profileCompleteness ?? 0) * 100)}%</p>
              <p className="text-xs opacity-60">Complete</p>
            </div>
          </div>

          {/* Background check */}
          <div className="rounded-2xl p-4 mt-4" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${(bc?.recommendation === 'PASS' ? '#22c55e' : '#ef4444')}44` }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Background Check</p>
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: bc?.recommendation === 'PASS' ? '#22c55e' : '#ef4444', color: '#0a0a0a', fontWeight: 700 }}>
                {bc ? `${bc.recommendation} · ${bc.riskScore}/100` : 'Not run'}
              </span>
            </div>
            {bc?.completedAt && <p className="text-xs opacity-60 mt-1">Verified {new Date(bc.completedAt).toLocaleDateString()}</p>}
          </div>

          {/* Skin in the game */}
          <div className="rounded-2xl p-4 mt-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-sm font-semibold mb-2">Protected Activity</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><b>{prot.activeDeposits ?? 0}</b> active deposits · ${Math.round(prot.totalDepositsUSD ?? 0).toLocaleString()}</div>
              <div><b>{prot.activeBonds ?? 0}</b> performance bonds · ${Math.round(prot.totalBondedUSD ?? 0).toLocaleString()}</div>
              <div className="col-span-2 opacity-60">{prot.drawsReleased ?? 0} milestone draws released clean</div>
            </div>
          </div>

          {data.communityPools?.length > 0 && (
            <div className="rounded-2xl p-4 mt-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-sm font-semibold mb-2">Community Pools Governed</p>
              {data.communityPools.map((pl: any, i: number) => (
                <p key={i} className="text-xs opacity-70">{pl.communityName}: ${Math.round(pl.availableYieldUSD).toLocaleString()} yield available</p>
              ))}
            </div>
          )}

          {/* CTAs */}
          <div className="flex gap-3 mt-6">
            <Link to={`/protected-deposit?provider=${handle}`} className="btn-pab" style={{ background: tokens.color.primary, color: '#0a0a0a', fontWeight: 700, borderRadius: 12, padding: '11px 18px', textDecoration: 'none' }}>
              Request Protected Deal
            </Link>
            <button className="btn-ghost" onClick={share} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '11px 18px', color: 'inherit', cursor: 'pointer' }}>
              {copied ? 'Link copied!' : 'Share'}
            </button>
          </div>
          <p className="text-xs opacity-50 mt-4 text-center">Verified by Pabandi · {data.issuedAt && new Date(data.issuedAt).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}
