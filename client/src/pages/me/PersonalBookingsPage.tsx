import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthToken } from '../../utils/authToken';
import { ClayCard } from '../../components/clay/ClayCard';

interface BookingRecord {
  id: string;
  serviceType?: string;
  slotStart: string;
  slotEnd?: string;
  status: string;
  depositAmount?: number;
  depositPaid?: boolean;
  depositStatus?: string;
  business?: {
    id: string;
    name: string;
    slug?: string;
    city?: string;
    address?: string;
    category?: string;
    logoUrl?: string;
  };
}

export default function PersonalBookingsPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchBookings = async () => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `${import.meta.env.VITE_API_URL || 'https://api.pabandi.com'}/api/v1/bookings/my-bookings`,
          { headers }
        );
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setBookings(json.data || []);
          }
        }
      } catch (e) {
        console.error('Failed to load personal bookings:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchBookings();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto py-8">
        <h1 className="text-2xl font-extrabold" style={{ color: 'var(--warm-ink)' }}>
          My Bookings & Escrows
        </h1>
        <div className="p-12 text-center text-sm" style={{ color: 'var(--soft-stone)' }}>
          Loading your active reservations...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--warm-ink)' }}>
            My Bookings & Escrows
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--soft-stone)' }}>
            Track your appointments, service milestones, and escrow deposit statuses.
          </p>
        </div>
        <Link
          to="/booking"
          className="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          style={{ background: 'var(--clay)', color: 'white' }}
        >
          Explore Services
        </Link>
      </div>

      {bookings.length === 0 ? (
        <ClayCard className="p-12 text-center" hover={false}>
          <div
            className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3"
            style={{ background: 'var(--warm-sand)' }}
          >
            <span className="material-symbols-outlined text-xl" style={{ color: 'var(--clay)' }}>
              event_available
            </span>
          </div>
          <h3 className="font-bold text-base mb-1" style={{ color: 'var(--warm-ink)' }}>
            No bookings yet
          </h3>
          <p className="text-xs mb-4 max-w-sm mx-auto" style={{ color: 'var(--soft-stone)' }}>
            Discover top-rated freelancers and service businesses, and guarantee your milestones with smart escrow.
          </p>
          <Link
            to="/booking"
            className="inline-block px-5 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{ background: 'var(--clay)', color: 'white' }}
          >
            Find a Provider
          </Link>
        </ClayCard>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const dateObj = new Date(booking.slotStart);
            const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : 'Upcoming';
            const timeStr = !isNaN(dateObj.getTime())
              ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';

            const providerLink = booking.business
              ? `/book/${booking.business.slug || booking.business.id}`
              : '#';

            return (
              <ClayCard key={booking.id} className="p-4 md:p-5" hover={true}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden"
                      style={{ background: 'var(--warm-sand)' }}
                    >
                      {booking.business?.logoUrl ? (
                        <img
                          src={booking.business.logoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span
                          className="material-symbols-outlined text-[22px]"
                          style={{ color: 'var(--clay)' }}
                        >
                          event
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-sm" style={{ color: 'var(--warm-ink)' }}>
                        {booking.serviceType || 'Service Booking'}
                      </h3>
                      {booking.business && (
                        <Link
                          to={providerLink}
                          className="text-xs font-medium hover:underline block mt-0.5"
                          style={{ color: 'var(--clay)' }}
                        >
                          {booking.business.name} {booking.business.city ? `· ${booking.business.city}` : ''}
                        </Link>
                      )}
                      <p className="text-xs mt-1" style={{ color: 'var(--soft-stone)' }}>
                        📅 {dateStr} at {timeStr}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-[rgba(191,179,163,0.2)]">
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                      style={{
                        background:
                          booking.status === 'confirmed' || booking.status === 'CONFIRMED'
                            ? 'var(--sage)'
                            : 'var(--warm-sand)',
                        color:
                          booking.status === 'confirmed' || booking.status === 'CONFIRMED'
                            ? 'white'
                            : 'var(--warm-ink)',
                      }}
                    >
                      {booking.status}
                    </span>

                    {booking.depositAmount && booking.depositAmount > 0 ? (
                      <span className="text-xs font-semibold" style={{ color: 'var(--warm-ink)' }}>
                        ${booking.depositAmount} Escrow {booking.depositPaid ? '✓ Funded' : 'Pending'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </ClayCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
