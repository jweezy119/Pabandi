import { useState, useEffect } from 'react';

interface VelocityMeterProps {
  current: number;
  max: number;
  efficiency: number;
  revenuePerCycle: number;
}

export default function VelocityMeter({ current, max, efficiency, revenuePerCycle }: VelocityMeterProps) {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const pct = Math.min(100, (current / max) * 100);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(pct), 50);
    return () => clearTimeout(timer);
  }, [pct]);

  const getEfficiencyColor = (eff: number) => {
    if (eff >= 90) return 'text-emerald-400';
    if (eff >= 70) return 'text-yellow-400';
    if (eff >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const getBarGradient = (eff: number) => {
    if (eff >= 90) return 'from-emerald-500 to-emerald-400';
    if (eff >= 70) return 'from-yellow-500 to-yellow-400';
    if (eff >= 50) return 'from-orange-500 to-orange-400';
    return 'from-red-500 to-red-400';
  };

  return (
    <div className="space-y-4">
      {/* Main velocity bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span className="font-semibold text-white">{current.toFixed(0)} cycles/day</span>
          <span>Max: {max}</span>
        </div>
        <div className="relative w-full h-4 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${getBarGradient(efficiency)} transition-all duration-1000 ease-out`}
            style={{ width: `${animatedWidth}%` }}
          />
          {/* Tick marks */}
          <div className="absolute inset-0 flex justify-between px-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="w-px h-full bg-slate-900/50" />
            ))}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-3 rounded-xl bg-slate-800/50 border border-white/5">
          <p className="text-xs text-slate-400 mb-1">Efficiency</p>
          <p className={`text-xl font-bold ${getEfficiencyColor(efficiency)}`}>{efficiency.toFixed(1)}%</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-slate-800/50 border border-white/5">
          <p className="text-xs text-slate-400 mb-1">Revenue / Cycle</p>
          <p className="text-xl font-bold text-emerald-400">${revenuePerCycle.toFixed(4)}</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-slate-800/50 border border-white/5">
          <p className="text-xs text-slate-400 mb-1">Daily Revenue</p>
          <p className="text-lg font-bold text-yellow-400">${(current * revenuePerCycle).toFixed(2)}</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-slate-800/50 border border-white/5">
          <p className="text-xs text-slate-400 mb-1">Hourly Revenue</p>
          <p className="text-lg font-bold text-purple-400">${((current * revenuePerCycle) / 24).toFixed(2)}</p>
        </div>
      </div>

      {/* Velocity formula */}
      <div className="p-3 rounded-lg bg-slate-800/30 border border-white/5">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Formula</p>
        <p className="text-xs text-slate-300 font-mono">
          86,400s ÷ {Math.round(86400 / (current || 1))}s cycle = <span className="text-emerald-400 font-bold">{current.toFixed(0)}/day</span>
        </p>
      </div>
    </div>
  );
}
