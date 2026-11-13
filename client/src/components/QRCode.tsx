import React from 'react';
import { SecureQRCode } from './SecureQRCode';

interface QRCodeProps {
  value: string;
  size?: number;
  label?: string;
  downloadable?: boolean;
}

export default function QRCode({ value, size = 200, label, downloadable = true }: QRCodeProps) {
  return (
    <div className="flex flex-col items-center">
      <SecureQRCode value={value} size={size} label={label} downloadable={downloadable} />
    </div>
  );
}
