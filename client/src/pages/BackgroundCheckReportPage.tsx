import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { backgroundCheckService } from '../services/api';
import { tokens } from '../design-system';

export default function BackgroundCheckReportPage() {
  const { id } = useParams<{ id: string }>();
  const [check, setCheck] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    backgroundCheckService
      .get(id)
      .then((res) => setCheck(res.data?.data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: tokens.color.text }}>Loading report…</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-400">{error}</div>;
  if (!check) return <div className="min-h-screen flex items-center justify-center">Report not found</div>;

  const bandColor: Record<string, string> = { A: '#16a34a', B: '#65a30d', C: '#ca8a04', D: '#ea580c', E: '#dc2626' };
  const recColor: Record<string, string> = { PASS: '#16a34a', REVIEW: '#ca8a04', REJECT: '#dc2626' };

  const modules = [
    { key: 'gigHistoryResult', label: 'Gig Economy History (Upwork/Fiverr/FieldNation)' },
    { key: 'walletResult', label: 'On-Chain Wallet Analytics' },
    { key: 'githubResult', label: 'GitHub Credibility' },
    { key: 'domainResult', label: 'Domain Age (RDAP)' },
    { key: 'newsResult', label: 'News Index (GDELT)' },
    { key: 'breachResult', label: 'Breach Registry (HIBP)' },
    { key: 'sanctionsResult', label: 'Sanctions (OFAC)' },
    { key: 'registryResult', label: 'Company Registry' },
    { key: 'osintResult', label: 'OSINT Fusion' },
  ].filter((m) => check[m.key]);

  return (
    <div className="min-h-screen font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <a href="/background-check" className="text-sm opacity-60 hover:opacity-100">← New check</a>

        <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${recColor[check.recommendation] || '#888'}40` }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-60">Subject</p>
              <h1 className="font-headline text-2xl font-bold">{check.subjectName}</h1>
              <p className="text-sm opacity-60">{check.subjectType}{check.subjectCompany ? ` · ${check.subjectCompany}` : ''}</p>
            </div>
            <div className="text-right">
              <p className="font-headline text-4xl font-bold" style={{ color: bandColor[check.riskBand] }}>
                {check.riskScore}<span className="text-lg opacity-50">/100</span>
              </p>
              <p className="text-sm opacity-60">Band {check.riskBand}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="px-4 py-1.5 rounded-full font-bold text-sm" style={{ background: `${recColor[check.recommendation]}20`, color: recColor[check.recommendation] }}>
              {check.recommendation}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${check.recommendation === 'REJECT' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
              {check.recommendation === 'REJECT' ? '✕ Do not proceed' : '✓ Safe to proceed'}
            </span>
          </div>
          {check.summary && (
            <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <p className="text-xs uppercase tracking-wide text-indigo-400 mb-2 font-bold">🧠 AI Underwriter Rationale</p>
              <p className="text-sm opacity-90 leading-relaxed">{check.summary}</p>
            </div>
          )}
        </div>

        {check.identityConfidence !== null && check.identityConfidence !== undefined && (
          <div>
            <h2 className="font-headline text-xl font-bold mb-3">AI Trust Vectors</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs uppercase opacity-60 mb-1">Identity/Liveness</p>
                <p className="text-2xl font-bold" style={{ color: check.identityConfidence >= 70 ? '#16a34a' : check.identityConfidence >= 40 ? '#ca8a04' : '#dc2626' }}>{check.identityConfidence}%</p>
              </div>
              <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs uppercase opacity-60 mb-1">Competence</p>
                <p className="text-2xl font-bold" style={{ color: check.competenceConfidence >= 70 ? '#16a34a' : check.competenceConfidence >= 40 ? '#ca8a04' : '#dc2626' }}>{check.competenceConfidence}%</p>
              </div>
              <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs uppercase opacity-60 mb-1">Integrity</p>
                <p className="text-2xl font-bold" style={{ color: check.integrityConfidence >= 70 ? '#16a34a' : check.integrityConfidence >= 40 ? '#ca8a04' : '#dc2626' }}>{check.integrityConfidence}%</p>
              </div>
              <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <p className="text-xs uppercase text-indigo-400 mb-1 font-bold">Temporal Alignment</p>
                <p className="text-2xl font-bold text-indigo-300">{check.temporalAlignment}%</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <h2 className="font-headline text-xl font-bold mb-3">Module Breakdown</h2>
          <div className="space-y-3">
            {modules.map((m) => {
              const mod = check[m.key];
              const score = mod.riskScore ?? 0;
              const color = score >= 70 ? '#dc2626' : score >= 40 ? '#ca8a04' : '#16a34a';
              return (
                <div key={m.key} className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{m.label}</span>
                    <span className="font-bold" style={{ color }}>{score}/100</span>
                  </div>
                  {mod.signals?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {mod.signals.map((s: string, i: number) => (
                        <li key={i} className="text-xs opacity-70">• {s}</li>
                      ))}
                    </ul>
                  )}
                  {mod.error && <p className="text-xs text-amber-400 mt-1">⚠ {mod.error}</p>}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs opacity-50 text-center">
          Generated {new Date(check.createdAt).toLocaleString()} · Status: {check.status} · Powered by real sources (GitHub, RDAP, GDELT, HIBP, OFAC, Companies House, OSINT Fusion)
        </p>
      </div>
    </div>
  );
}
