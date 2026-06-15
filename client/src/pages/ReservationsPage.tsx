import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';

import { reservationService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import {
  ClockIcon,
  CalendarIcon, PlusIcon,
  CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon,
  ShieldCheckIcon, EllipsisVerticalIcon
} from '@heroicons/react/24/outline';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; accent: string; icon: React.ReactNode }> = {
  CONFIRMED:  { label: 'Confirmed',  bg: 'bg-tertiary-fixed', color: 'text-on-tertiary-fixed-variant', accent: 'bg-tertiary-fixed-dim', icon: <CheckCircleIcon className="h-4 w-4" /> },
  PENDING:    { label: 'Pending',    bg: 'bg-secondary-container', color: 'text-on-secondary-fixed-variant', accent: 'bg-secondary-container', icon: <ClockIcon className="h-4 w-4" /> },
  CANCELLED:  { label: 'Cancelled', bg: 'bg-surface-container-highest', color: 'text-on-surface-variant', accent: 'bg-surface-container-high', icon: <XCircleIcon className="h-4 w-4" /> },
  NO_SHOW:    { label: 'No-Show',   bg: 'bg-error-container',  color: 'text-on-error-container', accent: 'bg-error', icon: <ExclamationTriangleIcon className="h-4 w-4" /> },
  COMPLETED:  { label: 'Completed', bg: 'bg-primary-container', color: 'text-on-primary-container', accent: 'bg-primary', icon: <CheckCircleIcon className="h-4 w-4" /> },
  PENDING_CONCIERGE: { label: 'Concierge Booking', bg: 'bg-amber-500/20', color: 'text-amber-600', accent: 'bg-amber-500', icon: <ClockIcon className="h-4 w-4 animate-pulse" /> },
  FAILED_CONCIERGE: { label: 'Concierge Failed', bg: 'bg-error-container', color: 'text-on-error-container', accent: 'bg-error', icon: <XCircleIcon className="h-4 w-4" /> },
};

const FILTER_TABS = [
  { value: '', label: 'Upcoming' },
  { value: 'PAST', label: 'Past' },
];

const DEPOSIT_STATUS_LABELS: Record<string, { label: string; colorClass: string }> = {
  PAID: { label: 'Deposit Paid', colorClass: 'text-tertiary' },
  PENDING: { label: 'Deposit Pending', colorClass: 'text-secondary' },
  NOT_REQUIRED: { label: 'No Deposit', colorClass: 'text-outline' },
  APPLIED_TO_SERVICE: { label: 'Applied to Bill', colorClass: 'text-primary' },
  REIMBURSED_TO_BUSINESS: { label: 'Reimbursed', colorClass: 'text-primary' },
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
  
  // Quick hack to filter upcoming vs past based on tab, since backend might not do it properly via status
  const reservations = allReservations.filter((r: any) => {
    if (!statusFilter) {
      // Upcoming: Pending, Confirmed, Concierge Processing
      return ['PENDING', 'CONFIRMED', 'PENDING_CONCIERGE'].includes(r.status);
    } else {
      // Past: Completed, Cancelled, No-Show, Concierge Failed
      return ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'FAILED_CONCIERGE'].includes(r.status);
    }
  });

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
    <div className="bg-surface min-h-screen text-on-surface flex flex-col">
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-24 md:mb-8 flex flex-col gap-10">
        
        {/* Page Header */}
        <div className="flex flex-col gap-2">
          <h2 className="font-headline text-[2rem] font-bold text-primary tracking-tight leading-tight">My Bookings</h2>
          <p className="font-body text-on-surface-variant text-sm">Manage your upcoming reservations and review past appointments.</p>
        </div>

        {/* Filter/Tabs */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="bg-surface-container-low p-1.5 rounded-lg flex inline-flex w-full md:w-auto self-start">
            {FILTER_TABS.map(f => (
              <button key={f.value} onClick={() => setStatusFilter(f.value)}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-md font-body text-sm font-medium transition-all ${
                  statusFilter === f.value 
                  ? 'bg-surface-container-lowest text-primary shadow-sm shadow-primary/5' 
                  : 'text-on-surface-variant hover:text-primary'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          <Link to="/reservations/new" className="bg-primary text-on-primary font-body text-sm font-medium px-5 py-2.5 rounded-md flex items-center gap-2 hover:opacity-90 transition-opacity shadow-sm self-start sm:self-auto w-full sm:w-auto justify-center">
            <PlusIcon className="h-4 w-4" /> New Booking
          </Link>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 gap-3">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="font-body text-sm text-on-surface-variant" >Loading reservations…</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && reservations.length === 0 && (
          <div className="rounded-2xl py-16 text-center bg-surface-container-lowest border border-dashed border-outline-variant/50">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-outline" />
            <h3 className="font-headline text-lg font-bold mb-2 text-on-surface" >
              {statusFilter ? 'No past reservations' : 'No upcoming reservations'}
            </h3>
            <p className="font-body text-sm mb-6 text-on-surface-variant" >
              {statusFilter ? 'You have no completed or cancelled bookings.' : 'Make your first booking to see it here.'}
            </p>
            <Link to="/reservations/new" className="bg-primary text-on-primary px-5 py-2.5 rounded-md inline-flex items-center gap-2 font-body text-sm font-medium hover:opacity-90 transition-opacity">
              <PlusIcon className="h-4 w-4" /> Add Reservation
            </Link>
          </div>
        )}

        {/* Grid List */}
        {!isLoading && reservations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {reservations.map((r: any) => {
              const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
              const deposit = DEPOSIT_STATUS_LABELS[r.depositStatus] || DEPOSIT_STATUS_LABELS.NOT_REQUIRED;
              return (
                <div key={r.id} className="bg-surface-container-lowest rounded-xl p-6 flex flex-col gap-5 relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
                  
                  {/* Status Bar Accent */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${status.accent} rounded-l-xl`}></div>
                  
                  {/* Top: Info */}
                  <div className="flex justify-between items-start pl-2">
                    <div className="flex flex-col gap-1 flex-1 pr-3">
                      <span className={`${status.bg} ${status.color} font-label text-[11px] font-semibold px-2 py-0.5 rounded-DEFAULT w-max tracking-wide uppercase`}>
                        {status.label}
                      </span>
                      <h3 className="font-headline text-lg font-bold text-primary mt-1 line-clamp-1" title={r.business?.name || 'Business'}>
                        {r.business?.name || 'Business'}
                      </h3>
                      <p className="font-body text-sm text-on-surface-variant line-clamp-1">{r.business?.address || 'Location Details'}</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-container-low shrink-0 flex items-center justify-center text-primary/40">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>storefront</span>
                    </div>
                  </div>

                  {/* Middle: Date/Time */}
                  <div className="flex flex-col gap-3 bg-surface-container-low p-4 rounded-lg pl-6">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px]">calendar_today</span>
                      <span className="font-body text-sm font-medium text-primary">
                        {format(new Date(r.reservationDate), 'EEEE, d MMM yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">schedule</span>
                        <span className="font-body text-sm font-medium text-primary">{r.reservationTime}</span>
                      </div>
                      <div className="flex items-center gap-1 font-body text-xs font-semibold bg-surface-container-lowest px-2 py-1 rounded text-on-surface-variant shadow-sm border border-outline-variant/10">
                        <span className="material-symbols-outlined text-[14px]">group</span> {r.numberOfGuests}
                      </div>
                    </div>
                  </div>

                  {/* Additional Context */}
                  <div className="flex flex-wrap gap-2 pl-2">
                     <span className={`font-label text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 bg-surface-container ${deposit.colorClass}`}>
                      <ShieldCheckIcon className="h-3.5 w-3.5" />
                      {deposit.label} {r.depositAmount ? `(PKR ${r.depositAmount.toLocaleString()})` : ''}
                    </span>
                    {r.riskScore != null && (
                      <span className={`font-label text-[10px] font-bold px-2 py-1 rounded-full bg-surface-container ${r.riskScore >= 50 ? 'text-error' : 'text-secondary'}`}>
                        Risk: {r.riskScore}%
                      </span>
                    )}
                  </div>

                  {/* Concierge Agent Dynamic Activity Logs */}
                  {r.isConcierge && r.status === 'PENDING_CONCIERGE' && (
                    <div className="bg-amber-500/5 border border-dashed border-amber-500/20 p-4 rounded-lg flex flex-col gap-2 mt-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                        <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin shrink-0" />
                        Pabandi Agent Concierge is booking...
                      </div>
                      <p className="text-[10px] text-on-surface-variant font-body leading-relaxed text-left">
                        Securing your table on external platforms. Your confirmation details will appear shortly.
                      </p>
                    </div>
                  )}

                  {r.isConcierge && r.status === 'CONFIRMED' && r.conciergeDetails && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-lg flex flex-col gap-2 mt-1 text-left">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-600">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-emerald-600">smart_toy</span>
                          Secured by Pabandi Agent
                        </span>
                        <span className="bg-emerald-500/25 px-2 py-0.5 rounded text-[9px] uppercase tracking-wide">
                          {r.conciergeDetails.externalConfirmationCode}
                        </span>
                      </div>
                      <div className="text-[10px] text-on-surface-variant font-body leading-relaxed space-y-1 bg-surface-container-low p-2 rounded border border-outline-variant/10">
                        {r.conciergeDetails.timeline?.map((step: string, idx: number) => (
                          <div key={idx} className="flex gap-1">
                            <span className="text-emerald-500 shrink-0 font-bold">✓</span>
                            <span>{step.replace(/^\[.*?\]\s*/, '')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-on-surface-variant font-body pt-1.5 border-t border-emerald-500/10">
                        <span>External Code: <strong>{r.conciergeDetails.externalConfirmationCode}</strong></span>
                        <a href={r.conciergeDetails.receiptPdfUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold flex items-center gap-0.5">
                          Receipt PDF <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {r.isConcierge && r.status === 'FAILED_CONCIERGE' && (
                    <div className="bg-error-container/10 border border-error/20 p-4 rounded-lg flex flex-col gap-2 mt-1 text-left">
                      <div className="flex items-center gap-2 text-xs font-bold text-error">
                        <span className="material-symbols-outlined text-[18px]">error</span>
                        Concierge Booking Failed
                      </div>
                      <p className="text-[10px] text-on-error-container font-body leading-relaxed">
                        {r.conciergeDetails?.error || 'External slots became fully booked or request was rejected.'}
                      </p>
                    </div>
                  )}

                  {/* Bottom: Actions */}
                  <div className="flex items-center gap-3 mt-auto pt-2 pl-2">
                     {/* For regular users, mostly view details or cancel */}
                     {(r.status === 'CONFIRMED' || r.status === 'PENDING' || r.status === 'PENDING_CONCIERGE') ? (
                       <button 
                         disabled={cancelMutation.isLoading}
                         onClick={() => {
                           if (confirm(`Cancel your reservation at ${r.business?.name || 'this business'}?\n\nCancellation Policy:\n- >24 hours: 100% Refund\n- 2-24 hours: 50% Refund\n- <2 hours: No Refund (0%)\n\nNote: Late cancellations may also affect your reliability score.`)) {
                             cancelMutation.mutate(r.id);
                           }
                         }}
                         className="flex-1 bg-transparent border border-outline-variant/40 text-error font-body text-sm font-medium py-2.5 rounded-md hover:bg-error-container transition-colors disabled:opacity-50 text-center">
                         {cancelMutation.isLoading ? 'Cancelling...' : 'Cancel Booking'}
                       </button>
                     ) : (
                       <Link to={`/business/${r.businessId}`} className="flex-1 bg-gradient-to-r from-primary to-primary-container text-on-primary font-body text-sm font-medium py-2.5 rounded-md hover:opacity-90 transition-opacity text-center block">
                         Book Again
                       </Link>
                     )}

                     {/* Business Owner Actions */}
                     {isBusinessOwner && (r.status === 'CONFIRMED' || r.status === 'PENDING') && (
                        <div className="flex gap-2">
                           <button 
                             disabled={completeMutation.isLoading}
                             onClick={() => {
                               if (confirm('Mark this reservation as completed?')) completeMutation.mutate(r.id);
                             }}
                             className="w-10 h-10 border border-outline-variant/30 text-tertiary rounded-md flex items-center justify-center hover:bg-tertiary-container transition-colors" title="Complete Booking">
                             <CheckCircleIcon className="h-5 w-5" />
                           </button>
                           <button 
                             disabled={noShowMutation.isLoading}
                             onClick={() => {
                               if (confirm('Mark as no-show? The deposit will be captured.')) noShowMutation.mutate(r.id);
                             }}
                             className="w-10 h-10 border border-outline-variant/30 text-error rounded-md flex items-center justify-center hover:bg-error-container transition-colors" title="Mark No-Show">
                             <XCircleIcon className="h-5 w-5" />
                           </button>
                        </div>
                     )}
                     
                     {/* More options button (placeholder) */}
                     {!isBusinessOwner && (
                       <button className="w-10 h-10 border border-outline-variant/30 text-primary rounded-md flex items-center justify-center hover:bg-surface-variant transition-colors">
                         <EllipsisVerticalIcon className="h-5 w-5" />
                       </button>
                     )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
