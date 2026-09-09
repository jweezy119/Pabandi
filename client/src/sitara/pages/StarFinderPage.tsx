// Sitara OS — Star Finder Page
// Discover and reach top customers

import { useState } from 'react';

const mockCustomers = [
  { id: '1', name: 'Sarah Chen', tier: 'sitara-e-roshan', starPower: 1245, visits: 12, lastVisit: '2 days ago', avgRating: 4.9 },
  { id: '2', name: 'Mike Johnson', tier: 'sitara-e-noor', starPower: 342, visits: 8, lastVisit: '1 week ago', avgRating: 4.7 },
  { id: '3', name: 'Emma Davis', tier: 'sitara-e-darakshan', starPower: 5670, visits: 34, lastVisit: 'Yesterday', avgRating: 5.0 },
  { id: '4', name: 'James Wilson', tier: 'sitara-e-roshan', starPower: 890, visits: 15, lastVisit: '3 days ago', avgRating: 4.8 },
  { id: '5', name: 'Lisa Park', tier: 'tara', starPower: 67, visits: 3, lastVisit: '2 weeks ago', avgRating: 4.5 },
];

const tierColors = {
  'tara': 'bg-slate-100 text-slate-700',
  'sitara-e-noor': 'bg-amber-100 text-amber-700',
  'sitara-e-roshan': 'bg-orange-100 text-orange-700',
  'sitara-e-darakshan': 'bg-red-100 text-red-700',
  'sitara-e-izzat': 'bg-purple-100 text-purple-700',
};

export default function StarFinderPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(10);

  const handleSendPromo = () => {
    // In real app: create smart contract promo
    alert(`Promo sent to ${selectedCustomer}!`);
    setSelectedCustomer(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Star Finder</h1>
      <p className="text-slate-600 mb-8">Find your best customers and send them exclusive promos.</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium">All</button>
        <button className="px-4 py-2 bg-white text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100">Sitara-e-Roshan+</button>
        <button className="px-4 py-2 bg-white text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100">Visited 10+ times</button>
        <button className="px-4 py-2 bg-white text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100">Rating 4.5+</button>
      </div>

      {/* Customer List */}
      <div className="space-y-4">
        {mockCustomers.map((customer) => (
          <div key={customer.id} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                {customer.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-slate-900">{customer.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierColors[customer.tier as keyof typeof tierColors]}`}>
                    {customer.tier}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600 mt-1">
                  <span>★ {customer.starPower} SP</span>
                  <span>{customer.visits} visits</span>
                  <span>Last: {customer.lastVisit}</span>
                  <span>⭐ {customer.avgRating}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {selectedCustomer === customer.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={promoDiscount}
                      onChange={(e) => setPromoDiscount(parseInt(e.target.value))}
                      className="w-16 px-2 py-1 border border-slate-300 rounded text-sm"
                      placeholder="%"
                    />
                    <span className="text-sm text-slate-600">% off</span>
                    <button
                      onClick={handleSendPromo}
                      className="px-3 py-1 bg-amber-500 text-white text-sm font-medium rounded hover:bg-amber-600"
                    >
                      Send
                    </button>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="px-3 py-1 bg-slate-200 text-slate-700 text-sm font-medium rounded hover:bg-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedCustomer(customer.id)}
                    className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600"
                  >
                    Send Promo
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Promo Stats */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
          <p className="text-3xl font-bold text-slate-900">24</p>
          <p className="text-sm text-slate-600">Promos sent this month</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
          <p className="text-3xl font-bold text-green-600">68%</p>
          <p className="text-sm text-slate-600">Redemption rate</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
          <p className="text-3xl font-bold text-slate-900">$2.4K</p>
          <p className="text-sm text-slate-600">Revenue from promos</p>
        </div>
      </div>
    </div>
  );
}
