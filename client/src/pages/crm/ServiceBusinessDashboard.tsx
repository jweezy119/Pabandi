import { useState, useEffect, useCallback } from 'react';
import { FiUsers, FiDollarSign, FiCalendar, FiTrendingUp, FiTool, FiFileText, FiCreditCard, FiTrendingDown, FiActivity, FiHome, FiBriefcase } from 'react-icons/fi';
import ContactsPipelineTab from './ContactsPipelineTab';
import EmployeesTab from './EmployeesTab';

const API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm`;
const PM_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/property-manager`;

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}`, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json()).error || 'API error');
  return res.json();
}

async function pmApi(path: string, options: RequestInit = {}) {
  const res = await fetch(`${PM_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}`, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json()).error || 'API error');
  return res.json();
}

type Tab = 'today' | 'calendar' | 'properties' | 'clients' | 'jobs' | 'team' | 'money' | 'pipeline';

export default function ServiceBusinessDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [s, j, c, e, p, ex] = await Promise.all([
        api('/dashboard').catch(() => ({ data: {} })),
        api('/jobs').catch(() => ({ data: [] })),
        api('/clients').catch(() => ({ data: [] })),
        api('/employees').catch(() => ({ data: [] })),
        api('/payroll').catch(() => ({ data: [] })),
        api('/expenses').catch(() => ({ data: [] })),
      ]);
      setStats(s.data); setJobs(j.data); setClients(c.data); setEmployees(e.data); setPayroll(p.data); setExpenses(ex.data);
      const pm = await pmApi('/dashboard').catch(() => null);
      if (pm?.data) {
        setProperties(pm.data.properties || []);
        setTenants(pm.data.tenants || []);
        setLeases(pm.data.leases || []);
        setMaintenance(pm.data.maintenance || []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) return <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--clay)]" /></div>;

  const totalRevenue = stats?.monthlyRevenue || 0;
  const totalExpenses = (stats?.monthlyExpenses || 0) + (stats?.payrollCosts || 0);
  const netIncome = totalRevenue - totalExpenses;
  const activeTenants = tenants.filter(t => t.status === 'ACTIVE').length;
  const occupiedProperties = properties.filter(p => p.status === 'OCCUPIED').length;
  const openMaintenance = maintenance.filter(m => m.status === 'OPEN' || m.status === 'IN_PROGRESS').length;

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <header className="border-b border-[var(--soft-stone)]/30 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--clay)] flex items-center justify-center text-white font-bold">C</div>
            <div><h1 className="text-lg font-bold text-[var(--warm-ink)]">ContactOS</h1><p className="text-xs text-[var(--soft-stone)]">Service & Property CRM</p></div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setTab('properties')} className="px-4 py-2 bg-[var(--clay)] text-white rounded-xl text-sm font-medium">Add Property</button>
            <button onClick={() => setTab('tenants')} className="px-4 py-2 bg-white border border-[var(--soft-stone)]/30 rounded-xl text-sm font-medium text-[var(--warm-ink)]">Add Tenant</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={FiDollarSign} label="Revenue" value={`$${totalRevenue.toLocaleString()}`} sub="This month" color="green" />
          <StatCard icon={FiTrendingDown} label="Expenses" value={`$${totalExpenses.toLocaleString()}`} sub={`$${(stats?.payrollCosts || 0).toLocaleString()} payroll`} color="red" />
          <StatCard icon={FiHome} label="Properties" value={String(properties.length)} sub={`${occupiedProperties} occupied`} color="blue" />
          <StatCard icon={FiUsers} label="Tenants" value={String(activeTenants)} sub={`${tenants.length} total`} color="purple" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={FiCalendar} label="Active Jobs" value={String(stats?.totalJobs || 0)} sub={`${jobs.filter(j => j.status === 'SCHEDULED').length} scheduled`} color="blue" />
          <StatCard icon={FiTool} label="Maintenance" value={String(openMaintenance)} sub={`${maintenance.length} total`} color="orange" />
          <StatCard icon={FiFileText} label="Active Leases" value={String(leases.filter(l => l.status === 'ACTIVE').length)} sub={`${leases.length} total`} color="green" />
          <StatCard icon={FiTrendingUp} label="Net Income" value={`$${netIncome.toLocaleString()}`} sub={netIncome >= 0 ? 'Profit' : 'Loss'} color={netIncome >= 0 ? 'green' : 'red'} />
        </div>

        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-[var(--soft-stone)]/30 overflow-x-auto">
          {(['overview', 'properties', 'tenants', 'jobs', 'maintenance', 'money', 'team', 'pipeline', 'activity'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all capitalize whitespace-nowrap ${tab === t ? 'bg-[var(--clay)] text-white' : 'text-[var(--soft-stone)] hover:text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]'}`}>{t}</button>
          ))}
        </div>

        {tab === 'today' && <OverviewTab jobs={jobs} properties={properties} tenants={tenants} maintenance={maintenance} stats={stats} />}
        {tab === 'calendar' && <CalendarTab jobs={jobs} />}
        {tab === 'properties' && <PropertiesTab properties={properties} onRefresh={loadAll} />}
        {tab === 'clients' && <TenantsTab tenants={tenants} properties={properties} leases={leases} onRefresh={loadAll} />}
        {tab === 'jobs' && <JobsTab jobs={jobs} clients={clients} employees={employees} onRefresh={loadAll} />}
        {tab === 'team' && <EmployeesTab employees={employees} onRefresh={loadAll} />}
        {tab === 'money' && <MoneyTab stats={stats} payroll={payroll} expenses={expenses} employees={employees} />}
        {tab === 'pipeline' && <ContactsPipelineTab />}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = { blue: 'bg-blue-500', green: 'bg-[var(--sage)]', purple: 'bg-[var(--dusty-rose)]', orange: 'bg-orange-500', red: 'bg-[var(--terracotta)]' };
  return (
    <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-5">
      <div className="flex items-start justify-between">
        <div><p className="text-xs text-[var(--soft-stone)] font-medium uppercase tracking-wider">{label}</p><p className="text-2xl font-bold text-[var(--warm-ink)] mt-1">{value}</p>{sub && <p className="text-xs text-[var(--soft-stone)] mt-1">{sub}</p>}</div>
        <div className={`p-3 rounded-xl ${colors[color || 'blue']} shadow-lg`}><Icon className="w-5 h-5 text-white" /></div>
      </div>
    </div>
  );
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: string }) {
  const v: Record<string, string> = { default: 'bg-[var(--soft-stone)] text-[var(--warm-ink)]', blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700', yellow: 'bg-yellow-100 text-yellow-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v[variant] || v.default}`}>{children}</span>;
}

function OverviewTab({ jobs, properties, maintenance, clients }: any) {
  const todayJobs = jobs.filter((j: any) => new Date(j.scheduledDate).toDateString() === new Date().toDateString());
  const weekJobs = jobs.filter((j: any) => {
    const d = new Date(j.scheduledDate);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return d >= weekStart && d <= weekEnd;
  });
  const todayRevenue = todayJobs.reduce((s: number, j: any) => s + (j.price || 0), 0);
  const weekRevenue = weekJobs.reduce((s: number, j: any) => s + (j.price || 0), 0);
  const topClients = clients.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Today Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FiCalendar} label="Today's Jobs" value={String(todayJobs.length)} color="blue" />
        <StatCard icon={FiDollarSign} label="Today's Revenue" value={`$${todayRevenue.toLocaleString()}`} color="green" />
        <StatCard icon={FiUsers} label="Active Clients" value={String(clients.length)} color="purple" />
        <StatCard icon={FiTrendingUp} label="Week's Revenue" value={`$${weekRevenue.toLocaleString()}`} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-4 sm:p-6">
          <h3 className="font-bold text-[var(--warm-ink)] mb-4">Today's Schedule ({todayJobs.length})</h3>
          {todayJobs.length === 0 ? <p className="text-sm text-[var(--soft-stone)]">No jobs scheduled</p> : (
            <div className="space-y-3">{todayJobs.map((j: any) => (
              <div key={j.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--warm-sand)]">
                <div className="w-12 text-center"><p className="font-bold text-[var(--warm-ink)] text-sm">{j.scheduledTime}</p><p className="text-xs text-[var(--soft-stone)]">{j.durationMinutes}m</p></div>
                <div className="flex-1 min-w-0"><p className="font-medium text-[var(--warm-ink)] text-sm truncate">{j.serviceType}</p><p className="text-xs text-[var(--soft-stone)] truncate">{j.address}</p></div>
                <Badge variant="blue">{j.status}</Badge>
              </div>
            ))}</div>
          )}
        </div>

        {/* Top Clients */}
        <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-4 sm:p-6">
          <h3 className="font-bold text-[var(--warm-ink)] mb-4">Top Clients</h3>
          {topClients.length === 0 ? <p className="text-sm text-[var(--soft-stone)]">No clients yet</p> : (
            <div className="space-y-3">{topClients.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--warm-sand)]">
                <div className="w-10 h-10 rounded-full bg-[var(--dusty-rose)] flex items-center justify-center text-white font-bold">{(c.name || '?')[0]}</div>
                <div className="flex-1 min-w-0"><p className="font-medium text-[var(--warm-ink)] truncate">{c.name}</p><p className="text-xs text-[var(--soft-stone)]">{c.totalJobs || 0} jobs · ${(c.totalSpent || 0).toLocaleString()} spent</p></div>
              </div>
            ))}</div>
          )}
        </div>
      </div>

      {/* Outstanding Invoices / Open Maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-4 sm:p-6">
          <h3 className="font-bold text-[var(--warm-ink)] mb-4">Open Maintenance</h3>
          {maintenance.filter((m: any) => m.status !== 'COMPLETED').length === 0 ? <p className="text-sm text-[var(--soft-stone)]">No open requests</p> : (
            <div className="space-y-3">{maintenance.filter((m: any) => m.status !== 'COMPLETED').slice(0, 5).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--warm-sand)]">
                <div><p className="font-medium text-[var(--warm-ink)] text-sm">{m.title}</p><p className="text-xs text-[var(--soft-stone)]">{m.priority}</p></div>
                <Badge variant={m.priority === 'URGENT' ? 'red' : m.priority === 'HIGH' ? 'yellow' : 'blue'}>{m.status}</Badge>
              </div>
            ))}</div>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-4 sm:p-6">
          <h3 className="font-bold text-[var(--warm-ink)] mb-4">Properties</h3>
          {properties.length === 0 ? <p className="text-sm text-[var(--soft-stone)]">No properties yet</p> : (
            <div className="space-y-3">{properties.slice(0, 5).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--warm-sand)]">
                <div><p className="font-medium text-[var(--warm-ink)]">{p.title}</p><p className="text-xs text-[var(--soft-stone)]">{p.address}</p></div>
                <Badge variant={p.status === 'OCCUPIED' ? 'green' : p.status === 'VACANT' ? 'yellow' : 'red'}>{p.status}</Badge>
              </div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarTab({ jobs }: { jobs: any[] }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[var(--warm-ink)]">Weekly Calendar</h2>
        <div className="flex gap-2">
          <button onClick={() => setWeekOffset(0)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--warm-sand)] text-[var(--warm-ink)] hover:bg-[var(--soft-stone)]/30">Today</button>
          <button onClick={() => setWeekOffset(weekOffset - 1)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--warm-sand)] text-[var(--warm-ink)] hover:bg-[var(--soft-stone)]/30">←</button>
          <button onClick={() => setWeekOffset(weekOffset + 1)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--warm-sand)] text-[var(--warm-ink)] hover:bg-[var(--soft-stone)]/30">→</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const dayJobs = jobs.filter((j: any) => new Date(j.scheduledDate).toDateString() === day.toDateString());
          const isToday = day.toDateString() === today.toDateString();
          return (
            <div key={i} className={`p-2 sm:p-3 rounded-xl border min-h-[100px] sm:min-h-[120px] ${isToday ? 'border-[var(--clay)] bg-[var(--clay)]/5' : 'border-[var(--soft-stone)]/30 bg-[var(--cream)]'}`}>
              <p className={`text-[10px] sm:text-xs font-medium mb-1 ${isToday ? 'text-[var(--clay)]' : 'text-[var(--soft-stone)]'}`}>{dayNames[i]}</p>
              <p className={`text-sm sm:text-lg font-bold mb-2 ${isToday ? 'text-[var(--clay)]' : 'text-[var(--warm-ink)]'}`}>{day.getDate()}</p>
              <div className="space-y-1">
                {dayJobs.slice(0, 2).map((j: any) => (
                  <div key={j.id} className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 truncate">
                    {j.scheduledTime} {j.serviceType}
                  </div>
                ))}
                {dayJobs.length > 2 && <p className="text-[10px] text-[var(--soft-stone)]">+{dayJobs.length - 2} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PropertiesTab({ properties, onRefresh }: { properties: any[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[var(--warm-ink)]">Properties</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-[var(--clay)] text-white rounded-xl text-sm font-medium">Add Property</button>
      </div>
      {showForm && <PropertyForm onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); onRefresh(); }} />}
      {properties.length === 0 ? <p className="text-[var(--soft-stone)]">No properties yet</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p: any) => (
            <div key={p.id} className="p-4 rounded-xl border border-[var(--soft-stone)]/30 hover:border-[var(--clay)]/30 transition">
              <div className="flex items-center justify-between mb-2"><h4 className="font-semibold text-[var(--warm-ink)]">{p.title}</h4><Badge variant={p.status === 'OCCUPIED' ? 'green' : p.status === 'VACANT' ? 'yellow' : 'red'}>{p.status}</Badge></div>
              <p className="text-sm text-[var(--soft-stone)] mb-2">{p.address}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-[var(--warm-sand)]"><p className="text-sm font-bold">{p.bedrooms || 0}</p><p className="text-xs text-[var(--soft-stone)]">Beds</p></div>
                <div className="p-2 rounded-lg bg-[var(--warm-sand)]"><p className="text-sm font-bold">{p.bathrooms || 0}</p><p className="text-xs text-[var(--soft-stone)]">Baths</p></div>
                <div className="p-2 rounded-lg bg-[var(--warm-sand)]"><p className="text-sm font-bold">${p.rentAmount?.toLocaleString() || 0}</p><p className="text-xs text-[var(--soft-stone)]">Rent</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TenantsTab({ tenants, properties, leases, onRefresh }: { tenants: any[]; properties: any[]; leases: any[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[var(--warm-ink)]">Tenants</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-[var(--clay)] text-white rounded-xl text-sm font-medium">Add Tenant</button>
      </div>
      {showForm && <TenantForm properties={properties} onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); onRefresh(); }} />}
      {tenants.length === 0 ? <p className="text-[var(--soft-stone)]">No tenants yet</p> : (
        <div className="space-y-3">{tenants.map((t: any) => {
          const tenantLeases = leases.filter((l: any) => l.tenantEmail === t.email);
          return (
            <div key={t.id} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--soft-stone)]/30">
              <div className="w-10 h-10 rounded-full bg-[var(--dusty-rose)] flex items-center justify-center text-white font-bold">{(t.firstName || t.email || '?')[0]}</div>
              <div className="flex-1"><p className="font-medium text-[var(--warm-ink)]">{t.firstName} {t.lastName}</p><p className="text-sm text-[var(--soft-stone)]">{t.email} · {t.phone}</p></div>
              <div className="text-right">
                <Badge variant={t.riskBand === 'HIGH' ? 'red' : t.riskBand === 'MEDIUM' ? 'yellow' : 'green'}>{t.riskBand || 'LOW'}</Badge>
                <p className="text-xs text-[var(--soft-stone)] mt-1">{tenantLeases.length} leases</p>
              </div>
            </div>
          );
        })}</div>
      )}
    </div>
  );
}

function JobsTab({ jobs, clients, employees, onRefresh }: { jobs: any[]; clients: any[]; employees: any[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[var(--warm-ink)]">Jobs</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-[var(--clay)] text-white rounded-xl text-sm font-medium">New Job</button>
      </div>
      {showForm && <JobForm clients={clients} employees={employees} onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); onRefresh(); }} />}
      {jobs.length === 0 ? <p className="text-[var(--soft-stone)]">No jobs yet</p> : (
        <div className="space-y-3">{jobs.map((j: any) => (
          <div key={j.id} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--soft-stone)]/30">
            <div className="w-12 text-center"><p className="font-bold">{j.scheduledTime}</p><p className="text-xs text-[var(--soft-stone)]">{j.durationMinutes}min</p></div>
            <div className="flex-1"><p className="font-medium">{j.serviceType}</p><p className="text-sm text-[var(--soft-stone)]">{j.address}</p></div>
            <Badge variant={j.status === 'COMPLETED' ? 'green' : j.status === 'IN_PROGRESS' ? 'yellow' : 'blue'}>{j.status}</Badge>
          </div>
        ))}</div>
      )}
    </div>
  );
}

function _MaintenanceTab({ maintenance, onRefresh }: { maintenance: any[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[var(--warm-ink)]">Maintenance</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-[var(--clay)] text-white rounded-xl text-sm font-medium">Report Issue</button>
      </div>
      {showForm && <MaintenanceForm onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); onRefresh(); }} />}
      {maintenance.length === 0 ? <p className="text-[var(--soft-stone)]">No maintenance requests</p> : (
        <div className="space-y-3">{maintenance.map((m: any) => (
          <div key={m.id} className="flex items-center justify-between p-4 rounded-xl border border-[var(--soft-stone)]/30">
            <div><p className="font-medium">{m.title}</p><p className="text-sm text-[var(--soft-stone)]">{m.description}</p></div>
            <Badge variant={m.priority === 'URGENT' ? 'red' : m.status === 'COMPLETED' ? 'green' : 'yellow'}>{m.status}</Badge>
          </div>
        ))}</div>
      )}
    </div>
  );
}

function MoneyTab({ stats, payroll, expenses, employees }: any) {
  const totalRevenue = stats?.monthlyRevenue || 0;
  const totalExpenses = (stats?.monthlyExpenses || 0) + (stats?.payrollCosts || 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FiTrendingUp} label="Revenue" value={`$${totalRevenue.toLocaleString()}`} color="green" />
        <StatCard icon={FiTrendingDown} label="Expenses" value={`$${totalExpenses.toLocaleString()}`} color="red" />
        <StatCard icon={FiCreditCard} label="Payroll" value={`$${(stats?.payrollCosts || 0).toLocaleString()}`} color="orange" />
        <StatCard icon={FiDollarSign} label="Net" value={`$${(totalRevenue - totalExpenses).toLocaleString()}`} color="blue" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-6">
          <h3 className="font-bold mb-4">Recent Payroll</h3>
          {payroll.slice(0, 10).map((p: any) => {
            const emp = employees.find((e: any) => e.id === p.employeeId);
            return <div key={p.id} className="flex justify-between p-3 rounded-lg bg-[var(--warm-sand)] mb-2"><span>{emp?.name || p.employeeId}</span><span className="font-medium">${p.netPay?.toFixed(2)}</span></div>;
          })}
        </div>
        <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-6">
          <h3 className="font-bold mb-4">Recent Expenses</h3>
          {expenses.slice(0, 10).map((e: any) => (
            <div key={e.id} className="flex justify-between p-3 rounded-lg bg-[var(--warm-sand)] mb-2"><span>{e.description}</span><span className="text-[var(--terracotta)]">-${e.amount?.toFixed(2)}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function _ActivityTab() {
  const [activities, setActivities] = useState<any[]>([]);
  useEffect(() => { pmApi('/activity').then(r => setActivities(r.data || [])).catch(() => {}); }, []);
  return (
    <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-6">
      <h2 className="text-lg font-bold mb-4">Activity Log</h2>
      {activities.length === 0 ? <p className="text-[var(--soft-stone)]">No activity yet</p> : (
        <div className="space-y-3">{activities.map((a: any) => (
          <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--warm-sand)]">
            <FiActivity className="w-4 h-4 text-[var(--soft-stone)]" />
            <div className="flex-1"><p className="text-sm font-medium text-[var(--warm-ink)]">{a.description}</p><p className="text-xs text-[var(--soft-stone)]">{new Date(a.createdAt).toLocaleString()}</p></div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

function PropertyForm({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ title: '', address: '', city: '', state: '', zip: '', bedrooms: 1, bathrooms: 1, rentAmount: '', rentPeriod: 'MONTH', status: 'VACANT' });
  const save = async () => { await pmApi('/properties', { method: 'POST', body: JSON.stringify(form) }); onSave(); };
  return (
    <div className="p-4 rounded-xl border border-[var(--soft-stone)]/30 mb-4 space-y-3">
      <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" />
      <input placeholder="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" />
      <div className="grid grid-cols-3 gap-3"><input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" /><input placeholder="State" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" /><input placeholder="Zip" value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} className="px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" /></div>
      <div className="grid grid-cols-3 gap-3"><input type="number" placeholder="Beds" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: +e.target.value })} className="px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" /><input type="number" placeholder="Baths" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: +e.target.value })} className="px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" /><input type="number" placeholder="Rent" value={form.rentAmount} onChange={e => setForm({ ...form, rentAmount: e.target.value })} className="px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" /></div>
      <div className="flex gap-3"><button onClick={save} className="px-4 py-2 bg-[var(--clay)] text-white rounded-xl text-sm">Save</button><button onClick={onClose} className="px-4 py-2 border border-[var(--soft-stone)]/30 rounded-xl text-sm">Cancel</button></div>
    </div>
  );
}

function TenantForm({ properties, onClose, onSave }: { properties: any[]; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', phone: '', propertyId: '', status: 'PROSPECT' });
  const save = async () => { await pmApi('/tenants', { method: 'POST', body: JSON.stringify(form) }); onSave(); };
  return (
    <div className="p-4 rounded-xl border border-[var(--soft-stone)]/30 mb-4 space-y-3">
      <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" />
      <div className="grid grid-cols-2 gap-3"><input placeholder="First Name" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" /><input placeholder="Last Name" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" /></div>
      <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" />
      <select value={form.propertyId} onChange={e => setForm({ ...form, propertyId: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white">
        <option value="">Select property</option>
        {properties.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <div className="flex gap-3"><button onClick={save} className="px-4 py-2 bg-[var(--clay)] text-white rounded-xl text-sm">Save</button><button onClick={onClose} className="px-4 py-2 border border-[var(--soft-stone)]/30 rounded-xl text-sm">Cancel</button></div>
    </div>
  );
}

function JobForm({ clients, employees, onClose, onSave }: { clients: any[]; employees: any[]; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ serviceType: '', clientId: '', scheduledDate: '', scheduledTime: '', durationMinutes: 60, address: '', price: '', employeeId: '' });
  const save = async () => { await api('/jobs', { method: 'POST', body: JSON.stringify(form) }); onSave(); };
  return (
    <div className="p-4 rounded-xl border border-[var(--soft-stone)]/30 mb-4 space-y-3">
      <input placeholder="Service Type" value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" />
      <select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white"><option value="">Select client</option>{clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <div className="grid grid-cols-2 gap-3"><input type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} className="px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" /><input type="time" value={form.scheduledTime} onChange={e => setForm({ ...form, scheduledTime: e.target.value })} className="px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" /></div>
      <input placeholder="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" />
      <div className="grid grid-cols-2 gap-3"><input type="number" placeholder="Price" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" /><select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white"><option value="">Unassigned</option>{employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
      <div className="flex gap-3"><button onClick={save} className="px-4 py-2 bg-[var(--clay)] text-white rounded-xl text-sm">Save</button><button onClick={onClose} className="px-4 py-2 border border-[var(--soft-stone)]/30 rounded-xl text-sm">Cancel</button></div>
    </div>
  );
}

function MaintenanceForm({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM' });
  const save = async () => { await pmApi('/maintenance', { method: 'POST', body: JSON.stringify(form) }); onSave(); };
  return (
    <div className="p-4 rounded-xl border border-[var(--soft-stone)]/30 mb-4 space-y-3">
      <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" />
      <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white" />
      <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select>
      <div className="flex gap-3"><button onClick={save} className="px-4 py-2 bg-[var(--clay)] text-white rounded-xl text-sm">Save</button><button onClick={onClose} className="px-4 py-2 border border-[var(--soft-stone)]/30 rounded-xl text-sm">Cancel</button></div>
    </div>
  );
}
