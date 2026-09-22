import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/pipeline/leads', label: 'Leads', icon: 'person_add' },
  { path: '/pipeline/deals', label: 'Deals', icon: 'handshake' },
  { path: '/pipeline/activities', label: 'Activities', icon: 'notifications' },
];

export default function PipelineDealsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDeals() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDeals(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch deals:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDeals();
  }, []);

  return (
    <DashboardLayout osName="PipelineOS" osIcon="P" osColor="clay" navItems={navItems}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Deals</h1>
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>
        ) : deals.length === 0 ? (
          <div className="p-8 text-center rounded-[var(--radius-card)]" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <p style={{ color: 'var(--soft-stone)' }}>No deals yet. Create a booking to generate deals.</p>
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] overflow-hidden" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            {deals.map((deal, idx, arr) => (
              <div
                key={deal.id}
                className="p-5 flex items-center justify-between"
                style={{ borderBottom: idx < arr.length - 1 ? '1px solid rgba(191,179,163,0.2)' : 'none' }}
              >
                <div>
                  <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>{deal.serviceType}</p>
                  <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>{deal.clientName} • {deal.status}</p>
                </div>
                <span className="font-medium" style={{ color: 'var(--clay)' }}>${deal.price?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
