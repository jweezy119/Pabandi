import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';

import { reservationService, popService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { Surface, Button, tokens } from '../design-system';
import ScreeningCard from '../components/ScreeningCard';

const STATUS_CONFIG: Record<string, { label: string; accent: string }> = {
  CONFIRMED: { label: 'Confirmed', accent: '#10b981' },
  PENDING: { label: 'Pending', accent: '#f59e0b' },
  CANCELLED: { label: 'Cancelled', accent: '#64748b' },
  NO_SHOW: { label: 'No-Show', accent: '#ef4444' },
  COMPLETED: { label: 'Completed', accent: '#818cf8' },
  PENDING_CONCIERGE: { label: 'Concierge Booking', accent: '#f59e0b' },
  FAILED_CONCIERGE: { label: 'Concierge Failed', accent: '#ef4444' },
};

const FILTER_TABS = [
  { value: '', label: 'Upcoming' },
  { value: 'PAST', label: 'Past' },
];

const DEPOSIT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PAID: { label: 'Deposit Paid', className: 'text-white/80' },
  PENDING: { label: 'Deposit Pending', className: 'text-white/80' },
  NOT_REQUIRED: { label: 'No Deposit', className: 'text-white/60' },
  APPLIED_TO_SERVICE: { label: 'Applied to Bill', className: 'text-white/80' },
  REIMBURSED_TO_BUSINESS: { label: 'Reimbursed', className: 'text-white/80' },
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

  const allReservations = data?.data?.data?.reservations || data?.data?.reservations || [];

  const reservations = allReservations.filter((r: any) => {
    if (!statusFilter) {
      return ['PENDING', 'CONFIRMED', 'PENDING_CONCIERGE'].includes(r.status);
    }
    return ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'FAILED_CONCIERGE'].includes(r.status);
  });

  const cancelMutation = useMutation(
    (id: string) => reservationService.cancelReservation(id),
    {
      onSuccess: () => qc.invalidateQueries('user-reservations'),
      onError: (err: any) => alert(err?.response?.data?.message || 'Cancel failed.'),
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
    <div className="min-h-screen flex flex-col" style={{ background: tokens.color.background, color: tokens.color.text, fontFamily: tokens.font.body }}>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 md:mb-8">
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="font-headline text-[2rem] font-bold tracking-tight text-white">My Bookings</h2>
          <p className="text-sm text-white/70">Manage upcoming reservations and review past appointments.</p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1.5 sm:w-auto">
            {FILTER_TABS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`flex-1 whitespace-nowrap rounded-lg px-6 py-3 text-sm font-bold transition-all sm:flex-none sm:py-2.5 ${
                  statusFilter === f.value ? 'bg-white/15 text-white shadow-sm shadow-white/10' : 'text-white/70 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Link to="/reservations/new" className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-center font-bold text-white shadow-sm transition-opacity hover:opacity-90 sm:w-auto">
            New Booking
          </Link>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-20">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
            <span className="text-sm text-white/70">Loading reservations…</span>
          </div>
        )}

        {!isLoading && reservations.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 py-16 text-center">
            <div className="mx-auto mb-4 text-4xl">📅</div>
            <h3 className="mb-2 text-lg font-bold text-white">
              {statusFilter ? 'No past reservations' : 'No upcoming reservations'}
            </h3>
            <p className="mx-auto mb-6 max-w-md text-sm text-white/70">
              {statusFilter ? 'You have no completed or cancelled bookings.' : 'Make your first booking to see it here.'}
            </p>
            <Link to="/reservations/new" className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">Add Reservation</Link>
          </div>
        )}

        {!isLoading && reservations.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {reservations.map((r: any) => {
              const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
              const deposit = DEPOSIT_STATUS_LABELS[r.depositStatus] || DEPOSIT_STATUS_LABELS.NOT_REQUIRED;
              return (
                <Surface key={r.id} className="flex flex-col gap-5">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="inline-flex w-fit items-center gap-2 rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white" style={{ background: `${status.accent}25`, color: status.accent, border: `1px solid ${status.accent}40` }}>
                        {status.label}
                      </div>
                      <h3 className="font-headline text-lg font-bold leading-snug text-white" title={r.business?.name || 'Business'}>
                        {r.business?.name || 'Business'}
                      </h3>
                      <p className="line-clamp-1 text-sm text-white/70">{r.business?.address || 'Location Details'}</p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/60">
                      🏪
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg bg-white/5 p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📅</span>
                      <span className="text-sm font-medium text-white">
                        {format(new Date(r.reservationDate), 'EEEE, d MMM yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">🕒</span>
                        <span className="text-sm font-medium text-white">{r.reservationTime}</span>
                      </div>
                      <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs font-bold text-white/80">
                        👥 {r.numberOfGuests}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold ${deposit.className}`}>
                      🛡️ {deposit.label} {r.depositAmount ? `($${r.depositAmount.toLocaleString()})` : ''}
                    </span>
                    {r.riskScore != null && (
                      <span className={`inline-flex items-center rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold ${r.riskScore >= 50 ? 'text-red-300' : 'text-white/80'}`}>
                        Risk: {r.riskScore}%
                      </span>
                    )}
                  </div>

                  <ScreeningCard reservationId={r.id} />

                  {(r.status === 'CONFIRMED' || r.status === 'PENDING') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Cancel your reservation at ${r.business?.name || 'this business'}?`)) {
                          cancelMutation.mutate(r.id);
                        }
                      }}
                      disabled={cancelMutation.isLoading}
                    >
                      {cancelMutation.isLoading ? 'Cancelling...' : 'Cancel Booking'}
                    </Button>
                  )}

                  {r.status === 'CONFIRMED' && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => popService.recordIntent({ userId: user?.id || '', reservationId: r.id, businessId: r.businessId })}
                      >
                        On my way
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => popService.recordArrived({ userId: user?.id || '', reservationId: r.id, businessId: r.businessId })}
                      >
                        Arrived
                      </Button>
                    </div>
                  )}

                  {isBusinessOwner && r.status === 'CONFIRMED' && (
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        onClick={() => {
                          if (confirm('Mark this reservation as completed?')) {
                            completeMutation.mutate(r.id);
                          }
                        }}
                        disabled={completeMutation.isLoading}
                      >
                        Complete
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (confirm('Mark as no-show?')) {
                            noShowMutation.mutate(r.id);
                          }
                        }}
                        disabled={noShowMutation.isLoading}
                      >
                        No-Show
                      </Button>
                    </div>
                  )}
                </Surface>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
