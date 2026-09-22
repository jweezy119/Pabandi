import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/property', label: 'Dashboard', icon: '📊', end: true },
  { path: '/property/tenants', label: 'Tenants', icon: '👥' },
  { path: '/property/leases', label: 'Leases', icon: '📝' },
  { path: '/property/maintenance', label: 'Maintenance', icon: '🔧' },
  { path: '/property/financials', label: 'Financials', icon: '💰' },
];

export default function PropertyTenantDetailPage() {
  const { id } = useParams();
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTenant(); }, [id]);

  const loadTenant = async () => {
    try {
      const res = await api.get(`/api/v1/property/tenants/${id}`);
      setTenant(res.data?.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <DashboardLayout osName="PropertyOS" osIcon="H" osColor="emerald" navItems={navItems}><div className="text-center py-8"><div className="w-8 h-8 border-4 border-[var(--sage)] border-t-transparent rounded-full animate-spin mx-auto" /></div></DashboardLayout>;

  return (
    <DashboardLayout osName="PropertyOS" osIcon="H" osColor="emerald" navItems={navItems}>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-[var(--warm-ink)]">{tenant?.firstName} {tenant?.lastName}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] rounded-xl p-4">
            <h3 className="text-[var(--soft-stone)] text-sm mb-2">Contact Info</h3>
            <p className="text-[var(--warm-ink)] text-sm">Email: {tenant?.email}</p>
            <p className="text-[var(--warm-ink)] text-sm">Phone: {tenant?.phone || 'N/A'}</p>
            <p className="text-[var(--warm-ink)] text-sm">Risk Score: {tenant?.riskScore || 50}</p>
          </div>
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] rounded-xl p-4">
            <h3 className="text-[var(--soft-stone)] text-sm mb-2">Payment History</h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {tenant?.paymentHistory?.map((p: any) => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span className="text-[var(--soft-stone)]">{new Date(p.date).toLocaleDateString()}</span>
                  <span className="text-[var(--sage)]">${p.amount}</span>
                </div>
              ))}
              {(!tenant?.paymentHistory || tenant.paymentHistory.length === 0) && <p className="text-[var(--soft-stone)] text-xs">No payment history</p>}
            </div>
          </div>
        </div>
        <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] rounded-xl p-4">
          <h3 className="text-[var(--soft-stone)] text-sm mb-2">Lease History</h3>
          <div className="space-y-2">
            {tenant?.leases?.map((l: any) => (
              <div key={l.id} className="flex justify-between items-center text-sm border-b border-[rgba(191,179,163,0.3)] pb-2">
                <div>
                  <p className="text-[var(--warm-ink)]">{l.tenantName || 'Lease'}</p>
                  <p className="text-[var(--soft-stone)] text-xs">{new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}</p>
                </div>
                <span className="text-[var(--sage)]">${l.rentAmount}/mo</span>
              </div>
            ))}
            {(!tenant?.leases || tenant.leases.length === 0) && <p className="text-[var(--soft-stone)] text-sm">No leases found</p>}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
