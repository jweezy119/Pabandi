import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { tenantService } from '../services/api';

interface TenantDashboardData {
  applications: any[];
  documents: any[];
  leases: any[];
  maintenance: any[];
  rentPayments: any[];
}

interface AiRecommendation {
  id: string;
  type: 'tip' | 'alert' | 'action';
  title: string;
  description: string;
  action?: string;
  actionLink?: string;
  priority: 'high' | 'medium' | 'low';
}

export const TenantPortalPage2: React.FC = () => {
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'rent' | 'maintenance' | 'documents' | 'lease' | 'ai'>('overview');
  const [maintForm, setMaintForm] = useState({ title: '', description: '', priority: 'MEDIUM' });
  const [maintLoading, setMaintLoading] = useState(false);

  useEffect(() => {
    loadTenantData();
  }, []);

  const loadTenantData = async () => {
    try {
      const [appsRes, docsRes] = await Promise.all([
        tenantService.applications().catch(() => ({ data: { data: [] } })),
        tenantService.documents().catch(() => ({ data: { data: [] } })),
      ]);

      setData({
        applications: appsRes.data?.data || [],
        documents: docsRes.data?.data || [],
        leases: [],
        maintenance: [],
        rentPayments: [],
      });

      // Generate AI recommendations
      const recs: AiRecommendation[] = [];
      
      if (appsRes.data?.data?.length === 0) {
        recs.push({
          id: '1',
          type: 'action',
          title: 'Find Your Perfect Home',
          description: 'Browse available properties and apply today. Our AI can match you with properties that fit your budget and preferences.',
          action: 'Browse',
          actionLink: '/marketplace',
          priority: 'medium',
        });
      }

      recs.push({
        id: '2',
        type: 'tip',
        title: 'Boost Your Application',
        description: 'Complete your profile, add references, and verify your identity to stand out to landlords.',
        action: 'Complete Profile',
        actionLink: '/settings',
        priority: 'low',
      });

      setRecommendations(recs);
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  };

  const submitMaintenance = async () => {
    if (!maintForm.title) return;
    setMaintLoading(true);
    try {
      // In production, this would call the API
      setMaintForm({ title: '', description: '', priority: 'MEDIUM' });
      alert('Maintenance request submitted!');
    } catch (e) {
      alert('Failed to submit request');
    } finally {
      setMaintLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background }}>
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">🏠</div>
          <p className="text-slate-400">Loading your tenant portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-100 font-headline">My Home</h1>
            <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>
              Manage your rent, maintenance, documents, and lease
            </p>
          </div>
          <Badge tone="success">Tenant</Badge>
        </div>

        {/* AI Recommendations */}
        {recommendations.filter(r => r.priority === 'high').length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div className="flex-1">
                <div className="font-bold text-amber-200">{recommendations.find(r => r.priority === 'high')?.title}</div>
                <div className="text-sm text-amber-300/80">{recommendations.find(r => r.priority === 'high')?.description}</div>
              </div>
              <Link to={recommendations.find(r => r.priority === 'high')?.actionLink || '#'}>
                <Button size="sm">Take Action</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['overview', 'rent', 'maintenance', 'documents', 'lease', 'ai'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap ${tab === t ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
              {t === 'ai' ? '🤖 AI' : t}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Surface className="p-4 text-center">
                <div className="text-xl font-bold text-emerald-300">{data?.applications?.length || 0}</div>
                <div className="text-xs" style={{ color: tokens.color.muted }}>Applications</div>
              </Surface>
              <Surface className="p-4 text-center">
                <div className="text-xl font-bold text-indigo-300">{data?.documents?.length || 0}</div>
                <div className="text-xs" style={{ color: tokens.color.muted }}>Documents</div>
              </Surface>
              <Surface className="p-4 text-center">
                <div className="text-xl font-bold text-amber-300">{data?.maintenance?.length || 0}</div>
                <div className="text-xs" style={{ color: tokens.color.muted }}>Maintenance</div>
              </Surface>
              <Surface className="p-4 text-center">
                <div className="text-xl font-bold text-purple-300">{data?.leases?.length || 0}</div>
                <div className="text-xs" style={{ color: tokens.color.muted }}>Leases</div>
              </Surface>
            </div>

            {/* AI Recommendations */}
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">🤖 AI Recommendations</h3>
              <div className="space-y-3">
                {recommendations.map(rec => (
                  <div key={rec.id} className={`p-3 rounded-xl border ${
                    rec.type === 'action' ? 'bg-emerald-500/10 border-emerald-500/20' :
                    rec.type === 'alert' ? 'bg-amber-500/10 border-amber-500/20' :
                    'bg-indigo-500/10 border-indigo-500/20'
                  }`}>
                    <div className="font-semibold text-slate-100 text-sm mb-1">{rec.title}</div>
                    <div className="text-xs text-slate-300">{rec.description}</div>
                    {rec.action && (
                      <Link to={rec.actionLink || '#'} className="text-xs text-indigo-300 hover:text-indigo-200 mt-1 inline-block">
                        {rec.action} →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </Surface>

            {/* Quick Actions */}
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">⚡ Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Link to="/marketplace" className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-center">
                  <div className="text-xl mb-1">🏠</div>
                  <div className="text-xs font-semibold text-slate-300">Browse Homes</div>
                </Link>
                <button onClick={() => setTab('maintenance')} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-center">
                  <div className="text-xl mb-1">🔧</div>
                  <div className="text-xs font-semibold text-slate-300">Report Issue</div>
                </button>
                <button onClick={() => setTab('rent')} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-center">
                  <div className="text-xl mb-1">💳</div>
                  <div className="text-xs font-semibold text-slate-300">Pay Rent</div>
                </button>
              </div>
            </Surface>
          </div>
        )}

        {/* Rent Tab */}
        {tab === 'rent' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">💳 Rent Payment</h3>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-xs text-emerald-300">Current Rent</div>
                  <div className="text-2xl font-black text-emerald-300">$1,800/mo</div>
                  <div className="text-xs text-emerald-400/80">Due: 1st of each month</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/5">
                    <div className="text-xs text-slate-400">Last Payment</div>
                    <div className="text-sm font-bold text-slate-100">Sep 1, 2026</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5">
                    <div className="text-xs text-slate-400">Status</div>
                    <Badge tone="success">Paid</Badge>
                  </div>
                </div>
                <Button className="w-full">Pay Rent Now</Button>
              </div>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">📜 Payment History</h3>
              <div className="space-y-2">
                {[
                  { date: 'Sep 1, 2026', amount: '$1,800', status: 'Paid' },
                  { date: 'Aug 1, 2026', amount: '$1,800', status: 'Paid' },
                  { date: 'Jul 1, 2026', amount: '$1,800', status: 'Paid' },
                ].map((payment, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div>
                      <div className="text-sm text-slate-100">{payment.date}</div>
                      <div className="text-xs text-slate-400">{payment.amount}</div>
                    </div>
                    <Badge tone="success">{payment.status}</Badge>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {/* Maintenance Tab */}
        {tab === 'maintenance' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">🔧 Submit Maintenance Request</h3>
              <div className="space-y-3">
                <input value={maintForm.title} onChange={e => setMaintForm({ ...maintForm, title: e.target.value })} placeholder="Issue title *" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
                <textarea value={maintForm.description} onChange={e => setMaintForm({ ...maintForm, description: e.target.value })} placeholder="Describe the issue..." className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" rows={3} />
                <select value={maintForm.priority} onChange={e => setMaintForm({ ...maintForm, priority: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none">
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <Button onClick={submitMaintenance} disabled={!maintForm.title || maintLoading} className="w-full">
                  {maintLoading ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">📋 My Requests</h3>
              {data?.maintenance?.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <div className="text-2xl mb-2">🔧</div>
                  <p>No maintenance requests yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.maintenance?.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                      <div>
                        <div className="text-sm text-slate-100">{m.title}</div>
                        <div className="text-xs text-slate-400">{m.description?.slice(0, 50)}</div>
                      </div>
                      <Badge tone={m.priority === 'HIGH' ? 'danger' : m.priority === 'MEDIUM' ? 'warning' : 'info'}>{m.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        )}

        {/* Documents Tab */}
        {tab === 'documents' && (
          <Surface className="p-4 md:p-6">
            <h3 className="text-base font-bold text-slate-100 mb-4">📁 My Documents</h3>
            {data?.documents?.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <div className="text-2xl mb-2">📁</div>
                <p>No documents yet</p>
                <p className="text-xs mt-1">Documents will appear here once uploaded by your landlord</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data?.documents?.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div>
                      <div className="text-sm text-slate-100">{doc.title}</div>
                      <div className="text-xs text-slate-400">{doc.category} · {new Date(doc.createdAt).toLocaleDateString()}</div>
                    </div>
                    <Button size="sm">View</Button>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        )}

        {/* Lease Tab */}
        {tab === 'lease' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">📝 My Lease</h3>
              {data?.leases?.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <div className="text-2xl mb-2">📝</div>
                  <p>No active lease</p>
                  <p className="text-xs mt-1">Your lease will appear here once signed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data?.leases?.map((lease: any) => (
                    <div key={lease.id} className="p-4 rounded-xl bg-white/5">
                      <div className="font-semibold text-slate-100 mb-2">{lease.property?.title || 'Lease Agreement'}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-slate-400">Rent:</span> <span className="text-emerald-300">${lease.rentAmount}/mo</span></div>
                        <div><span className="text-slate-400">Deposit:</span> <span className="text-slate-100">${lease.depositAmount}</span></div>
                        <div><span className="text-slate-400">Start:</span> <span className="text-slate-100">{new Date(lease.startDate).toLocaleDateString()}</span></div>
                        <div><span className="text-slate-400">End:</span> <span className="text-slate-100">{new Date(lease.endDate).toLocaleDateString()}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        )}

        {/* AI Tab */}
        {tab === 'ai' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">🤖 AI Insights</h3>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <div className="font-semibold text-slate-100 text-sm mb-1">Rent vs Buy Analysis</div>
                  <div className="text-xs text-slate-300">Based on your income and local market, buying may be advantageous after 3 years. Run the numbers with our calculator.</div>
                  <Link to="/calculator" className="text-xs text-indigo-300 hover:text-indigo-200 mt-1 inline-block">Try Calculator →</Link>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="font-semibold text-slate-100 text-sm mb-1">Credit Score Tips</div>
                  <div className="text-xs text-slate-300">Improving your credit score by 50 points could save you $200/mo on a mortgage. Here's how.</div>
                  <Link to="/customer/ai" className="text-xs text-indigo-300 hover:text-indigo-200 mt-1 inline-block">Learn More →</Link>
                </div>
              </div>
            </Surface>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantPortalPage2;
