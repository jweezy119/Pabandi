import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { serviceProviderService, type ServiceProvider } from '../services/serviceProviderService';

const SOURCE_BADGES: Record<string, string> = {
  upwork: 'Upwork',
  fiverr: 'Fiverr',
  taskrabbit: 'TaskRabbit',
  thumbtack: 'Thumbtack',
  jobber: 'Jobber',
  broccoli: 'Broccoli',
  manual: 'Manual',
};

const RISK_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  B: 'bg-blue-100 text-blue-800 border-blue-200',
  C: 'bg-amber-100 text-amber-800 border-amber-200',
  D: 'bg-orange-100 text-orange-800 border-orange-200',
  E: 'bg-rose-100 text-rose-800 border-rose-200',
};

const RISK_LABELS: Record<string, string> = {
  A: 'Guaranteed up to $500',
  B: 'Guaranteed up to $200',
  C: 'No guarantee',
  D: 'No guarantee',
  E: 'No guarantee',
};

export default function ServiceProviderDirectoryPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    minTrustScore: '',
    category: '',
    skills: '',
  });
  const [page, setPage] = useState(0);
  const limit = 20;

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const skills = filters.skills.split(',').map(s => s.trim()).filter(Boolean);
      const res = await serviceProviderService.discover({
        minTrustScore: filters.minTrustScore ? Number(filters.minTrustScore) : undefined,
        category: filters.category || undefined,
        skills: skills.length > 0 ? skills : undefined,
        limit,
        offset: page * limit,
      });
      if (res.data?.success) {
        setProviders(res.data.data.providers);
        setTotal(res.data.data.total);
      }
    } catch {
      // swallow
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  return (
    <div className="min-h-screen bg-[var(--warm-sand)] text-[var(--warm-ink)]">
      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold bg-[var(--clay)] bg-clip-text text-transparent mb-4">
            Service Provider Directory
          </h1>
          <p className="text-lg text-[var(--soft-stone)] max-w-2xl mx-auto">
            Verified service providers from Upwork, Fiverr, TaskRabbit, Jobber and Broccoli —
            each with a Pabandi Trust Score and PTP attestation. AI agents and humans book
            them through escrow with platform-backed guarantees.
          </p>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] backdrop-blur-xl p-6 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[var(--soft-stone)]">Min Trust Score</label>
              <input
                type="number"
                placeholder="0-1000"
                className="rounded-lg border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] px-3 py-2 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
                value={filters.minTrustScore}
                onChange={e => setFilters(f => ({ ...f, minTrustScore: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[var(--soft-stone)]">Category</label>
              <select
                className="rounded-lg border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] px-3 py-2 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
                value={filters.category}
                onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
              >
                <option value="">All</option>
                <option value="FREELANCER">Freelancer</option>
                <option value="HOME_SERVICE">Home Service</option>
                <option value="DATA_BROKER">Data Broker</option>
                <option value="AGENT_BUILDER">AI Agent Builder</option>
                <option value="MARKETPLACE">Marketplace</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[var(--soft-stone)]">Skills (comma-separated)</label>
              <input
                type="text"
                placeholder="plumbing, design, coding"
                className="rounded-lg border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] px-3 py-2 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
                value={filters.skills}
                onChange={e => setFilters(f => ({ ...f, skills: e.target.value }))}
              />
            </div>
            <div className="flex items-end col-span-1 sm:col-span-1">
              <button
                onClick={() => setPage(0)}
                onMouseDown={e => e.preventDefault()}
                className="px-6 py-3 rounded-xl bg-[var(--clay)] text-white font-semibold hover:opacity-90 transition-colors"
                disabled={loading}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mb-8 text-[var(--soft-stone)] text-sm">
          <span>{total} providers</span>
          <span>•</span>
          <span>3.5% platform fee on booking release</span>
          <span>•</span>
          <span>PTP-backed guarantees</span>
        </div>

        {/* Providers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-6 animate-pulse h-80" />
            ))
          ) : providers.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-12 text-center text-[var(--soft-stone)]">
              No providers match your filters.
            </div>
          ) : (
            providers.map(provider => (
              <ProviderCard key={provider.id} provider={provider} />
            ))
          )}
        </div>

        {total > page * limit + limit && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setPage(p => p + 1)}
              className="px-8 py-3 rounded-xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] text-[var(--warm-ink)] font-semibold hover:bg-[rgba(232,217,197,0.5)] transition-colors"
              disabled={loading}
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: ServiceProvider }) {
  const riskColor = RISK_COLORS[provider.riskBand] || RISK_COLORS.C;
  const riskLabel = RISK_LABELS[provider.riskBand] || 'No guarantee';
  const sourceLabel = SOURCE_BADGES[provider.source] || provider.source;
  const rating = provider.externalRating?.toFixed(1) || '—';
  const reviews = provider.reviewCount || 0;

  return (
    <Link
      to={`/service-providers/${provider.id}`}
      className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-6 hover:border-[var(--clay)] hover:shadow-lg hover:shadow-[var(--clay)]/20 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${riskColor}`}>
            Band {provider.riskBand}
          </span>
          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] text-[var(--soft-stone)]`}>
            {sourceLabel}
          </span>
        </div>
        <span className="text-[var(--clay)] font-bold text-xl">{provider.trustScore}</span>
      </div>

      <h3 className="font-bold text-[var(--warm-ink)] text-lg mb-1 group-hover:text-[var(--clay)] transition-colors">
        {provider.displayName}
      </h3>
      <p className="text-[var(--soft-stone)] text-sm mb-3 line-clamp-2">
        {provider.bio || provider.headline || `Service provider from ${sourceLabel}`}
      </p>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs text-[var(--soft-stone)]">
          <span className="material-symbols-outlined">star</span>
          <span>{rating}</span>
          <span className="text-[10px]">({reviews} reviews)</span>
        </div>
        {provider.location && (
          <div className="flex items-center gap-2 text-xs text-[var(--soft-stone)]">
            <span className="material-symbols-outlined">location_on</span>
            <span>{provider.location}</span>
          </div>
        )}
        {provider.hourlyRate && (
          <div className="flex items-center gap-2 text-xs text-[var(--soft-stone)]">
            <span className="material-symbols-outlined">attach_money</span>
            <span>${provider.hourlyRate}/hr</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        {provider.skills.slice(0, 4).map(skill => (
          <span key={skill} className="px-2 py-1 rounded border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] text-[10px] text-[var(--soft-stone)]">
            {skill}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-[rgba(191,179,163,0.3)]">
        <span className="text-[10px] font-bold uppercase text-[var(--soft-stone)] block mb-1">{riskLabel}</span>
        <div className="flex items-center justify-between">
          <Link
            to={`/service-providers/${provider.id}`}
            className="px-4 py-2 rounded-xl bg-[var(--clay)] text-[var(--warm-ink)] text-xs font-bold hover:opacity-90 transition-colors"
          >
            View Details
          </Link>
        </div>
      </div>
    </Link>
  );
}
