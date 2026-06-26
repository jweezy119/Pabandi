import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface BusinessMapProps {
  latitude?: number;
  longitude?: number;
  name?: string;
  zoom?: number;
}

export default function BusinessMap({ latitude = 0, longitude = 0, name }: BusinessMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const hasCoords = latitude !== 0 && longitude !== 0;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [longitude, latitude],
      zoom: hasCoords ? 15 : 2,

    });

    mapRef.current = map;

    if (hasCoords) {
      new maplibregl.Marker({ color: '#14F195' })
        .setLngLat([longitude, latitude])
        .setPopup(new maplibregl.Popup().setText(name || 'Business Location'))
        .addTo(map);
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, name]);

  const hasCoords = latitude !== 0 && longitude !== 0;

  return (
    <div ref={containerRef} className="w-full h-full relative rounded-xl overflow-hidden">
      {!hasCoords && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-container text-on-surface-variant text-xs">
          No coordinates available for this business.
        </div>
      )}
      {hasCoords && (
        <a
          href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white text-gray-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-full shadow-md hover:bg-gray-50 transition-colors z-10"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Open in Maps
        </a>
      )}
    </div>
  );
}
