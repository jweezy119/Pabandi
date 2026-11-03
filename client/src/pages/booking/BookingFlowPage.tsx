import DashboardLayout from '../../components/DashboardLayout';

const NAV_ITEMS = [
  { path: '/booking', label: 'Discovery', icon: 'explore' },
  { path: '/booking/flow', label: 'Bookings', icon: 'event', end: true },
  { path: '/booking#my-bookings', label: 'My Bookings', icon: 'bookmark' },
];

export default function BookingFlowPage() {
  return (
    <DashboardLayout osName="BookingOS" osIcon="★" osColor="emerald" navItems={NAV_ITEMS}>
      <div className="min-h-screen bg-[var(--cream)] text-[var(--warm-ink)]">
        <div className="max-w-lg mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Booking Flow</h1>
          <p className="text-[var(--soft-stone)] text-sm mt-1">Sitara module removed — booking flow relocated.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
