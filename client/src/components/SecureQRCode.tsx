import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface SecureQRCodeProps {
  value: string;
  size?: number;
  label?: string;
  className?: string;
}

export const SecureQRCode: React.FC<SecureQRCodeProps> = ({
  value,
  size = 180,
  label,
  className = '',
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!value) {
      setDataUrl(null);
      return;
    }

    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: '#2A2520',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setDataUrl(url);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('QR code generation notice:', err);
          setError('Failed to generate visual QR');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className="p-3 bg-white rounded-2xl shadow-sm border border-[rgba(191,179,163,0.35)] flex items-center justify-center"
        style={{ width: size + 24, height: size + 24 }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={label || 'Payment QR Code'}
            width={size}
            height={size}
            className="block rounded-lg"
          />
        ) : error ? (
          <div className="text-center p-2 text-xs text-[var(--soft-stone,#4A3E31)]">
            <span className="block font-semibold mb-1">Visual QR Unavailable</span>
            <span className="text-[10px] break-all">Use the copy button below</span>
          </div>
        ) : (
          <div
            className="animate-pulse bg-neutral-100 rounded-lg"
            style={{ width: size, height: size }}
            aria-label="Generating secure QR code"
          />
        )}
      </div>
      {label && (
        <p className="mt-2 text-xs font-medium text-[var(--soft-stone,#4A3E31)] text-center">
          {label}
        </p>
      )}
    </div>
  );
};

export default SecureQRCode;

