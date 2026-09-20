import DashboardLayout, { NavItem } from '../../components/DashboardLayout';
import DiscoveryPage from '../../sitara/pages/DiscoveryPage';

const NAV_ITEMS: NavItem[] = [
  { path: '/discovery', label: 'Discovery', icon: 'explore', end: true },
  { path: '/booking', label: 'Bookings', icon: 'event' },
  { path: '/discovery#favorites', label: 'Favorites', icon: 'favorite' },
  { path: '/discovery#map', label: 'Map', icon: 'map' },
];

export default function SitaraDiscoveryPage() {
  return (
    <DashboardLayout osName="Sitara" osIcon="★" osColor="emerald" navItems={NAV_ITEMS}>
      <DiscoveryPage />
    </DashboardLayout>
  );
}
