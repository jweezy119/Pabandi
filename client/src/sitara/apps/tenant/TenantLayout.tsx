// Sitara OS — Tenant Layout
// Shell: sidebar on desktop, top bar + bottom tabs on mobile.
import { useSitaraStore } from '../../store/sitaraStore';
import DashboardShell from '../../components/DashboardShell';

const tenantNav = [
  { path: '/sitara/tenant', label: 'Home', icon: '🏠' },
  { path: '/sitara/tenant/lease', label: 'Lease', icon: '📄' },
  { path: '/sitara/tenant/payments', label: 'Pay', icon: '💳' },
  { path: '/sitara/tenant/maintenance', label: 'Fix', icon: '🔧' },
];

export default function TenantLayout() {
  const { user } = useSitaraStore();

  return (
    <DashboardShell
      title="Tenant Portal"
      nav={tenantNav}
      footerTitle={user?.name || 'Tenant'}
      footerSub={`★ ${user?.starPower || 0} Star Power`}
      avatarLetter={user?.name.charAt(0).toUpperCase() || 'T'}
    />
  );
}
