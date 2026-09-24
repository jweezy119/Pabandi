import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { crmJobsService } from '../../services/crmJobs.service';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/leads', label: 'Leads', icon: 'person_add' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
  { path: '/contact/jobs', label: 'Jobs', icon: 'work' },
];

// Reused Clay primitives from booking/BookingOSPage.tsx
function ClayCard({ children, className = '', hover = true, ...props }: any) {
  return (
    <div
      className={`rounded-[28px] bg-white transition-all duration-300 ${hover ? 'hover:-translate-y-0.5' : ''} ${className}`}
      style={{ boxShadow: '0 4px 20px rgba(180,130,90,0.12)' }}
      {...props}
    >
      <div className="p-4">{children}</div>
    </div>
  );
}

function ClayButton({ children, variant = 'primary', className = '', ...props }: any) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer border-2';
  const variants: Record<string, string> = {
    primary: 'bg-[var(--clay)] text-white border-[var(--clay)] hover:bg-[var(--terracotta)] hover:border-[var(--terracotta)] hover:-translate-y-0.5 active:scale-95',
    secondary: 'bg-transparent text-[var(--warm-ink)] border-[var(--soft-stone)] hover:border-[var(--clay)] hover:text-[var(--clay)]',
    ghost: 'bg-transparent text-[var(--soft-stone)] border-transparent hover:bg-[var(--warm-sand)]',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// Reused chip component from invoice pages
function StatusChip({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    scheduled: 'bg-[var(--warm-sand)]/20 text-[var(--warm-sand)]',
    'in progress': 'bg-[var(--clay)]/20 text-[var(--clay)]',
    complete: 'bg-[var(--sage)]/20 text-[var(--sage)]',
    cancelled: 'bg-[var(--dusty-rose)]/20 text-[var(--dusty-rose)]',
    missed: 'bg-[var(--terracotta)]/20 text-[var(--terracotta)]',
  };
  const color = statusColors[status.toLowerCase()] || 'bg-[var(--soft-stone)]/20 text-[var(--soft-stone)]';
  return (
    <span className={`${color} px-2 py-0.5 rounded-full text-xs font-medium capitalize`}>
      {status}
    </span>
  );
}

// Reused empty state pattern
function ClayEmptyState({ title, description, buttonText, onButtonClick }: { 
  title: string; 
  description: string; 
  buttonText: string; 
  onButtonClick: () => void 
}) {
  return (
    <div className="text-center py-8">
      {/* Placeholder illustration - using a simple dot with clay background */}
      <div className="h-20 w-20 mx-auto rounded-full bg-[var(--clay)]/20 flex items-center justify-center mb-4">
        <span className="text-[var(--clay)] text-xl">📋</span>
      </div>
      <h3 className="text-[var(--warm-ink)] font-medium mb-2">{title}</h3>
      <p className="text-[var(--soft-stone)] mb-4">{description}</p>
      <ClayButton onClick={onButtonClick} variant="primary">
        {buttonText}
      </ClayButton>
    </div>
  );
}

export default function ContactJobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    view: 'list', // list or calendar
    filter: 'all', // all, today, this week, upcoming, past, recurring
    search: '',
    sort: 'date-desc' // date-desc, date-asc, client-asc, client-desc, status
  });
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Calendar state
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [today, setToday] = useState(new Date().getDate());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Calendar calculations
  const startDays = useMemo(() => {
    const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
    return firstDay.getDay();
  }, [year, month]);

  const daysInMonth = useMemo(() => {
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  }, [year, month]);

  const endDays = useMemo(() => {
    const lastDay = new Date(parseInt(year), parseInt(month), 0);
    return (6 - lastDay.getDay()) % 7;
  }, [year, month]);

  // Jobs by date for calendar view
  const jobsByDate = useMemo(() => {
    const map = new Map();
    jobs.forEach(job => {
      const date = new Date(job.scheduledDate);
      const dateStr = date.toISOString().split('T')[0];
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr).push(job);
    });
    return map;
  }, [jobs]);

  // Calendar helper functions
  const prevMonth = () => {
    const m = parseInt(month) - 1;
    let y = parseInt(year);
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setYear(y.toString());
    setMonth(m.toString().padStart(2, '0'));
  };

  const nextMonth = () => {
    const m = parseInt(month) + 1;
    let y = parseInt(year);
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y.toString());
    setMonth(m.toString().padStart(2, '0'));
  };

  const resetToToday = () => {
    const now = new Date();
    setYear(now.getFullYear().toString());
setMonth((now.getMonth() + 1).toString().padStart(2, '0'));
setToday(now.getDate());
setCurrentMonth(now.getMonth());
setCurrentYear(now.getFullYear());
  };

  const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('default', { month: 'long' });

  const [createJobForm, setCreateJobForm] = useState({
    clientId: '',
    serviceType: '',
    scheduledDate: '',
    scheduledTime: '',
    durationMinutes: '',
    priceEstimate: '',
    recurrence: 'one_time',
    endDate: '',
    notes: '',
    requireDeposit: false
  });
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [filteredClients, setFilteredClients] = useState<any[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch clients for the dropdown
      const clientsRes = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData.data || []);
      }
      
      // Fetch jobs
      await fetchJobs();
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters based on UI state
      if (filters.filter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        queryParams.append('scheduledDate_gte', today);
        queryParams.append('scheduledDate_lte', today);
      } else if (filters.filter === 'this week') {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        queryParams.append('scheduledDate_gte', startOfWeek.toISOString().split('T')[0]);
        const endOfWeek = new Date();
        endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
        queryParams.append('scheduledDate_lte', endOfWeek.toISOString().split('T')[0]);
      } else if (filters.filter === 'upcoming') {
        const today = new Date().toISOString().split('T')[0];
        queryParams.append('scheduledDate_gte', today);
      } else if (filters.filter === 'past') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        queryParams.append('scheduledDate_lte', yesterday.toISOString().split('T')[0]);
      } else if (filters.filter === 'recurring') {
        queryParams.append('recurrence_not', 'one_time');
      }
      
      if (filters.search) {
        queryParams.append('search', filters.search);
      }
      
      // Add sorting
      let sortField = 'scheduledDate';
      let sortOrder = 'desc';
      if (filters.sort === 'date-asc') { sortOrder = 'asc'; }
      else if (filters.sort === 'client-asc') { sortField = 'clientName'; sortOrder = 'asc'; }
      else if (filters.sort === 'client-desc') { sortField = 'clientName'; sortOrder = 'desc'; }
      
      queryParams.append('sortBy', sortField);
      queryParams.append('sortOrder', sortOrder);
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setJobs(data.data || []);
      } else {
        console.error('Failed to fetch jobs:', await res.text());
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  };

  // Filter clients based on search
  useEffect(() => {
    if (!clientSearch) {
      setFilteredClients(clients);
      return;
    }
    
    const searchLower = clientSearch.toLowerCase();
    const filtered = clients.filter(client => 
      client.name.toLowerCase().includes(searchLower) ||
      client.email.toLowerCase().includes(searchLower) ||
      client.phone.toLowerCase().includes(searchLower)
    );
    setFilteredClients(filtered);
  }, [clients, clientSearch]);

  const handleCreateJob = async () => {
    try {
      // Convert form data to API format
      const jobData = {
        clientId: createJobForm.clientId,
        serviceType: createJobForm.serviceType,
        scheduledDate: createJobForm.scheduledDate ? new Date(createJobForm.scheduledDate) : undefined,
        scheduledTime: createJobForm.scheduledTime,
        durationMinutes: parseInt(createJobForm.durationMinutes) || undefined,
        priceEstimate: parseFloat(createJobForm.priceEstimate) || undefined,
        recurrence: createJobForm.recurrence,
        endDate: createJobForm.endDate ? new Date(createJobForm.endDate) : undefined,
        notes: createJobForm.notes,
        depositRequired: createJobForm.requireDeposit,
        depositAmount: createJobForm.requireDeposit ? parseFloat(createJobForm.depositAmount) || undefined : undefined
      };
      
      // Remove undefined fields
      const cleanedData = Object.fromEntries(
        Object.entries(jobData).filter(([_, value]) => value !== undefined && value !== '')
      );
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(cleanedData)
      });
      
      if (res.ok) {
        setShowCreateModal(false);
        // Reset form
        setCreateJobForm({
          clientId: '',
          serviceType: '',
          scheduledDate: '',
          scheduledTime: '',
          durationMinutes: '',
          priceEstimate: '',
          recurrence: 'one_time',
          endDate: '',
          notes: '',
          requireDeposit: false
        });
        await fetchJobs();
      } else {
        console.error('Failed to create job:', await res.text());
      }
    } catch (err) {
      console.error('Error creating job:', err);
    }
  };

  const handleJobClick = (jobId: string) => {
    navigate(`/contact/jobs/${jobId}`);
  };

  if (loading) {
    return (
      <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={navItems}>
        <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Jobs</h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowCreateModal(true)}
              className="bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2"
            >
              + New Job
            </button>
            <button 
              onClick={() => setFilters(prev => ({ ...prev, view: prev.view === 'list' ? 'calendar' : 'list' }))}
              className="bg-[var(--warm-sand)]/20 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]/30 px-3 py-1 rounded-full text-xs flex items-center gap-1"
            >
              {filters.view === 'list' ? 'Calendar' : 'List'}
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-[28px] p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-[var(--soft-stone)] mb-1">Filter</label>
              <select
                value={filters.filter}
                onChange={(e) => setFilters(prev => ({ ...prev, filter: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 rounded border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
              >
                <option value="all">All Jobs</option>
                <option value="today">Today</option>
                <option value="this week">This Week</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
                <option value="recurring">Recurring Only</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-[var(--soft-stone)] mb-1">Sort By</label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
              >
                <option value="date-desc">Date (Newest First)</option>
                <option value="date-asc">Date (Oldest First)</option>
                <option value="client-asc">Client (A-Z)</option>
                <option value="client-desc">Client (Z-A)</option>
                <option value="status">Status</option>
              </select>
            </div>
            
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-xs text-[var(--soft-stone)] mb-1">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by client name, service type, or notes..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full px-4 py-2 rounded pl-10 border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--soft-stone)]/50">
                  <span className="material-symbols-outlined">search</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Job List View */}
        {filters.view === 'list' && (
          <ClayCard>
            {jobs.length === 0 ? (
              <ClayEmptyState
                title="No jobs scheduled yet."
                description="Create your first job to get started."
                buttonText="+ Create Job"
                onButtonClick={() => setShowCreateModal(true)}
              />
            ) : (
              <div className="space-y-4">
                {jobs.map(job => (
                  <div 
                    key={job.id} 
                    onClick={() => handleJobClick(job.id)}
                    className="cursor-pointer flex items-center justify-between p-4 rounded-xl border border-[var(--soft-stone)]/30 bg-white hover:border-[var(--clay)]/30 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        {/* Recurrence indicator */}
                        {job.recurrence !== 'one_time' && (
                          <div className="bg-[var(--clay)]/20 text-[var(--clay)] rounded-full px-2 py-0.5 text-xs">
                            {job.recurrence.charAt(0).toUpperCase()}
                          </div>
                        )}
                        
                        <div>
                          <p className="font-medium text-[var(--warm-ink)] truncate">{job.client?.name || 'Unknown Client'}</p>
                          <p className="text-sm text-[var(--soft-stone)] truncate">
                            {job.serviceType || 'Service'} {job.durationMinutes ? `(${job.durationMinutes}min)` : ''}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-2 text-sm text-[var(--soft-stone)]">
                        {job.scheduledDate ? new Date(job.scheduledDate).toLocaleString() : 'TBD'}
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <StatusChip status={job.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ClayCard>
        )}


        {/* Create Job Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-[var(--warm-ink)]/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-[28px] w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-[var(--warm-ink)]">Create New Job</h2>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)]"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              
              <form onSubmit={(e) => { e.preventDefault(); handleCreateJob(); }} className="space-y-4">
                {/* Client Selection */}
                <div>
                  <label className="block text-xs text-[var(--soft-stone)] mb-1">Client</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search clients..."
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        // Find selected client
                        const selectedClient = filteredClients.find(c => 
                          c.name.toLowerCase() === e.target.value.toLowerCase() ||
                          c.email.toLowerCase() === e.target.value.toLowerCase()
                        );
                        if (selectedClient) {
                          setCreateJobForm(prev => ({ ...prev, clientId: selectedClient.id }));
                        }
                      }}
                      className="w-full px-4 py-2 rounded pl-10 border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--soft-stone)]/50">
                      <span className="material-symbols-outlined">person</span>
                    </div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--soft-stone)]/50">
                      {filteredClients.length > 0 && (
                        <span className="material-symbols-outlined">expand_more</span>
                      )}
                    </div>
                  </div>
                  {filteredClients.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-[var(--soft-stone)]/20 rounded">
                      {filteredClients.map(client => (
                        <div 
                          key={client.id}
                          onClick={() => {
                            setClientSearch(`${client.name} ${client.email}`.trim());
                            setCreateJobForm(prev => ({ ...prev, clientId: client.id }));
                          }}
                          className="cursor-pointer px-3 py-2 hover:bg-[var(--warm-sand)]/20"
                        >
                          <div className="flex justify-between">
                            <div className="font-medium text-[var(--warm-ink)]">{client.name}</div>
                            <div className="text-xs text-[var(--soft-stone)]">{client.email}</div>
                          </div>
                        </div>
                      ))}
                      {filteredClients.length === 0 && (
                        <div className="px-3 py-2 text-[var(--soft-stone)] text-center">
                          No matching clients found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Service Type */}
                <div>
                  <label className="block text-xs text-[var(--soft-stone)] mb-1">Service Type</label>
                  <input
                    type="text"
                    placeholder="e.g., Standard Clean, Deep Clean, Haircut"
                    value={createJobForm.serviceType}
                    onChange={(e) => setCreateJobForm(prev => ({ ...prev, serviceType: e.target.value }))}
                    className="w-full px-3 py-2 rounded border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                  />
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--soft-stone)] mb-1">Date</label>
                    <input
                      type="date"
                      value={createJobForm.scheduledDate}
                      onChange={(e) => setCreateJobForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                      className="w-full px-3 py-2 rounded border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--soft-stone)] mb-1">Time</label>
                    <input
                      type="time"
                      value={createJobForm.scheduledTime}
                      onChange={(e) => setCreateJobForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                      className="w-full px-3 py-2 rounded border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                    />
                  </div>
                </div>

                {/* Duration and Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--soft-stone)] mb-1">Duration (min)</label>
                    <select
                      value={createJobForm.durationMinutes}
                      onChange={(e) => setCreateJobForm(prev => ({ ...prev, durationMinutes: e.target.value }))}
                      className="w-full px-3 py-2 rounded border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                    >
                      <option value="">Custom</option>
                      <option value="30">30 min</option>
                      <option value="60">1 hr</option>
                      <option value="90">1.5 hr</option>
                      <option value="120">2 hr</option>
                      <option value="180">3 hr</option>
                      <option value="240">4 hr</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--soft-stone)] mb-1">Price Estimate ($)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={createJobForm.priceEstimate}
                      onChange={(e) => setCreateJobForm(prev => ({ ...prev, priceEstimate: e.target.value }))}
                      className="w-full px-3 py-2 rounded border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                    />
                  </div>
                </div>

                {/* Recurrence Settings */}
                <div>
                  <label className="block text-xs text-[var(--soft-stone)] mb-1">Recurrence</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        id="recurrence-one-time"
                        name="recurrence"
                        value="one_time"
                        checked={createJobForm.recurrence === 'one_time'}
                        onChange={(e) => setCreateJobForm(prev => ({ ...prev, recurrence: e.target.value }))}
                        className="h-4 w-4 text-[var(--clay)]"
                      />
                      <label htmlFor="recurrence-one-time" className="text-[var(--warm-ink)] font-medium">One-time</label>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        id="recurrence-weekly"
                        name="recurrence"
                        value="weekly"
                        checked={createJobForm.recurrence === 'weekly'}
                        onChange={(e) => setCreateJobForm(prev => ({ ...prev, recurrence: e.target.value }))}
                        className="h-4 w-4 text-[var(--clay)]"
                      />
                      <label htmlFor="recurrence-weekly" className="text-[var(--warm-ink)] font-medium">Weekly</label>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        id="recurrence-biweekly"
                        name="recurrence"
                        value="biweekly"
                        checked={createJobForm.recurrence === 'biweekly'}
                        onChange={(e) => setCreateJobForm(prev => ({ ...prev, recurrence: e.target.value }))}
                        className="h-4 w-4 text-[var(--clay)]"
                      />
                      <label htmlFor="recurrence-biweekly" className="text-[var(--warm-ink)] font-medium">Bi-weekly</label>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        id="recurrence-monthly"
                        name="recurrence"
                        value="monthly"
                        checked={createJobForm.recurrence === 'monthly'}
                        onChange={(e) => setCreateJobForm(prev => ({ ...prev, recurrence: e.target.value }))}
                        className="h-4 w-4 text-[var(--clay)]"
                      />
                      <label htmlFor="recurrence-monthly" className="text-[var(--warm-ink)] font-medium">Monthly</label>
                    </div>
                  </div>
                  
                  {createJobForm.recurrence !== 'one_time' && (
                    <div className="mt-3 pt-3 border-t border-[var(--soft-stone)]/30">
                      <label className="block text-xs text-[var(--soft-stone)] mb-1">End Date</label>
                      <input
                        type="date"
                        value={createJobForm.endDate}
                        onChange={(e) => setCreateJobForm(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 rounded border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                      />
                      <p className="text-[var(--soft-stone)] text-xs mt-1">
                        This will create approximately {createJobForm.endDate ? 
                          Math.floor((new Date(createJobForm.endDate).getTime() - new Date(createJobForm.scheduledDate || new Date()).getTime()) / (1000 * 60 * 60 * 24 * 
                            (createJobForm.recurrence === 'weekly' ? 7 : 
                             createJobForm.recurrence === 'biweekly' ? 14 : 
                             createJobForm.recurrence === 'monthly' ? 30 : 1))
                          ) : 'X'} jobs
                      </p>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs text-[var(--soft-stone)] mb-1">Notes (optional)</label>
                  <textarea
                    placeholder="Add any special instructions or notes for the worker..."
                    value={createJobForm.notes}
                    onChange={(e) => setCreateJobForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 rounded border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                    rows="3"
                  />
                </div>

                {/* Deposit Toggle */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-[var(--soft-stone)] font-medium">Require Deposit</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createJobForm.requireDeposit}
                        onChange={(e) => setCreateJobForm(prev => ({ ...prev, requireDeposit: e.target.checked }))}
                        className="h-4 w-4 text-[var(--clay)]"
                      />
                      <span className="text-[var(--warm-ink)] text-xs">{createJobForm.requireDeposit ? 'ON' : 'OFF'}</span>
                    </div>
                  </div>
                  
                  {createJobForm.requireDeposit && (
                    <div className="mt-3">
                      <label className="block text-xs text-[var(--soft-stone)] mb-1">Deposit Amount ($)</label>
                      <input
                        type="number"
                        placeholder="25-100"
                        value={createJobForm.depositAmount || ''}
                        onChange={(e) => setCreateJobForm(prev => ({ ...prev, depositAmount: e.target.value }))}
                        className="w-full px-3 py-2 rounded border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                      />
                      <p className="text-[var(--soft-stone)] text-xs mt-1">
                        Suggested range: $25-$100 for new or low-reliability clients
                      </p>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="mt-6">
                  <button
                    type="submit"
                    className="w-full bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] px-4 py-3 rounded-full font-medium flex items-center justify-center gap-2"
                    disabled={!createJobForm.clientId || !createJobForm.serviceType || !createJobForm.scheduledDate || !createJobForm.scheduledTime}
                  >
                    Create Job
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
