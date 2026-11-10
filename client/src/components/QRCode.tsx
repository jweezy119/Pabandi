import React from 'react';
import { SecureQRCode } from './SecureQRCode';

interface QRCodeProps {
  value: string;
  size?: number;
  label?: string;
}

export default function QRCode({ value, size = 200, label }: QRCodeProps) {
  return (
    <div className="flex flex-col items-center">
      <SecureQRCode value={value} size={size} label={label} />
    </div>
  );
}
