import { useQuery } from 'react-query';
import apiClient from '../services/api';
import { useAuthStore } from '../store/authStore';
import { tokens } from '../design-system';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationCircleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface TrustFluxData {
  velocity: number;
  confidence: number;
  trend: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE';
  predictedScore30d: number;
  predictedScore90d: number;
  anomaly: boolean;
}

export default function TrustFluxWidget({ userId }: { userId?: string }) {
  const { user } = useAuthStore();
  const targetId = userId || user?.id;

  const { data: fluxData, isLoading } = useQuery(
    ['trust-flux', targetId],
    () => apiClient.get(`/trust/flux/${targetId}`).then((res: any) => res.data?.data as TrustFluxData),
    {
      enabled: !!targetId,
      retry: false,
      staleTime: 60000,
    }
  );

  if (!targetId || isLoading || !fluxData) return null;

  const velocity = fluxData.velocity;
  const isPositive = velocity > 0.05;
  const isNegative = velocity < -0.05;
  const velocityPercent = Math.abs(velocity) * 100;

  const velocityColor = isPositive
    ? tokens.color.success || '#22c55e'
    : isNegative
      ? tokens.color.danger || '#ef4444'
      : tokens.color.textDim || '#9ca3af';

  const velocityBg = isPositive
    ? 'rgba(34, 197, 94, 0.10)'
    : isNegative
      ? 'rgba(239, 68, 68, 0.10)'
      : 'rgba(156, 163, 175, 0.10)';

  const trendEmoji =
    fluxData.trend === 'RISING' ? '🚀'
    : fluxData.trend === 'DECLINING' ? '📉'
    : fluxData.trend === 'VOLATILE' ? '⚠️'
    : '➖';

  return (
    <div className="rounded-2xl p-6 mb-8 border border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: velocityBg, color: velocityColor }}>
            <ChartBarIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-headline text-lg font-bold text-slate-100">
              TrustFlux Trajectory
            </h3>
            <p className="text-xs mt-1 text-slate-400">
              Real-time trust momentum powered by temporal GNN
            </p>
          </div>
        </div>
        <span className="text-2xl">{trendEmoji}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center p-3 rounded-xl bg-black/20 border border-white/10">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Velocity</p>
          <p className="text-2xl font-bold mt-1" style={{ color: velocityColor }}>
            {isPositive && <ArrowTrendingUpIcon className="h-5 w-5 inline mb-0.5" />}
            {isNegative && <ArrowTrendingDownIcon className="h-5 w-5 inline mb-0.5" />}
            {velocityPercent.toFixed(1)}%
          </p>
        </div>

        <div className="text-center p-3 rounded-xl bg-black/20 border border-white/10">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Confidence</p>
          <p className="text-2xl font-bold mt-1 text-slate-100">
            {Math.round(fluxData.confidence * 100)}%
          </p>
        </div>

        <div className="text-center p-3 rounded-xl bg-black/20 border border-white/10">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">30d Projection</p>
          <p className="text-2xl font-bold mt-1 text-indigo-300">
            {fluxData.predictedScore30d}
          </p>
        </div>

        <div className="text-center p-3 rounded-xl bg-black/20 border border-white/10">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">90d Projection</p>
          <p className="text-2xl font-bold mt-1 text-purple-300">
            {fluxData.predictedScore90d}
          </p>
        </div>
      </div>

      {fluxData.anomaly && (
        <div className="flex items-start gap-2 p-3 rounded-xl mb-3 bg-amber-500/10 border border-amber-500/20">
          <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-400" />
          <div>
            <p className="font-bold text-sm text-amber-300">Anomaly Detected</p>
            <p className="text-xs mt-0.5 text-slate-400">
              Your trust score shows an unusual pattern. AI arbitration may request additional verification.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Trend: <span className="font-bold text-slate-200">{fluxData.trend}</span></span>
        <span>Velocity multiplier: <span className="font-bold" style={{ color: velocityColor }}>
          {isPositive ? '+' : ''}{velocity.toFixed(3)}
        </span></span>
      </div>
    </div>
  );
}
