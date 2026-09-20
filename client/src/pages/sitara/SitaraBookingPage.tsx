import DashboardLayout, { NavItem } from '../../components/DashboardLayout';
import BookingFlowPage from '../../sitara/pages/BookingFlowPage';

const NAV_ITEMS: NavItem[] = [
  { path: '/discovery', label: 'Discovery', icon: 'explore' },
  { path: '/booking', label: 'Bookings', icon: 'event', end: true },
  { path: '/booking#my-bookings', label: 'My Bookings', icon: 'bookmark' },
];

export default function SitaraBookingPage() {
  return (
    <DashboardLayout osName="Sitara" osIcon="★" osColor="emerald" navItems={NAV_ITEMS}>
      <BookingFlowPage />
    </DashboardLayout>
  );
}
