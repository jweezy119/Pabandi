import React, { useState } from 'react';

type Tab = 'overview' | 'properties' | 'tenants' | 'leases' | 'maintenance' | 'inspections' | 'financials' | 'automations' | 'settings';

const CRMDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'properties', label: 'Properties' },
    { key: 'tenants', label: 'Tenants' },
    { key: 'leases', label: 'Leases' },
    { key: 'maintenance', label: 'Maintenance' },
    { key: 'inspections', label: 'Inspections' },
    { key: 'financials', label: 'Financials' },
    { key: 'automations', label: 'Automations' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: '#1e293b', color: 'white', padding: '16px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Pabandi CRM</h1>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>Enterprise Property Management</p>
      </header>

      <nav style={{ background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', overflowX: 'auto', padding: '0 24px' }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === key ? '3px solid #6366f1' : '3px solid transparent',
              fontWeight: activeTab === key ? 600 : 400, color: activeTab === key ? '#6366f1' : '#64748b',
              whiteSpace: 'nowrap', fontSize: 14,
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Properties', value: '12', sub: '10 occupied' },
                { label: 'Tenants', value: '18', sub: '2 at risk' },
                { label: 'Rent Collected', value: '$24,500', sub: 'This month' },
                { label: 'Open Maintenance', value: '5', sub: '2 urgent' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{stat.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{stat.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('tenants')} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>Add Tenant</button>
                <button onClick={() => setActiveTab('maintenance')} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>Create Work Order</button>
                <button onClick={() => setActiveTab('financials')} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>View Reports</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'properties' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Properties</h2>
              <button style={{ padding: '8px 16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>+ Add Property</button>
            </div>
            {['Sunset Apartments', 'Maple Grove', 'Ocean View'].map((name, i) => (
              <div key={i} style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{name}</strong>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{3 + i} units • {80 + i * 10}% occupied</div>
                </div>
                <div style={{ fontSize: 14, color: '#16a34a' }}>${(2000 + i * 500)}/mo</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'tenants' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Tenants</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: 10, fontSize: 12, color: '#64748b' }}>Name</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#64748b' }}>Email</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#64748b' }}>Status</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#64748b' }}>Risk</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'John Smith', email: 'john@example.com', status: 'ACTIVE', risk: 'LOW' },
                  { name: 'Jane Doe', email: 'jane@example.com', status: 'ACTIVE', risk: 'MEDIUM' },
                  { name: 'Bob Lee', email: 'bob@example.com', status: 'ACTIVE', risk: 'HIGH' },
                ].map((t, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 10 }}>{t.name}</td>
                    <td style={{ padding: 10 }}>{t.email}</td>
                    <td style={{ padding: 10 }}><span style={{ color: '#16a34a', fontSize: 12 }}>{t.status}</span></td>
                    <td style={{ padding: 10 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: t.risk === 'LOW' ? '#dcfce7' : t.risk === 'MEDIUM' ? '#fef3c7' : '#fee2e2',
                        color: t.risk === 'LOW' ? '#16a34a' : t.risk === 'MEDIUM' ? '#d97706' : '#dc2626',
                      }}>{t.risk}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'leases' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Leases</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button style={{ padding: '6px 12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 4, fontSize: 12 }}>Active</button>
              <button style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12 }}>Expiring Soon</button>
              <button style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12 }}>Expired</button>
            </div>
            <p style={{ color: '#64748b' }}>8 active leases • 2 expiring within 30 days</p>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Maintenance</h2>
              <button style={{ padding: '8px 16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>+ New Work Order</button>
            </div>
            {[
              { title: 'Leaky faucet', unit: '2A', priority: 'LOW', status: 'OPEN' },
              { title: 'AC not working', unit: '3B', priority: 'HIGH', status: 'IN_PROGRESS' },
              { title: 'Broken window', unit: '1A', priority: 'URGENT', status: 'OPEN' },
            ].map((m, i) => (
              <div key={i} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{m.title}</strong>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Unit {m.unit}</span>
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  <span style={{ color: m.priority === 'URGENT' ? '#dc2626' : m.priority === 'HIGH' ? '#d97706' : '#16a34a' }}>{m.priority}</span>
                  {' • '}{m.status}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'inspections' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Inspections</h2>
            <button style={{ padding: '8px 16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', marginBottom: 16 }}>+ New Inspection</button>
            <p style={{ color: '#64748b' }}>Move-in, move-out, and routine inspection reports</p>
          </div>
        )}

        {activeTab === 'financials' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Financials</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Revenue (YTD)</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>$294,000</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Expenses (YTD)</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>$45,200</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>NOI</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>$248,800</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Cap Rate</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>8.3%</div>
              </div>
            </div>
            <button style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}>Export Tax Report (CSV)</button>
          </div>
        )}

        {activeTab === 'automations' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Automations</h2>
              <button style={{ padding: '8px 16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>+ New Rule</button>
            </div>
            {[
              { name: 'Rent Reminder', trigger: 'RENT_DUE', action: 'SEND_REMINDER', count: 12 },
              { name: 'Late Fee Apply', trigger: 'RENT_LATE', action: 'APPLY_LATE_FEE', count: 5 },
              { name: 'Lease Expiry Alert', trigger: 'LEASE_EXPIRING', action: 'SEND_REMINDER', count: 3 },
            ].map((r, i) => (
              <div key={i} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{r.name}</strong>
                  <div style={{ fontSize: 12, color: '#64748b' }}>When {r.trigger} → {r.action}</div>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Triggered {r.count}x</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Settings</h2>
            <div style={{ marginBottom: 16 }}>
              <h4>Vendors</h4>
              <button style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>+ Add Vendor</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <h4>Maintenance Categories</h4>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Plumbing', 'Electrical', 'HVAC', 'Appliance'].map(c => (
                  <span key={c} style={{ padding: '4px 10px', background: '#f1f5f9', borderRadius: 12, fontSize: 12 }}>{c}</span>
                ))}
              </div>
            </div>
            <div>
              <h4>Late Fee Configuration</h4>
              <div style={{ fontSize: 14, color: '#64748b' }}>$50 after 5-day grace period</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CRMDashboard;
