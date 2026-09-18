import React, { useState } from 'react';

interface TenantPortalProps {
  slug?: string; // white-label slug
}

const TenantPortal: React.FC<TenantPortalProps> = ({ slug }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pay' | 'maintenance' | 'lease' | 'inspections' | 'ledger' | 'notifications'>('dashboard');
  const balance = 1250.00;
  const nextDue = { amount: 1500, date: '2026-10-01' };
  const openRequests = 2;

  const brandColor = '#6366f1';
  const brandName = slug ? `${slug.replace(/-/g, ' ')}` : 'Pabandi';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ background: brandColor, color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>{brandName} Tenant Portal</h1>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Property Management</p>
        </div>
        <div style={{ fontSize: 14 }}>Welcome, Tenant</div>
      </header>

      {/* Tabs */}
      <nav style={{ background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', overflowX: 'auto' }}>
        {(['dashboard', 'pay', 'maintenance', 'lease', 'inspections', 'ledger', 'notifications'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab ? `3px solid ${brandColor}` : '3px solid transparent',
              fontWeight: activeTab === tab ? 600 : 400, color: activeTab === tab ? brandColor : '#64748b',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Current Balance</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: balance > 0 ? '#dc2626' : '#16a34a' }}>${balance.toFixed(2)}</div>
              </div>
              <div style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Next Payment Due</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>${nextDue.amount}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{nextDue.date}</div>
              </div>
              <div style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Open Maintenance</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{openRequests}</div>
              </div>
            </div>
            <div style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('pay')} style={{ padding: '10px 20px', background: brandColor, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Pay Rent</button>
                <button onClick={() => setActiveTab('maintenance')} style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}>Submit Maintenance</button>
              </div>
            </div>
          </div>
        )}

        {/* Pay Rent Tab */}
        {activeTab === 'pay' && (
          <div>
            <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>Pay Rent — ${nextDue.amount}</h2>
              <p style={{ color: '#64748b' }}>Due: {nextDue.date}</p>
              <div style={{ marginTop: 16 }}>
                <button style={{ padding: '12px 24px', background: brandColor, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 16 }}>
                  Pay with Card (PayLio)
                </button>
              </div>
            </div>
            <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3>USDC Payment</h3>
              <div style={{ background: '#f1f5f9', padding: 16, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ width: 200, height: 200, background: '#e2e8f0', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                  QR Code Placeholder
                </div>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>Scan with Solflare or Phantom wallet</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Maintenance Tab */}
        {activeTab === 'maintenance' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Submit Maintenance Request</h2>
            <form onSubmit={e => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Category</label>
                <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6 }}>
                  <option>Plumbing</option>
                  <option>Electrical</option>
                  <option>HVAC</option>
                  <option>Appliance</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Priority</label>
                <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6 }}>
                  <option>LOW</option>
                  <option>MEDIUM</option>
                  <option>HIGH</option>
                  <option>URGENT</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Description</label>
                <textarea rows={4} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6, resize: 'vertical' }} placeholder="Describe the issue..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Photos</label>
                <input type="file" multiple accept="image/*" style={{ fontSize: 14 }} />
              </div>
              <button type="submit" style={{ padding: '12px 24px', background: brandColor, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 16 }}>
                Submit Request
              </button>
            </form>
          </div>
        )}

        {/* View Lease Tab */}
        {activeTab === 'lease' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Your Lease</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>Monthly Rent</span>
                <strong>$1,500.00</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>Lease Start</span>
                <strong>Jan 1, 2025</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>Lease End</span>
                <strong>Dec 31, 2026</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>Deposit Held</span>
                <strong>$1,500.00</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ color: '#64748b' }}>Status</span>
                <strong style={{ color: '#16a34a' }}>Active</strong>
              </div>
            </div>
            <button style={{ marginTop: 16, padding: '10px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}>
              View Renewal Offer
            </button>
          </div>
        )}

        {/* Inspection Reports Tab */}
        {activeTab === 'inspections' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Inspection Reports</h2>
            <div style={{ padding: 16, background: '#f1f5f9', borderRadius: 6, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Move-In Inspection</strong>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Jan 1, 2025 — Condition: GOOD</div>
                </div>
                <button style={{ padding: '6px 12px', background: brandColor, color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>View & Sign</button>
              </div>
            </div>
          </div>
        )}

        {/* Ledger Tab */}
        {activeTab === 'ledger' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Payment History</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: 8, fontSize: 12, color: '#64748b' }}>Date</th>
                  <th style={{ padding: 8, fontSize: 12, color: '#64748b' }}>Type</th>
                  <th style={{ padding: 8, fontSize: 12, color: '#64748b' }}>Description</th>
                  <th style={{ padding: 8, fontSize: 12, color: '#64748b' }}>Amount</th>
                  <th style={{ padding: 8, fontSize: 12, color: '#64748b' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>2026-09-01</td>
                  <td style={{ padding: 8 }}>RENT</td>
                  <td style={{ padding: 8 }}>Monthly rent</td>
                  <td style={{ padding: 8, color: '#dc2626' }}>-$1,500</td>
                  <td style={{ padding: 8 }}>$0</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>2026-09-05</td>
                  <td style={{ padding: 8 }}>LATE_FEE</td>
                  <td style={{ padding: 8 }}>Late fee: 4 days overdue</td>
                  <td style={{ padding: 8, color: '#dc2626' }}>-$50</td>
                  <td style={{ padding: 8 }}>$50</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Notifications</h2>
            <div style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontWeight: 500 }}>Rent Due Reminder</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Sep 28, 2026 — Your rent of $1,500 is due Oct 1</div>
            </div>
            <div style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontWeight: 500 }}>Maintenance Update</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Sep 25, 2026 — Your plumbing request is in progress</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TenantPortal;
