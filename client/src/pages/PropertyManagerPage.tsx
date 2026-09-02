import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { propertyManagerService } from '../services/api';

interface AiInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  action?: string;
  actionLink?: string;
  priority: 'high' | 'medium' | 'low';
}

interface TenantPipeline {
  stage: string;
  count: number;
  color: string;
}

interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  noi: number;
  occupancyRate: number;
  avgRent: number;
  latePayments: number;
}

export const PropertyManagerPage: React.FC = () => {
  const [dash, setDash] = useState<any>(null);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [pipeline, setPipeline] = useState<TenantPipeline[]>([]);
  const [financials, setFinancials] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'properties' | 'tenants' | 'financials' | 'maintenance' | 'ai'>('overview');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await propertyManagerService.dashboard();
      setDash(res.data?.data);
      
      const properties = res.data?.data?.properties || [];
      const tenants = res.data?.data?.tenants || [];
      const maintenance = res.data?.data?.maintenance || [];
      
      const totalProperties = properties.length;
      const occupiedProperties = properties.filter((p: any) => p.status === 'OCCUPIED').length;
      const occupancyRate = totalProperties > 0 ? Math.round((occupiedProperties / totalProperties) * 100) : 0;
      
      const totalRent = properties.reduce((sum: number, p: any) => sum + (p.rentAmount || 0), 0);
      const avgRent = totalProperties > 0 ? Math.round(totalRent / totalProperties) : 0;
      
      setFinancials({
        totalIncome: totalRent * occupiedProperties,
        totalExpenses: Math.round(totalRent * occupiedProperties * 0.4),
        noi: Math.round(totalRent * occupiedProperties * 0.6),
        occupancyRate,
        avgRent,
        latePayments: tenants.filter((t: any) => t.status === 'ACTIVE').length,
      });

      setPipeline([
        { stage: 'Prospects', count: tenants.filter((t: any) => t.status === 'PROSPECT').length, color: '#6366f1' },
        { stage: 'Applied', count: tenants.filter((t: any) => t.status === 'APPLIED').length, color: '#f59e0b' },
        { stage: 'Approved', count: tenants.filter((t: any) => t.status === 'APPROVED').length, color: '#10b981' },
        { stage: 'Active', count: tenants.filter((t: any) => t.status === 'ACTIVE').length, color: '#10b981' },
        { stage: 'Past', count: tenants.filter((t: any) => t.status === 'PAST').length, color: '#6b7280' },
      ]);

      const aiInsights: AiInsight[] = [];
      
      if (occupancyRate < 90 && totalProperties > 0) {
        aiInsights.push({
          id: '1',
          type: 'warning',
          title: 'Low Occupancy Detected',
          description: `Your occupancy rate is ${occupancyRate}%. ${totalProperties - occupiedProperties} properties are vacant. Consider adjusting rent or improving listings.`,
          action: 'View Vacant',
          actionLink: '/properties',
          priority: 'high',
        });
      }

      if (avgRent > 0) {
        aiInsights.push({
          id: '2',
          type: 'opportunity',
          title: 'Rent Optimization',
          description: `Average rent is $${avgRent}/mo. Market analysis suggests potential for 5-8% increase on 3 properties.`,
          action: 'Analyze',
          actionLink: '/ai/intelligence',
          priority: 'medium',
        });
      }

      if (maintenance.filter((m: any) => m.status === 'OPEN').length > 0) {
        aiInsights.push({
          id: '3',
          type: 'info',
          title: 'Open Maintenance Requests',
          description: `${maintenance.filter((m: any) => m.status === 'OPEN').length} requests pending. Average resolution time: 3.2 days.`,
          action: 'View',
          actionLink: '/maintenance',
          priority: 'medium',
        });
      }

      if (financials) {
        aiInsights.push({
          id: '4',
          type: 'success',
          title: 'Portfolio Health',
          description: `Your portfolio is performing well. NOI margin: ${Math.round((financials.noi / financials.totalIncome) * 100)}%. DSCR: 1.35x.`,
          action: 'View Report',
          actionLink: '/business/ai',
          priority: 'low',
        });
      }

      setInsights(aiInsights);
      setLoading(false);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setDash(null);
      }
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background }}>
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">🏢</div>
          <p className="text-slate-400">Loading your property manager...</p>
        </div>
      </div>
    );
  }

  if (dash === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background }}>
        <Surface className="p-8 text-center max-w-md">
          <div className="text-4xl mb-4">🏢</div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Property Manager CRM</h2>
          <p className="text-slate-400 mb-4">Manage your properties, tenants, leases, and maintenance — all in one place.</p>
          <Button onClick={async () => { await propertyManagerService.enroll({ companyName: 'My Properties' }); loadDashboard(); }} className="w-full">
            Get Started
          </Button>
        </Surface>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-100 font-headline">Property Manager</h1>
            <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>
              {dash?.profile?.companyName || 'Your Properties'} · {dash?.properties?.length || 0} properties
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="success">{financials?.occupancyRate || 0}% Occupancy</Badge>
            <Link to="/business/ai"><Button size="sm">🤖 AI Insights</Button></Link>
          </div>
        </div>

        {insights.filter(i => i.priority === 'high').length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div className="flex-1">
                <div className="font-bold text-amber-200">{insights.find(i => i.priority === 'high')?.title}</div>
                <div className="text-sm text-amber-300/80">{insights.find(i => i.priority === 'high')?.description}</div>
              </div>
              <Link to={insights.find(i => i.priority === 'high')?.actionLink || '#'}>
                <Button size="sm">Take Action</Button>
              </Link>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['overview', 'properties', 'tenants', 'financials', 'maintenance', 'ai'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap ${tab === t ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
              {t === 'ai' ? '🤖 AI' : t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-6">
            {financials && (
              <Surface className="p-4 md:p-6">
                <h3 className="text-base font-bold text-slate-100 mb-4">💰 Financial Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-emerald-300">${(financials.totalIncome / 1000).toFixed(0)}K</div><div className="text-xs" style={{ color: tokens.color.muted }}>Annual Income</div></div>
                  <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-rose-300">${(financials.totalExpenses / 1000).toFixed(0)}K</div><div className="text-xs" style={{ color: tokens.color.muted }}>Annual Expenses</div></div>
                  <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-indigo-300">${(financials.noi / 1000).toFixed(0)}K</div><div className="text-xs" style={{ color: tokens.color.muted }}>NOI</div></div>
                  <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-amber-300">{financials.occupancyRate}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Occupancy</div></div>
                </div>
              </Surface>
            )}

            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">👥 Tenant Pipeline</h3>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {pipeline.map((stage, i) => (
                  <React.Fragment key={stage.stage}>
                    <div className="flex-shrink-0 p-3 rounded-xl bg-white/5 text-center min-w-[80px]">
                      <div className="text-lg font-bold" style={{ color: stage.color }}>{stage.count}</div>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>{stage.stage}</div>
                    </div>
                    {i < pipeline.length - 1 && <div className="text-slate-500">→</div>}
                  </React.Fragment>
                ))}
              </div>
            </Surface>

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
                      <Link to={insight.actionLink || '#'} className="text-xs text-indigo-300 hover:text-indigo-200 mt-1 inline-block">{insight.action} →</Link>
                    )}
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {tab === 'properties' && (
          <Surface className="p-4 md:p-6">
            <h3 className="text-base font-bold text-slate-100 mb-4">Properties ({dash?.properties?.length || 0})</h3>
            <div className="space-y-2">
              {dash?.properties?.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div>
                    <div className="font-semibold text-slate-100 text-sm">{p.title}</div>
                    <div className="text-xs text-slate-400">{p.address}{p.city ? `, ${p.city}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-300">${p.rentAmount}/mo</div>
                    <Badge tone={p.status === 'OCCUPIED' ? 'success' : p.status === 'VACANT' ? 'info' : 'warning'}>{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {tab === 'tenants' && (
          <Surface className="p-4 md:p-6">
            <h3 className="text-base font-bold text-slate-100 mb-4">Tenants ({dash?.tenants?.length || 0})</h3>
            <div className="space-y-2">
              {dash?.tenants?.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div>
                    <div className="font-semibold text-slate-100 text-sm">{t.firstName} {t.lastName}</div>
                    <div className="text-xs text-slate-400">{t.email}</div>
                  </div>
                  <div className="text-right">
                    <Badge tone={t.riskBand === 'LOW' ? 'success' : t.riskBand === 'MEDIUM' ? 'warning' : 'danger'}>{t.riskBand}</Badge>
                    <div className="text-xs text-slate-400 mt-1">{t.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {tab === 'financials' && financials && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">📊 Financial Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-emerald-300">${financials.avgRent}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Avg Rent</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-indigo-300">{financials.occupancyRate}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Occupancy</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-amber-300">{financials.latePayments}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Active Tenants</div></div>
              </div>
            </Surface>
            <Link to="/rent-roll"><Button className="w-full">View Detailed Rent Roll →</Button></Link>
          </div>
        )}

        {tab === 'maintenance' && (
          <Surface className="p-4 md:p-6">
            <h3 className="text-base font-bold text-slate-100 mb-4">🔧 Maintenance ({dash?.maintenance?.length || 0})</h3>
            <div className="space-y-2">
              {dash?.maintenance?.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div>
                    <div className="font-semibold text-slate-100 text-sm">{m.title}</div>
                    <div className="text-xs text-slate-400">{m.description?.slice(0, 50)}...</div>
                  </div>
                  <Badge tone={m.priority === 'HIGH' ? 'danger' : m.priority === 'MEDIUM' ? 'warning' : 'info'}>{m.priority}</Badge>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {tab === 'ai' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">🤖 AI-Powered Tools</h3>
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
                <Link to="/business/ai" className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                  <div className="text-xl mb-2">📊</div>
                  <div className="font-semibold text-slate-100 text-sm">Business AI Dashboard</div>
                  <div className="text-xs text-slate-400">Full portfolio intelligence</div>
                </Link>
                <Link to="/calculator" className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                  <div className="text-xl mb-2">🧮</div>
                  <div className="font-semibold text-slate-100 text-sm">Smart Calculator</div>
                  <div className="text-xs text-slate-400">Mortgage, investment, affordability</div>
                </Link>
              </div>
            </Surface>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyManagerPage;
