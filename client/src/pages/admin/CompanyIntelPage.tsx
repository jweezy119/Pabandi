import { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Surface, Button, Badge, Chip, Stack, tokens } from '../../design-system';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../services/api';

interface IntelResult {
  domain: string;
  isActive: boolean;
  emails: string[];
  techStack: string[];
  socials: { linkedin?: string; twitter?: string; facebook?: string };
  legal?: {
    verified: boolean;
    source: string;
    lei?: string;
    legalName?: string;
    jurisdiction?: string;
    companyNumber?: string;
  };
  error?: string;
}

export default function CompanyIntelPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<IntelResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      navigate('/');
      return;
    }
  }, [user, navigate]);

  const handleRunIntel = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await apiClient.post('/admin/ingest/company-intel', { domain: domain.trim() });
      setResult(res.data.data);
    } catch (err: any) {
      setResult({
        domain: domain.trim(),
        isActive: false,
        emails: [],
        techStack: [],
        socials: {},
        error: err.response?.data?.error || err.message || 'Enrichment failed',
      });
    } finally {
      setIsLoading(false);
    }
  }, [domain]);

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: tokens.color.text }}>
              Company Intel
            </h1>
            <p className="text-sm" style={{ color: tokens.color.textMuted }}>
              In-house enrichment engine — scrapes websites and government registries to verify business legitimacy.
            </p>
          </div>
          <Link to="/admin/dashboard">
            <Button variant="outline">← Back to Dashboard</Button>
          </Link>
        </div>

        <Stack>
          <Surface className="p-6">
            <h2 className="text-lg font-bold mb-4" style={{ color: tokens.color.text }}>
              Enrich Company
            </h2>
            <form onSubmit={handleRunIntel} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                  Website Domain
                </label>
                <input
                  type="text"
                  placeholder="e.g. acme-corp.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                />
                <p className="text-xs mt-1" style={{ color: tokens.color.textDim }}>
                  Enter a domain without http:// or https://
                </p>
              </div>
              <Button type="submit" variant="primary" disabled={isLoading} loading={isLoading}>
                Run Intel
              </Button>
            </form>
          </Surface>

          {result && (
            <Surface className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: tokens.color.text }}>
                  Results for {result.domain}
                </h2>
                <Badge tone={result.error ? 'danger' : result.isActive ? 'success' : 'warning'}>
                  {result.error ? 'Error' : result.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {result.error && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm mb-4">
                  {result.error}
                </div>
              )}

              {!result.error && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                    <h3 className="text-sm font-bold text-[var(--soft-stone)] mb-3" style={{ color: tokens.color.textMuted }}>
                      Emails
                    </h3>
                    {result.emails.length ? (
                      <ul className="space-y-1 text-sm">
                        {result.emails.map((email) => (
                          <li key={email} className="flex items-center gap-2 truncate">
                            <span className="text-[var(--warm-ink)]" style={{ color: tokens.color.text }}>{email}</span>
                            <Badge tone="success" className="text-[10px] leading-none">✓</Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs" style={{ color: tokens.color.textMuted }}>
                        No emails found
                      </p>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                    <h3 className="text-sm font-bold text-[var(--soft-stone)] mb-3" style={{ color: tokens.color.textMuted }}>
                      Tech Stack
                    </h3>
                    {result.techStack.length ? (
                      <div className="flex flex-wrap gap-2">
                        {result.techStack.map((tech) => (
                          <Chip key={tech} label={tech} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: tokens.color.textMuted }}>
                        No tech detected
                      </p>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                    <h3 className="text-sm font-bold text-[var(--soft-stone)] mb-3" style={{ color: tokens.color.textMuted }}>
                      Socials
                    </h3>
                    <div className="space-y-2 text-sm">
                      {result.socials.linkedin && (
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--soft-stone)]">LinkedIn</span>
                          <a href={result.socials.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline truncate max-w-[200px]">{result.socials.linkedin}</a>
                        </div>
                      )}
                      {result.socials.twitter && (
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--soft-stone)]">Twitter/X</span>
                          <a href={result.socials.twitter} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline truncate max-w-[200px]">{result.socials.twitter}</a>
                        </div>
                      )}
                      {result.socials.facebook && (
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--soft-stone)]">Facebook</span>
                          <a href={result.socials.facebook} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline truncate max-w-[200px]">{result.socials.facebook}</a>
                        </div>
                      )}
                      {!result.socials.linkedin && !result.socials.twitter && !result.socials.facebook && (
                        <p className="text-xs" style={{ color: tokens.color.textMuted }}>
                          No socials found
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/10 bg-white/5 col-span-1 md:col-span-2 lg:col-span-3">
                    <h3 className="text-sm font-bold text-[var(--soft-stone)] mb-3" style={{ color: tokens.color.textMuted }}>
                      Legal Verification
                    </h3>
                    {result.legal ? (
                      <div className="flex items-center gap-4">
                        <Badge tone={result.legal.verified ? 'success' : 'danger'}>
                          {result.legal.verified ? 'Verified' : 'Not Verified'}
                        </Badge>
                        <div className="text-sm">
                          <p className="text-[var(--warm-ink)]" style={{ color: tokens.color.text }}>
                            {result.legal.legalName || 'N/A'}
                          </p>
                          <p className="text-xs text-[var(--soft-stone)]" style={{ color: tokens.color.textMuted }}>
                            Source: {result.legal.source.toUpperCase()} {result.legal.lei ? `• LEI: ${result.legal.lei}` : ''} {result.legal.companyNumber ? `• Reg: ${result.legal.companyNumber}` : ''} {result.legal.jurisdiction ? `• ${result.legal.jurisdiction}` : ''}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: tokens.color.textMuted }}>
                        Legal verification not performed
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Surface>
          )}
        </Stack>
      </div>
    </div>
  );
}
