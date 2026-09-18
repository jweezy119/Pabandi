import React, { useState } from 'react';

type DetailTab = 'overview' | 'payments' | 'leases' | 'maintenance' | 'inspections' | 'screening' | 'notes' | 'communications';

const TenantDetail: React.FC<{ tenantId?: string }> = (_props) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  
  const riskScore = 72;
  const riskBand = 'LOW';
  const riskColor = riskBand === 'LOW' ? '#16a34a' : riskBand === 'MEDIUM' ? '#d97706' : '#dc2626';

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <button style={{ marginBottom: 16, padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}>
        ← Back to Tenants
      </button>

      {/* Header */}
      <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>John Smith</h1>
            <p style={{ margin: '4px 0', color: '#64748b' }}>john@example.com • (555) 123-4567</p>
            <p style={{ margin: 0, fontSize: 14, color: '#94a3b8' }}>Unit 2A • Sunset Apartments</p>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 16px', background: `${riskColor}15`, borderRadius: 8, border: `1px solid ${riskColor}` }}>
            <div style={{ fontSize: 12, color: riskColor }}>Risk Score</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: riskColor }}>{riskScore}</div>
            <div style={{ fontSize: 11, color: riskColor }}>{riskBand} RISK</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto' }}>
        {(['overview', 'payments', 'leases', 'maintenance', 'inspections', 'screening', 'notes', 'communications'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
              background: activeTab === tab ? '#6366f1' : '#f1f5f9', color: activeTab === tab ? 'white' : '#64748b',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {/* Content */}
      {activeTab === 'overview' && (
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Profile Overview</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><strong>Status:</strong> <span style={{ color: '#16a34a' }}>Active</span></div>
            <div><strong>Deposit Held:</strong> $1,500</div>
            <div><strong>Total Stays:</strong> 2</div>
            <div><strong>Total Disputes:</strong> 0</div>
            <div><strong>Member Since:</strong> Jan 2024</div>
            <div><strong>Last Stay:</strong> Sep 2026</div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Payment History</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: 8, fontSize: 12 }}>Date</th>
                <th style={{ padding: 8, fontSize: 12 }}>Type</th>
                <th style={{ padding: 8, fontSize: 12 }}>Description</th>
                <th style={{ padding: 8, fontSize: 12 }}>Amount</th>
                <th style={{ padding: 8, fontSize: 12 }}>Balance After</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: 8 }}>2026-09-01</td><td style={{ padding: 8 }}>RENT</td>
                <td style={{ padding: 8 }}>Monthly rent</td><td style={{ padding: 8, color: '#dc2626' }}>-$1,500</td>
                <td style={{ padding: 8 }}>$0</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: 8 }}>2026-08-01</td><td style={{ padding: 8 }}>RENT</td>
                <td style={{ padding: 8 }}>Monthly rent</td><td style={{ padding: 8, color: '#dc2626' }}>-$1,500</td>
                <td style={{ padding: 8 }}>$0</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'leases' && (
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Lease History</h3>
          <div style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 6, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>Current Lease</strong>
                <div style={{ fontSize: 13, color: '#64748b' }}>Jan 1, 2025 — Dec 31, 2026</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>$1,500/month • $1,500 deposit</div>
              </div>
              <span style={{ color: '#16a34a', fontSize: 13 }}>Active</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Maintenance Requests</h3>
          <p style={{ color: '#64748b' }}>No maintenance requests</p>
        </div>
      )}

      {activeTab === 'inspections' && (
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Inspection Reports</h3>
          <div style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 6, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>Move-In Inspection</strong>
                <div style={{ fontSize: 13, color: '#64748b' }}>Jan 1, 2025 — GOOD condition</div>
              </div>
              <span style={{ fontSize: 12, color: '#16a34a' }}>Signed ✓</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'screening' && (
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Screening Results</h3>
          <div style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 6, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>CourtListener Check</strong>
                <div style={{ fontSize: 13, color: '#64748b' }}>Aug 15, 2025</div>
              </div>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>LOW RISK</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Notes</h3>
          <textarea rows={4} placeholder="Add a note..." style={{ width: '100%', padding: 12, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }} />
        </div>
      )}

      {activeTab === 'communications' && (
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Communication Log</h3>
          <p style={{ color: '#64748b' }}>No communications logged</p>
        </div>
      )}
    </div>
  );
};

export default TenantDetail;
