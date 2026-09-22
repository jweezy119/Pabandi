import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/cod', label: 'Marketplace', icon: '🛍️', end: true },
  { path: '/cod/my-escrows', label: 'My Escrows', icon: '📋' },
];

const mockListings = [
  { id: '1', title: 'Samsung Galaxy S26 Ultra', price: 350000, seller: 'TechWorld PK', image: '📱', location: 'Karachi' },
  { id: '2', title: 'Honda Civic 2024', price: 5500000, seller: 'AutoHub', image: '🚗', location: 'Lahore' },
  { id: '3', title: 'iPhone 17 Pro Max', price: 450000, seller: 'iStore PK', image: '📱', location: 'Islamabad' },
  { id: '4', title: 'Gaming PC RTX 5090', price: 850000, seller: 'PC Masters', image: '🖥️', location: 'Rawalpindi' },
  { id: '5', title: 'Rolex Submariner', price: 3200000, seller: 'Luxury Time', image: '⌚', location: 'Karachi' },
  { id: '6', title: 'Sony PlayStation 6', price: 125000, seller: 'GameZone', image: '🎮', location: 'Faisalabad' },
];

export default function CODMarketplace() {
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);

  const handleBuy = (item: any) => {
    setSelectedItem(item);
    setShowBuyModal(true);
  };

  const confirmBuy = async () => {
    try {
      await api.post('/api/v1/cod/create', {
        sellerId: 'seller-id-placeholder',
        amount: selectedItem.price,
        description: selectedItem.title,
      });
      alert('Escrow created! Share the link with seller.');
      setShowBuyModal(false);
    } catch (e: any) {
      alert('Failed: ' + e.message);
    }
  };

  return (
    <DashboardLayout osName="Pabandi Pay" osIcon="🛡️" osColor="violet" navItems={navItems}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--warm-ink)]">COD Marketplace</h1>
          <p className="text-[var(--soft-stone)] text-sm mt-1">Buy with Pabandi Protection — Pay when you receive</p>
        </div>

        <div className="bg-gradient-to-r from-[var(--clay)]/20 to-[var(--clay)]/20 border border-[var(--clay)]/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🛡️</span>
            <div>
              <p className="text-[var(--warm-ink)] font-medium">Pabandi Protection</p>
              <p className="text-[var(--soft-stone)] text-sm">Your money is safe. Pay only when you receive the item.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockListings.map((item) => (
            <div key={item.id} className="bg-[#0a0f1a] border border-[var(--soft-stone)]/30 rounded-xl p-4 hover:border-[var(--clay)]/30 transition">
              <div className="text-4xl text-center py-4">{item.image}</div>
              <h3 className="text-[var(--warm-ink)] font-medium">{item.title}</h3>
              <p className="text-[var(--soft-stone)] text-sm">{item.seller} • {item.location}</p>
              <p className="text-[var(--sage)] font-bold mt-2">Rs {item.price?.toLocaleString()}</p>
              <button
                onClick={() => handleBuy(item)}
                className="w-full mt-3 px-4 py-2 bg-[var(--clay)] text-[var(--warm-ink)] rounded-lg text-sm hover:bg-[var(--terracotta)]"
              >
                Buy with Pabandi Protection
              </button>
            </div>
          ))}
        </div>
      </div>

      {showBuyModal && selectedItem && (
        <div className="fixed inset-0 bg-[var(--warm-ink)]/30 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0f1a] border border-[var(--soft-stone)]/30 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-[var(--warm-ink)] font-bold mb-4">Confirm Purchase</h3>
            <div className="bg-[var(--cream)] rounded-lg p-4 mb-4">
              <p className="text-[var(--warm-ink)] font-medium">{selectedItem.title}</p>
              <p className="text-[var(--soft-stone)] text-sm">Seller: {selectedItem.seller}</p>
              <p className="text-[var(--sage)] font-bold mt-2">Rs {selectedItem.price?.toLocaleString()}</p>
            </div>
            <div className="bg-[var(--clay)]/10 border border-[var(--clay)]/30 rounded-lg p-3 mb-4">
              <p className="text-[var(--terracotta)] text-sm">🛡️ Your payment will be held safely. Release only after you receive the item.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={confirmBuy} className="flex-1 px-4 py-2 bg-[var(--clay)] text-[var(--warm-ink)] rounded-lg">Create Escrow</button>
              <button onClick={() => setShowBuyModal(false)} className="flex-1 px-4 py-2 bg-[var(--warm-sand)] text-[var(--warm-ink)] rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
