import DashboardLayout, { NavItem } from '../../components/DashboardLayout';
import BookingFlowPage from '../../sitara/pages/BookingFlowPage';

const NAV_ITEMS: NavItem[] = [
  { path: '/booking', label: 'Discovery', icon: 'explore' },
  { path: '/booking', label: 'Bookings', icon: 'event', end: true },
  { path: '/booking#my-bookings', label: 'My Bookings', icon: 'bookmark' },
];

export default function BookingBookingPage() {
  return (
    <DashboardLayout osName="BookingOS" osIcon="★" osColor="emerald" navItems={NAV_ITEMS}>
      <BookingFlowPage />
    </DashboardLayout>
  );
}
