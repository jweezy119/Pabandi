interface QRCodeProps {
  value: string;
  size?: number;
  label?: string;
}

export default function QRCode({ value, size = 200, label }: QRCodeProps) {
  const encoded = encodeURIComponent(value);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=FFFFFF&color=1a1a2e&margin=10`;

  return (
    <div className="flex flex-col items-center">
      <div className="bg-white p-3 rounded-xl shadow-lg">
        <img
          src={qrUrl}
          alt="Check-in QR Code"
          width={size}
          height={size}
          className="block"
        />
      </div>
      {label && (
        <p className="mt-3 text-sm text-purple-200 font-medium">{label}</p>
      )}
    </div>
  );
}
