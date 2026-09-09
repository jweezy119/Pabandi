// Sitara OS — Tenant Lease Page
// View lease details

export default function TenantLeasePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">My Lease</h1>
      <p className="text-slate-600 mb-8">Your lease agreement details</p>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-slate-900">Lease Agreement</h3>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Active</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-slate-500 mb-1">Property</p>
            <p className="font-medium">Oak Tower Apartments</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Unit</p>
            <p className="font-medium">2A</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Lease Start</p>
            <p className="font-medium">July 1, 2026</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Lease End</p>
            <p className="font-medium">June 30, 2027</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Monthly Rent</p>
            <p className="font-medium">$1,850</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Security Deposit</p>
            <p className="font-medium">$1,850 (held in escrow)</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <button className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
            Download Lease PDF
          </button>
        </div>
      </div>
    </div>
  );
}
