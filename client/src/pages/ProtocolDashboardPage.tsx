import DashboardLayout, { NavItem } from '../components/DashboardLayout';
import ProtocolDashboard from '../pages/ProtocolDashboard';

const NAV_ITEMS: NavItem[] = [
  { path: '/protocol', label: 'Overview', icon: 'dashboard', end: true },
  { path: '/protocol/staking', label: 'Staking', icon: 'lock' },
  { path: '/protocol/escrow', label: 'Escrow', icon: 'shield' },
  { path: '/protocol/agents', label: 'Agents', icon: 'smart_toy' },
];

export default function ProtocolDashboardPage() {
  return (
    <DashboardLayout osName="Pabandi Protocol" osIcon="P" osColor="emerald" navItems={NAV_ITEMS}>
      <ProtocolDashboard />
    </DashboardLayout>
  );
}
