import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Check } from 'lucide-react';

interface SecureQRCodeProps {
  value: string;
  size?: number;
  label?: string;
  className?: string;
  downloadable?: boolean;
}

export const SecureQRCode: React.FC<SecureQRCodeProps> = ({
  value,
  size = 180,
  label,
  className = '',
  downloadable = true,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  const handleSaveToGallery = async () => {
    if (!dataUrl) return;

    // Telegram Haptic
    try {
      (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch {}

    try {
      // If Web Share API with files is supported (modern mobile)
      if (navigator.share && navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `pabandi-escrow-qr-${Date.now()}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Pabandi Escrow QR Code',
            text: 'Scan this QR code from your gallery/photos in your banking or crypto app',
            files: [file],
          });
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
          return;
        }
      }
    } catch {
      // Fall through to download anchor
    }

    // Direct download anchor
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `pabandi-escrow-qr-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className="p-3 bg-white rounded-2xl shadow-sm border border-[rgba(191,179,163,0.35)] flex items-center justify-center transition-transform hover:scale-[1.01]"
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
        <p className="mt-2 text-xs font-medium text-[var(--soft-stone,#4A3E31)] text-center max-w-[260px]">
          {label}
        </p>
      )}

      {downloadable && dataUrl && (
        <button
          type="button"
          onClick={handleSaveToGallery}
          className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E8D9C5]/50 hover:bg-[#E8D9C5] text-[#2A2520] text-[11px] font-semibold border border-[#BFB3A3]/40 transition-colors focus-visible:ring-2 focus-visible:ring-[#C97B5A] focus-visible:outline-none"
        >
          {saved ? (
            <>
              <Check size={12} className="text-emerald-700" aria-hidden="true" />
              <span className="text-emerald-800 font-bold">Saved! Open Gallery to Scan</span>
            </>
          ) : (
            <>
              <Download size={12} className="text-[#C97B5A]" aria-hidden="true" />
              <span>Save QR to Photos (Scan from Gallery)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default SecureQRCode;
