interface BusinessMapProps {
  latitude: number;
  longitude: number;
  name?: string;
  zoom?: number;
}

export default function BusinessMap({ latitude, longitude, name, zoom = 15 }: BusinessMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
    // Graceful fallback if API key isn't loaded yet
    return (
      <div className="w-full h-full bg-surface-container-low flex items-center justify-center text-on-surface-variant rounded-xl border border-outline-variant/30">
        <div className="flex flex-col items-center">
            <span className="material-symbols-outlined text-[32px] mb-2 opacity-50">map</span>
            <p className="text-sm font-medium">Map loading...</p>
        </div>
      </div>
    );
  }

  // Uses Google's official Native Iframe Embed API - No NPM packages required!
  const encodedName = name ? encodeURIComponent(name) : `${latitude},${longitude}`;
  const iframeSrc = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedName}&zoom=${zoom}`;

  return (
    <iframe
      title={name || "Business Location"}
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
