import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { Button } from '../../components/primitives';
import { getAuthToken } from '../../utils/authToken';


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
  const [today] = useState(new Date().getDate());

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
    let m = parseInt(month) - 1;
    let y = parseInt(year);
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setYear(y.toString());
    setMonth(m.toString().padStart(2, '0'));
  };

  const nextMonth = () => {
    let m = parseInt(month) + 1;
    let y = parseInt(year);
    if (m > 12) {
      m = 1;
      y -= 1;
    }
    setYear(y.toString());
    setMonth(m.toString().padStart(2, '0'));
  };

  const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('default', { month: 'long' });

  const [createJobForm, setCreateJobForm] = useState({
    clientId: '',
    serviceType: '',
    scheduledDate: '',
    scheduledTime: '',
    durationMinutes: '',
    price: '',
    notes: '',
    address: '',
  });
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');

  /**
   * Why the last attempt failed, shown in the modal.
   *
   * It used to console.error and close the modal anyway, so a 400 — which is what
   * every creation from this page produced, because the form never asked for the
   * address the endpoint requires — looked identical to a job created. Someone
   * pressing the button and watching nothing appear has no way to tell those apart.
   */
  const [createError, setCreateError] = useState<string | null>(null);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch clients for the dropdown
      const clientsRes = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
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
        headers: { Authorization: `Bearer ${getAuthToken()}` },
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
    setCreateError(null);
    try {
      // Convert form data to API format
      // `price`, not `priceEstimate`. CrmJob has no priceEstimate column, so the
      // amount a customer agreed was sent under a name the server does not read and
      // the job saved at 0.
      //
      // `address` is required here — POST /crm/jobs rejects a job with no address,
      // and this form never asked for one, so every creation from this page was a
      // 400 that only reached the console.
      const jobData = {
        clientId: createJobForm.clientId,
        serviceType: createJobForm.serviceType,
        scheduledDate: createJobForm.scheduledDate ? new Date(createJobForm.scheduledDate) : undefined,
        scheduledTime: createJobForm.scheduledTime,
        durationMinutes: parseInt(createJobForm.durationMinutes) || undefined,
        price: parseFloat(createJobForm.price) || 0,
        address: createJobForm.address,
        notes: createJobForm.notes,
      };
      
      // Remove undefined fields
      const cleanedData = Object.fromEntries(
        Object.entries(jobData).filter(([_, value]) => value !== undefined && value !== '')
      );
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
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
          price: '',
          notes: '',
          address: ''
        });
        await fetchJobs();
      } else {
        // Shown, not logged. "Something went wrong" in the console is invisible to
        // the person who pressed the button, and the modal used to close either way
        // — so a rejected job looked exactly like a created one.
        const body = await res.json().catch(() => ({}));
        setCreateError(body?.error || 'The job could not be saved. Check the details and try again.');
      }
    } catch (err) {
      setCreateError('The job could not be saved. Check your connection and try again.');
    }
  };

  const handleJobClick = (jobId: string) => {
    navigate(`/contact/jobs/${jobId}`);
  };

  if (loading) {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="#C97B5A" >
        <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="#C97B5A" >
      <div className="space-y-6">
        <div className="flex justify-between items-center clay-heading">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Jobs</h1>
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowCreateModal(true)} variant="primary">
              + New Job
            </Button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, view: prev.view === 'list' ? 'calendar' : 'list' }))}
              className="clay-filter-chip clay-filter-chip--inactive text-xs"
            >
              {filters.view === 'list' ? 'Calendar' : 'List'}
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-[28px] p-4 shadow-sm clay-rise">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-[var(--soft-stone)] font-label mb-1">Filter</label>
              <select
                value={filters.filter}
                onChange={(e) => setFilters(prev => ({ ...prev, filter: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm clay-field-input"
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
                className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm clay-field-input"
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
                  className="w-full px-4 py-2 rounded-lg pl-10 border border-[var(--soft-stone)]/30 bg-white text-sm clay-field-input"
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
                    className="cursor-pointer flex items-center justify-between p-4 rounded-xl border border-[var(--soft-stone)]/30 bg-white hover:border-[var(--clay)]/30 transition clay-card--interactive clay-table-row clay-rise"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
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


        {/* Calendar View */}
        {filters.view === 'calendar' && (
          <ClayCard>
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="clay-filter-chip clay-filter-chip--inactive text-xs">← Prev</button>
              <h3 className="text-lg font-bold text-[var(--warm-ink)]">{monthName} {year}</h3>
              <button onClick={nextMonth} className="clay-filter-chip clay-filter-chip--inactive text-xs">Next →</button>
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-[var(--soft-stone)] py-2">{day}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before the first day of month */}
              {Array.from({ length: startDays }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square"></div>
              ))}
              
              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${month}-${day.toString().padStart(2, '0')}`;
                const dayJobs = jobsByDate.get(dateStr) || [];
                const isToday = day === today && parseInt(year) === new Date().getFullYear() && parseInt(month) - 1 === new Date().getMonth();
                
                return (
                  <div
                    key={day}
                    className={`aspect-square border rounded-lg p-1 flex flex-col items-center justify-start pt-1 cursor-pointer transition-colors ${
                      isToday 
                        ? 'border-[var(--clay)] bg-[var(--clay)]/10' 
                        : 'border-[var(--soft-stone)]/20 hover:border-[var(--clay)]/30'
                    }`}
                    onClick={() => {
                      if (dayJobs.length > 0) {
                        handleJobClick(dayJobs[0].id);
                      }
                    }}
                  >
                    <span className={`text-xs font-medium ${isToday ? 'text-[var(--clay)] font-bold' : 'text-[var(--warm-ink)]'}`}>
                      {day}
                    </span>
                    {dayJobs.length > 0 && (
                      <div className="mt-0.5 w-full px-1">
                        <div className="text-[10px] bg-[var(--clay)] text-white rounded-full px-1 py-0.5 truncate text-center">
                          {dayJobs.length}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Empty cells for days after the last day of month */}
              {Array.from({ length: endDays }).map((_, i) => (
                <div key={`end-${i}`} className="aspect-square"></div>
              ))}
            </div>
            
            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 text-xs text-[var(--soft-stone)]">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border border-[var(--clay)] bg-[var(--clay)]/10"></div>
                <span>Today</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-[var(--clay)]"></div>
                <span>Has jobs</span>
              </div>
            </div>
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
                        className="w-full px-4 py-2 rounded-lg pl-10 border border-[var(--soft-stone)]/30 bg-white text-sm clay-field-input"
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
                    className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm clay-field-input"
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
                      className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm clay-field-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--soft-stone)] font-label mb-1">Time</label>
                    <input
                      type="time"
                      value={createJobForm.scheduledTime}
                      onChange={(e) => setCreateJobForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm clay-field-input"
                    />
                  </div>
                </div>

                {/* Duration and Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--soft-stone)] font-label mb-1">Duration (min)</label>
                    <select
                      value={createJobForm.durationMinutes}
                      onChange={(e) => setCreateJobForm(prev => ({ ...prev, durationMinutes: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm clay-field-input"
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
                    <label className="block text-xs text-[var(--soft-stone)] font-label mb-1">Price ($)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={createJobForm.price}
                      onChange={(e) => setCreateJobForm(prev => ({ ...prev, price: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm clay-field-input"
                    />
                  </div>
                </div>

                {/* Recurrence, end date and deposits were here.

                    CrmJob has no column for any of them, so each was collected,
                    POSTed and discarded: a job set to recur weekly came back as a
                    one-off, and a deposit the customer had agreed to was never
                    recorded. The form also had no address, which this endpoint
                    requires, so every job created from this page was a 400 that only
                    reached the console.

                    The two commits before this removed exactly this pattern — a
                    control that accepts input and stores nothing — everywhere else
                    in the CRM. Leaving it here would have been lossy and
                    inconsistent. They come back when there is somewhere to store
                    them, not before. */}

                {/* Address — required by the endpoint.

                    POST /crm/jobs rejects a job with no address: a service business
                    cannot dispatch someone who does not know where to go. The form
                    never asked, so every creation from this page was a 400 that only
                    reached the console. */}
                <div>
                  <label className="block text-xs text-[var(--soft-stone)] mb-1">Address</label>
                  <input
                    type="text"
                    placeholder="Where the work happens"
                    value={createJobForm.address}
                    onChange={(e) => setCreateJobForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm clay-field-input"
                    required
                  />
                  <p className="text-[var(--soft-stone)] text-xs mt-1">
                    Defaults to the client's address once this is filled in for them.
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs text-[var(--soft-stone)] mb-1">Notes (optional)</label>
                  <textarea
                    placeholder="Add any special instructions or notes for the worker..."
                    value={createJobForm.notes}
                    onChange={(e) => setCreateJobForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm clay-field-input"
                    rows={3}
                  />
                </div>

                {/* Placed directly above the button that was pressed, so a rejection is
                    read where it happened rather than on a page they were moved to. */}
                {createError && (
                  <div
                    role="alert"
                    className="mb-3 rounded-xl px-3 py-2.5 text-sm"
                    style={{ background: 'var(--danger-container, #FCE8E6)', color: 'var(--on-danger-container, #8C1D18)' }}
                  >
                    <span className="material-symbols-outlined text-[18px] align-middle mr-1.5">error</span>
                    {createError}
                  </div>
                )}

                {/* Submit Button */}
                <div className="mt-6">
                  <Button variant="primary" type="submit" className="w-full" disabled={!createJobForm.clientId || !createJobForm.serviceType || !createJobForm.scheduledDate || !createJobForm.scheduledTime || !createJobForm.address}>
                    Create Job
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
