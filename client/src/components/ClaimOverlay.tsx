import { useState } from 'react';

type ClaimOverlayProps = {
  show: boolean;
  businessName: string;
  onClose: () => void;
  onSubmit: (phone: string) => void;
};

export const ClaimOverlay = ({ show, businessName, onClose, onSubmit }: ClaimOverlayProps) => {
  const [phone, setPhone] = useState('');

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Claim Listing</p>
            <h2 className="font-headline text-xl font-bold text-on-surface">{businessName}</h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            ×
          </button>
        </div>

        <p className="font-body text-sm text-on-surface-variant mb-4">
          Enter your business WhatsApp number to receive a verification link. You’ll be able to manage this listing, respond to reviews, and accept reservations.
        </p>

        <div className="bg-surface border border-outline-variant/30 rounded-xl p-4 mb-4">
          <p className="font-body text-xs text-on-surface-variant mb-2">WhatsApp Number</p>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="+92 300 1234567"
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container p-3 text-sm"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-surface border border-outline-variant/40 text-sm font-bold text-on-surface-variant">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(phone)}
            className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-sm font-bold"
          >
            Send Claim Link
          </button>
        </div>
      </div>
    </div>
  );
};
