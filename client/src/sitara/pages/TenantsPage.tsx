// Sitara OS — Tenants Page
// Tenant management and screening

const mockTenants = [
  { id: '1', name: 'Sarah Chen', email: 'sarah@email.com', unit: '2A', leaseEnd: '2027-06-30', score: 92, status: 'active' },
  { id: '2', name: 'Mike Johnson', email: 'mike@email.com', unit: '3B', leaseEnd: '2027-03-15', score: 78, status: 'active' },
  { id: '3', name: 'Emma Davis', email: 'emma@email.com', unit: '1C', leaseEnd: '2026-12-31', score: 95, status: 'pending' },
];

export default function TenantsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tenants</h1>
          <p className="text-slate-600 mt-1">Manage tenants and screening</p>
        </div>
        <button className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
          + Invite Tenant
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Tenant</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Unit</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Lease End</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Score</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {mockTenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{tenant.name}</p>
                    <p className="text-xs text-slate-500">{tenant.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{tenant.unit}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{tenant.leaseEnd}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${tenant.score >= 90 ? 'bg-green-500' : tenant.score >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${tenant.score}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-600">{tenant.score}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {tenant.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
