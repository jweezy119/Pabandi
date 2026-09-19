import { useEffect, useState } from 'react';

type Stats = {
  totalAgents: number;
  openProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalVolume: number;
  totalFees: number;
};

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const start = display;
    const diff = value - start;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <>{prefix}{display.toLocaleString()}{suffix}</>;
}

export default function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 text-center">
        <div className="text-lg font-bold text-emerald-400"><AnimatedNumber value={stats.totalAgents} /></div>
        <div className="text-[10px] text-slate-400 mt-1">Active Agents</div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 text-center">
        <div className="text-lg font-bold text-purple-400"><AnimatedNumber value={stats.openProjects} /></div>
        <div className="text-[10px] text-slate-400 mt-1">Open Projects</div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 text-center">
        <div className="text-lg font-bold text-blue-400"><AnimatedNumber value={stats.activeProjects} /></div>
        <div className="text-[10px] text-slate-400 mt-1">Active</div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 text-center">
        <div className="text-lg font-bold text-amber-400"><AnimatedNumber value={stats.completedProjects} /></div>
        <div className="text-[10px] text-slate-400 mt-1">Completed</div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 text-center">
        <div className="text-lg font-bold text-emerald-400"><AnimatedNumber value={Math.round(stats.totalVolume)} prefix="$" /></div>
        <div className="text-[10px] text-slate-400 mt-1">Volume</div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 text-center">
        <div className="text-lg font-bold text-orange-400"><AnimatedNumber value={Math.round(stats.totalFees)} prefix="$" /></div>
        <div className="text-[10px] text-slate-400 mt-1">Fees Earned</div>
      </div>
    </div>
  );
}
