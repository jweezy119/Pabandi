import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/cod', label: 'Marketplace', icon: '🛍️', end: true },
  { path: '/cod/my-escrows', label: 'My Escrows', icon: '📋' },
];

export default function CreateEscrow() {
  const [form, setForm] = useState({
    productName: '',
    amount: '',
    shippingAddress: '',
    description: '',
    terms: '',
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/v1/cod/create', {
        sellerId: 'current-user', // Would come from auth context
        amount: parseFloat(form.amount),
        description: form.productName,
        shippingAddress: form.shippingAddress,
      });
      setCreated(true);
    } catch (e: any) {
      alert('Failed to create escrow: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <DashboardLayout osName="Pabandi Pay" osIcon="🛡️" osColor="violet" navItems={navItems}>
        <div className="max-w-md mx-auto text-center py-12">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">Escrow Created!</h2>
          <p className="text-gray-400 mb-4">Share this link with your buyer/seller:</p>
          <div className="bg-[#0a0f1a] border border-white/10 rounded-lg p-4">
            <code className="text-emerald-400 text-sm">https://pabandi.app/cod/escrow/abc123</code>
          </div>
          <button onClick={() => setCreated(false)} className="mt-6 px-4 py-2 bg-violet-500 text-white rounded-lg">
            Create Another
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout osName="Pabandi Pay" osIcon="🛡️" osColor="violet" navItems={navItems}>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Create COD Escrow</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">Product Name</label>
            <input
              type="text"
              value={form.productName}
              onChange={(e) => setForm({...form, productName: e.target.value})}
              placeholder="e.g., iPhone 15 Pro"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              required
            />
          </div>
          
          <div>
            <label className="text-gray-400 text-sm block mb-1">Amount (PKR)</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({...form, amount: e.target.value})}
              placeholder="250000"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              required
            />
          </div>
          
          <div>
            <label className="text-gray-400 text-sm block mb-1">Shipping Address</label>
            <textarea
              value={form.shippingAddress}
              onChange={(e) => setForm({...form, shippingAddress: e.target.value})}
              placeholder="Full delivery address"
              rows={3}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              required
            />
          </div>
          
          <div>
            <label className="text-gray-400 text-sm block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({...form, description: e.target.value})}
              placeholder="Product details, condition, etc."
              rows={3}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
            />
          </div>
          
          <div>
            <label className="text-gray-400 text-sm block mb-1">Terms & Conditions</label>
            <textarea
              value={form.terms}
              onChange={(e) => setForm({...form, terms: e.target.value})}
              placeholder="Return policy, warranty info, etc."
              rows={2}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
            />
          </div>
          
          <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-3">
            <p className="text-violet-300 text-sm">🛡️ Pabandi will hold the payment until delivery is confirmed.</p>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-violet-500 text-white rounded-lg font-medium hover:bg-violet-600 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create & Share Link'}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
