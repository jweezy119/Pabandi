import DashboardLayout from '../../components/DashboardLayout';
import DiscoveryPage from '../../sitara/pages/DiscoveryPage';
import { Link } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/booking', label: 'Discovery', icon: 'explore', end: true },
  { path: '/booking/flow', label: 'Bookings', icon: 'event' },
  { path: '/booking#favorites', label: 'Favorites', icon: 'favorite' },
  { path: '/booking#map', label: 'Map', icon: 'map' },
];

export default function BookingOSPage() {
  return (
    <DashboardLayout osName="BookingOS" osIcon="★" osColor="emerald" navItems={NAV_ITEMS}>
      <DiscoveryPage />
      <footer className="pt-8 border-t border-white/5 text-center">
        <p className="text-sm text-slate-500">
          Powered by <Link to="/" className="text-emerald-400 hover:text-emerald-300 transition">Pabandi</Link> — The Trust Layer
        </p>
        <p className="text-xs text-slate-600 mt-2">
          © 2026 Pabandi. All rights reserved.
        </p>
      </footer>
    </DashboardLayout>
  );
}
