// Sitara OS — Tenant Payments Page
// Rent payment history

const mockPayments = [
  { id: '1', date: '2026-09-01', amount: 1850, status: 'paid', method: 'ACH' },
  { id: '2', date: '2026-08-01', amount: 1850, status: 'paid', method: 'ACH' },
  { id: '3', date: '2026-07-01', amount: 1850, status: 'paid', method: 'Card' },
  { id: '4', date: '2026-06-01', amount: 1850, status: 'paid', method: 'ACH' },
];

export default function TenantPaymentsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Payments</h1>
      <p className="text-slate-600 mb-8">Your rent payment history</p>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Method</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {mockPayments.map((payment) => (
              <tr key={payment.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm text-slate-900">{payment.date}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">${payment.amount}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{payment.method}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    {payment.status}
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
