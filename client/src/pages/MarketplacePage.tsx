import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { marketplaceService } from '../services/api';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = [
  { id: 'furniture', icon: '🛋️', label: 'Furniture' },
  { id: 'electronics', icon: '📱', label: 'Electronics' },
  { id: 'appliances', icon: '🏠', label: 'Appliances' },
  { id: 'clothing', icon: '👕', label: 'Clothing' },
  { id: 'sports', icon: '⚽', label: 'Sports' },
  { id: 'other', icon: '📦', label: 'Other' },
];

const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'];

export const MarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'buy' | 'sell' | 'rent' | 'hire'>('buy');
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', category: '', condition: 'GOOD', price: '', currency: 'USD',
    city: '', state: '', imageUrls: '', sellerEmail: '', sellerName: '',
  });

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params: any = { type: activeSection === 'buy' ? 'ITEM' : activeSection === 'rent' ? 'RENTAL' : activeSection === 'hire' ? 'SERVICE' : undefined };
      if (filterCategory) params.category = filterCategory;
      if (searchQuery) params.q = searchQuery;
      const res = await marketplaceService.listings(params);
      setListings(res.data?.data?.items || []);
    } catch (e) {
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchListings(); }, [activeSection, filterCategory]);

  const handleCreate = async () => {
    try {
      await marketplaceService.createListing({
        title: form.title, description: form.description, category: form.category,
        condition: form.condition, price: parseFloat(form.price), currency: form.currency,
        city: form.city, state: form.state, imageUrls: form.imageUrls ? form.imageUrls.split(',').map((s: string) => s.trim()) : [],
        sellerEmail: form.sellerEmail, sellerName: form.sellerName,
        type: activeSection === 'buy' ? 'ITEM' : activeSection === 'rent' ? 'RENTAL' : activeSection === 'hire' ? 'SERVICE' : 'ITEM',
      });
      setShowCreateForm(false);
      fetchListings();
    } catch (e) {
      alert('Failed to create listing');
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🛡️ Pabandi Marketplace</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--warm-ink)] font-headline">Buy. Sell. Rent. Hire.</h1>
          <p className="mt-3 text-[var(--soft-stone)] max-w-2xl mx-auto">One trusted marketplace for everything. Every transaction protected by escrow.</p>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {(['buy', 'sell', 'rent', 'hire'] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)}
              className={`flex-1 min-w-[80px] px-4 py-3 rounded-xl text-center transition-all ${activeSection === s ? 'bg-[var(--clay)]/15 border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]'}`}>
              <div className="text-lg">{s === 'buy' ? '🛒' : s === 'sell' ? '💰' : s === 'rent' ? '🏠' : '🔧'}</div>
              <div className="text-xs font-semibold capitalize">{s}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search listings..." className="flex-1 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none">
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <Button onClick={fetchListings} size="sm">Search</Button>
          <Button onClick={() => setShowCreateForm(!showCreateForm)} size="sm">+ List</Button>
        </div>

        {showCreateForm && (
          <Surface className="p-4 mb-4">
            <h3 className="text-base font-bold text-[var(--warm-ink)] mb-3">Create Listing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title *" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
              <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Price *" type="number" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none">
                <option value="">Category</option>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none">
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
              <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="State" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
              <input value={form.sellerEmail} onChange={e => setForm({ ...form, sellerEmail: e.target.value })} placeholder="Your email *" type="email" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
              <input value={form.sellerName} onChange={e => setForm({ ...form, sellerName: e.target.value })} placeholder="Your name" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
              <input value={form.imageUrls} onChange={e => setForm({ ...form, imageUrls: e.target.value })} placeholder="Image URLs (comma-separated)" className="md:col-span-2 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" className="md:col-span-2 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" rows={2} />
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={handleCreate} className="flex-1">Publish Listing</Button>
              <Button onClick={() => setShowCreateForm(false)} variant="ghost">Cancel</Button>
            </div>
          </Surface>
        )}

        {loading ? (
          <div className="text-center py-8 text-[var(--soft-stone)]">Loading...</div>
        ) : listings.length === 0 ? (
          <Surface className="p-6 text-center">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-[var(--soft-stone)]">No listings yet. Be the first to list something!</p>
          </Surface>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {listings.map((listing: any) => (
              <Surface key={listing.id} className="p-3 cursor-pointer hover:bg-[var(--warm-sand)] transition-all" onClick={() => navigate(`/listing/${listing.id}`)}>
                <div className="flex items-start gap-3">
                  {listing.imageUrls?.[0] ? (
                    <img src={listing.imageUrls[0]} alt={listing.title} className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-[var(--warm-sand)] flex items-center justify-center text-2xl">📦</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--warm-ink)] text-sm truncate">{listing.title}</div>
                    <div className="text-xs text-[var(--soft-stone)]">{listing.city}{listing.state ? `, ${listing.state}` : ''}</div>
                    <div className="text-lg font-bold text-[var(--sage)]">${listing.price}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <Badge tone="info">{listing.condition}</Badge>
                  <span className="text-xs text-[var(--soft-stone)]">{new Date(listing.createdAt).toLocaleDateString()}</span>
                </div>
              </Surface>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplacePage;
