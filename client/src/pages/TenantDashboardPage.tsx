import { useState, useEffect } from 'react';

import { Surface, tokens } from '../design-system';
import { tenantService } from '../services/api';

interface TenantDashboardData {
  applications: any[];
  documents: any[];
  leases: any[];
  maintenance: any[];
  rentPayments: any[];
}

export default function TenantDashboardPage() {
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'rent' | 'maintenance' | 'documents' | 'lease'>('overview');

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
    } catch (e) {
      console.error('Failed to load tenant data', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm" style={{ color: tokens.color.muted }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-0" style={{ background: tokens.color.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold font-headline text-slate-100">Tenant Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Track your applications, leases, payments, and maintenance requests.</p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {([
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'rent', label: 'Rent', icon: '💳' },
            { id: 'maintenance', label: 'Maintenance', icon: '🔧' },
            { id: 'documents', label: 'Documents', icon: '📄' },
            { id: 'lease', label: 'Lease', icon: '📝' },
          ] as const).map(s => (
            <button key={s.id} onClick={() => setTab(s.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === s.id ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Surface className="text-center">
              <div className="text-3xl font-bold text-slate-100">{data?.applications?.length || 0}</div>
              <div className="text-xs" style={{ color: tokens.color.muted }}>Applications</div>
            </Surface>
            <Surface className="text-center">
              <div className="text-3xl font-bold text-slate-100">{data?.documents?.length || 0}</div>
              <div className="text-xs" style={{ color: tokens.color.muted }}>Documents</div>
            </Surface>
            <Surface className="text-center">
              <div className="text-3xl font-bold text-slate-100">{data?.leases?.length || 0}</div>
              <div className="text-xs" style={{ color: tokens.color.muted }}>Active Leases</div>
            </Surface>
          </div>
        )}

        {tab === 'rent' && (
          <Surface className="p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">💳 Rent Payments</h3>
            <p className="text-sm" style={{ color: tokens.color.muted }}>Rent payment tracking coming soon. Your landlord will send payment links here.</p>
          </Surface>
        )}

        {tab === 'maintenance' && (
          <Surface className="p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">🔧 Maintenance Requests</h3>
            {data?.maintenance?.length === 0 && <p style={{ color: tokens.color.muted }}>No maintenance requests yet.</p>}
            <div className="space-y-2">
              {data?.maintenance?.map((m: any) => (
                <div key={m.id} className="p-3 rounded-xl bg-white/5">
                  <div className="font-semibold text-slate-100">{m.title}</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>{m.description} · {m.priority} · {m.status}</div>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {tab === 'documents' && (
          <Surface className="p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">📄 Documents</h3>
            {data?.documents?.length === 0 && <p style={{ color: tokens.color.muted }}>No documents uploaded yet.</p>}
            <div className="space-y-2">
              {data?.documents?.map((d: any) => (
                <div key={d.id} className="p-3 rounded-xl bg-white/5">
                  <div className="font-semibold text-slate-100">{d.name || d.type}</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>{d.type} · {new Date(d.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {tab === 'lease' && (
          <Surface className="p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">📝 My Lease</h3>
            {data?.leases?.length === 0 && <p style={{ color: tokens.color.muted }}>No active lease yet.</p>}
            <div className="space-y-2">
              {data?.leases?.map((l: any) => (
                <div key={l.id} className="p-3 rounded-xl bg-white/5">
                  <div className="font-semibold text-slate-100">{l.propertyName || 'Lease'}</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()} · ${l.rentAmount}/{l.rentPeriod === 'MONTH' ? 'mo' : 'wk'}</div>
                </div>
              ))}
            </div>
          </Surface>
        )}
      </div>
    </div>
  );
}
