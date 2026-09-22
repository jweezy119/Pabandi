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
      const [dashRes, appsRes, docsRes] = await Promise.all([
        tenantService.dashboard().catch(() => ({ data: { data: null } })),
        tenantService.applications().catch(() => ({ data: { data: [] } })),
        tenantService.documents().catch(() => ({ data: { data: [] } })),
      ]);
      const dash = dashRes.data?.data;
      setData({
        applications: appsRes.data?.data || [],
        documents: docsRes.data?.data || [],
        leases: dash?.leases || [],
        maintenance: dash?.maintenance || [],
        rentPayments: dash?.rentPayments || [],
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
          <div className="w-12 h-12 border-4 border-[var(--clay)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm" style={{ color: tokens.color.textDim }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-0 mt-16" style={{ background: tokens.color.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold font-headline text-[var(--warm-ink)]">Tenant Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: tokens.color.textDim }}>Track your applications, leases, payments, and maintenance requests.</p>
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
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === s.id ? 'bg-[var(--clay)]/20 text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.2)]'}`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Surface className="text-center">
              <div className="text-3xl font-bold text-[var(--warm-ink)]">{data?.applications?.length || 0}</div>
              <div className="text-xs" style={{ color: tokens.color.textDim }}>Applications</div>
            </Surface>
            <Surface className="text-center">
              <div className="text-3xl font-bold text-[var(--warm-ink)]">{data?.documents?.length || 0}</div>
              <div className="text-xs" style={{ color: tokens.color.textDim }}>Documents</div>
            </Surface>
            <Surface className="text-center">
              <div className="text-3xl font-bold text-[var(--warm-ink)]">{data?.leases?.length || 0}</div>
              <div className="text-xs" style={{ color: tokens.color.textDim }}>Active Leases</div>
            </Surface>
          </div>
        )}

        {tab === 'rent' && (
          <Surface className="p-6">
            <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">💳 Rent Payments</h3>
            {!data?.rentPayments?.length ? (
              <p className="text-sm" style={{ color: tokens.color.textDim }}>No rent payments yet. Your landlord will send payment links here.</p>
            ) : (
              <div className="space-y-3">
                {data.rentPayments.map((p: any) => (
                  <div key={p.id} className="p-4 rounded-xl bg-[var(--warm-sand)] flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[var(--warm-ink)]">${p.amount?.toFixed(2)}</div>
                      <div className="text-xs" style={{ color: tokens.color.textDim }}>Due {new Date(p.dueDate).toLocaleDateString()} · {p.status}</div>
                      {p.notes && <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{p.notes}</div>}
                    </div>
                    <div className="flex gap-2">
                      {p.status !== 'PAID' && (
                        <button onClick={async () => {
                          try {
                            const res = await tenantService.payRent(p.id);
                            const url = res.data?.data?.url;
                            if (url) window.location.href = url;
                          } catch (e) {
                            alert('Could not start payment');
                          }
                        }} className="px-4 py-2 rounded-lg bg-[var(--clay)] text-[var(--warm-ink)] text-sm font-semibold hover:opacity-90 transition-opacity">
                          Pay Now
                        </button>
                      )}
                      {p.status === 'PAID' && <span className="px-3 py-2 rounded-lg bg-[var(--sage)]/20 text-[var(--sage)] text-sm font-semibold">Paid</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        )}

        {tab === 'maintenance' && (
          <Surface className="p-6">
            <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">🔧 Maintenance Requests</h3>
            {data?.maintenance?.length === 0 && <p style={{ color: tokens.color.textDim }}>No maintenance requests yet.</p>}
            <div className="space-y-2">
              {data?.maintenance?.map((m: any) => (
                <div key={m.id} className="p-3 rounded-xl bg-[var(--warm-sand)]">
                  <div className="font-semibold text-[var(--warm-ink)]">{m.title}</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>{m.description} · {m.priority} · {m.status}</div>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {tab === 'documents' && (
          <Surface className="p-6">
            <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">📄 Documents</h3>
            {data?.documents?.length === 0 && <p style={{ color: tokens.color.textDim }}>No documents uploaded yet.</p>}
            <div className="space-y-2">
              {data?.documents?.map((d: any) => (
                <div key={d.id} className="p-3 rounded-xl bg-[var(--warm-sand)]">
                  <div className="font-semibold text-[var(--warm-ink)]">{d.name || d.type}</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>{d.type} · {new Date(d.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {tab === 'lease' && (
          <Surface className="p-6">
            <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">📝 My Lease</h3>
            {data?.leases?.length === 0 && <p style={{ color: tokens.color.textDim }}>No active lease yet.</p>}
            <div className="space-y-2">
              {data?.leases?.map((l: any) => (
                <div key={l.id} className="p-3 rounded-xl bg-[var(--warm-sand)]">
                  <div className="font-semibold text-[var(--warm-ink)]">{l.propertyName || 'Lease'}</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()} · ${l.rentAmount}/{l.rentPeriod === 'MONTH' ? 'mo' : 'wk'}</div>
                </div>
              ))}
            </div>
          </Surface>
        )}
      </div>
    </div>
  );
}
