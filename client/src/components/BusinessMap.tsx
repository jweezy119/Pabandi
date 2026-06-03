interface BusinessMapProps {
  latitude: number;
  longitude: number;
  name?: string;
  zoom?: number;
}

export default function BusinessMap({ latitude, longitude, name, zoom = 15 }: BusinessMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
    return (
      <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-[#a0a0a0] rounded-xl border border-outline-variant/30">
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <span className="material-symbols-outlined text-[32px] opacity-40">map</span>
          <p className="text-sm font-medium opacity-60">Map loading…</p>
        </div>
      </div>
    );
  }

  // Use coordinate-based embed for precise global accuracy (USA, Pakistan, anywhere).
  // Falls back to name search if coordinates are zero / not yet set.
  const hasCoords = latitude !== 0 && longitude !== 0;
  const iframeSrc = hasCoords
    ? `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${latitude},${longitude}&zoom=${zoom}&maptype=roadmap`
    : `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(name || 'business')}&zoom=${zoom}`;

  return (
    <iframe
      title={name || 'Business Location'}
      width="100%"
      height="100%"
      style={{ border: 0, borderRadius: '0.75rem' }}
      loading="lazy"
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
      src={iframeSrc}
      className="w-full h-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]"
    />
  );
}
