import React, { useState } from 'react';

type FinancialTab = 'overview' | 'properties' | 'cashflow' | 'tax';

const FinancialDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FinancialTab>('overview');
  const [forecastMonths, setForecastMonths] = useState(12);

  const monthlyData = [
    { month: 'Jan', revenue: 24000, expenses: 4200 },
    { month: 'Feb', revenue: 24000, expenses: 3800 },
    { month: 'Mar', revenue: 24500, expenses: 5100 },
    { month: 'Apr', revenue: 24500, expenses: 3500 },
    { month: 'May', revenue: 25000, expenses: 4800 },
    { month: 'Jun', revenue: 25000, expenses: 3200 },
  ];

  const maxVal = Math.max(...monthlyData.map(d => Math.max(d.revenue, d.expenses)));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Financial Dashboard</h1>

      <nav style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['overview', 'properties', 'cashflow', 'tax'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14,
              background: activeTab === tab ? '#6366f1' : '#f1f5f9', color: activeTab === tab ? 'white' : '#64748b',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Revenue (YTD)', value: '$147,000', color: '#16a34a' },
              { label: 'Total Expenses (YTD)', value: '$24,600', color: '#dc2626' },
              { label: 'Net Operating Income', value: '$122,400', color: '#6366f1' },
              { label: 'Cap Rate', value: '8.3%', color: '#d97706' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{stat.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Revenue vs Expenses Chart */}
          <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>Revenue vs Expenses (6 months)</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 200, padding: '20px 0' }}>
              {monthlyData.map(d => (
                <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: '100%', width: '100%', justifyContent: 'center' }}>
                    <div style={{ width: '40%', height: `${(d.revenue / maxVal) * 100}%`, background: '#16a34a', borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                    <div style={{ width: '40%', height: `${(d.expenses / maxVal) * 100}%`, background: '#dc2626', borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>{d.month}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, background: '#16a34a', borderRadius: 2, display: 'inline-block' }}></span> Revenue</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, background: '#dc2626', borderRadius: 2, display: 'inline-block' }}></span> Expenses</span>
            </div>
          </div>

          {/* Vacancy & other stats */}
          <div style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0 }}>Key Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div><strong>Vacancy Rate:</strong> 4.2%</div>
              <div><strong>Avg Rent/Unit:</strong> $1,480</div>
              <div><strong>Late Fees (YTD):</strong> $1,250</div>
              <div><strong>Maintenance Costs:</strong> $8,400</div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'properties' && (
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0 }}>Per-Property Breakdown</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: 10, fontSize: 12 }}>Property</th>
                <th style={{ padding: 10, fontSize: 12 }}>Revenue</th>
                <th style={{ padding: 10, fontSize: 12 }}>Expenses</th>
                <th style={{ padding: 10, fontSize: 12 }}>NOI</th>
                <th style={{ padding: 10, fontSize: 12 }}>Cap Rate</th>
                <th style={{ padding: 10, fontSize: 12 }}>Vacancy</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Sunset Apartments', rev: 96000, exp: 15000, noi: 81000, cap: '8.5%', vac: '3%' },
                { name: 'Maple Grove', rev: 72000, exp: 12000, noi: 60000, cap: '7.8%', vac: '5%' },
                { name: 'Ocean View', rev: 126000, exp: 18200, noi: 107800, cap: '9.1%', vac: '2%' },
              ].map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 10 }}><strong>{p.name}</strong></td>
                  <td style={{ padding: 10 }}>${p.rev.toLocaleString()}</td>
                  <td style={{ padding: 10 }}>${p.exp.toLocaleString()}</td>
                  <td style={{ padding: 10, color: '#16a34a' }}>${p.noi.toLocaleString()}</td>
                  <td style={{ padding: 10 }}>{p.cap}</td>
                  <td style={{ padding: 10 }}>{p.vac}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'cashflow' && (
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Cash Flow Forecast</h3>
            <select value={forecastMonths} onChange={e => setForecastMonths(parseInt(e.target.value))} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 4 }}>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180, padding: '20px 0', overflowX: 'auto' }}>
            {Array.from({ length: forecastMonths }, (_, i) => {
              const rent = 22000 + Math.random() * 3000;
              return (
                <div key={i} style={{ flex: '0 0 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: 40, height: `${(rent / 25000) * 100}%`, background: '#6366f1', borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>M{i + 1}</div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 12 }}>
            Projected monthly rent from active leases: <strong>$24,000/mo</strong> • Assumed vacancy: 4.2%
          </p>
        </div>
      )}

      {activeTab === 'tax' && (
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0 }}>Tax-Ready Reports</h3>
          <p style={{ color: '#64748b' }}>Export financial data formatted for tax filing.</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <button style={{ padding: '10px 20px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              Export Schedule E (CSV)
            </button>
            <button style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}>
              Export Income Statement (CSV)
            </button>
            <button style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}>
              Export 1099 Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialDashboard;
