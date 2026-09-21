import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TABS = ['Today', 'Calendar', 'Customers', 'Employees', 'Money', 'Services'] as const;
type Tab = typeof TABS[number];

interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  time: string;
  status: string;
  notes?: string;
  depositAmount?: number;
  depositPaid?: boolean;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  totalBookings: number;
  totalSpent: number;
}

interface Employee {
  id: string;
  name: string;
  phone?: string;
  payRate?: number;
  payType: string;
  jobsThisWeek: number;
  estimatedEarnings: number;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  description?: string;
  date: string;
}

interface Financials {
  weeklyRevenue: number;
  monthlyRevenue: number;
  totalExpenses: number;
  netProfit: number;
  paylioBalance: number;
  recentExpenses: Expense[];
}

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('Today');
  const [businessId, setBusinessId] = useState('');

  useEffect(() => {
    // Get businessId from localStorage or user context
    const stored = localStorage.getItem('pabandi_business_id');
    if (stored) setBusinessId(stored);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Dashboard</h1>
        <button
          onClick={() => navigate('/onboarding')}
          style={{ padding: '8px 16px', borderRadius: 8, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', cursor: 'pointer', fontSize: 13 }}
        >
          Onboarding
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
              color: activeTab === tab ? '#818cf8' : '#64748b',
              borderBottom: activeTab === tab ? '2px solid #818cf8' : '2px solid transparent',
              fontWeight: activeTab === tab ? 700 : 500, fontSize: 14, whiteSpace: 'nowrap',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px' }}>
        {activeTab === 'Today' && <TodayTab businessId={businessId} />}
        {activeTab === 'Calendar' && <CalendarTab businessId={businessId} />}
        {activeTab === 'Customers' && <CustomersTab businessId={businessId} />}
        {activeTab === 'Employees' && <EmployeesTab businessId={businessId} />}
        {activeTab === 'Money' && <MoneyTab businessId={businessId} />}
        {activeTab === 'Services' && <ServicesTab />}
      </div>
    </div>
  );
}

function TodayTab({ businessId }: { businessId: string }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/v1/dashboard/${businessId}/today`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setBookings(data.data.bookings);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [businessId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return '#22c55e';
      case 'CHECKED_IN': return '#38bdf8';
      case 'COMPLETED': return '#64748b';
      case 'CANCELLED': return '#ef4444';
      default: return '#fbbf24';
    }
  };

  if (loading) return <p style={{ color: '#94a3b8' }}>Loading today's bookings...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Today's Bookings</h2>
      {bookings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
          <p>No bookings for today</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bookings.map(b => (
            <div key={b.id} style={{ background: '#0f172a', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{b.customerName}</div>
                  <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
                    {b.time} • {b.notes}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                    {b.customerPhone}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: `${getStatusColor(b.status)}15`, color: getStatusColor(b.status),
                    border: `1px solid ${getStatusColor(b.status)}30`,
                  }}>
                    {b.status}
                  </span>
                  <button style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: '#818cf8', color: '#fff', border: 'none', cursor: 'pointer',
                  }}>
                    Check In
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarTab({ businessId }: { businessId: string }) {
  const [calendar, setCalendar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/v1/dashboard/${businessId}/calendar`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setCalendar(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [businessId]);

  if (loading) return <p style={{ color: '#94a3b8' }}>Loading calendar...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>This Week</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {calendar.map(day => (
          <div key={day.date} style={{ background: '#0f172a', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{day.day} <span style={{ color: '#64748b', fontSize: 13, fontWeight: 400 }}>{day.date}</span></div>
            {day.bookings.length === 0 ? (
              <p style={{ color: '#475569', fontSize: 13 }}>No bookings</p>
            ) : (
              day.bookings.map((b: any) => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ fontSize: 14 }}>{b.customerName}</span>
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>{b.time}</span>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomersTab({ businessId }: { businessId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/v1/dashboard/${businessId}/customers`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setCustomers(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [businessId]);

  if (loading) return <p style={{ color: '#94a3b8' }}>Loading customers...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Customers</h2>
      {customers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
          <p>No customers yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {customers.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#0f172a', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{c.phone} • {c.email}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#818cf8' }}>${c.totalSpent.toFixed(0)}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{c.totalBookings} bookings</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeesTab({ businessId }: { businessId: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/v1/dashboard/${businessId}/employees`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setEmployees(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [businessId]);

  if (loading) return <p style={{ color: '#94a3b8' }}>Loading employees...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Employees</h2>
      {employees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
          <p>No employees yet. Add them during onboarding.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {employees.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#0f172a', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{e.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{e.phone} • {e.payType} • ${e.payRate}/{e.payType === 'HOURLY' ? 'hr' : 'job'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#22c55e' }}>${e.estimatedEarnings.toFixed(0)}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{e.jobsThisWeek} jobs this week</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MoneyTab({ businessId }: { businessId: string }) {
  const [financials, setFinancials] = useState<Financials | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: '', amount: '', description: '' });
  const [loading, setLoading] = useState(true);

  const loadFinancials = () => {
    if (!businessId) return;
    fetch(`/api/v1/dashboard/${businessId}/money`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setFinancials(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadFinancials(); }, [businessId]);

  const addExpense = async () => {
    if (!expenseForm.category || !expenseForm.amount) return;
    await fetch(`/api/v1/dashboard/${businessId}/expense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
      body: JSON.stringify(expenseForm),
    });
    setExpenseForm({ category: '', amount: '', description: '' });
    setShowAddExpense(false);
    loadFinancials();
  };

  if (loading) return <p style={{ color: '#94a3b8' }}>Loading financials...</p>;
  if (!financials) return <p style={{ color: '#64748b' }}>No data available</p>;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Money</h2>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="This Week" value={`$${financials.weeklyRevenue.toFixed(0)}`} color="#22c55e" />
        <StatCard label="This Month" value={`$${financials.monthlyRevenue.toFixed(0)}`} color="#818cf8" />
        <StatCard label="Expenses" value={`$${financials.totalExpenses.toFixed(0)}`} color="#ef4444" />
        <StatCard label="Net Profit" value={`$${financials.netProfit.toFixed(0)}`} color="#fbbf24" />
      </div>

      {/* PayLio Balance */}
      <div style={{ background: '#0f172a', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>PayLio Balance</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#818cf8' }}>${financials.paylioBalance.toFixed(2)}</div>
      </div>

      {/* Expenses */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Recent Expenses</h3>
        <button onClick={() => setShowAddExpense(!showAddExpense)} style={{ padding: '6px 14px', borderRadius: 8, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', cursor: 'pointer', fontSize: 13 }}>
          + Add
        </button>
      </div>

      {showAddExpense && (
        <div style={{ background: '#0f172a', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input
              value={expenseForm.category}
              onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
              placeholder="Category (e.g. Supplies)"
              style={{ padding: '10px 12px', borderRadius: 8, background: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', fontSize: 14 }}
            />
            <input
              value={expenseForm.amount}
              onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              placeholder="Amount"
              type="number"
              style={{ padding: '10px 12px', borderRadius: 8, background: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', fontSize: 14 }}
            />
          </div>
          <input
            value={expenseForm.description}
            onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
            placeholder="Description (optional)"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', fontSize: 14, boxSizing: 'border-box', marginBottom: 12 }}
          />
          <button onClick={addExpense} style={{ padding: '8px 20px', borderRadius: 8, background: '#818cf8', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            Save Expense
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {financials.recentExpenses.map(e => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0f172a', borderRadius: 8 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{e.category}</span>
              {e.description && <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{e.description}</span>}
            </div>
            <span style={{ fontWeight: 700, color: '#ef4444' }}>-${e.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServicesTab() {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Services & Pricing</h2>
      <p style={{ color: '#94a3b8', marginBottom: 16 }}>To edit services, pricing, and availability, re-run the onboarding wizard.</p>
      <button
        onClick={() => window.open('/onboarding', '_self')}
        style={{ padding: '12px 24px', borderRadius: 12, background: '#818cf8', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
      >
        Re-open Onboarding Wizard
      </button>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#0f172a', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
