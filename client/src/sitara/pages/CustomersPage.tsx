// Sitara OS — Customers Page (operator)
// One place for guest data: CRM patrons enriched with Star Power tiers.
// Full CRM stays at /business/crm — this is the Sitara-native view.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sitaraApi } from '../api/sitaraApi';

// Best-effort field picker for CRM rows whose exact shape may evolve.
function pick(obj: any, keys: string[], fallback = '—'): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return fallback;
}

const tierColors: Record<string, string> = {
  tara: 'bg-slate-100 text-slate-700',
  'sitara-e-noor': 'bg-amber-100 text-amber-700',
  'sitara-e-roshan': 'bg-orange-100 text-orange-700',
  'sitara-e-darakshan': 'bg-red-100 text-red-700',
  'sitara-e-izzat': 'bg-purple-100 text-purple-700',
};

export default function CustomersPage() {
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [starCustomers, setStarCustomers] = useState<any[]>([]);
  const [crmCustomers, setCrmCustomers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const biz = await sitaraApi.myBusiness().catch(() => null);
        setBusiness(biz);
        if (biz?.id) {
          const [stars, crm] = await Promise.allSettled([
            sitaraApi.getStarFinder(biz.id),
            sitaraApi.businessCustomers(biz.id),
          ]);
          if (stars.status === 'fulfilled') setStarCustomers(stars.value || []);
          if (crm.status === 'fulfilled') {
            const raw: any = crm.value;
            setCrmCustomers(Array.isArray(raw) ? raw : raw?.customers || []);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-slate-500">Loading your customers…</p>
      </div>
    );
  }

  if (!business?.id) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">No business connected</h1>
        <p className="text-slate-600 mb-6">Register your business to see customers, Star tiers, and CRM data in one place.</p>
        <Link to="/business/register" className="inline-block px-6 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
          Register Your Business
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-600 mt-1">
            {business?.name} · {crmCustomers.length} patrons · {starCustomers.length} ranked reviewers
          </p>
        </div>
        <Link
          to="/business/crm"
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
        >
          Open full CRM →
        </Link>
      </div>

      {/* Star customers */}
      <h2 className="text-lg font-semibold text-slate-900 mt-8 mb-4">★ Top customers by Star Power</h2>
      {starCustomers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500">
          No ranked reviewers yet. Reviews with check-ins will appear here with tiers — then send them promos from{' '}
          <Link to="/sitara/operator/star-finder" className="text-amber-600 font-medium">Star Finder</Link>.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-8">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Tier</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Points</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Reviews</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Avg rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {starCustomers.slice(0, 25).map((c: any) => (
                <tr key={c.userId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {(c.name || '?').charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-slate-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierColors[c.tier] || tierColors.tara}`}>
                      {c.tierName || c.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-medium">★ {c.totalPoints}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.reviewCount}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{Number(c.avgRating || 0).toFixed(1)} ⭐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CRM patrons */}
      <h2 className="text-lg font-semibold text-slate-900 mt-8 mb-4">All patrons (CRM)</h2>
      {crmCustomers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500">
          No patron records yet — they appear after your first bookings.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Patron</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Contact</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Visits</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Last visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {crmCustomers.slice(0, 50).map((p: any, i: number) => (
                <tr key={p.id || p.userId || i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                    {pick(p, ['name', 'fullName', 'firstName', 'email'])}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {pick(p, ['email', 'phone'])}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {pick(p, ['visits', 'visitCount', 'totalBookings', 'bookings'])}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {pick(p, ['lastVisit', 'lastBooking', 'lastSeen', 'updatedAt'])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
