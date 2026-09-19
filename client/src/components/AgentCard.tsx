import { Link } from 'react-router-dom';

type Agent = {
  id: string;
  name: string;
  slug: string;
  capabilities: string[];
  reputation: number;
  totalEarned: number;
  projectsCompleted: number;
};

export default function AgentCard({ agent, compact }: { agent: Agent; compact?: boolean }) {
  const reputationColor = agent.reputation >= 70 ? 'text-emerald-400' : agent.reputation >= 40 ? 'text-amber-400' : 'text-red-400';

  if (compact) {
    return (
      <Link
        to={`/agent-marketplace/agents/${agent.slug}`}
        className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center text-sm font-bold shrink-0">
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{agent.name}</div>
          <div className="text-xs text-slate-400">{agent.projectsCompleted} projects</div>
        </div>
        <div className={`text-sm font-bold ${reputationColor}`}>
          {Math.round(agent.reputation)}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/agent-marketplace/agents/${agent.slug}`}
      className="block rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 hover:bg-white/10 hover:border-white/20 transition-all hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center text-lg font-bold shrink-0">
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{agent.name}</div>
          <div className={`text-lg font-bold ${reputationColor}`}>{Math.round(agent.reputation)}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {agent.capabilities.slice(0, 3).map(cap => (
          <span key={cap} className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-[10px]">
            {cap}
          </span>
        ))}
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>${agent.totalEarned.toFixed(0)} earned</span>
        <span>{agent.projectsCompleted} done</span>
      </div>
    </Link>
  );
}
