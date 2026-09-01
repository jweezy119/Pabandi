import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';

const CATEGORIES = [
  { id: 'furniture', icon: '🛋️', label: 'Furniture', desc: 'Couches, tables, chairs', color: '#6366f1' },
  { id: 'electronics', icon: '📱', label: 'Electronics', desc: 'Phones, laptops, TVs', color: '#10b981' },
  { id: 'appliances', icon: '🏠', label: 'Appliances', desc: 'Washers, fridges, ACs', color: '#f59e0b' },
  { id: 'clothing', icon: '👕', label: 'Clothing', desc: 'Shoes, bags, accessories', color: '#ec4899' },
  { id: 'sports', icon: '⚽', label: 'Sports', desc: 'Bikes, weights, gear', color: '#8b5cf6' },
  { id: 'other', icon: '📦', label: 'Other', desc: 'Anything else', color: '#6b7280' },
];

const SERVICES = [
  { id: 'plumbing', icon: '🔧', label: 'Plumbing', desc: 'Leaks, pipes, installations', avg: '$75-150' },
  { id: 'electrical', icon: '⚡', label: 'Electrical', desc: 'Wiring, outlets, lighting', avg: '$100-200' },
  { id: 'cleaning', icon: '🧹', label: 'Cleaning', desc: 'Deep clean, move-out, maid', avg: '$80-150' },
  { id: 'moving', icon: '📦', label: 'Moving', desc: 'Help moving furniture', avg: '$50-100/hr' },
  { id: 'painting', icon: '🎨', label: 'Painting', desc: 'Interior, exterior, touch-ups', avg: '$200-500' },
  { id: 'hvac', icon: '❄️', label: 'HVAC', desc: 'AC repair, heating, vents', avg: '$100-300' },
  { id: 'handyman', icon: '🛠️', label: 'Handyman', desc: 'General repairs, assembly', avg: '$60-120' },
  { id: 'landscaping', icon: '🌱', label: 'Landscaping', desc: 'Lawn care, trees, gardens', avg: '$100-250' },
];

export const MarketplacePage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'buy' | 'sell' | 'rent' | 'hire'>('buy');

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Hero */}
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🛡️ Pabandi Marketplace</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-100 font-headline">
            Buy. Sell. Rent. Hire.
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            One trusted marketplace for everything. Every transaction protected by escrow, every user verified by background checks.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {([
            { id: 'buy', label: '🛒 Buy', desc: 'Find items' },
            { id: 'sell', label: '💰 Sell', desc: 'List items' },
            { id: 'rent', label: '🏠 Rent', desc: 'Find a home' },
            { id: 'hire', label: '🔧 Hire', desc: 'Get help' },
          ] as const).map((s) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`flex-1 min-w-[80px] px-4 py-3 rounded-xl text-center transition-all ${activeSection === s.id ? 'bg-indigo-500/20 border border-indigo-400/30' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
              <div className="text-lg">{s.label.split(' ')[0]}</div>
              <div className="text-xs font-semibold" style={{ color: activeSection === s.id ? '#a5b4fc' : tokens.color.muted }}>{s.label.split(' ')[1]}</div>
            </button>
          ))}
        </div>

        {/* Buy Section */}
        {activeSection === 'buy' && (
          <div className="space-y-6">
            <Surface className="p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Browse Categories</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CATEGORIES.map((cat) => (
                  <button key={cat.id} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left">
                    <div className="text-2xl mb-2">{cat.icon}</div>
                    <div className="font-semibold text-slate-100 text-sm">{cat.label}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{cat.desc}</div>
                  </button>
                ))}
              </div>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Featured Listings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { title: 'IKEA Sofa - Like New', price: 350, seller: 'Sarah M.', rating: 4.9, image: '🛋️' },
                  { title: 'iPhone 14 Pro Max', price: 800, seller: 'Ahmed K.', rating: 4.8, image: '📱' },
                  { title: 'Samsung 55" 4K TV', price: 450, seller: 'Mike R.', rating: 5.0, image: '📺' },
                  { title: 'Herman Miller Chair', price: 600, seller: 'Lisa T.', rating: 4.7, image: '🪑' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-3xl">{item.image}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-100 text-sm">{item.title}</div>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>{item.seller} · {item.rating} ⭐</div>
                      <div className="text-lg font-bold text-emerald-300">${item.price}</div>
                    </div>
                    <Button size="sm">View</Button>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {/* Sell Section */}
        {activeSection === 'sell' && (
          <div className="space-y-6">
            <Surface className="p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">List an Item</h2>
              <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Sell anything with escrow protection. Your money is safe until the buyer confirms receipt.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CATEGORIES.map((cat) => (
                  <button key={cat.id} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-center">
                    <div className="text-xl mb-1">{cat.icon}</div>
                    <div className="text-xs font-semibold text-slate-100">{cat.label}</div>
                  </button>
                ))}
              </div>
              <Button className="w-full mt-4">+ Create Listing</Button>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">How Selling Works</h2>
              <div className="space-y-3">
                {[
                  { step: 1, icon: '📸', title: 'List your item', desc: 'Add photos, description, and price' },
                  { step: 2, icon: '🤝', title: 'Buyer funds escrow', desc: 'Money is locked — neither party can walk with it' },
                  { step: 3, icon: '📍', title: 'Meet at SafeMeet', desc: 'Exchange at a verified safe location' },
                  { step: 4, icon: '✅', title: 'Confirm & get paid', desc: 'Buyer confirms — funds release to you' },
                ].map((s) => (
                  <div key={s.step} className="flex gap-3 p-3 rounded-xl bg-white/5">
                    <div className="text-xl">{s.icon}</div>
                    <div>
                      <div className="font-bold text-slate-100 text-sm">Step {s.step}: {s.title}</div>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {/* Rent Section */}
        {activeSection === 'rent' && (
          <div className="space-y-6">
            <Surface className="p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Find a Home</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { title: '2BR Apartment - Downtown', rent: 1800, beds: 2, baths: 1, sqft: 850, available: 'Now' },
                  { title: '1BR Condo - Lakeview', rent: 1200, beds: 1, baths: 1, sqft: 600, available: 'Oct 1' },
                  { title: '3BR House - Suburbs', rent: 2400, beds: 3, baths: 2, sqft: 1500, available: 'Nov 1' },
                  { title: 'Studio - University', rent: 800, beds: 0, baths: 1, sqft: 400, available: 'Now' },
                ].map((listing, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-slate-100 text-sm">{listing.title}</div>
                      <Badge tone="success">{listing.available}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs mb-2" style={{ color: tokens.color.muted }}>
                      <span>{listing.beds} bd</span>
                      <span>{listing.baths} ba</span>
                      <span>{listing.sqft} sqft</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold text-emerald-300">${listing.rent}/mo</div>
                      <Button size="sm">Apply</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Renting with Pabandi</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { icon: '🔍', title: 'Background Checks', desc: 'Every tenant screened via CourtListener' },
                  { icon: '🔒', title: 'Escrow Deposits', desc: 'Security deposits held in smart contracts' },
                  { icon: '📝', title: 'Digital Leases', desc: 'Sign leases online with full legal terms' },
                ].map((f, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-2xl mb-2">{f.icon}</div>
                    <div className="font-semibold text-slate-100 text-sm">{f.title}</div>
                    <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{f.desc}</div>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {/* Hire Section */}
        {activeSection === 'hire' && (
          <div className="space-y-6">
            <Surface className="p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Home Services</h2>
              <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Find trusted local help for any task. Every tasker is background-checked and rated.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SERVICES.map((s) => (
                  <button key={s.id} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-center">
                    <div className="text-2xl mb-1">{s.icon}</div>
                    <div className="font-semibold text-slate-100 text-sm">{s.label}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{s.avg}</div>
                  </button>
                ))}
              </div>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Top Taskers</h2>
              <div className="space-y-3">
                {[
                  { name: 'Carlos Rivera', specialty: 'Plumbing', rating: 4.9, jobs: 203, distance: '2.3 mi' },
                  { name: 'Sarah Chen', specialty: 'Cleaning', rating: 4.8, jobs: 156, distance: '3.1 mi' },
                  { name: 'Mike Johnson', specialty: 'Handyman', rating: 4.9, jobs: 312, distance: '1.5 mi' },
                  { name: 'Lisa Park', specialty: 'Electrical', rating: 4.7, jobs: 89, distance: '4.2 mi' },
                ].map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">👷</div>
                      <div>
                        <div className="font-semibold text-slate-100 text-sm">{t.name}</div>
                        <div className="text-xs" style={{ color: tokens.color.muted }}>{t.specialty} · {t.distance}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-300">{t.rating} ⭐</div>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>{t.jobs} jobs</div>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplacePage;
