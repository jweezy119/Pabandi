import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { serviceProviderService } from '../services/serviceProviderService';
import { useAuthStore } from '../store/authStore';

const PLATFORMS: Array<{ value: string; label: string; example: string }> = [
  { value: 'upwork', label: 'Upwork', example: 'upwork.com/freelancers/~01abc123' },
  { value: 'fiverr', label: 'Fiverr', example: 'fiverr.com/seller_username' },
  { value: 'taskrabbit', label: 'TaskRabbit', example: 'taskrabbit.com/tasker/username' },
  { value: 'jobber', label: 'Jobber', example: 'getjobber.com/providers/username' },
  { value: 'broccoli', label: 'Broccoli', example: 'broccoli.io/providers/username' },
];

export default function ServiceProviderIngestPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [urls, setUrls] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ url: string; status: 'pending' | 'success' | 'error'; data?: any; error?: string }>>([]);
  const [step, setStep] = useState<'input' | 'results'>('input');

  const handleAddUrl = () => {
    setUrls([...urls, '']);
  };

  const handleRemoveUrl = (index: number) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const handleUrlChange = (index: number, value: string) => {
    const next = [...urls];
    next[index] = value;
    setUrls(next);
  };

  const handleIngest = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/auth/login');
      return;
    }

    const validUrls = urls.filter(u => u.trim());
    if (validUrls.length === 0) return;

    setLoading(true);
    setResults(validUrls.map(u => ({ url: u, status: 'pending' })));
    setStep('results');

    try {
      const res = await serviceProviderService.scrapeAndIngest(validUrls);
      setResults(
        validUrls.map(url => {
          const sourceId = url.split('/').pop() || url;
          const ingested = res.data.data.ingested.find(ing => ing.sourceId === sourceId || ing.handle === sourceId);
          if (ingested) {
            return { url, status: 'success', data: ingested };
          }
          return { url, status: 'error', error: 'Ingestion failed - no result returned' };
        })
      );
    } catch (err: any) {
      setResults(validUrls.map(u => ({ url: u, status: 'error', error: err.message || 'Unknown error' })));
    } finally {
      setLoading(false);
    }
  };

  const renderInput = () => (
    <div className="min-h-screen bg-[var(--warm-sand)] text-[var(--warm-ink)]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold bg-[var(--clay)] bg-clip-text text-transparent mb-4">Import Provider</h1>
          <p className="text-[var(--soft-stone)]">Paste a profile URL from any supported marketplace. We'll scrape it, compute a Pabandi Trust Score, and create a PTP-attested Trust Passport.</p>
        </div>

        <form onSubmit={handleIngest}>
          <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-6">
            <div className="space-y-4">
              {urls.map((url, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Paste profile URL..."
                    value={url}
                    onChange={e => handleUrlChange(index, e.target.value)}
                    className="flex-1 rounded-lg border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] px-3 py-2 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
                  />
                  {urls.length > 1 && (
                    <button type="button" onClick={() => handleRemoveUrl(index)} className="p-2 text-[var(--soft-stone)] hover:text-[var(--clay)]">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={handleAddUrl} className="text-xs text-[var(--clay)] font-medium hover:underline">+ Add another URL</button>
            </div>
          </div>

          {!isAuthenticated && (
            <div className="mt-6 rounded-xl bg-[rgba(201,123,90,0.1)] border border-[rgba(201,123,90,0.3)] p-4 text-center">
              <p className="text-[var(--soft-stone)] text-sm mb-3">Sign in to import providers and create Trust Passports.</p>
              <Link to="/auth/login" className="text-[var(--clay)] font-semibold hover:underline">Sign in</Link>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isAuthenticated || urls.filter(u => u.trim()).length === 0}
            className={`mt-8 w-full py-4 rounded-xl font-bold transition-colors ${
              loading || !isAuthenticated || urls.filter(u => u.trim()).length === 0
                ? 'bg-[rgba(191,179,163,0.3)] text-[var(--soft-stone)] cursor-not-allowed'
                : 'bg-[var(--clay)] text-[var(--warm-ink)] hover:opacity-90'
            }`}
          >
            {loading ? 'Importing...' : 'Import & Create Trust Passports'}
          </button>
        </form>

        <div className="mt-10 rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-6">
          <h3 className="font-bold mb-4">Supported Platforms</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PLATFORMS.map(p => (
              <div key={p.value} className="flex items-center gap-2 text-sm text-[var(--soft-stone)]">
                <span className="material-symbols-outlined text-[var(--clay)] text-xs">open_in_new</span>
                <span>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="min-h-screen bg-[var(--warm-sand)] text-[var(--warm-ink)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              setStep('input');
              setResults([]);
            }}
            className="text-[var(--soft-stone)] hover:text-[var(--clay)] flex items-center gap-2"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Import Another
          </button>
          <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Import Results</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {results.map((result, i) => (
            <div key={i} className={`rounded-2xl p-4 border ${result.status === 'success' ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
              <div className="flex items-start justify-between mb-2">
                <span className={`text-xs font-bold uppercase ${result.status === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {result.status === 'success' ? '✓ Imported' : '✗ Failed'}
                </span>
                <span className="text-xs text-[var(--soft-stone)] truncate max-w-[200px]">{result.url}</span>
              </div>
              {result.status === 'success' && result.data && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${result.data.riskBand === 'A' ? 'bg-emerald-100 text-emerald-800' : result.data.riskBand === 'B' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                      Band {result.data.riskBand}
                    </span>
                    <span className="text-xs text-[var(--soft-stone)]">{result.data.trustScore} Trust Score</span>
                  </div>
                  <div className="text-sm font-bold text-[var(--warm-ink)]">{result.data.displayName}</div>
                  <div className="text-xs text-[var(--soft-stone)]">{result.data.source} • {result.data.sourceId}</div>
                  <button
                    onClick={() => navigate(`/service-providers/${result.data.passportId}`)}
                    className="mt-3 w-full py-2 rounded-lg bg-[var(--clay)] text-[var(--warm-ink)] text-xs font-bold hover:opacity-90 transition-colors"
                  >
                    View Provider
                  </button>
                </div>
              )}
              {result.status === 'error' && (
                <div className="text-xs text-[var(--soft-stone)] mt-2">{result.error}</div>
              )}
            </div>
          ))}
        </div>

        {results.some(r => r.status === 'success') && (
          <div className="mt-8 text-center">
            <Link to="/service-providers" className="text-[var(--clay)] font-semibold hover:underline">
              Browse All Providers
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  return step === 'input' ? renderInput() : renderResults();
}
