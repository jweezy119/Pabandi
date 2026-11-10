import React from 'react';
import { SecureQRCode } from './SecureQRCode';

export interface RaastQRProps {
  amount: number;
  merchantId: string;
  description?: string;
  reference?: string;
}

export const RaastQR: React.FC<RaastQRProps> = ({ amount, merchantId, description, reference }) => {
  const raastPayload = `raast:${merchantId}?amount=${amount}${reference ? `&ref=${encodeURIComponent(reference)}` : ''}`;

  return (
    <div
      role="region"
      aria-label="Raast Payment QR Code"
      className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-3"
    >
      <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
        <span>RAAST INSTANT PAYMENT</span>
        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">0% Fee</span>
      </div>

      <div className="flex justify-center">
        <SecureQRCode
          value={raastPayload}
          size={140}
          label="Scan with any banking app supporting Raast"
        />
      </div>

      <div className="text-xs space-y-1 text-[#2A2520]">
        <p>
          Amount: <span className="font-bold text-emerald-700">Rs. {amount.toLocaleString()} PKR</span>
        </p>
        <p className="text-[11px] text-[#5C5248] font-mono">
          Merchant: {merchantId}
        </p>
        {reference && (
          <p className="text-[11px] text-[#C97B5A] font-mono">
            Ref: {reference}
          </p>
        )}
        {description && (
          <p className="text-[11px] text-[#5C5248]">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default RaastQR;
