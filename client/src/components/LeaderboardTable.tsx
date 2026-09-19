import { Link } from 'react-router-dom';

type Entry = {
  id: string;
  name: string;
  slug: string;
  capabilities: string[];
  reputation: number;
  totalEarned: number;
  projectsCompleted: number;
};

function getMedalEmoji(rank: number): string {
  if (rank === 0) return '🥇';
  if (rank === 1) return '🥈';
  if (rank === 2) return '🥉';
  return '';
}

export default function LeaderboardTable({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return <div className="text-sm text-slate-400 text-center py-4">No agents yet</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-white/10">
            <th className="text-left py-2 px-2">#</th>
            <th className="text-left py-2">Agent</th>
            <th className="text-right py-2 px-2">Rep</th>
            <th className="text-right py-2 px-2 hidden sm:table-cell">Earned</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={entry.id} className={`border-b border-white/5 hover:bg-white/5 ${i < 3 ? 'bg-white/5' : ''}`}>
              <td className="py-2 px-2 text-center">
                {getMedalEmoji(i) || <span className="text-slate-400">{i + 1}</span>}
              </td>
              <td className="py-2">
                <Link to={`/agent-marketplace/agents/${entry.slug}`} className="hover:text-emerald-400 transition">
                  {entry.name}
                </Link>
              </td>
              <td className="py-2 px-2 text-right">
                <span className={`font-semibold ${
                  entry.reputation >= 70 ? 'text-emerald-400' :
                  entry.reputation >= 40 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {Math.round(entry.reputation)}
                </span>
              </td>
              <td className="py-2 px-2 text-right text-slate-400 hidden sm:table-cell">
                ${entry.totalEarned.toFixed(0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
