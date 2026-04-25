import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { reservationService } from '../services/api';
import { format } from 'date-fns';
import {
  CalendarIcon, LinkIcon, PlusIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  CONFIRMED:  { label: 'Confirmed',  bg: 'rgba(16,185,129,0.12)', color: '#34d399', icon: <CheckCircleIcon className="h-4 w-4" /> },
  PENDING:    { label: 'Pending',    bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', icon: <ClockIcon className="h-4 w-4" /> },
  CANCELLED:  { label: 'Cancelled', bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', icon: <XCircleIcon className="h-4 w-4" /> },
  NO_SHOW:    { label: 'No-Show',   bg: 'rgba(239,68,68,0.12)',  color: '#f87171', icon: <ExclamationTriangleIcon className="h-4 w-4" /> },
};

export default function ReservationsPage() {
  const { data, isLoading } = useQuery(
    'user-reservations',
    () => reservationService.getUserReservations(),
    { refetchInterval: 30000 }
  );

  const reservations = data?.data?.reservations || [];

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', color: 'var(--color-text)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900" >My Reservations</h1>
            <p className="mt-1 text-sm text-slate-600" >View and manage your bookings</p>
          </div>
          <Link to="/reservations/new" className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto">
            <PlusIcon className="h-4 w-4" /> New Reservation
          </Link>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-600" >Loading reservations…</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && reservations.length === 0 && (
          <div className="rounded-2xl py-16 text-center"
            style={{ background: 'var(--color-surface-raised)', border: '1px dashed rgba(255,255,255,0.09)' }}>
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-slate-800" />
            <h3 className="text-lg font-bold mb-2 text-slate-900" >No reservations yet</h3>
            <p className="text-sm mb-6 text-slate-600" >
              Make your first booking to see it here.
            </p>
            <Link to="/reservations/new" className="btn-primary inline-flex items-center gap-2 text-sm">
              <PlusIcon className="h-4 w-4" /> Add Reservation
            </Link>
          </div>
        )}

        {/* List */}
        {!isLoading && reservations.length > 0 && (
          <div className="space-y-4">
            {reservations.map((r: any) => {
              const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
              return (
                <div key={r.id}
                  className="rounded-2xl p-5 sm:p-6 transition-all"
                  style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.13)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

                    {/* Left — business info */}
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: 'rgba(59,130,246,0.12)' }}>
                          <CalendarIcon className="h-5 w-5" style={{ color: '#60a5fa' }} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900" >
                            {r.business?.name || 'Business'}
                          </h3>
                          {r.business?.address && (
                            <p className="text-xs mt-0.5 text-slate-700" >{r.business.address}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {[
                          { label: 'Date', value: format(new Date(r.reservationDate), 'MMM d, yyyy') },
                          { label: 'Time', value: r.reservationTime },
                          { label: 'Guests', value: r.numberOfGuests },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-xl p-3"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-slate-800" >{label}</p>
                            <p className="text-sm font-bold text-slate-500" >{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right — status + actions */}
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 sm:gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                        style={{ background: status.bg, color: status.color }}>
                        {status.icon} {status.label}
                      </span>

                      {r.riskScore && (
                        <p className="text-xs text-slate-700" >Risk: {r.riskScore}</p>
                      )}

                      {r.transactionHash && (
                        <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                          style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                          <LinkIcon className="h-3 w-3" />
                          Tx: {r.transactionHash.slice(0, 6)}…{r.transactionHash.slice(-4)}
                        </div>
                      )}

                      {r.status === 'CONFIRMED' && (
                        <button className="text-xs font-semibold transition-colors mt-1"
                          style={{ color: '#f87171' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fca5a5'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}>
                          Cancel Booking
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
