import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/abode', label: 'Dashboard', icon: '📊', end: true },
  { path: '/abode/tenants', label: 'Tenants', icon: '👥' },
  { path: '/abode/leases', label: 'Leases', icon: '📝' },
  { path: '/abode/maintenance', label: 'Maintenance', icon: '🔧' },
  { path: '/abode/financials', label: 'Financials', icon: '💰' },
];

export default function AbodeTenantDetailPage() {
  const { id } = useParams();
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTenant(); }, [id]);

  const loadTenant = async () => {
    try {
      const res = await api.get(`/api/v1/haq/tenants/${id}`);
      setTenant(res.data?.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <DashboardLayout osName="AbodeOS" osIcon="H" osColor="emerald" navItems={navItems}><div className="text-center py-8"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /></div></DashboardLayout>;

  return (
    <DashboardLayout osName="AbodeOS" osIcon="H" osColor="emerald" navItems={navItems}>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-white">{tenant?.firstName} {tenant?.lastName}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
            <h3 className="text-gray-400 text-sm mb-2">Contact Info</h3>
            <p className="text-white text-sm">Email: {tenant?.email}</p>
            <p className="text-white text-sm">Phone: {tenant?.phone || 'N/A'}</p>
            <p className="text-white text-sm">Risk Score: {tenant?.riskScore || 50}</p>
          </div>
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
            <h3 className="text-gray-400 text-sm mb-2">Payment History</h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {tenant?.paymentHistory?.map((p: any) => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span className="text-gray-400">{new Date(p.date).toLocaleDateString()}</span>
                  <span className="text-emerald-400">${p.amount}</span>
                </div>
              ))}
              {(!tenant?.paymentHistory || tenant.paymentHistory.length === 0) && <p className="text-gray-500 text-xs">No payment history</p>}
            </div>
          </div>
        </div>
        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-2">Lease History</h3>
          <div className="space-y-2">
            {tenant?.leases?.map((l: any) => (
              <div key={l.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                <div>
                  <p className="text-white">{l.tenantName || 'Lease'}</p>
                  <p className="text-gray-500 text-xs">{new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}</p>
                </div>
                <span className="text-emerald-400">${l.rentAmount}/mo</span>
              </div>
            ))}
            {(!tenant?.leases || tenant.leases.length === 0) && <p className="text-gray-500 text-sm">No leases found</p>}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
