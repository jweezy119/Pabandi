import { useState, useEffect } from 'react';

interface ProfitCycle {
  cycleNumber: number;
  cycleTime: number;
  revenue: number;
  pabIssued: number;
  success: boolean;
  projectId: string;
}

interface ProfitCycleCardProps {
  cycle: ProfitCycle;
}

export default function ProfitCycleCard({ cycle }: ProfitCycleCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={`rounded-xl border transition-all cursor-pointer ${
        cycle.success
          ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40'
          : 'border-red-500/20 bg-red-500/5 hover:border-red-500/40'
      }`}
    >
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-slate-400">#{cycle.cycleNumber}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
            cycle.success
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {cycle.success ? '✅ SUCCESS' : '❌ FAILED'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">{cycle.cycleTime.toFixed(2)}s</span>
          <span className={`font-mono font-bold ${cycle.success ? 'text-emerald-400' : 'text-slate-500'}`}>
            +${cycle.revenue.toFixed(4)}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5 mt-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">PAB Issued</span>
            <span className="text-yellow-400 font-mono">{cycle.pabIssued.toFixed(2)} PAB</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Project ID</span>
            <span className="text-slate-400 font-mono text-[10px]">{cycle.projectId || 'N/A'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Revenue Rate</span>
            <span className="text-slate-400 font-mono">
              {cycle.cycleTime > 0 ? `$${(cycle.revenue / cycle.cycleTime).toFixed(4)}/s` : 'N/A'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Animated counter hook for metrics
export function useAnimatedValue(target: number, duration = 1000): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let animationFrame: number;
    const start = value;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(start + (target - start) * eased);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration]);

  return value;
}
