import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { reservationService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import {
  CalendarIcon, LinkIcon, PlusIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon, ExclamationTriangleIcon,
  FunnelIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  CONFIRMED:  { label: 'Confirmed',  bg: 'rgba(16,185,129,0.12)', color: '#34d399', icon: <CheckCircleIcon className="h-4 w-4" /> },
  PENDING:    { label: 'Pending',    bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', icon: <ClockIcon className="h-4 w-4" /> },
  CANCELLED:  { label: 'Cancelled', bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', icon: <XCircleIcon className="h-4 w-4" /> },
  NO_SHOW:    { label: 'No-Show',   bg: 'rgba(239,68,68,0.12)',  color: '#f87171', icon: <ExclamationTriangleIcon className="h-4 w-4" /> },
  COMPLETED:  { label: 'Completed', bg: 'rgba(52,211,153,0.12)', color: '#34d399', icon: <CheckCircleIcon className="h-4 w-4" /> },
};

const FILTER_TABS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NO_SHOW', label: 'No-Show' },
];

const DEPOSIT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PAID: { label: 'Deposit Paid', color: '#34d399' },
  PENDING: { label: 'Deposit Pending', color: '#fbbf24' },
  NOT_REQUIRED: { label: 'No Deposit', color: '#94a3b8' },
  APPLIED_TO_SERVICE: { label: 'Applied to Bill', color: '#60a5fa' },
  REIMBURSED_TO_BUSINESS: { label: 'Reimbursed', color: '#a78bfa' },
};

export default function ReservationsPage() {
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery(
    ['user-reservations', statusFilter],
    () => reservationService.getUserReservations(statusFilter ? { status: statusFilter } : undefined),
    { refetchInterval: 30000 }
  );

  const reservations = data?.data?.data?.reservations || data?.data?.reservations || [];

  // Mutations
  const cancelMutation = useMutation(
    (id: string) => reservationService.cancelReservation(id),
    {
      onSuccess: () => qc.invalidateQueries('user-reservations'),
      onError: (err: any) => alert(err?.response?.data?.message || 'Cancel failed. Check the cancellation policy.'),
    }
  );

  const completeMutation = useMutation(
    (id: string) => reservationService.completeReservation(id),
    { onSuccess: () => qc.invalidateQueries('user-reservations') }
  );

  const noShowMutation = useMutation(
    (id: string) => reservationService.markNoShow(id),
    { onSuccess: () => qc.invalidateQueries('user-reservations') }
  );

  const isBusinessOwner = user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN';

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', color: 'var(--color-text)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900" >My Reservations</h1>
            <p className="mt-1 text-sm text-slate-600" >View and manage your bookings</p>
          </div>
          <Link to="/reservations/new" className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto">
            <PlusIcon className="h-4 w-4" /> New Reservation
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <FunnelIcon className="h-4 w-4 text-slate-500" />
          {FILTER_TABS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: statusFilter === f.value
                  ? (STATUS_CONFIG[f.value]?.bg || 'rgba(59,130,246,0.15)')
                  : 'rgba(255,255,255,0.04)',
                color: statusFilter === f.value
                  ? (STATUS_CONFIG[f.value]?.color || '#60a5fa')
                  : '#5a7490',
                border: `1px solid ${statusFilter === f.value ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              {f.label}
            </button>
          ))}
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
            <h3 className="text-lg font-bold mb-2 text-slate-900" >
              {statusFilter ? `No ${STATUS_CONFIG[statusFilter]?.label || statusFilter} reservations` : 'No reservations yet'}
            </h3>
            <p className="text-sm mb-6 text-slate-600" >
              {statusFilter ? 'Try a different filter or make a new booking.' : 'Make your first booking to see it here.'}
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
              const deposit = DEPOSIT_STATUS_LABELS[r.depositStatus] || DEPOSIT_STATUS_LABELS.NOT_REQUIRED;
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
                    <div className="flex flex-col items-end gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                        style={{ background: status.bg, color: status.color }}>
                        {status.icon} {status.label}
                      </span>

                      {/* Risk Score */}
                      {r.riskScore != null && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                          style={{
                            background: r.riskScore >= 50 ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.12)',
                            color: r.riskScore >= 50 ? '#f87171' : '#fbbf24',
                          }}>
                          Risk: {r.riskScore}%
                        </span>
                      )}

                      {/* Deposit Status */}
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"
                        style={{ background: 'rgba(255,255,255,0.04)', color: deposit.color }}>
                        <ShieldCheckIcon className="h-3 w-3" />
                        {deposit.label}
                        {r.depositAmount ? ` · PKR ${r.depositAmount.toLocaleString()}` : ''}
                      </span>

                      {/* Crypto tx hash */}
                      {r.cryptoDepositTxHash && (
                        <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                          style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                          <LinkIcon className="h-3 w-3" />
                          Tx: {r.cryptoDepositTxHash.slice(0, 6)}…{r.cryptoDepositTxHash.slice(-4)}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-1">
                        {/* Cancel — customer can cancel CONFIRMED or PENDING */}
                        {(r.status === 'CONFIRMED' || r.status === 'PENDING') && (
                          <button
                            disabled={cancelMutation.isLoading}
                            onClick={() => {
                              if (confirm(`Cancel your reservation at ${r.business?.name || 'this business'}?\n\nNote: Late cancellations may affect your reliability score.`)) {
                                cancelMutation.mutate(r.id);
                              }
                            }}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                            style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                            {cancelMutation.isLoading ? 'Cancelling...' : 'Cancel Booking'}
                          </button>
                        )}

                        {/* Business owner actions */}
                        {isBusinessOwner && (r.status === 'CONFIRMED' || r.status === 'PENDING') && (
                          <>
                            <button
                              disabled={completeMutation.isLoading}
                              onClick={() => {
                                if (confirm('Mark this reservation as completed?')) {
                                  completeMutation.mutate(r.id);
                                }
                              }}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                              style={{ color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}>
                              ✓ Complete
                            </button>
                            <button
                              disabled={noShowMutation.isLoading}
                              onClick={() => {
                                if (confirm('Mark as no-show? The deposit will be captured for business protection.')) {
                                  noShowMutation.mutate(r.id);
                                }
                              }}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                              style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                              ✕ No-Show
                            </button>
                          </>
                        )}
                      </div>
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
