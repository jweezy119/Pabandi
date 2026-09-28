import DashboardLayout from '../../../components/DashboardLayout';
import { ClaySkeletonCard } from '../../../components/primitives';



export default function LoadingState() {
  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
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