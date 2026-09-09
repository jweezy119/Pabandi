// Sitara OS — Leases Page
// Lease management

const mockLeases = [
  { id: '1', tenant: 'Sarah Chen', unit: '2A', start: '2026-07-01', end: '2027-06-30', rent: 1850, deposit: 1850, status: 'active' },
  { id: '2', tenant: 'Mike Johnson', unit: '3B', start: '2026-04-15', end: '2027-03-15', rent: 2100, deposit: 2100, status: 'active' },
  { id: '3', tenant: 'Emma Davis', unit: '1C', start: '2026-01-01', end: '2026-12-31', rent: 1650, deposit: 1650, status: 'expiring' },
];

export default function LeasesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Leases</h1>
          <p className="text-slate-600 mt-1">Manage lease agreements</p>
        </div>
        <button className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
          + Create Lease
        </button>
      </div>

      <div className="space-y-4">
        {mockLeases.map((lease) => (
          <div key={lease.id} className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-900">{lease.tenant}</h3>
                <p className="text-sm text-slate-600">Unit {lease.unit}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                lease.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {lease.status}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Start Date</p>
                <p className="font-medium">{lease.start}</p>
              </div>
              <div>
                <p className="text-slate-500">End Date</p>
                <p className="font-medium">{lease.end}</p>
              </div>
              <div>
                <p className="text-slate-500">Monthly Rent</p>
                <p className="font-medium">${lease.rent}</p>
              </div>
              <div>
                <p className="text-slate-500">Deposit</p>
                <p className="font-medium">${lease.deposit}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
