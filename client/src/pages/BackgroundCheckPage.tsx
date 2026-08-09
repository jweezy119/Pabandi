import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { backgroundCheckService } from '../services/api';
import { tokens } from '../design-system';

type SubjectType = 'FREELANCER' | 'PROPERTY_MANAGER' | 'BUSINESS' | 'GUEST';

interface CheckResult {
  checkId: string;
  recommendation: string;
  riskScore: number;
  riskBand: string;
  proceed: boolean;
}

export default function BackgroundCheckPage() {
  const { isAuthenticated } = useAuthStore();
  const [subjectType, setSubjectType] = useState<SubjectType>('FREELANCER');
  const [subjectId, setSubjectId] = useState<string>('');
  const [name, setName] = useState('');
  const [github, setGithub] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<any[]>([]);

  // Allow deep-linking a subject (e.g. ?subjectId=<businessId>) so a check is
  // tied to a real entity and can hard-gate bookings.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('subjectId');
    if (sid) setSubjectId(sid);
  }, []);

  const runCheck = async () => {
    if (!name.trim()) {
      setError('Subject name is required');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await backgroundCheckService.preBooking({
        subjectType,
        subjectName: name,
        subjectId: subjectId || undefined,
        subjectGithub: github || undefined,
        subjectWebsite: website || undefined,
        subjectEmail: email || undefined,
        subjectCompany: company || undefined,
      });
      const data = res.data?.data;
      setResult(data);
      loadRecent();
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Check failed');
    } finally {
      setLoading(false);
    }
  };

  const loadRecent = async () => {
    try {
      const res = await backgroundCheckService.list({ subjectType });
      setRecent(res.data?.data || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadRecent();
  }, [subjectType, isAuthenticated]);

  const bandColor: Record<string, string> = {
    A: '#16a34a',
    B: '#65a30d',
    C: '#ca8a04',
    D: '#ea580c',
    E: '#dc2626',
  };

  const recColor: Record<string, string> = {
    PASS: '#16a34a',
    REVIEW: '#ca8a04',
    REJECT: '#dc2626',
  };

  return (
    <div className="min-h-screen font-body relative" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .anim-fade-up { animation: fadeUp .45s ease-out both; }
        .card-lift { transition: transform .2s ease, box-shadow .2s ease; }
        .card-lift:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(0,0,0,0.25); }
        .input-pab { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 12px 14px; color: inherit; width: 100%; outline: none; transition: border-color .2s; }
        .input-pab:focus { border-color: ${tokens.color.primary}; }
        .btn-pab { background: ${tokens.color.primary}; color: #0a0a0a; font-weight: 700; border-radius: 14px; padding: 12px 20px; cursor: pointer; border: none; transition: opacity .2s; }
        .btn-pab:hover { opacity: 0.9; }
        .btn-pab:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <div className="anim-fade-up">
          <p className="text-xs uppercase tracking-widest opacity-60 mb-2">Trust & Safety</p>
          <h1 className="font-headline text-3xl sm:text-4xl font-bold">Background Check</h1>
          <p className="opacity-70 mt-2 max-w-2xl">
            Streamlined, reliable screening for freelancers, service providers, and property managers.
            Real sources: GitHub, domain age (RDAP), global news (GDELT), breach registry (HIBP),
            US sanctions (OFAC), and company registries — fused into one trust verdict.
          </p>
        </div>

        {/* Input form */}
        <div className="anim-fade-up anim-delay-1 card-lift rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs uppercase tracking-wide opacity-60">Subject ID (optional — business/user id to hard-gate bookings)</label>
              <input className="input-pab mt-1" placeholder="e.g. business id from profile URL" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide opacity-60">Subject Type</label>
              <select className="input-pab mt-1" value={subjectType} onChange={(e) => setSubjectType(e.target.value as SubjectType)}>
                <option value="FREELANCER">Freelancer / Dev</option>
                <option value="PROPERTY_MANAGER">Property Manager</option>
                <option value="BUSINESS">Business</option>
                <option value="GUEST">Guest / Client</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide opacity-60">Name *</label>
              <input className="input-pab mt-1" placeholder="Full name or business name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide opacity-60">GitHub (freelancers)</label>
              <input className="input-pab mt-1" placeholder="username" value={github} onChange={(e) => setGithub(e.target.value)} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide opacity-60">Website / Domain</label>
              <input className="input-pab mt-1" placeholder="example.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide opacity-60">Email</label>
              <input className="input-pab mt-1" placeholder="contact@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide opacity-60">Company (UK reg)</label>
              <input className="input-pab mt-1" placeholder="Company Ltd" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <div className="mt-5">
            <button className="btn-pab" onClick={runCheck} disabled={loading}>
              {loading ? 'Running checks…' : 'Run Background Check'}
            </button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="anim-fade-up anim-delay-2 card-lift rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${recColor[result.recommendation] || '#888'}40` }}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide opacity-60">Verdict</p>
                <p className="font-headline text-2xl font-bold" style={{ color: recColor[result.recommendation] }}>
                  {result.recommendation}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide opacity-60">Risk Score</p>
                <p className="font-headline text-4xl font-bold" style={{ color: bandColor[result.riskBand] }}>
                  {result.riskScore}<span className="text-lg opacity-50">/100</span>
                </p>
                <p className="text-sm opacity-60">Band {result.riskBand}</p>
              </div>
            </div>
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${result.proceed ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                {result.proceed ? '✓ Safe to proceed' : '✕ Do not proceed'}
              </span>
              <a href={`/background-check/${result.checkId}`} className="ml-3 text-xs underline opacity-60 hover:opacity-100">
                View full report →
              </a>
            </div>
          </div>
        )}

        {/* Recent checks */}
        {isAuthenticated && recent.length > 0 && (
          <div className="anim-fade-up anim-delay-3">
            <h2 className="font-headline text-xl font-bold mb-3">Recent Checks</h2>
            <div className="space-y-2">
              {recent.slice(0, 8).map((c: any) => (
                <a key={c.id} href={`/background-check/${c.id}`} className="block card-lift rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div>
                    <p className="font-semibold">{c.subjectName}</p>
                    <p className="text-xs opacity-60">{c.subjectType} · {new Date(c.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.riskScore !== null && (
                      <span className="font-bold" style={{ color: bandColor[c.riskBand] }}>{c.riskScore}</span>
                    )}
                    {c.recommendation && (
                      <span className="px-2 py-1 rounded-full text-xs font-bold" style={{ background: `${recColor[c.recommendation]}20`, color: recColor[c.recommendation] }}>
                        {c.recommendation}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {!isAuthenticated && (
          <p className="text-sm opacity-60 anim-fade-up">Log in to save checks and view your screening history.</p>
        )}
      </div>
    </div>
  );
}
