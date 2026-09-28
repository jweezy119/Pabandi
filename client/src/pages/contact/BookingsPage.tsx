import React, { useState, useEffect } from 'react';
import { FiFilter, FiCheck, FiX, FiClock, FiUser, FiAlertCircle, FiMoreVertical, FiEdit } from 'react-icons/fi';
import apiClient from '@/services/api';
import { Surface, Button, Chip, tokens } from '@/design-system';
import toast from 'react-hot-toast';

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'attended' | 'no_show' | 'cancelled';

interface Booking {
  id: string;
  slotStart: string;
  slotEnd: string;
  serviceType: string;
  status: string;
  depositAmount: number;
  depositStatus: string;
  client?: { id: string; name: string; email: string; phone: string };
  job?: { id: string; status: string };
  metadata?: any;
}

export default function BookingsManagementPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadBookings();
  }, [filter, page]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const businessId = localStorage.getItem('businessId');
      const res = await apiClient.get(`/api/v1/bookings/public/business/${businessId}?status=${filter}&page=${page}&limit=20`);
      if (res.data.success) {
        setBookings(res.data.data);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (e) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (bookingId: string, action: 'confirm' | 'cancel' | 'attend' | 'no-show') => {
    setActionLoading(bookingId);
    try {
      let endpoint = '';
      switch (action) {
        case 'confirm': endpoint = 'confirm'; break;
        case 'cancel': endpoint = 'cancel'; break;
        case 'attend': endpoint = 'attend'; break;
        case 'no-show': endpoint = 'no-show'; break;
      }
      await apiClient.post(`/api/v1/bookings/public/${bookingId}/${endpoint}`);
      toast.success(`Booking ${action}d`);
      loadBookings();
    } catch (e: any) {
      toast.error(e.response?.data?.error || `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'confirmed': return 'info';
      case 'attended': return 'success';
      case 'no_show': return 'danger';
      case 'cancelled': return 'neutral';
      default: return 'neutral';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--warm-ink)]">Bookings</h1>
          <p className="text-[var(--soft-stone)] mt-1">Manage all bookings from your public booking page</p>
        </div>
      </div>

      {/* Filters */}
      <Surface className="p-4">
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'confirmed', 'attended', 'no_show', 'cancelled'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                filter === f
                  ? 'bg-[var(--clay)]/15 text-[var(--clay)] border border-[var(--clay)]/30'
                  : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.3)] hover:bg-[var(--warm-sand)]'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
            </button>
          ))}
        </div>
      </Surface>

      {/* Bookings List */}
      <Surface className="p-0">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--clay)] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-[var(--soft-stone)]">Loading bookings...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center">
            <FiClock className="w-12 h-12 text-[var(--soft-stone)]/30 mx-auto mb-4" />
            <p className="text-[var(--soft-stone)]">No bookings found</p>
          </div>
        ) : (
          <div className="divide-y divide-[rgba(191,179,163,0.2)]">
            {bookings.map(booking => (
              <div key={booking.id} className="p-4 hover:bg-[var(--warm-sand)]/20 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <span className="font-semibold text-[var(--warm-ink)]">{booking.serviceType}</span>
                      <Chip label={booking.status.replace('_', ' ')} variant={getStatusColor(booking.status) as any} size="sm" />
                      {booking.depositAmount > 0 && booking.depositStatus === 'required' && (
                        <Chip label="Deposit Required" variant="warning" size="sm" />
                      )}
                      {booking.depositStatus === 'funded' && (
                        <Chip label="Deposit Paid" variant="success" size="sm" />
                      )}
                    </div>
                    <div className="text-sm text-[var(--soft-stone)] flex flex-wrap gap-4">
                      <span className="flex items-center gap-1"><FiClock className="w-3.5 h-3.5" /> {formatDate(booking.slotStart)}</span>
                      {booking.client && (
                        <span className="flex items-center gap-1"><FiUser className="w-3.5 h-3.5" /> {booking.client.name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:ml-4">
                    {booking.status === 'pending' && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => handleAction(booking.id, 'confirm')} disabled={actionLoading === booking.id}>
                          Confirm
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleAction(booking.id, 'cancel')} disabled={actionLoading === booking.id} className="text-[var(--terracotta)]">
                          Cancel
                        </Button>
                      </>
                    )}
                    {booking.status === 'confirmed' && (
                      <>
                        <Button variant="primary" size="sm" onClick={() => handleAction(booking.id, 'attend')} disabled={actionLoading === booking.id}>
                          <FiCheck className="w-3.5 h-3.5 mr-1" /> Attended
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleAction(booking.id, 'no-show')} disabled={actionLoading === booking.id} className="text-[var(--terracotta)]">
                          <FiAlertCircle className="w-3.5 h-3.5 mr-1" /> No-Show
                        </Button>
                      </>
                    )}
                    {booking.status === 'attended' && (
                      <Chip label="Completed" variant="success" size="sm" />
                    )}
                    {booking.status === 'cancelled' && (
                      <Chip label="Cancelled" variant="neutral" size="sm" />
                    )}
                    {booking.status === 'no_show' && (
                      <Chip label="No-Show" variant="danger" size="sm" />
                    )}
                  </div>
                </div>

                {booking.client && (
                  <div className="mt-3 pt-3 border-t border-[rgba(191,179,163,0.2)] text-sm text-[var(--soft-stone)]">
                    <span className="font-medium text-[var(--warm-ink)]">{booking.client.email}</span>
                    {booking.client.phone && (
                      <> <span className="mx-2">·</span> <span>{booking.client.phone}</span> </>
                    )}
                    {booking.metadata?.notes && (
                      <> <span className="mx-2">·</span> <span className="italic">"{booking.metadata.notes}"</span> </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 flex items-center justify-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <span className="text-sm text-[var(--soft-stone)]">Page {page} of {totalPages}</span>
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        )}
      </Surface>
    </div>
  );
}