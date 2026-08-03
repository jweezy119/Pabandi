import { useQuery } from 'react-query';
import apiClient from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Surface, tokens } from '../design-system';
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
      : tokens.color.muted || '#9ca3af';

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
    <Surface className="mb-8 p-6 border" style={{ borderColor: tokens.color.border }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: velocityBg, color: velocityColor }}>
            <ChartBarIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-headline text-lg font-bold" style={{ color: tokens.color.text }}>
              TrustFlux Trajectory
            </h3>
            <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>
              Real-time trust momentum powered by temporal GNN
            </p>
          </div>
        </div>
        <span className="text-2xl">{trendEmoji}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center p-3 rounded-xl" style={{ background: tokens.color.background, border: `1px solid ${tokens.color.border}` }}>
          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: tokens.color.muted }}>Velocity</p>
          <p className="text-2xl font-bold mt-1" style={{ color: velocityColor }}>
            {isPositive && <ArrowTrendingUpIcon className="h-5 w-5 inline mb-0.5" />}
            {isNegative && <ArrowTrendingDownIcon className="h-5 w-5 inline mb-0.5" />}
            {velocityPercent.toFixed(1)}%
          </p>
        </div>

        <div className="text-center p-3 rounded-xl" style={{ background: tokens.color.background, border: `1px solid ${tokens.color.border}` }}>
          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: tokens.color.muted }}>Confidence</p>
          <p className="text-2xl font-bold mt-1" style={{ color: tokens.color.text }}>
            {Math.round(fluxData.confidence * 100)}%
          </p>
        </div>

        <div className="text-center p-3 rounded-xl" style={{ background: tokens.color.background, border: `1px solid ${tokens.color.border}` }}>
          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: tokens.color.muted }}>30d Projection</p>
          <p className="text-2xl font-bold mt-1" style={{ color: tokens.color.primary }}>
            {fluxData.predictedScore30d}
          </p>
        </div>

        <div className="text-center p-3 rounded-xl" style={{ background: tokens.color.background, border: `1px solid ${tokens.color.border}` }}>
          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: tokens.color.muted }}>90d Projection</p>
          <p className="text-2xl font-bold mt-1" style={{ color: tokens.color.secondary }}>
            {fluxData.predictedScore90d}
          </p>
        </div>
      </div>

      {fluxData.anomaly && (
        <div className="flex items-start gap-2 p-3 rounded-xl mb-3" style={{ background: 'rgba(251, 113, 13, 0.10)' }}>
          <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
          <div>
            <p className="font-bold text-sm" style={{ color: '#fbbf24' }}>Anomaly Detected</p>
            <p className="text-xs mt-0.5" style={{ color: tokens.color.muted }}>
              Your trust score shows an unusual pattern. AI arbitration may request additional verification.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs" style={{ color: tokens.color.muted }}>
        <span>Trend: <span className="font-bold" style={{ color: tokens.color.text }}>{fluxData.trend}</span></span>
        <span>Velocity multiplier: <span className="font-bold" style={{ color: velocityColor }}>
          {isPositive ? '+' : ''}{velocity.toFixed(3)}
        </span></span>
      </div>
    </Surface>
  );
}
