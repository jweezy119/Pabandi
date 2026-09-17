import { useEffect, useState } from 'react';
import { cleaningBusinessService } from '../../services/cleaningBusinessService';
import { useAuthStore } from '../../store/authStore';

export default function CleaningDashboardPage() {
  const { isAuthenticated, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [biz, svcs, res, inv, vend] = await Promise.allSettled([
          cleaningBusinessService.getMyBusiness(),
          cleaningBusinessService.getServices(),
          cleaningBusinessService.getBusinessReservations(),
          cleaningBusinessService.getInventoryProducts(),
          cleaningBusinessService.getInventoryVendors(),
        ]);

        if (biz.status === 'fulfilled') {
          setBusiness(biz.value);
          if (biz.value?.id) {
            cleaningBusinessService.setBusinessId(biz.value.id);
          }
        }
        if (svcs.status === 'fulfilled') setServices(svcs.value || []);
        if (res.status === 'fulfilled') setReservations(res.value || []);
        if (inv.status === 'fulfilled') setInventory(inv.value || []);
        if (vend.status === 'fulfilled') setVendors(vend.value || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load cleaning business data');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🧹</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Cleaning Business Hub</h1>
        <p className="text-slate-600 mb-6">Sign in to manage your cleaning business.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-slate-500">Loading your cleaning business…</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Set Up Your Cleaning Business</h1>
        <p className="text-slate-600 mb-8">
          Create your cleaning business profile to start managing services, bookings, and clients.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 mb-6">{error}</div>
        )}
        <CreateBusinessForm onCreated={(biz) => {
          setBusiness(biz);
          cleaningBusinessService.setBusinessId(biz.id);
        }} />
      </div>
    );
  }

  const activeReservations = reservations.filter((r: any) => 
    r.status === 'PENDING' || r.status === 'CONFIRMED'
  ).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Cleaning Business Hub</h1>
          <p className="text-slate-600 mt-1">{business.name} · {business.category?.replace(/_/g, ' ')}</p>
        </div>
        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-sm font-medium rounded-full">
          Active
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 mb-6">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Services" value={services.length} icon="🧹" />
        <StatCard label="Active Jobs" value={activeReservations} icon="📅" />
        <StatCard label="Inventory Items" value={inventory.length} icon="📦" />
        <StatCard label="Vendors" value={vendors.length} icon="🚚" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Recent Jobs</h3>
          </div>
          {reservations.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500 text-center">No jobs yet.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-sm font-medium text-slate-600">Customer</th>
                  <th className="px-5 py-3 text-left text-sm font-medium text-slate-600">Date</th>
                  <th className="px-5 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reservations.slice(0, 10).map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm text-slate-900">{r.customerName || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {r.reservationDate ? new Date(r.reservationDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{r.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Inventory & Vendors</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Supplies</h4>
              {inventory.length === 0 ? (
                <p className="text-xs text-slate-500">No inventory items yet.</p>
              ) : (
                <div className="space-y-1">
                  {inventory.slice(0, 5).map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-slate-900">{item.name}</span>
                      <span className="text-slate-600">Qty: {item.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Vendors</h4>
              {vendors.length === 0 ? (
                <p className="text-xs text-slate-500">No vendors yet.</p>
              ) : (
                <div className="space-y-1">
                  {vendors.slice(0, 5).map((v: any) => (
                    <div key={v.id} className="flex justify-between text-sm">
                      <span className="text-slate-900">{v.name}</span>
                      <span className="text-slate-600">{v.email || v.phone || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function CreateBusinessForm({ onCreated }: { onCreated: (business: any) => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const biz = await cleaningBusinessService.createBusiness({
        name,
        address,
        city,
        phone,
        email,
        category: 'CLEANING',
      });
      onCreated(biz);
    } catch (err: any) {
      setError(err?.message || 'Failed to create business');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Create Cleaning Business Profile</h2>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Sparkle Clean Services" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Service Address</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="123 Main St, City, ST 12345" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
      </div>
      <button type="submit" disabled={saving} className="w-full py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
        {saving ? 'Creating…' : 'Create Cleaning Business'}
      </button>
    </form>
  );
}
