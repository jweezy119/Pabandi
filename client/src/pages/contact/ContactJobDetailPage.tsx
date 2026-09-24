import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { crmJobsService } from '../../services/crmJobs.service';
import { invoiceTrustService } from '../../services/invoice-trust.service'; // This would be a client-side service in reality

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

// Reused ClayStat from booking/BookingOSPage.tsx
function ClayStat({ icon, value, label, trend, color = 'terracotta' }: { icon: string; value: string; label: string; trend?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    terracotta: 'bg-[var(--clay)]',
    sage: 'bg-[var(--sage)]',
    'dusty-rose': 'bg-[var(--dusty-rose)]',
    ochre: 'bg-[var(--muted-ochre)]',
    'sky-wash': 'bg-[var(--sky-wash)]',
  };
  const bgColor = colorMap[color] || colorMap.terracotta;
  return (
    <div className={`${bgColor} rounded-[20px] p-4 flex items-center gap-3`}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20">
        <span className="material-symbols-outlined text-[var(--warm-ink)] text-[18px]">{icon}</span>
      </div>
      <div>
        {trend && (
          <p className="text-xs text-[var(--soft-stone)]">{trend}</p>
        )}
        <p className="text-sm font-medium text-[var(--warm-ink)]">{value}</p>
        <p className="text-xs text-[var(--soft-stone)]">{label}</p>
      </div>
    </div>
  );
}

// Reused chip component
function StatusChip({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    scheduled: 'bg-[var(--warm-sand)]/20 text-[var(--warm-sand)]',
    'in progress': 'bg-[var(--clay)]/20 text-[var(--clay)]',
    complete: 'bg-[var(--sage)]/20 text-[var(--sage)]',
    cancelled: 'bg-[var(--dusty-rose)]/20 text-[var(--dusty-rose)]',
    missed: 'bg-[var(--terracotta)]/20 text-[var(--terracotta)]',
    overdue: 'bg-[var(--rose)]/20 text-[var(--rose)]',
  };
  const color = statusColors[status.toLowerCase()] || 'bg-[var(--soft-stone)]/20 text-[var(--soft-stone)]';
  return (
    <span className={`${color} px-2 py-0.5 rounded-full text-xs font-medium capitalize`}>
      {status}
    </span>
  );
}

// Reliability Chip component
function ReliabilityChip({ score }: { score: number }) {
  if (score === 0) {
    return <span className="bg-[var(--soft-stone)]/20 text-[var(--soft-stone)] px-2 py-0.5 rounded-full text-xs font-medium">New</span>;
  }
  if (score >= 70) {
    return <span className="bg-[var(--sage)]/20 text-[var(--sage)] px-2 py-0.5 rounded-full text-xs font-medium">Reliable</span>;
  }
  if (score >= 40) {
    return <span className="bg-[var(--muted-ochre)]/20 text-[var(--muted-ochre)] px-2 py-0.5 rounded-full text-xs font-medium">Mixed</span>;
  }
  return <span className="bg-[var(--dusty-rose)]/20 text-[var(--dusty-rose)] px-2 py-0.5 rounded-full text-xs font-medium">At Risk</span>;
}

export default function ContactJobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recurringJobs, setRecurringJobs] = useState<any[]>([]);
  const [client, setClient] = useState<any>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [checkedInAt, setCheckedInAt] = useState<Date | null>(null);
  const [checkedOutAt, setCheckedOutAt] = useState<Date | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchJobDetails();
  }, [id]);

  const fetchJobDetails = async () => {
    setLoading(true);
    try {
      // Fetch job details
      const jobRes = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (jobRes.ok) {
        const jobData = await jobRes.json();
        setJob(jobData.data);
        
        // Fetch client details
        if (jobData.data.clientId) {
          const clientRes = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${jobData.data.clientId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          });
          if (clientRes.ok) {
            const clientData = await clientRes.json();
            setClient(clientData.data);
          }
        }
        
        // Fetch recurring jobs in series if this is part of a series
        if (jobData.data.parentJobId) {
          const seriesRes = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs?parentJobId=${jobData.data.parentJobId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          });
          if (seriesRes.ok) {
            const seriesData = await seriesRes.json();
            setRecurringJobs(seriesData.data || []);
          }
        } else if (jobData.data.id) {
          // This is a parent job, get its children
          const childrenRes = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs?parentJobId=${jobData.data.id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          });
          if (childrenRes.ok) {
            const childrenData = await childrenRes.json();
            setRecurringJobs(childrenData.data || []);
          }
        }
        
        // Fetch invoice if job is complete
        if (jobData.data.status === 'complete' && jobData.data.clientId) {
          const invoiceRes = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${jobData.data.clientId}/invoices?jobId=${jobData.data.id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          });
          if (invoiceRes.ok) {
            const invoiceData = await invoiceRes.json();
            setInvoice(invoiceData.data?.[0] || null);
          }
        }
      } else {
        console.error('Failed to fetch job:', await jobRes.text());
      }
    } catch (err) {
      console.error('Error fetching job details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      setShowCheckInModal(false);
      const now = new Date();
      
      // Update job status
      await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs/${id}/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'in progress' })
      });
      
      // In a real app, we would also emit trust events and update audit log
      // For now, we'll just update the UI
      setCheckedInAt(now);
      
      // Refetch job to get updated status
      await fetchJobDetails();
    } catch (err) {
      console.error('Error checking in:', err);
    }
  };

  const handleCheckOut = async () => {
    try {
      setShowCheckOutModal(false);
      const now = new Date();
      
      // Update job status
      await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'complete' })
      });
      
      // In a real app, we would:
      // 1. Calculate actual duration
      // 2. Fire delivery.on_time or delivery.late event
      // 3. Update worker's deliveryScore
      // 4. Auto-generate invoice
      // 5. Auto-release deposit from escrow
      // For now, we'll just update the UI
      setCheckedOutAt(now);
      
      // Refetch job to get updated status and invoice
      await fetchJobDetails();
    } catch (err) {
      console.error('Error checking out:', err);
    }
  };

  const handleCancelJob = async () => {
    if (!window.confirm('Are you sure you want to cancel this job?')) return;
    
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'cancelled' })
      });
      
      await fetchJobDetails();
    } catch (err) {
      console.error('Error cancelling job:', err);
    }
  };

  const handleDeleteJob = async () => {
    if (!window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) return;
    
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      navigate('/contact/jobs');
    } catch (err) {
      console.error('Error deleting job:', err);
    }
  };

  const formatDateTime = (dateString: string | undefined | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (minutes: number | undefined | null) => {
    if (!minutes) return 'Not set';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
  };

  if (loading) {
    return (
      <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={[]}>
        <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading job details...</div>
      </DashboardLayout>
    );
  }

  if (!job) {
    return (
      <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={[]}>
        <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Job not found</div>
      </DashboardLayout>
    );
  }

  const isRecurring = job.parentJobId !== null || recurringJobs.length > 0;
  const seriesTitle = job.parentJobId 
    ? `Part of recurring series` 
    : recurringJobs.length > 0 
      ? `Parent of recurring series (${recurringJobs.length} child jobs)` 
      : '';

  return (
    <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={[]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Job Details</h1>
          <div className="flex items-center gap-3">
            <Link to="/contact/jobs" className="text-sm" style={{ color: 'var(--terracotta)' }}>← Back to Jobs</Link>
            
            {job.status === 'scheduled' && (
              <button 
                onClick={() => setShowCheckInModal(true)}
                className="bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] px-4 py-3 rounded-full font-medium flex items-center gap-2"
              >
                Check In
              </button>
            )}
            
            {checkedInAt && !checkedOutAt && (
              <button 
                onClick={() => setShowCheckOutModal(true)}
                className="bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] px-4 py-3 rounded-full font-medium flex items-center gap-2"
              >
                Check Out
              </button>
            )}
            
            {['scheduled', 'in progress'].includes(job.status) && (
              <button 
                onClick={handleCancelJob}
                className="bg-[var(--dusty-rose)] text-white hover:bg-[var(--terracotta)] px-4 py-3 rounded-full font-medium flex items-center gap-2"
              >
                Cancel Job
              </button>
            )}
            
            <button 
              onClick={handleDeleteJob}
              className="bg-[var(--soft-stone)]/20 text-[var(--warm-ink)] hover:bg-[var(--soft-stone)]/30 px-3 py-2 rounded-full flex items-center gap-1 text-xs"
            >
              Delete
            </button>
          </div>

          {/* Check-In Modal */}
          {showCheckInModal && (
            <div className="fixed inset-0 bg-[var(--warm-ink)]/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-[28px] w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Check In</h2>
                <p className="text-[var(--soft-stone)] mb-4">
                  Are you sure you want to check in for this job?
                </p>
                <div className="flex justify-end">
                  <button 
                    onClick={() => setShowCheckInModal(false)}
                    className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)]"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCheckIn}
                    className="ml-4 bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] px-4 py-2 rounded-full"
                  >
                    Check In
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Check-Out Modal */}
          {showCheckOutModal && (
            <div className="fixed inset-0 bg-[var(--warm-ink)]/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-[28px] w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Check Out</h2>
                <p className="text-[var(--soft-stone)] mb-4">
                  Are you sure you want to check out and complete this job?
                </p>
                <div className="flex justify-end">
                  <button 
                    onClick={() => setShowCheckOutModal(false)}
                    className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)]"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCheckOut}
                    className="ml-4 bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] px-4 py-2 rounded-full"
                  >
                    Check Out
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Job Header */}
          <ClayCard className="p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[var(--warm-ink)]">{job.client?.name || 'Unknown Client'}</h2>
                <p className="text-[var(--warm-ink)] font-medium">{job.serviceType || 'Service'}</p>
                {job.durationMinutes && (
                  <p className="text-sm text-[var(--soft-stone)]">Duration: {formatDuration(job.durationMinutes)}</p>
                )}
                {job.priceEstimate && (
                  <p className="text-sm text-[var(--warm-ink)]">Estimate: ${job.priceEstimate.toFixed(2)}</p>
                )}
              </div>
              <div className="text-center">
                <div className="space-y-2">
                  <p className="text-xs text-[var(--soft-stone)]">Scheduled</p>
                  <p className="font-medium text-[var(--warm-ink)]">{formatDateTime(job.scheduledDate)} {job.scheduledTime ? `at ${job.scheduledTime}` : ''}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-[var(--soft-stone)]">Status</p>
                  <StatusChip status={job.status} />
                </div>
                {isRecurring && (
                  <div className="space-y-2 mt-4">
                    <p className="text-xs text-[var(--soft-stone)]">Series</p>
                    <p className="text-sm text-[var(--warm-ink)] font-medium">{seriesTitle}</p>
                  </div>
                )}
              </div>
            </div>
          </ClayCard>

          {/* Job Details Section */}
          <ClayCard className="p-6">
            <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Job Details</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--soft-stone)] font-medium">Address</p>
                  <p className="text-[var(--warm-ink)]">{job.address || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--soft-stone)] font-medium">Notes</p>
                  <p className="text-[var(--warm-ink)]">{job.notes || 'None'}</p>
                </div>
              </div>
              
              {job.notes && (
                <div className="mt-4 p-4 bg-[var(--warm-sand)]/20 rounded-[20px]">
                  <p className="text-xs text-[var(--warm-ink)] font-medium mb-2">Worker Notes</p>
                  <p className="text-[var(--soft-stone)]">{job.notes}</p>
                </div>
              )}
            </div>
          </ClayCard>

          {/* Recurring Series Info */}
          {isRecurring && (
            <ClayCard className="p-6">
              <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Recurring Series</h3>
              {job.parentJobId ? (
                <>
                  <p className="text-[var(--soft-stone)]">This job is part of a recurring series.</p>
                  <p className="text-[var(--soft-stone)]">Series Index: {job.seriesIndex}</p>
                  {job.seriesEndDate && (
                    <p className="text-[var(--soft-stone)]">Series ends: {formatDateTime(job.seriesEndDate)}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[var(--soft-stone)]">This job is the parent of a recurring series.</p>
                  <p className="text-[var(--soft-stone)]">Recurrence: {job.recurrence}</p>
                  {job.seriesEndDate && (
                    <p className="text-[var(--soft-stone)]">Series ends: {formatDateTime(job.seriesEndDate)}</p>
                  )}
                  <p className="text-[var(--soft-stone)]">Total jobs in series: {recurringJobs.length + 1}</p>
                </>
              )}
              
              {recurringJobs.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-lg font-bold text-[var(--warm-ink)] mb-2">Child Jobs in Series:</h4>
                  <div className="space-y-2">
                    {recurringJobs.map(childJob => (
                      <div 
                        key={childJob.id} 
                        onClick={() => navigate(`/contact/jobs/${childJob.id}`)}
                        className="cursor-pointer p-3 rounded border border-[var(--soft-stone)]/30 bg-white hover:border-[var(--clay)]/30"
                      >
                        <div className="flex justify-between">
                          <span className="font-medium text-[var(--warm-ink)]">{childJob.client?.name}</span>
                          <span className="text-sm text-[var(--soft-stone)]">
                            {formatDateTime(childJob.scheduledDate)} {childJob.scheduledTime ? `at ${childJob.scheduledTime}` : ''}
                          </span>
                        </div>
                        <StatusChip status={childJob.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ClayCard>
          )}

          {/* Check-In/Check-Out Status */}
          {checkedInAt && (
            <ClayCard className="p-6">
              <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Check-In Status</h3>
              <div className="space-y-4">
                <p className="text-[var(--warm-ink)] font-medium">Checked In At:</p>
                <p className="text-[var(--warm-ink)] text-lg font-bold">{checkedInAt.toLocaleString()}</p>
                
                {checkedOutAt && (
                  <div className="mt-4">
                    <p className="text-[var(--warm-ink)] font-medium">Checked Out At:</p>
                    <p className="text-[var(--warm-ink)] text-lg font-bold">{checkedOutAt.toLocaleString()}</p>
                    
                    <div className="mt-3">
                      <p className="text-[var(--warm-ink)] font-medium">Duration:</p>
                      <p className="text-[var(--warm-ink)] text-lg font-bold">
                        {Math.floor((checkedOutAt.getTime() - checkedInAt.getTime()) / (1000 * 60))} min
                      </p>
                    </div>
                  )}
                }
              </div>
            </ClayCard>
          )}

          {/* Invoice Section */}
          {invoice && (
            <ClayCard className="p-6">
              <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Generated Invoice</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="font-medium text-[var(--warm-ink)]">Invoice #{invoice.number}</span>
                  <span className="text-sm text-[var(--soft-stone)]">Status: {invoice.status}</span>
                </div>
                
                <div className="mt-3">
                  <p className="text-[var(--warm-ink)] font-medium">Amount:</p>
                  <p className="text-[var(--warm-ink)] text-lg font-bold">${invoice.subtotal?.toFixed(2) || 0}</p>
                </div>
                
                <div className="mt-3">
                  <p className="text-[var(--warm-ink)] font-medium">Due Date:</p>
                  <p className="text-[var(--warm-ink)] text-lg font-bold">{invoice.dateDue ? new Date(invoice.dateDue).toLocaleDateString() : 'Not set'}</p>
                </div>
                
                <div className="mt-4 flex justify-end">
                  <Link 
                    to={`/contact/invoices/${invoice.id}`} 
                    className="bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] px-4 py-2 rounded-full"
                  >
                    View Invoice
                  </Link>
                </div>
              </div>
            </ClayCard>
          )}

          {/* Activity Timeline */}
          <ClayCard className="p-6">
            <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Activity Timeline</h3>
            <div className="space-y-4">
              {(!checkedInAt && !checkedOutAt) && (
                <p className="text-[var(--soft-stone)] text-center py-4">No activity yet.</p>
              )}
              
              {checkedInAt && (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[var(--warm-ink)] font-medium">Checked In</span>
                    <span className="text-[var(--warm-ink)] text-sm">{checkedInAt.toLocaleString()}</span>
                  </div>
                  <div className="h-0.5 bg-[var(--warm-sand)]/20 my-4"></div>
                  
                  {checkedOutAt && (
                    <>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[var(--warm-ink)] font-medium">Checked Out</span>
                        <span className="text-[var(--warm-ink)] text-sm">{checkedOutAt.toLocaleString()}</span>
                      </div>
                      <div className="h-0.5 bg-[var(--warm-sand)]/20 my-4"></div>
                      
                      {invoice && (
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[var(--warm-ink)] font-medium">Invoice Generated</span>
                            <span className="text-[var(--warm-ink)] text-sm">#{invoice.number}</span>
                          </div>
                          <div className="h-0.5 bg-[var(--warm-sand)]/20 my-4"></div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </ClayCard>
        </div>
      </DashboardLayout>
    );
}
