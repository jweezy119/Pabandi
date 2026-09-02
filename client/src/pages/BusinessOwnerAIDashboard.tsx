import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';

interface AiInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  action?: string;
  actionLink?: string;
  priority: 'high' | 'medium' | 'low';
}

interface PortfolioSummary {
  totalValue: number;
  totalEquity: number;
  totalDebt: number;
  noi: number;
  cashOnCash: number;
  capRate: number;
  dscr: number;
  propertyCount: number;
  occupancyRate: number;
}

interface TenantAlert {
  id: string;
  tenantName: string;
  property: string;
  type: 'late_payment' | 'lease_expiring' | 'maintenance' | 'complaint';
  severity: 'high' | 'medium' | 'low';
  message: string;
  aiRecommendation: string;
}

interface MarketSignal {
  id: string;
  type: 'opportunity' | 'risk' | 'trend';
  title: string;
  description: string;
  impact: string;
  confidence: number;
}

export const BusinessOwnerAIDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [tenantAlerts, setTenantAlerts] = useState<TenantAlert[]>([]);
  const [marketSignals, setMarketSignals] = useState<MarketSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'market' | 'maintenance' | 'ai'>('overview');

  useEffect(() => {
    // Simulate AI-generated insights
    setTimeout(() => {
      setPortfolio({
        totalValue: 1250000,
        totalEquity: 480000,
        totalDebt: 770000,
        noi: 86400,
        cashOnCash: 12.5,
        capRate: 6.9,
        dscr: 1.35,
        propertyCount: 8,
        occupancyRate: 94,
      });

      setInsights([
        { id: '1', type: 'opportunity', title: 'Rent Optimization', description: '3 properties are under market rate by 8-12%. Potential $2,400/mo additional income.', action: 'Review Pricing', actionLink: '/rent-roll', priority: 'high' },
        { id: '2', type: 'warning', title: 'Maintenance Predicted', description: 'HVAC systems in 2 properties due for service within 30 days. Budget $400-600.', action: 'Schedule', actionLink: '/maintenance', priority: 'medium' },
        { id: '3', type: 'success', title: 'Portfolio Performance', description: 'Your portfolio outperforms market by 2.3% annually. Diversification score: 78/100.', action: 'View Report', actionLink: '/ai/intelligence', priority: 'low' },
        { id: '4', type: 'info', title: 'Market Shift', description: 'Days on market decreasing in your area. Seller\'s market emerging — consider acquisitions.', action: 'Analyze', actionLink: '/ai/advanced/market-intelligence', priority: 'medium' },
      ]);

      setTenantAlerts([
        { id: '1', tenantName: 'Sarah M.', property: '123 Main St', type: 'lease_expiring', severity: 'medium', message: 'Lease expires in 60 days. Tenant has good payment history.', aiRecommendation: 'Offer 12-month renewal at 3% increase — 85% acceptance probability' },
        { id: '2', tenantName: 'John D.', property: '456 Oak Ave', type: 'late_payment', severity: 'high', message: 'Rent late 2 consecutive months. Previously on-time for 18 months.', aiRecommendation: 'Reach out proactively — likely temporary hardship. Consider payment plan.' },
        { id: '3', tenantName: 'Lisa T.', property: '789 Pine Rd', type: 'maintenance', severity: 'low', message: 'Reported kitchen faucet leak. Reported 3 days ago.', aiRecommendation: 'Schedule plumber within 48hrs to prevent water damage claim.' },
      ]);

      setMarketSignals([
        { id: '1', type: 'opportunity', title: 'Undervalued Area Detected', description: 'Properties in Westside trading 15% below comparable areas.', impact: 'Potential 15% appreciation', confidence: 72 },
        { id: '2', type: 'trend', title: 'Rent Growth Accelerating', description: 'Quarterly rent growth increased from 0.8% to 1.2%.', impact: 'Higher NOI next quarter', confidence: 85 },
        { id: '3', type: 'risk', title: 'Inventory Increasing', description: 'New listings up 20% — may soften prices.', impact: 'Longer days on market', confidence: 68 },
      ]);

      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background }}>
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">🧠</div>
          <p className="text-slate-400">AI is analyzing your portfolio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-100 font-headline">
              AI Command Center
            </h1>
            <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>
              Personalized intelligence for {user?.firstName || 'your'} portfolio
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="success">● AI Active</Badge>
            <Badge tone="info">{insights.length} Insights</Badge>
          </div>
        </div>

        {/* AI Insights Banner */}
        {insights.filter(i => i.priority === 'high').length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div className="flex-1">
                <div className="font-bold text-amber-200">High Priority: {insights.find(i => i.priority === 'high')?.title}</div>
                <div className="text-sm text-amber-300/80">{insights.find(i => i.priority === 'high')?.description}</div>
              </div>
              <Link to={insights.find(i => i.priority === 'high')?.actionLink || '#'}>
                <Button size="sm">Take Action</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['overview', 'tenants', 'market', 'maintenance', 'ai'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap ${activeTab === t ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
              {t === 'ai' ? '🤖 AI Insights' : t}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Portfolio Summary */}
            {portfolio && (
              <Surface className="p-4 md:p-6">
                <h3 className="text-base font-bold text-slate-100 mb-4">📊 Portfolio Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-xl font-bold text-emerald-300">${(portfolio.totalValue / 1000).toFixed(0)}K</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Total Value</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-xl font-bold text-indigo-300">{portfolio.cashOnCash}%</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Cash-on-Cash</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-xl font-bold text-amber-300">{portfolio.capRate}%</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Cap Rate</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-xl font-bold text-purple-300">{portfolio.occupancyRate}%</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Occupancy</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-lg font-bold text-slate-100">{portfolio.propertyCount}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Properties</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-lg font-bold text-slate-100">{portfolio.dscr}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>DSCR</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-lg font-bold text-emerald-300">${(portfolio.noi / 1000).toFixed(0)}K</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Annual NOI</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-lg font-bold text-slate-100">${(portfolio.totalEquity / 1000).toFixed(0)}K</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Equity</div>
                  </div>
                </div>
              </Surface>
            )}

            {/* AI Insights */}
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">🤖 AI Insights</h3>
              <div className="space-y-3">
                {insights.map(insight => (
                  <div key={insight.id} className={`p-3 rounded-xl border ${
                    insight.type === 'opportunity' ? 'bg-emerald-500/10 border-emerald-500/20' :
                    insight.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' :
                    insight.type === 'success' ? 'bg-indigo-500/10 border-indigo-500/20' :
                    'bg-white/5 border-white/10'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-slate-100 text-sm">{insight.title}</div>
                      <Badge tone={insight.priority === 'high' ? 'danger' : insight.priority === 'medium' ? 'warning' : 'info'}>{insight.priority}</Badge>
                    </div>
                    <div className="text-xs text-slate-300">{insight.description}</div>
                    {insight.action && (
                      <Link to={insight.actionLink || '#'} className="text-xs text-indigo-300 hover:text-indigo-200 mt-1 inline-block">
                        {insight.action} →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">👥 Tenant Intelligence</h3>
              <div className="space-y-3">
                {tenantAlerts.map(alert => (
                  <div key={alert.id} className={`p-4 rounded-xl border ${
                    alert.severity === 'high' ? 'bg-rose-500/10 border-rose-500/20' :
                    alert.severity === 'medium' ? 'bg-amber-500/10 border-amber-500/20' :
                    'bg-white/5 border-white/10'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-slate-100">{alert.tenantName} — {alert.property}</div>
                      <Badge tone={alert.severity === 'high' ? 'danger' : alert.severity === 'medium' ? 'warning' : 'info'}>{alert.type.replace('_', ' ')}</Badge>
                    </div>
                    <div className="text-sm text-slate-300 mb-2">{alert.message}</div>
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                      <div className="text-xs font-bold text-indigo-300">🤖 AI Recommendation</div>
                      <div className="text-xs text-indigo-200/80">{alert.aiRecommendation}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {/* Market Tab */}
        {activeTab === 'market' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">📈 Market Intelligence</h3>
              <div className="space-y-3">
                {marketSignals.map(signal => (
                  <div key={signal.id} className={`p-4 rounded-xl border ${
                    signal.type === 'opportunity' ? 'bg-emerald-500/10 border-emerald-500/20' :
                    signal.type === 'risk' ? 'bg-rose-500/10 border-rose-500/20' :
                    'bg-indigo-500/10 border-indigo-500/20'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-slate-100">{signal.title}</div>
                      <Badge tone={signal.type === 'opportunity' ? 'success' : signal.type === 'risk' ? 'danger' : 'info'}>{signal.confidence}% confidence</Badge>
                    </div>
                    <div className="text-sm text-slate-300 mb-1">{signal.description}</div>
                    <div className="text-xs text-slate-400">Impact: {signal.impact}</div>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {/* Maintenance Tab */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">🔧 Predictive Maintenance</h3>
              <div className="space-y-3">
                {[
                  { task: 'HVAC Filter Replacement', property: '123 Main St', due: '2 weeks', cost: '$20-50', urgency: 'medium' },
                  { task: 'Water Heater Flush', property: '456 Oak Ave', due: '1 month', cost: '$100-250', urgency: 'medium' },
                  { task: 'Gutter Cleaning', property: '789 Pine Rd', due: '3 months', cost: '$100-250', urgency: 'low' },
                  { task: 'Roof Inspection', property: '321 Elm St', due: '2 months', cost: '$200-500', urgency: 'medium' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div>
                      <div className="font-semibold text-slate-100 text-sm">{item.task}</div>
                      <div className="text-xs text-slate-400">{item.property} · Due: {item.due}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-300">{item.cost}</div>
                      <Badge tone={item.urgency === 'high' ? 'danger' : item.urgency === 'medium' ? 'warning' : 'info'}>{item.urgency}</Badge>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/maintenance"><Button className="w-full mt-4">View All Maintenance</Button></Link>
            </Surface>
          </div>
        )}

        {/* AI Tab */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">🤖 AI-Powered Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Link to="/ai/intelligence" className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                  <div className="text-xl mb-2">🏠</div>
                  <div className="font-semibold text-slate-100 text-sm">Property Intelligence</div>
                  <div className="text-xs text-slate-400">Deep analysis with predictions</div>
                </Link>
                <Link to="/ai/analyze" className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                  <div className="text-xl mb-2">💰</div>
                  <div className="font-semibold text-slate-100 text-sm">Investment Analyzer</div>
                  <div className="text-xs text-slate-400">ROI, cash flow, projections</div>
                </Link>
                <Link to="/ai" className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                  <div className="text-xl mb-2">📝</div>
                  <div className="font-semibold text-slate-100 text-sm">Lease Analyzer</div>
                  <div className="text-xs text-slate-400">Extract terms, find red flags</div>
                </Link>
                <Link to="/ai/chat" className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                  <div className="text-xl mb-2">💬</div>
                  <div className="font-semibold text-slate-100 text-sm">AI Assistant</div>
                  <div className="text-xs text-slate-400">Ask anything about real estate</div>
                </Link>
                <Link to="/calculator" className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                  <div className="text-xl mb-2">🧮</div>
                  <div className="font-semibold text-slate-100 text-sm">Smart Calculator</div>
                  <div className="text-xs text-slate-400">Mortgage, investment, affordability</div>
                </Link>
                <Link to="/background-check" className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                  <div className="text-xl mb-2">🔍</div>
                  <div className="font-semibold text-slate-100 text-sm">Tenant Screening</div>
                  <div className="text-xs text-slate-400">AI-powered risk assessment</div>
                </Link>
              </div>
            </Surface>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessOwnerAIDashboard;
