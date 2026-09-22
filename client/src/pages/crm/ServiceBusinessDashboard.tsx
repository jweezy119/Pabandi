import { useState, useEffect } from 'react';
import { FiPlus, FiUsers, FiDollarSign, FiCalendar, FiBriefcase, FiTrendingUp, FiClock, FiMapPin, FiPhone, FiMail, FiSearch, FiX, FiChevronDown } from 'react-icons/fi';

// ─── API Helper ───────────────────────────────────────────────────────────────

const API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm`;
const token = localStorage.getItem('token') || '';

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error((await res.json()).error || 'API error');
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CrmEmployee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  payRate: number;
  payType: 'HOURLY' | 'SALARY' | 'PER_JOB';
  isActive: boolean;
  rating: number;
  jobsCompleted: number;
}

interface CrmClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  totalJobs: number;
  totalSpent: number;
  lastJobAt?: string;
  createdAt: string;
}

interface CrmJob {
  id: string;
  serviceType: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  address: string;
  notes?: string;
  price: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completedAt?: string;
  clientId: string;
  client?: CrmClient;
  employees?: CrmEmployee[];
  createdAt: string;
}

interface CrmPayroll {
  id: string;
  employeeId: string;
  employee?: CrmEmployee;
  periodStart: string;
  periodEnd: string;
  hoursWorked: number;
  jobsCompleted: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  status: 'PENDING' | 'PAID';
  paidAt?: string;
  createdAt: string;
}

interface CrmExpense {
  id: string;
  category: string;
  amount: number;
  description: string;
  vendor?: string;
  date: string;
  createdAt: string;
}

interface DashboardStats {
  totalJobs: number;
  completedJobs: number;
  activeClients: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  payrollCosts: number;
}

// ─── Shared Components ────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--soft-stone)]/30 bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-sm shadow-[var(--shadow-lift)] ${className}`}>
      {children}
    </div>
  );
}

function Button({ children, variant = 'primary', size = 'md', className = '', ...props }: any) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 cursor-pointer';
  const variants: Record<string, string> = {
    primary: 'bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--warm-ink)] hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl',
    secondary: 'bg-[var(--warm-sand)] text-[var(--warm-ink)] hover:bg-white/20 border border-[var(--soft-stone)]/30',
    danger: 'bg-[var(--terracotta)]/20 text-[var(--terracotta)] hover:bg-[var(--terracotta)]/30 border border-red-500/30',
    success: 'bg-[var(--sage)]/20 text-[var(--sage)] hover:bg-[var(--sage)]/30 border border-[var(--sage)]/30',
    ghost: 'bg-transparent text-[var(--warm-ink)] hover:bg-[var(--cream)]',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`} {...props}>
      {children}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }: { icon: any; label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 to-cyan-400',
    green: 'from-[var(--sage)] to-teal-400',
    purple: 'from-purple-500 to-pink-400',
    orange: 'from-orange-500 to-amber-400',
    red: 'from-red-500 to-[var(--dusty-rose)]',
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[var(--soft-stone)] font-medium uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-[var(--warm-ink)] mt-1">{value}</p>
          {sub && <p className="text-xs text-[var(--soft-stone)] mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colors[color] || colors.blue} shadow-lg`}>
          <Icon className="w-5 h-5 text-[var(--warm-ink)]" />
        </div>
      </div>
    </Card>
  );
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: string }) {
  const v: Record<string, string> = {
    default: 'bg-[var(--soft-stone)] text-[var(--warm-ink)]',
    blue: 'bg-blue-500/20 text-blue-300',
    green: 'bg-[var(--sage)]/20 text-[var(--sage)]',
    red: 'bg-[var(--terracotta)]/20 text-[var(--terracotta)]',
    yellow: 'bg-yellow-500/20 text-yellow-300',
    purple: 'bg-[var(--dusty-rose)]/20 text-purple-300',
    gray: 'bg-gray-500/20 text-[var(--soft-stone)]',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v[variant] || v.default}`}>{children}</span>;
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--soft-stone)]/30 bg-gray-900 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-[var(--soft-stone)]/30">
          <h3 className="text-lg font-bold text-[var(--warm-ink)]">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--warm-sand)] text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, ...props }: any) {
  return (
    <div>
      <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1.5">{label}</label>
      <input
        {...props}
        className="w-full px-3 py-2 bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-lg text-[var(--warm-ink)] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
      />
    </div>
  );
}

function Select({ label, options, ...props }: any) {
  return (
    <div>
      <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1.5">{label}</label>
      <div className="relative">
        <select
          {...props}
          className="w-full px-3 py-2 bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-lg text-[var(--warm-ink)] appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          {options.map((o: any) => (
            <option key={o.value} value={o.value} className="bg-gray-800 text-[var(--warm-ink)]">{o.label}</option>
          ))}
        </select>
        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-stone)] pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Expense Categories ──────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = ['Supplies', 'Fuel', 'Equipment', 'Marketing', 'Insurance', 'Rent', 'Software', 'Payroll', 'Other'];

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function ServiceBusinessDashboard() {
  const [tab, setTab] = useState<'today' | 'calendar' | 'clients' | 'employees' | 'money' | 'services'>('today');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [jobs, setJobs] = useState<CrmJob[]>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [employees, setEmployees] = useState<CrmEmployee[]>([]);
  const [payroll, setPayroll] = useState<CrmPayroll[]>([]);
  const [expenses, setExpenses] = useState<CrmExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showJobModal, setShowJobModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [statsRes, jobsRes, clientsRes, employeesRes, payrollRes, expensesRes] = await Promise.all([
        api('/dashboard'),
        api('/jobs'),
        api('/clients'),
        api('/employees'),
        api('/payroll'),
        api('/expenses'),
      ]);
      setStats(statsRes.data);
      setJobs(jobsRes.data);
      setClients(clientsRes.data);
      setEmployees(employeesRes.data);
      setPayroll(payrollRes.data);
      setExpenses(expensesRes.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const todayJobs = jobs.filter((j) => {
    const d = new Date();
    return new Date(j.scheduledDate).toDateString() === d.toDateString();
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--soft-stone)] text-sm">Loading your business...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-[var(--warm-ink)]">
      {/* Header */}
      <header className="border-b border-[var(--soft-stone)]/30 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <FiBriefcase className="w-5 h-5 text-[var(--warm-ink)]" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Pabandi Business</h1>
              <p className="text-xs text-[var(--soft-stone)]">Service CRM Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowJobModal(true)}>
              <FiPlus className="w-4 h-4" /> New Job
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowClientModal(true)}>
              <FiPlus className="w-4 h-4" /> Add Client
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--terracotta)]/10 border border-red-500/30 text-[var(--terracotta)] text-sm">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={FiCalendar} label="Active Jobs" value={String(stats?.totalJobs || 0)} sub={`${todayJobs.length} today`} color="blue" />
          <StatCard icon={FiDollarSign} label="Monthly Revenue" value={`$${stats?.monthlyRevenue?.toFixed(0) || 0}`} sub="This month" color="green" />
          <StatCard icon={FiUsers} label="Clients" value={String(stats?.activeClients || 0)} sub="Active" color="purple" />
          <StatCard icon={FiTrendingUp} label="Payroll" value={`$${stats?.payrollCosts?.toFixed(0) || 0}`} sub={`$${stats?.monthlyExpenses?.toFixed(0) || 0} expenses`} color="orange" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-800/50 rounded-xl p-1 border border-[var(--soft-stone)]/30">
          {(['today', 'calendar', 'clients', 'employees', 'money', 'services'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all capitalize cursor-pointer ${
                tab === t ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--warm-ink)] shadow-lg' : 'text-[var(--soft-stone)] hover:text-[var(--warm-ink)] hover:bg-[var(--cream)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'today' && <TodayTab jobs={todayJobs} employees={employees} clients={clients} onRefresh={loadAll} onUpdateStatus={(id, s) => api(`/jobs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: s }) }).then(loadAll)} />}
        {tab === 'calendar' && <CalendarTab jobs={jobs} />}
        {tab === 'clients' && <ClientsTab clients={clients} jobs={jobs} onAdd={() => setShowClientModal(true)} />}
        {tab === 'employees' && <EmployeesTab employees={employees} onAdd={() => setShowEmployeeModal(true)} payroll={payroll} />}
        {tab === 'money' && <MoneyTab stats={stats} payroll={payroll} expenses={expenses} employees={employees} onAddExpense={() => setShowExpenseModal(true)} onAddPayroll={() => setShowPayrollModal(true)} />}
        {tab === 'services' && <ServicesTab />}
      </div>

      {/* Modals */}
      {showJobModal && <JobModal employees={employees} clients={clients} onClose={() => setShowJobModal(false)} onSave={() => { setShowJobModal(false); loadAll(); }} />}
      {showClientModal && <ClientModal onClose={() => setShowClientModal(false)} onSave={() => { setShowClientModal(false); loadAll(); }} />}
      {showEmployeeModal && <EmployeeModal onClose={() => setShowEmployeeModal(false)} onSave={() => { setShowEmployeeModal(false); loadAll(); }} />}
      {showExpenseModal && <ExpenseModal onClose={() => setShowExpenseModal(false)} onSave={() => { setShowExpenseModal(false); loadAll(); }} />}
      {showPayrollModal && <PayrollModal employees={employees} onClose={() => setShowPayrollModal(false)} onSave={() => { setShowPayrollModal(false); loadAll(); }} />}
    </div>
  );
}

// ─── Today Tab ────────────────────────────────────────────────────────────────

function TodayTab({ jobs, employees, clients, onRefresh, onUpdateStatus }: { jobs: CrmJob[]; employees: CrmEmployee[]; clients: CrmClient[]; onRefresh: () => void; onUpdateStatus: (id: string, s: string) => void }) {
  const _unused = { employees, clients, onRefresh };
  void _unused;
  const statusColors: Record<string, string> = {
    SCHEDULED: 'blue',
    IN_PROGRESS: 'yellow',
    COMPLETED: 'green',
    CANCELLED: 'red',
  };

  const statusActions: Record<string, { label: string; next: string; variant: string }[]> = {
    SCHEDULED: [{ label: 'Start', next: 'IN_PROGRESS', variant: 'primary' }],
    IN_PROGRESS: [{ label: 'Complete', next: 'COMPLETED', variant: 'success' }],
    COMPLETED: [],
    CANCELLED: [],
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Today's Schedule</h2>
        <p className="text-sm text-[var(--soft-stone)]">{jobs.length} jobs</p>
      </div>
      {jobs.length === 0 ? (
        <div className="text-center py-12">
          <FiCalendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-[var(--soft-stone)]">No jobs scheduled for today</p>
          <p className="text-sm text-[var(--soft-stone)] mt-1">Create a new job to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--cream)] border border-[var(--soft-stone)]/30 hover:border-white/20 transition-all">
              <div className="flex-shrink-0 w-16 text-center">
                <p className="text-lg font-bold text-[var(--warm-ink)]">{job.scheduledTime}</p>
                <p className="text-xs text-[var(--soft-stone)]">{job.durationMinutes}min</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-[var(--warm-ink)] truncate">{job.serviceType}</p>
                  <Badge variant={statusColors[job.status] as any}>{job.status}</Badge>
                </div>
                <div className="flex items-center gap-3 text-sm text-[var(--soft-stone)]">
                  <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3" />{job.address}</span>
                  <span className="flex items-center gap-1"><FiDollarSign className="w-3 h-3" />${job.price}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {statusActions[job.status]?.map((a) => (
                  <Button key={a.next} variant={a.variant} size="sm" onClick={() => onUpdateStatus(job.id, a.next)}>
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab({ jobs }: { jobs: CrmJob[] }) {
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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Weekly Calendar</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(weekOffset - 1)}>←</Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(weekOffset + 1)}>→</Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const dayJobs = jobs.filter((j) => new Date(j.scheduledDate).toDateString() === day.toDateString());
          const isToday = day.toDateString() === today.toDateString();
          return (
            <div key={i} className={`p-3 rounded-xl border ${isToday ? 'border-blue-500/50 bg-blue-500/10' : 'border-[var(--soft-stone)]/30 bg-[var(--cream)]'} min-h-[120px]`}>
              <p className={`text-xs font-medium mb-2 ${isToday ? 'text-blue-400' : 'text-[var(--soft-stone)]'}`}>{dayNames[i]}</p>
              <p className={`text-lg font-bold mb-2 ${isToday ? 'text-blue-400' : 'text-[var(--warm-ink)]'}`}>{day.getDate()}</p>
              <div className="space-y-1">
                {dayJobs.slice(0, 3).map((j) => (
                  <div key={j.id} className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 truncate">
                    {j.scheduledTime} {j.serviceType}
                  </div>
                ))}
                {dayJobs.length > 3 && <p className="text-xs text-[var(--soft-stone)]">+{dayJobs.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Clients Tab ───────────────────────────────────────────────────────────────

function ClientsTab({ clients, jobs, onAdd }: { clients: CrmClient[]; jobs: CrmJob[]; onAdd: () => void }) {
  const [search, setSearch] = useState('');
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Clients</h2>
        <Button variant="primary" size="sm" onClick={onAdd}><FiPlus className="w-4 h-4" /> Add Client</Button>
      </div>
      <div className="relative mb-4">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-stone)]" />
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-lg text-[var(--warm-ink)] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <FiUsers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-[var(--soft-stone)]">No clients found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((client) => {
            const clientJobs = jobs.filter((j) => j.clientId === client.id);
            return (
              <div key={client.id} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--cream)] border border-[var(--soft-stone)]/30">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[var(--warm-ink)] font-bold text-sm">
                  {client.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--warm-ink)]">{client.name}</p>
                  <div className="flex items-center gap-3 text-sm text-[var(--soft-stone)]">
                    {client.phone && <span className="flex items-center gap-1"><FiPhone className="w-3 h-3" />{client.phone}</span>}
                    {client.email && <span className="flex items-center gap-1"><FiMail className="w-3 h-3" />{client.email}</span>}
                    {client.address && <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3" />{client.address}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--warm-ink)]">{clientJobs.length} jobs</p>
                  <p className="text-xs text-[var(--soft-stone)]">${client.totalSpent?.toFixed(0) || 0} spent</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Employees Tab ─────────────────────────────────────────────────────────────

function EmployeesTab({ employees, onAdd, payroll }: { employees: CrmEmployee[]; onAdd: () => void; payroll: CrmPayroll[] }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Team</h2>
        <Button variant="primary" size="sm" onClick={onAdd}><FiPlus className="w-4 h-4" /> Add Employee</Button>
      </div>
      {employees.length === 0 ? (
        <div className="text-center py-12">
          <FiUsers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-[var(--soft-stone)]">No employees yet</p>
          <p className="text-sm text-[var(--soft-stone)] mt-1">Add your team members</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => {
            const empPayroll = payroll.filter((p) => p.employeeId === emp.id);
            const totalPaid = empPayroll.reduce((sum, p) => sum + p.netPay, 0);
            return (
              <div key={emp.id} className="p-4 rounded-xl bg-[var(--cream)] border border-[var(--soft-stone)]/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-[var(--warm-ink)] font-bold text-sm">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--warm-ink)]">{emp.name}</p>
                    <p className="text-xs text-[var(--soft-stone)]">{emp.role}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-[var(--cream)]">
                    <p className="text-lg font-bold text-[var(--warm-ink)]">{emp.jobsCompleted}</p>
                    <p className="text-xs text-[var(--soft-stone)]">Jobs</p>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--cream)]">
                    <p className="text-lg font-bold text-[var(--warm-ink)]">{emp.rating?.toFixed(1) || '5.0'}</p>
                    <p className="text-xs text-[var(--soft-stone)]">Rating</p>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--cream)]">
                    <p className="text-lg font-bold text-green-400">${totalPaid.toFixed(0)}</p>
                    <p className="text-xs text-[var(--soft-stone)]">Paid</p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-[var(--soft-stone)]">
                  {emp.payType === 'HOURLY' ? `$${emp.payRate}/hr` : emp.payType === 'SALARY' ? `$${emp.payRate}/mo` : `$${emp.payRate}/job`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Money Tab ─────────────────────────────────────────────────────────────────

function MoneyTab({ stats, payroll, expenses, employees, onAddExpense, onAddPayroll }: { stats: DashboardStats | null; payroll: CrmPayroll[]; expenses: CrmExpense[]; employees: CrmEmployee[]; onAddExpense: () => void; onAddPayroll: () => void }) {
  const totalRevenue = stats?.monthlyRevenue || 0;
  const totalExpenses = stats?.monthlyExpenses || 0;
  const totalPayroll = stats?.payrollCosts || 0;
  const netIncome = totalRevenue - totalExpenses - totalPayroll;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FiTrendingUp} label="Revenue" value={`$${totalRevenue.toFixed(0)}`} sub="This month" color="green" />
        <StatCard icon={FiDollarSign} label="Expenses" value={`$${totalExpenses.toFixed(0)}`} sub="This month" color="red" />
        <StatCard icon={FiUsers} label="Payroll" value={`$${totalPayroll.toFixed(0)}`} sub="This month" color="orange" />
        <StatCard icon={netIncome >= 0 ? FiTrendingUp : FiClock} label="Net Income" value={`$${netIncome.toFixed(0)}`} sub={netIncome >= 0 ? 'Profit' : 'Loss'} color={netIncome >= 0 ? 'green' : 'red'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payroll */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--warm-ink)]">Payroll</h3>
            <Button variant="primary" size="sm" onClick={onAddPayroll}><FiPlus className="w-4 h-4" /> Record</Button>
          </div>
          {payroll.length === 0 ? (
            <p className="text-[var(--soft-stone)] text-sm text-center py-8">No payroll recorded</p>
          ) : (
            <div className="space-y-2">
              {payroll.slice(0, 10).map((p) => {
                const emp = employees.find((e) => e.id === p.employeeId);
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--cream)]">
                    <div>
                      <p className="text-sm font-medium text-[var(--warm-ink)]">{emp?.name || 'Unknown'}</p>
                      <p className="text-xs text-[var(--soft-stone)]">{p.hoursWorked}h • {p.jobsCompleted} jobs</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-400">${p.netPay.toFixed(0)}</p>
                      <Badge variant={p.status === 'PAID' ? 'green' : 'yellow'}>{p.status}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Expenses */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--warm-ink)]">Expenses</h3>
            <Button variant="primary" size="sm" onClick={onAddExpense}><FiPlus className="w-4 h-4" /> Add</Button>
          </div>
          {expenses.length === 0 ? (
            <p className="text-[var(--soft-stone)] text-sm text-center py-8">No expenses recorded</p>
          ) : (
            <div className="space-y-2">
              {expenses.slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--cream)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--warm-ink)]">{e.description}</p>
                    <p className="text-xs text-[var(--soft-stone)]">{e.category}{e.vendor ? ` • ${e.vendor}` : ''}</p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--terracotta)]">-${e.amount.toFixed(0)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Services Tab ──────────────────────────────────────────────────────────────

function ServicesTab() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold mb-4">Services & Pricing</h2>
      <div className="text-center py-12">
        <FiBriefcase className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-[var(--soft-stone)]">Service management</p>
        <p className="text-sm text-[var(--soft-stone)] mt-1">Manage your service offerings and pricing</p>
        <Button variant="primary" size="sm" className="mt-4">Edit Services</Button>
      </div>
    </Card>
  );
}

// ─── Job Modal ────────────────────────────────────────────────────────────────

function JobModal({ employees, clients, onClose, onSave }: { employees: CrmEmployee[]; clients: CrmClient[]; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    serviceType: '',
    clientId: '',
    scheduledDate: '',
    scheduledTime: '',
    durationMinutes: 60,
    address: '',
    notes: '',
    price: 0,
    employeeId: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await api('/jobs', { method: 'POST', body: JSON.stringify(form) });
      if (form.employeeId) {
        // Assign employee
      }
      onSave();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title="New Job">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Service Type" value={form.serviceType} onChange={(e: any) => setForm({ ...form, serviceType: e.target.value })} options={[
          { value: '', label: 'Select service...' },
          ...['Standard Clean', 'Deep Clean', 'Move-Out Clean', 'Office Clean', 'Window Cleaning', 'Carpet Clean'].map((s) => ({ value: s, label: s })),
        ]} />
        <Select label="Client" value={form.clientId} onChange={(e: any) => setForm({ ...form, clientId: e.target.value })} options={[
          { value: '', label: 'Select client...' },
          ...clients.map((c) => ({ value: c.id, label: c.name })),
        ]} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" type="date" value={form.scheduledDate} onChange={(e: any) => setForm({ ...form, scheduledDate: e.target.value })} />
          <Input label="Time" type="time" value={form.scheduledTime} onChange={(e: any) => setForm({ ...form, scheduledTime: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Duration (min)" type="number" value={form.durationMinutes} onChange={(e: any) => setForm({ ...form, durationMinutes: +e.target.value })} />
          <Input label="Price ($)" type="number" value={form.price} onChange={(e: any) => setForm({ ...form, price: +e.target.value })} />
        </div>
        <Input label="Address" value={form.address} onChange={(e: any) => setForm({ ...form, address: e.target.value })} placeholder="Service address" />
        <Select label="Assign Employee" value={form.employeeId} onChange={(e: any) => setForm({ ...form, employeeId: e.target.value })} options={[
          { value: '', label: 'Unassigned' },
          ...employees.map((e) => ({ value: e.id, label: `${e.name} (${e.role})` })),
        ]} />
        <Input label="Notes" value={form.notes} onChange={(e: any) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Job'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Client Modal ──────────────────────────────────────────────────────────────

function ClientModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await api('/clients', { method: 'POST', body: JSON.stringify(form) });
      onSave();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title="New Client">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name *" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="Client name" />
        <Input label="Email" value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} placeholder="client@email.com" />
        <Input label="Phone" value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555-0000" />
        <Input label="Address" value={form.address} onChange={(e: any) => setForm({ ...form, address: e.target.value })} placeholder="Service address" />
        <Input label="Notes" value={form.notes} onChange={(e: any) => setForm({ ...form, notes: e.target.value })} placeholder="Optional..." />
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Adding...' : 'Add Client'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Employee Modal ────────────────────────────────────────────────────────────

function EmployeeModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: '', payRate: 0, payType: 'HOURLY' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await api('/employees', { method: 'POST', body: JSON.stringify(form) });
      onSave();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title="New Team Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name *" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="Employee name" />
        <Input label="Email" value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} placeholder="employee@email.com" />
        <Input label="Phone" value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555-0000" />
        <div className="grid grid-cols-3 gap-4">
          <Input label="Role *" value={form.role} onChange={(e: any) => setForm({ ...form, role: e.target.value })} placeholder="Cleaner" />
          <Input label="Pay Rate ($)" type="number" value={form.payRate} onChange={(e: any) => setForm({ ...form, payRate: +e.target.value })} />
          <Select label="Pay Type" value={form.payType} onChange={(e: any) => setForm({ ...form, payType: e.target.value })} options={[
            { value: 'HOURLY', label: 'Hourly' },
            { value: 'SALARY', label: 'Salary' },
            { value: 'PER_JOB', label: 'Per Job' },
          ]} />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Adding...' : 'Add Employee'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Expense Modal ─────────────────────────────────────────────────────────────

function ExpenseModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ category: '', amount: 0, description: '', vendor: '', date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await api('/expenses', { method: 'POST', body: JSON.stringify(form) });
      onSave();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title="New Expense">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Category" value={form.category} onChange={(e: any) => setForm({ ...form, category: e.target.value })} options={[
          { value: '', label: 'Select category...' },
          ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
        ]} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Amount ($)" type="number" value={form.amount} onChange={(e: any) => setForm({ ...form, amount: +e.target.value })} />
          <Input label="Date" type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} />
        </div>
        <Input label="Description" value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} placeholder="What was this for?" />
        <Input label="Vendor" value={form.vendor} onChange={(e: any) => setForm({ ...form, vendor: e.target.value })} placeholder="Vendor name" />
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Recording...' : 'Record Expense'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Payroll Modal ─────────────────────────────────────────────────────────────

function PayrollModal({ employees, onClose, onSave }: { employees: CrmEmployee[]; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    employeeId: '',
    periodStart: new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0],
    hoursWorked: 0,
    jobsCompleted: 0,
    grossPay: 0,
    deductions: 0,
    netPay: 0,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await api('/payroll', { method: 'POST', body: JSON.stringify(form) });
      onSave();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Record Payroll">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Employee" value={form.employeeId} onChange={(e: any) => setForm({ ...form, employeeId: e.target.value })} options={[
          { value: '', label: 'Select employee...' },
          ...employees.map((e) => ({ value: e.id, label: e.name })),
        ]} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Period Start" type="date" value={form.periodStart} onChange={(e: any) => setForm({ ...form, periodStart: e.target.value })} />
          <Input label="Period End" type="date" value={form.periodEnd} onChange={(e: any) => setForm({ ...form, periodEnd: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Hours Worked" type="number" value={form.hoursWorked} onChange={(e: any) => setForm({ ...form, hoursWorked: +e.target.value })} />
          <Input label="Jobs Completed" type="number" value={form.jobsCompleted} onChange={(e: any) => setForm({ ...form, jobsCompleted: +e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Gross Pay ($)" type="number" value={form.grossPay} onChange={(e: any) => setForm({ ...form, grossPay: +e.target.value, netPay: +e.target.value - form.deductions })} />
          <Input label="Deductions ($)" type="number" value={form.deductions} onChange={(e: any) => setForm({ ...form, deductions: +e.target.value, netPay: form.grossPay - +e.target.value })} />
          <Input label="Net Pay ($)" type="number" value={form.netPay} readOnly />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Recording...' : 'Record Payroll'}</Button>
        </div>
      </form>
    </Modal>
  );
}
