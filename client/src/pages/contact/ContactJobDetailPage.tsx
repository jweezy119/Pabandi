import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { TrustPanel } from '../../components/TrustPanel';
import { getAuthToken } from '../../utils/authToken';

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
    held: 'bg-[var(--warm-sand)]/20 text-[var(--warm-sand)]',
    released: 'bg-[var(--sage)]/20 text-[var(--sage)]',
    disputed: 'bg-[var(--dusty-rose)]/20 text-[var(--dusty-rose)]',
  };
  const c = colors[status.toLowerCase()] || 'bg-[var(--soft-stone)]/20 text-[var(--soft-stone)]';
  return <span className={`${c} px-2 py-0.5 rounded-full text-xs font-medium capitalize`}>{status}</span>;
}

/**
 * The three escrow states trust-core writes, with the plain-English consequence.
 *
 * `HELD` is the one that matters commercially and it was invisible: money is in
 * escrow, nobody has had it, and the job looks ordinary. A hint says so, rather than
 * leaving the reader to infer from a badge.
 */
const ESCROW_LABELS: Record<string, { label: string; status: string; hint?: string }> = {
  HELD: {
    label: 'Money held in escrow',
    status: 'held',
    hint: 'The client has paid but it has not been released to you yet. It releases when the job completes.',
  },
  RELEASED: {
    label: 'Escrow released',
    status: 'released',
    hint: 'Funds have been released to you.',
  },
  DISPUTED: {
    label: 'Escrow disputed',
    status: 'disputed',
    hint: 'The client disputed this job, so the funds are frozen. This counts against their trust score until it is resolved.',
  },
  REFUNDED: {
    label: 'Escrow refunded',
    status: 'released',
    // Worth stating what a refund did to their record. getClientStage reads REFUNDED to
    // mark a client at_risk, so "money went back to the client" and "this now counts
    // against them" are the same event and only one of them was visible.
    hint: 'The money was returned to the client. This counts against their trust score unless the dispute is resolved in their favour.',
  },
};

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
    if (!id || id === 'new') {
      setLoading(false);
      return;
    }
    setLoading(true);
    const h = { Authorization: `Bearer ${getAuthToken()}` };
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ status: 'cancelled' }),
    }).catch(console.error);
    setJob((p: any) => ({ ...p, status: 'cancelled' }));
  };

  const delJob = async () => {
    if (!confirm('Delete this job? This cannot be undone.')) return;
    const API = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    await fetch(`${API}/api/v1/crm/jobs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getAuthToken()}` } }).catch(console.error);
    navigate('/contact/jobs');
  };

  if (loading) return <DashboardLayout osName="Contact OS" osIcon="C" osColor="#C97B5A" ><div className="p-8 text-center text-[var(--soft-stone)]">Loading job details...</div></DashboardLayout>;
  
  if (id === 'new') {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="#C97B5A" >
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-[var(--warm-ink)]">New Deal</h1>
            <Link to="/contact/deals" className="text-sm text-[var(--terracotta)]">← Back to Deals</Link>
          </div>
          <ClayCard className="p-6">
            <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Deal Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--soft-stone)] mb-1">Deal Title / Service</label>
                <input id="new-deal-svc" type="text" placeholder="e.g. Website Redesign" className="w-full rounded-xl bg-[var(--warm-sand)]/20 border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)] transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--soft-stone)] mb-1">Deal Value ($)</label>
                <input id="new-deal-price" type="number" placeholder="0.00" className="w-full rounded-xl bg-[var(--warm-sand)]/20 border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)] transition" />
              </div>
              <button 
                onClick={async () => {
                  const svc = (document.getElementById('new-deal-svc') as HTMLInputElement).value;
                  const price = parseFloat((document.getElementById('new-deal-price') as HTMLInputElement).value || '0');
                  const API = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
                  await fetch(`${API}/api/v1/crm/jobs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
                    body: JSON.stringify({ serviceType: svc || 'New Deal', price, status: 'PENDING' }),
                  });
                  navigate('/contact/deals');
                }}
                className="w-full bg-[var(--clay)] text-white px-4 py-3 rounded-xl font-bold hover:opacity-90 transition mt-4"
              >
                Create Deal
              </button>
            </div>
          </ClayCard>
        </div>
      </DashboardLayout>
    );
  }

  if (!job) return <DashboardLayout osName="Contact OS" osIcon="C" osColor="#C97B5A" ><div className="p-8 text-center text-[var(--soft-stone)]">Job not found</div></DashboardLayout>;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="#C97B5A" >
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

        {client && (
          <TrustPanel passportId={client.passportId} />
        )}
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

            {/* Where they actually were.
                checkin.routes records coordinates, the distance from the venue and
                whether the geofence passed, and none of it was rendered anywhere. A
                business disputing a no-show has no way to answer "were they really
                there?" without it — which is precisely the question this row exists
                to settle. */}
            <div className="mt-4 pt-4 border-t border-[var(--soft-stone)]/20">
              <p className="text-xs text-[var(--soft-stone)]">Location</p>
              {job.checkinLat != null && job.checkinLng != null ? (
                <>
                  <p className="text-[var(--warm-ink)] font-medium">
                    {job.locationVerified
                      ? 'Verified at the job location'
                      : 'Checked in, but outside the geofence'}
                  </p>
                  <p className="text-xs text-[var(--soft-stone)] mt-1">
                    {job.locationVerified
                      ? `${job.checkinDistanceM?.toFixed(0)} m from the recorded address`
                      : `${job.checkinDistanceM?.toFixed(0) ?? '?'} m away — treat this job as unverified`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--soft-stone)]">No location recorded</p>
              )}
            </div>
          </ClayCard>
        )}

        {/* Escrow.
            trust-core writes HELD / RELEASED / DISPUTED here from the escrow events
            and nothing ever displayed it, so a business whose money was sitting in
            escrow had no way to see it, and a DISPUTED job looked identical to any
            other. DISPUTED in particular feeds getClientStage's at_risk verdict, so
            this is the evidence behind a client being marked at_risk.

            Now that the chain is live this panel has something to show for the first
            time — escrowStatus was previously unreachable, and every one of these
            states was unreachable too.

            The vocabulary here is deliberately four words long. The settlement rail is
            chosen inside the service and never crosses this boundary, so a business
            holding money for a client who has never heard of a wallet sees exactly the
            same panel as one whose client prefers USDC. On-chain detail exists and is
            reachable, but it is not what this screen leads with. */}
        {job.escrowStatus && job.escrowStatus !== 'NONE' && (
          <ClayCard className="p-6">
            <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Escrow</h3>
            <div className="flex items-center justify-between">
              <span className="text-[var(--warm-ink)] font-medium">
                {ESCROW_LABELS[job.escrowStatus]?.label ?? job.escrowStatus}
              </span>
              <StatusChip status={ESCROW_LABELS[job.escrowStatus]?.status ?? job.escrowStatus} />
            </div>
            {ESCROW_LABELS[job.escrowStatus]?.hint && (
              <p className="text-sm text-[var(--soft-stone)] mt-2">
                {ESCROW_LABELS[job.escrowStatus].hint}
              </p>
            )}
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
