import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';

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

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, string> = {
    scheduled: 'bg-[var(--warm-sand)]/20 text-[var(--warm-sand)]',
    'in progress': 'bg-[var(--clay)]/20 text-[var(--clay)]',
    complete: 'bg-[var(--sage)]/20 text-[var(--sage)]',
    cancelled: 'bg-[var(--dusty-rose)]/20 text-[var(--dusty-rose)]',
  };
  const c = colors[status.toLowerCase()] || 'bg-[var(--soft-stone)]/20 text-[var(--soft-stone)]';
  return <span className={`${c} px-2 py-0.5 rounded-full text-xs font-medium capitalize`}>{status}</span>;
}

export default function ContactJobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [checkedInAt, setCheckedInAt] = useState<Date | null>(null);
  const [checkedOutAt, setCheckedOutAt] = useState<Date | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const h = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    const API = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    Promise.all([
      fetch(`${API}/api/v1/crm/jobs/${id}`, { headers: h }),
      fetch(`${API}/api/v1/crm/clients/${job?.clientId || ''}`, { headers: h }),
    ]).then(async ([jr, cr]) => {
      if (jr.ok) setJob((await jr.json()).data);
      if (cr.ok) setClient((await cr.json()).data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const chkIn = async () => {
    setShowCheckIn(false);
    const now = new Date();
    const API = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    await fetch(`${API}/api/v1/crm/jobs/${id}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ status: 'in progress' }),
    }).catch(console.error);
    setCheckedInAt(now);
    setJob((p: any) => ({ ...p, status: 'in progress' }));
  };

  const chkOut = async () => {
    setShowCheckOut(false);
    const now = new Date();
    const API = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    await fetch(`${API}/api/v1/crm/jobs/${id}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ status: 'complete' }),
    }).catch(console.error);
    setCheckedOutAt(now);
    setJob((p: any) => ({ ...p, status: 'complete' }));
  };

  const cancelJob = async () => {
    if (!confirm('Cancel this job?')) return;
    const API = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    await fetch(`${API}/api/v1/crm/jobs/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ status: 'cancelled' }),
    }).catch(console.error);
    setJob((p: any) => ({ ...p, status: 'cancelled' }));
  };

  const delJob = async () => {
    if (!confirm('Delete this job? This cannot be undone.')) return;
    const API = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    await fetch(`${API}/api/v1/crm/jobs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(console.error);
    navigate('/contact/jobs');
  };

  if (loading) return <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={[]}><div className="p-8 text-center text-[var(--soft-stone)]">Loading job details...</div></DashboardLayout>;
  if (!job) return <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={[]}><div className="p-8 text-center text-[var(--soft-stone)]">Job not found</div></DashboardLayout>;

  return (
    <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={[]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Job Details</h1>
          <div className="flex items-center gap-3">
            <Link to="/contact/jobs" className="text-sm text-[var(--terracotta)]">← Back to Jobs</Link>
            {job.status === 'scheduled' && <button onClick={() => setShowCheckIn(true)} className="bg-[var(--clay)] text-white px-4 py-2 rounded-full font-medium">Check In</button>}
            {checkedInAt && !checkedOutAt && <button onClick={() => setShowCheckOut(true)} className="bg-[var(--sage)] text-white px-4 py-2 rounded-full font-medium">Check Out</button>}
            {['scheduled', 'in progress'].includes(job.status) && <button onClick={cancelJob} className="bg-[var(--dusty-rose)] text-white px-4 py-2 rounded-full font-medium">Cancel</button>}
            <button onClick={delJob} className="bg-[var(--soft-stone)]/20 text-[var(--warm-ink)] px-3 py-2 rounded-full text-xs">Delete</button>
          </div>
        </div>

        <ClayCard className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-[var(--warm-ink)]">{client?.name || 'Unknown'}</h2>
              <p className="text-[var(--warm-ink)] font-medium">{job.serviceType}</p>
              {job.durationMinutes && <p className="text-sm text-[var(--soft-stone)]">Duration: {job.durationMinutes} min</p>}
              {job.priceEstimate && <p className="text-sm text-[var(--warm-ink)]">Estimate: ${job.priceEstimate.toFixed(2)}</p>}
            </div>
            <div className="text-center space-y-2">
              <p className="text-xs text-[var(--soft-stone)]">Scheduled</p>
              <p className="font-medium text-[var(--warm-ink)]">{new Date(job.scheduledDate).toLocaleString()}</p>
              <StatusChip status={job.status} />
            </div>
          </div>
        </ClayCard>

        <ClayCard className="p-6">
          <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><p className="text-xs text-[var(--soft-stone)]">Address</p><p className="text-[var(--warm-ink)]">{job.address || 'Not provided'}</p></div>
            <div><p className="text-xs text-[var(--soft-stone)]">Notes</p><p className="text-[var(--warm-ink)]">{job.notes || 'None'}</p></div>
          </div>
        </ClayCard>

        {checkedInAt && (
          <ClayCard className="p-6">
            <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Check-In Status</h3>
            <p className="text-xs text-[var(--soft-stone)]">Checked In</p>
            <p className="text-[var(--warm-ink)] text-lg font-bold">{checkedInAt.toLocaleString()}</p>
            {checkedOutAt && <>
              <p className="text-xs text-[var(--soft-stone)] mt-3">Checked Out</p>
              <p className="text-[var(--warm-ink)] text-lg font-bold">{checkedOutAt.toLocaleString()}</p>
              <p className="text-xs text-[var(--soft-stone)] mt-3">Duration</p>
              <p className="text-[var(--warm-ink)] text-lg font-bold">{Math.floor((checkedOutAt.getTime() - checkedInAt.getTime()) / (1000 * 60))} min</p>
            </>}
          </ClayCard>
        )}

        {invoice && (
          <ClayCard className="p-6">
            <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Invoice</h3>
            <div className="flex justify-between">
              <span className="font-medium text-[var(--warm-ink)]">#{invoice.number}</span>
              <span className="text-sm text-[var(--soft-stone)]">{invoice.status}</span>
            </div>
            <p className="text-[var(--warm-ink)] text-lg font-bold mt-2">${invoice.subtotal?.toFixed(2) || 0}</p>
            <div className="mt-4"><Link to={`/contact/invoices/${invoice.id}`} className="bg-[var(--clay)] text-white px-4 py-2 rounded-full text-sm">View Invoice</Link></div>
          </ClayCard>
        )}
      </div>

      {showCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-[28px] w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Check In</h2>
            <p className="text-[var(--soft-stone)] mb-4">Confirm check-in?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCheckIn(false)} className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">Cancel</button>
              <button onClick={chkIn} className="bg-[var(--clay)] text-white px-4 py-2 rounded-full">Check In</button>
            </div>
          </div>
        </div>
      )}

      {showCheckOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-[28px] w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Check Out</h2>
            <p className="text-[var(--soft-stone)] mb-4">Complete this job?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCheckOut(false)} className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">Cancel</button>
              <button onClick={chkOut} className="bg-[var(--sage)] text-white px-4 py-2 rounded-full">Check Out</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
