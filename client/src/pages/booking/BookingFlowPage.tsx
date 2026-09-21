import DashboardLayout from '../../components/DashboardLayout';
import SitaraBookingFlowPage from '../../sitara/pages/BookingFlowPage';

const NAV_ITEMS = [
  { path: '/booking', label: 'Discovery', icon: 'explore' },
  { path: '/booking/flow', label: 'Bookings', icon: 'event', end: true },
  { path: '/booking#my-bookings', label: 'My Bookings', icon: 'bookmark' },
];

export default function BookingFlowPage() {
  return (
    <DashboardLayout osName="BookingOS" osIcon="★" osColor="emerald" navItems={NAV_ITEMS}>
      <SitaraBookingFlowPage />
    </DashboardLayout>
  );
}
