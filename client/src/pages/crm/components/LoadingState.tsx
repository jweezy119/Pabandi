import DashboardLayout from '../../../components/DashboardLayout';
import { ClaySkeletonCard } from '../../../components/primitives';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard' },
  { path: '/contact/clients', label: 'Clients', icon: 'groups' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
  { path: '/contact/settings/modules', label: 'Settings', icon: 'settings' },
];

export default function LoadingState() {
  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <h1
          style={{
            fontFamily: 'Fraunces, serif',
            fontSize: '28px',
            color: 'var(--warm-ink)',
            marginBottom: '4px',
          }}
        >
          Loading ContactOS
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--soft-stone)',
            marginBottom: '24px',
          }}
        >
          Trust-Aware Revenue Engine
        </p>
        <ClaySkeletonCard />
        <ClaySkeletonCard />
        <ClaySkeletonCard />
      </div>
    </DashboardLayout>
  );
}