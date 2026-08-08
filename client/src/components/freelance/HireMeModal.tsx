import React, { useState } from 'react';
import { X, ShieldCheck, CreditCard } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

interface HireMeModalProps {
  isOpen: boolean;
  onClose: () => void;
  freelancerName: string;
  hourlyRate: number;
  businessId: string;
}

export const HireMeModal: React.FC<HireMeModalProps> = ({ isOpen, onClose, freelancerName, hourlyRate, businessId }) => {
  const [estimatedHours, setEstimatedHours] = useState(10);
  const [description, setDescription] = useState('');
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const totalAmount = estimatedHours * hourlyRate;
  const escrowFee = totalAmount * 0.05; // 5% platform escrow fee
  const grandTotal = totalAmount + escrowFee;

  const handleProceed = () => {
    if (!isAuthenticated) {
      // Force login first
      window.location.href = `/api/v1/auth/google?role=customer&returnTo=${window.location.pathname}`;
      return;
    }

    // In a real implementation, we would hit an API to create a Pending Reservation
    // For now, we mock success and redirect to a checkout session or wallet
    alert('Booking generated! In production, this redirects to Escrow Checkout.');
    onClose();
    // navigate(`/checkout/${mockSessionId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity">
      {/* Slide-over panel */}
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right relative">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Hire {freelancerName}</h2>
            <div className="flex items-center text-emerald-600 text-sm mt-1 font-medium">
              <ShieldCheck className="w-4 h-4 mr-1" />
              Pabandi Escrow Protection
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Project Description</label>
            <textarea 
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what you need help with..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Estimated Hours</label>
            <input 
              type="number" 
              min="1"
              value={estimatedHours}
              onChange={e => setEstimatedHours(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
            />
            <p className="text-xs text-slate-500 mt-2">Freelancer's Rate: ${hourlyRate}/hr</p>
          </div>

          <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
            <h3 className="font-semibold text-indigo-900 mb-3">Escrow Summary</h3>
            <div className="space-y-2 text-sm text-indigo-800">
              <div className="flex justify-between">
                <span>Project Milestone ({estimatedHours} hrs)</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-indigo-600">
                <span>Pabandi Trust Fee (5%)</span>
                <span>${escrowFee.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-indigo-200 flex justify-between font-bold text-lg mt-2">
                <span>Total Escrow Deposit</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white">
          <button 
            onClick={handleProceed}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2 shadow-lg shadow-indigo-200"
          >
            <CreditCard className="w-5 h-5" />
            Lock Funds in Escrow
          </button>
          <p className="text-xs text-center text-slate-400 mt-3">
            Funds are held securely by Pabandi and only released upon milestone completion.
          </p>
        </div>
      </div>
    </div>
  );
};
