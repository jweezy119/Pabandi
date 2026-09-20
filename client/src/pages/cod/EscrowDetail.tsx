import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/cod', label: 'Marketplace', icon: '🛍️', end: true },
  { path: '/cod/my-escrows', label: 'My Escrows', icon: '📋' },
];

const STEPS = [
  { key: 'PENDING', label: 'Pending Payment' },
  { key: 'PAID', label: 'Payment Received' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'RELEASED', label: 'Completed' },
];

export default function EscrowDetail() {
  const { id } = useParams();
  const [escrow, setEscrow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  useEffect(() => { loadEscrow(); }, [id]);

  const loadEscrow = async () => {
    try {
      const res = await api.get(`/api/v1/cod/${id}`);
      setEscrow(res.data?.data);
    } catch (e) {
      console.error('Failed to load escrow', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, data?: any) => {
    try {
      await api.post(`/api/v1/cod/${id}/${action}`, data);
      loadEscrow();
    } catch (e: any) {
      alert('Action failed: ' + e.message);
    }
  };

  if (loading) {
    return (
      <DashboardLayout osName="Pabandi Pay" osIcon="🛡️" osColor="violet" navItems={navItems}>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!escrow) {
    return (
      <DashboardLayout osName="Pabandi Pay" osIcon="🛡️" osColor="violet" navItems={navItems}>
        <div className="text-center text-gray-400 py-12">Escrow not found</div>
      </DashboardLayout>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === escrow.status);

  return (
    <DashboardLayout osName="Pabandi Pay" osIcon="🛡️" osColor="violet" navItems={navItems}>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Transaction #{escrow.id?.slice(0, 8)}</h1>
        
        {/* Stepper */}
        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, idx) => (
              <div key={step.key} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  idx <= currentStepIndex
                    ? 'bg-violet-500 text-white'
                    : 'bg-white/10 text-gray-500'
                }`}>
                  {idx < currentStepIndex ? '✓' : idx + 1}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`w-8 md:w-16 h-0.5 mx-1 ${
                    idx < currentStepIndex ? 'bg-violet-500' : 'bg-white/10'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            {STEPS.map((step) => (
              <span key={step.key} className="hidden md:block">{step.label}</span>
            ))}
          </div>
          <p className="text-violet-300 text-sm mt-4 text-center font-medium">
            Current Status: {STEPS[currentStepIndex]?.label}
          </p>
        </div>

        {/* Transaction Info */}
        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Buyer</p>
              <p className="text-white">{escrow.buyer?.firstName} {escrow.buyer?.lastName}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Seller</p>
              <p className="text-white">{escrow.seller?.firstName} {escrow.seller?.lastName}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Amount</p>
              <p className="text-emerald-400 font-bold">Rs {escrow.amount?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Status</p>
              <p className="text-white">{escrow.status}</p>
            </div>
          </div>
          {escrow.shippingAddress && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-gray-400 text-sm">Shipping Address</p>
              <p className="text-white">{escrow.shippingAddress}</p>
            </div>
          )}
          {escrow.trackingNumber && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-gray-400 text-sm">Tracking Number</p>
              <p className="text-white">{escrow.trackingNumber}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-6">
          <h3 className="text-white font-bold mb-4">Actions</h3>
          <div className="flex flex-wrap gap-3">
            {escrow.status === 'PENDING' && (
              <button
                onClick={() => handleAction('pay')}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600"
              >
                Pay into Escrow
              </button>
            )}
            {escrow.status === 'PAID' && (
              <button
                onClick={() => handleAction('ship', { trackingNumber: prompt('Enter tracking number:') || 'TRK-' + Date.now() })}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"
              >
                Confirm Shipment
              </button>
            )}
            {escrow.status === 'SHIPPED' && (
              <button
                onClick={() => handleAction('deliver')}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600"
              >
                Confirm Delivery
              </button>
            )}
            {escrow.status === 'DELIVERED' && (
              <button
                onClick={() => handleAction('release')}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600"
              >
                Release Funds
              </button>
            )}
            {['PAID', 'SHIPPED', 'DELIVERED'].includes(escrow.status) && (
              <button
                onClick={() => setShowDisputeForm(true)}
                className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30"
              >
                Raise Dispute
              </button>
            )}
          </div>
        </div>

        {/* Dispute Form */}
        {showDisputeForm && (
          <div className="bg-[#0a0f1a] border border-red-500/30 rounded-xl p-6">
            <h3 className="text-red-300 font-bold mb-4">Raise Dispute</h3>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Describe the issue..."
              rows={3}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white mb-3"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { handleAction('dispute', { reason: disputeReason }); setShowDisputeForm(false); }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm"
              >
                Submit Dispute
              </button>
              <button onClick={() => setShowDisputeForm(false)} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
