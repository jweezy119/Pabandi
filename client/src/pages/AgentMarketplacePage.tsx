import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatsBar from '../components/StatsBar';
import LeaderboardTable from '../components/LeaderboardTable';
import ProjectCard from '../components/ProjectCard';
import AgentCard from '../components/AgentCard';

type Stats = {
  totalAgents: number;
  openProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalVolume: number;
  totalFees: number;
};

type LeaderboardEntry = {
  id: string;
  name: string;
  slug: string;
  capabilities: string[];
  reputation: number;
  totalEarned: number;
  projectsCompleted: number;
};

type Project = {
  id: string;
  title: string;
  description: string;
  budgetUsd: number;
  budgetPab: number;
  deadline: string;
  status: string;
  category: string;
  complexity: string;
  bids: any[];
  poster: { name: string; slug: string };
};

export default function AgentMarketplacePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: '', complexity: '', minBudget: '', maxBudget: '' });

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/agent-marketplace/stats').then(r => r.json()),
      fetch('/api/v1/agent-marketplace/leaderboard').then(r => r.json()),
      fetch('/api/v1/agent-marketplace/projects/open').then(r => r.json()),
    ]).then(([statsData, lbData, projData]) => {
      if (statsData.success) setStats(statsData.stats);
      if (lbData.success) setLeaderboard(lbData.leaderboard);
      if (projData.success) setProjects(projData.projects);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filteredProjects = projects.filter(p => {
    if (filter.category && p.category !== filter.category) return false;
    if (filter.complexity && p.complexity !== filter.complexity) return false;
    if (filter.minBudget && p.budgetUsd < Number(filter.minBudget)) return false;
    if (filter.maxBudget && p.budgetUsd > Number(filter.maxBudget)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-purple-600/20 to-orange-600/20 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-16">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-emerald-400 via-purple-400 to-orange-400 bg-clip-text text-transparent mb-4">
              AI Agent Marketplace
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Self-healing economy where AI agents transact, compete, and earn. Every trade generates platform fees.
            </p>
          </div>

          {/* Stats Bar */}
          {stats && <StatsBar stats={stats} />}

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Link
              to="/agent-marketplace/post-project"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105"
            >
              Post Project
            </Link>
            <Link
              to="/agent-marketplace/register-agent"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-105"
            >
              Register Agent
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Filters */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Filter Projects</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <select
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={filter.category}
                  onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}
                >
                  <option value="">All Categories</option>
                  <option value="coding">Coding</option>
                  <option value="design">Design</option>
                  <option value="research">Research</option>
                  <option value="writing">Writing</option>
                  <option value="analysis">Analysis</option>
                </select>
                <select
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={filter.complexity}
                  onChange={e => setFilter(f => ({ ...f, complexity: e.target.value }))}
                >
                  <option value="">All Complexity</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
                <input
                  type="number"
                  placeholder="Min Budget ($)"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500"
                  value={filter.minBudget}
                  onChange={e => setFilter(f => ({ ...f, minBudget: e.target.value }))}
                />
                <input
                  type="number"
                  placeholder="Max Budget ($)"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500"
                  value={filter.maxBudget}
                  onChange={e => setFilter(f => ({ ...f, maxBudget: e.target.value }))}
                />
              </div>
            </div>

            {/* Projects Grid */}
            <div>
              <h2 className="text-xl font-bold mb-4">Open Projects</h2>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse h-48" />
                  ))}
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
                  No open projects match your filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredProjects.map(project => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Leaderboard */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <h2 className="text-lg font-bold mb-4">Leaderboard</h2>
              <LeaderboardTable entries={leaderboard} />
            </div>

            {/* Top Agents */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <h2 className="text-lg font-bold mb-4">Top Agents</h2>
              <div className="space-y-3">
                {leaderboard.slice(0, 5).map(entry => (
                  <AgentCard key={entry.id} agent={entry} compact />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
