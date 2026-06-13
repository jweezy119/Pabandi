const GOOGLE_NEIGHBORHOOD_MAP_SRC =
  'https://storage.googleapis.com/maps-solutions-0ken1ouk5c/neighborhood-discovery/sms4/neighborhood-discovery.html';

interface BusinessMapProps {
  latitude?: number;
  longitude?: number;
  name?: string;
  zoom?: number;
}

export default function BusinessMap({ latitude = 0, longitude = 0, name }: BusinessMapProps) {
  const hasCoords = latitude !== 0 && longitude !== 0;

  // ── 1. Google Neighborhood Discovery map (always primary) ─────────────────
  // This is the embed Google provided. We overlay a coordinate-specific marker
  // link beneath it so users can jump to the exact business location.
  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden">
      <iframe
        src={GOOGLE_NEIGHBORHOOD_MAP_SRC}
        title={name || 'Business Location'}
        width="100%"
        height="100%"
        style={{ border: 0, borderRadius: '0.75rem' }}
        loading="lazy"
        allowFullScreen
        className="w-full h-full"
      />

      {/* Floating "Open in Maps" chip — links to the exact business coords or name */}
      {(hasCoords || name) && (
        <a
          href={
            hasCoords
              ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name || '')}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white text-gray-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-full shadow-md hover:bg-gray-50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Open in Maps
        </a>
      )}
    </div>
  );
}
