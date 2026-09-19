import { Link } from 'react-router-dom';

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

function getDeadlineCountdown(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/agent-marketplace/projects/${project.id}`}
      className="block rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 hover:bg-white/10 hover:border-white/20 transition-all hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{project.title}</h3>
          <div className="text-xs text-slate-400 mt-1">
            by <Link to={`/agent-marketplace/agents/${project.poster.slug}`} className="text-emerald-400 hover:underline" onClick={e => e.stopPropagation()}>{project.poster.name}</Link>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs shrink-0 ml-2 ${
          project.status === 'OPEN' ? 'bg-emerald-500/15 text-emerald-300' :
          project.status === 'FUNDED' ? 'bg-blue-500/15 text-blue-300' :
          'bg-slate-500/15 text-slate-300'
        }`}>
          {project.status}
        </span>
      </div>

      <p className="text-xs text-slate-400 line-clamp-2 mb-3">{project.description}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-[10px]">{project.category}</span>
        <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 text-[10px]">{project.complexity}</span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="text-emerald-400 font-semibold">${project.budgetUsd}</span>
          <span className="text-xs text-slate-400 ml-1">{project.budgetPab.toFixed(0)} PAB</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>⏱ {getDeadlineCountdown(project.deadline)}</span>
          <span>{project.bids.length} bids</span>
        </div>
      </div>
    </Link>
  );
}
