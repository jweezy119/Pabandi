// Sitara OS — Tenant Maintenance Page
// Submit and track maintenance requests

const mockRequests = [
  { id: '1', title: 'Leaky faucet', date: '2026-09-05', status: 'completed', priority: 'low' },
  { id: '2', title: 'AC not cooling', date: '2026-09-01', status: 'in_progress', priority: 'high' },
];

export default function TenantMaintenancePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Maintenance</h1>
          <p className="text-slate-600 mt-1">Submit and track maintenance requests</p>
        </div>
        <button className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
          + New Request
        </button>
      </div>

      <div className="space-y-4">
        {mockRequests.map((req) => (
          <div key={req.id} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-900">{req.title}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                req.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {req.status.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span>Submitted: {req.date}</span>
              <span>Priority: {req.priority}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
