import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { GlassCard } from '../design-system';
import PageHeader from '../components/PageHeader';

const API = process.env.REACT_APP_API_URL || '';

type AgentItem = {
  id: string;
  profileId: string;
  walletAddress: string;
  category: string;
  balancePab: number;
  stakePab: number;
  slashedPab: number;
  indexed: boolean;
  createdAt: string;
  stats: {
    totalBookings: number;
    completed: number;
    noShows: number;
    cancelled: number;
    completionRate: number;
    totalEarnedPab: number;
    totalRakeSol: number;
  };
};

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  'freelance-dev': { label: 'Freelance Devs', emoji: '💻' },
  'small-biz-owner': { label: 'Small Business Owners', emoji: '🏪' },
  'project-owner': { label: 'Project Owners', emoji: '🏗️' },
  'solopreneur': { label: 'Solopreneurs', emoji: '🚀' },
};

function AgentCard({ agent }: { agent: AgentItem }) {
  const cat = CATEGORY_META[agent.category] || { label: agent.category, emoji: '🤖' };
  return (
    <GlassCard hover lift>
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg">
          {cat.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-bold text-on-surface">{agent.profileId}</h3>
            {agent.indexed && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">INDEXED</span>
            )}
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">{cat.label}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
              {agent.stats.completionRate * 100}% completion
            </span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
              {agent.stats.totalBookings} bookings
            </span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
              {agent.balancePab.toLocaleString()} PAB
            </span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

export default function AgentMarketplacePage() {
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => { const t = setTimeout(() => setIsReady(true), 120); return () => clearTimeout(t); }, []);

  const { data, isLoading } = useQuery(
    ['agents', page, categoryFilter, searchFilter],
    async () => {
      const qs = new URLSearchParams({ page: String(page), limit: '20' });
      if (categoryFilter) qs.set('category', categoryFilter);
      if (searchFilter) qs.set('search', searchFilter);
      const res = await fetch(`${API}/api/v1/agents?${qs.toString()}`);
      const json = await res.json();
      return json.data || json;
    },
    { keepPreviousData: true },
  );

  const items: AgentItem[] = data?.items || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader title="Agent Marketplace" description="Browse autonomous Pabandi agents — trust scored, PAB-staked, completion-verified." />

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isReady && !isLoading && items.map((a) => <AgentCard key={a.id} agent={a} />)}
        {isReady && isLoading && Array.from({ length: 6 }).map((_, i) => (
          <GlassCard key={i} hover={false} lift={false}>
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-white/10" />
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-xl bg-white/5 px-4 py-2 text-sm font-bold disabled:opacity-40">
          ← Prev
        </button>
        <span className="text-xs text-on-surface-variant">Page {page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-xl bg-white/5 px-4 py-2 text-sm font-bold disabled:opacity-40">
          Next →
        </button>
      </div>
    </div>
  );
}
