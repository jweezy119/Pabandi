import DashboardLayout, { NavItem } from '../components/DashboardLayout';
import TenantPortal from './TenantPortal';

const NAV_ITEMS: NavItem[] = [
  { path: '/tenant-portal', label: 'Dashboard', icon: 'grid_view', end: true },
  { path: '/tenant-portal/pay-rent', label: 'Pay Rent', icon: 'payments' },
  { path: '/tenant-portal/maintenance', label: 'Maintenance', icon: 'build' },
  { path: '/tenant-portal/lease', label: 'Lease', icon: 'description' },
  { path: '/tenant-portal/staking', label: 'Staking', icon: 'account_balance' },
  { path: '/tenant-portal/history', label: 'History', icon: 'history' },
];

export default function TenantPortalDashboard() {
  return (
    <DashboardLayout osName="Haq OS" osIcon="H" osColor="violet" navItems={NAV_ITEMS}>
      <TenantPortal />
    </DashboardLayout>
  );
}
