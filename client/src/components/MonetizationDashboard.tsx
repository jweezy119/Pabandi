import { useQuery } from 'react-query';
import apiClient from '../services/api';
import { useAuthStore } from '../store/authStore';
import { tokens } from '../design-system';
import { Shield, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';

/**
 * MonetizationDashboard — shows a business their revenue from:
 * - Trust Brokerage (data bundle sales)
 * - API subscriptions (recurring revenue)
 * - Reputation Insurance (premium income)
 */
export default function MonetizationDashboard() {
  const { user } = useAuthStore();
  const userId = user?.id || '';

  const { data: brokerageRevenue, isLoading: loadingBrokerage } = useQuery(
    ['brokerage-revenue'],
    () => apiClient.get('/api/v1/monetization/trust-brokerage/revenue').then(r => r.data),
    { staleTime: 60000 }
  );

  const { data: insuranceStats, isLoading: loadingInsurance } = useQuery(
    ['insurance-stats'],
    () => apiClient.get('/api/v1/monetization/insurance/stats').then(r => r.data),
    { staleTime: 60000 }
  );

  const stats = [
    {
      label: 'Brokerage Revenue (24h)',
      value: loadingBrokerage ? '...' : `$${brokerageRevenue?.dailyRevenue?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: tokens.color.success,
    },
    {
      label: 'Insurance Premiums',
      value: loadingInsurance ? '...' : `$${insuranceStats?.totalPremiums?.toFixed(2) || '0.00'}`,
      icon: Shield,
      color: tokens.color.primary,
    },
    {
      label: 'Insurance Loss Ratio',
      value: loadingInsurance ? '...' : `${(insuranceStats?.lossRatio * 100)?.toFixed(1) || '0'}%`,
      icon: BarChart3,
      color: tokens.color.warning,
    },
    {
      label: 'Active Policies',
      value: loadingInsurance ? '...' : String(insuranceStats?.activePolicies || 0),
      icon: TrendingUp,
      color: tokens.color.warning,
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: tokens.color.muted }}>
        Revenue Dashboard
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="p-3 rounded-lg"
            style={{ backgroundColor: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <stat.icon size={14} style={{ color: stat.color }} />
              <span className="text-xs" style={{ color: tokens.color.muted }}>{stat.label}</span>
            </div>
            <div className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Trust Data Bundle Offer */}
      <button
        onClick={async () => {
          await apiClient.post('/api/v1/monetization/trust-brokerage/bundle', {
            entityId: userId,
            entityType: 'BUSINESS',
            buyerId: 'marketplace-partner',
          });
        }}
        className="w-full p-2 text-xs font-bold uppercase rounded"
        style={{ backgroundColor: tokens.color.primary, color: '#FFFFFF' }}
      >
        Generate Trust Data Bundle for Sale
      </button>
    </div>
  );
}
