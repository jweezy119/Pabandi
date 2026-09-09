// Sitara OS — Promos Page (Operator)
// Manage promotional offers

const mockPromos = [
  { id: '1', title: '20% Off Next Visit', discount: 20, sentTo: 'Sarah Chen', status: 'accepted', sentAt: '2 days ago' },
  { id: '2', title: 'Free Appetizer', discount: 0, sentTo: 'Mike Johnson', status: 'pending', sentAt: '1 week ago' },
  { id: '3', title: 'Priority Booking', discount: 0, sentTo: 'Emma Davis', status: 'redeemed', sentAt: '3 days ago' },
];

export default function PromosPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Promos</h1>
          <p className="text-slate-600 mt-1">Manage promotional offers to your customers</p>
        </div>
        <button className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
          + Create Promo
        </button>
      </div>

      <div className="space-y-4">
        {mockPromos.map((promo) => (
          <div key={promo.id} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{promo.title}</h3>
                <p className="text-sm text-slate-600">Sent to {promo.sentTo} · {promo.sentAt}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                promo.status === 'accepted' ? 'bg-green-100 text-green-800' :
                promo.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {promo.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
