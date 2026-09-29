import { useEffect, useState } from 'react';

export default function PersonalBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/bookings/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          setBookings((await res.json()).data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--warm-ink)]">My Bookings</h1>
      {bookings.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
          <p style={{ color: 'var(--soft-stone)' }}>No bookings yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking: any) => (
            <div key={booking.id} className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
              <div className="font-medium text-[var(--warm-ink)]">{booking.serviceType || 'Booking'}</div>
              <div className="text-sm text-[var(--soft-stone)]">
                {new Date(booking.slotStart).toLocaleDateString()} {booking.slotStart?.split('T')[1]?.slice(0,5) || ''}
              </div>
              <div className="text-xs text-[var(--sage)] mt-1">{booking.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
